/**
 * Stripe webhook (optional adapter, test mode). Authenticated by Stripe's signature, not by
 * cookies/CSRF tokens (T558, T29). Body size limited (T536).
 */
import type { NextRequest } from "next/server";
import { json, jsonError } from "@/lib/http";
import { serverEnv } from "@/lib/env.server";
import { handleStripeWebhook } from "@/services/payments";

export const maxDuration = 10;

export async function POST(request: NextRequest) {
  if (serverEnv().PAYMENT_PROVIDER !== "stripe") return jsonError(404, "Not found");
  if (Number(request.headers.get("content-length") ?? 0) > 256 * 1024) return jsonError(413, "Payload too large");
  const raw = await request.text();
  try {
    await handleStripeWebhook(raw, request.headers.get("stripe-signature"));
    return json({ received: true });
  } catch (err) {
    console.error("[acme] stripe webhook rejected", err instanceof Error ? err.message : "unknown");
    return jsonError(400, "Invalid webhook");
  }
}
