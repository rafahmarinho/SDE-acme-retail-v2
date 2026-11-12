/**
 * Payment providers.
 * - "simulated" (default): approve / decline / authenticate / timeout, no real money. Logic lives in
 *   Postgres (pay_order / complete_payment_challenge) so the client can't fake an outcome.
 * - "stripe" (optional adapter): Stripe Checkout in TEST mode only (sk_test_ keys enforced in env).
 *   Payment is confirmed server-side only - by re-fetching the Checkout Session or via a signed
 *   webhook - never from redirect query parameters (T558, T59).
 */
import "server-only";
import type StripeType from "stripe";
import { createAdminClient } from "@/db/admin";
import { createServerClient } from "@/db/server";
import { serverEnv } from "@/lib/env.server";

export type ProviderId = "simulated" | "stripe";

export function activeProvider(): ProviderId {
  return serverEnv().PAYMENT_PROVIDER;
}

let stripeClient: StripeType | undefined;
async function stripe(): Promise<StripeType> {
  if (stripeClient) return stripeClient;
  const key = serverEnv().STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");
  const { default: Stripe } = await import("stripe"); // static specifier: bundled at build time (T279)
  stripeClient = new Stripe(key, { maxNetworkRetries: 1, timeout: 10_000 });
  return stripeClient;
}

// ---------------------------------------------------------------------------------------------
// Simulated provider
// ---------------------------------------------------------------------------------------------
export async function paySimulated(orderId: string, scenario: "approve" | "decline" | "authenticate" | "timeout") {
  const supabase = await createServerClient();
  // the "timeout" outcome is a stored state - the request never hangs (T35)
  const { data, error } = await supabase.rpc("pay_order", { p_order_id: orderId, p_scenario: scenario });
  if (error) throw error;
  return data;
}

export async function completeChallenge(orderId: string, success: boolean) {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("complete_payment_challenge", { p_order_id: orderId, p_success: success });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------------------------
// Stripe Checkout (test mode)
// ---------------------------------------------------------------------------------------------
export async function createStripeCheckout(order: { id: string; number: string; total: number }): Promise<string> {
  const base = serverEnv().APP_BASE_URL;
  const session = await (await stripe()).checkout.sessions.create({
    mode: "payment",
    client_reference_id: order.id,
    metadata: { order_id: order.id }, // internal reference only - no personal data (T744)
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(order.total * 100),
          product_data: { name: `ACME Retail order ${order.number}` },
        },
      },
    ],
    success_url: `${base}/checkout/result/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/checkout/result/${order.id}?cancelled=1`,
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
  });
  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  return session.url;
}

async function markPaid(orderId: string, providerRef: string) {
  const admin = createAdminClient("payments");
  const { error } = await admin.rpc("mark_order_paid_external", { p_order_id: orderId, p_provider_ref: providerRef });
  if (error) throw error;
}

/** Called from the result page: verifies the session with Stripe (server-to-server). */
export async function confirmStripeSession(orderId: string, sessionId: string): Promise<boolean> {
  if (!/^cs_test_[A-Za-z0-9]+$/.test(sessionId)) return false;
  const session = await (await stripe()).checkout.sessions.retrieve(sessionId);
  if (session.livemode || session.client_reference_id !== orderId || session.payment_status !== "paid") return false;
  await markPaid(orderId, String(session.payment_intent ?? session.id));
  return true;
}

/** Signed webhook (checkout.session.completed). Idempotent: mark_order_paid_external ignores repeats. */
export async function handleStripeWebhook(rawBody: string, signature: string | null): Promise<void> {
  const secret = serverEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) throw new Error("Missing webhook secret or signature");
  const event = (await stripe()).webhooks.constructEvent(rawBody, signature, secret);
  if (event.type !== "checkout.session.completed") return;
  const session = event.data.object as StripeType.Checkout.Session;
  const orderId = session.client_reference_id;
  if (!session.livemode && orderId && session.payment_status === "paid") {
    await markPaid(orderId, String(session.payment_intent ?? session.id));
  }
}
