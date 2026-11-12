"use server";
/**
 * Storefront actions: cart quotes, favorites, checkout and simulated payment.
 * Prices/totals are computed server-side; payment outcomes are decided in Postgres (T558).
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Quote } from "@/db/types";
import { fail, type ActionResult } from "@/lib/errors";
import { Address, CartLines, CouponCode, PaymentScenario, ShippingMethod, Uuid } from "@/lib/schemas";
import { assertUser } from "@/services/auth";
import { quoteCart } from "@/services/cart";
import { toggleFavorite } from "@/services/catalog";
import { placeOrder } from "@/services/checkout";
import { activeProvider, completeChallenge, createStripeCheckout, paySimulated } from "@/services/payments";
import { saveAddress } from "@/services/users";

export async function quoteCartAction(
  lines: unknown,
  coupon: string | null,
  method: string,
): Promise<{ ok: true; quote: Quote | null } | { ok: false; error: string }> {
  const parsedLines = CartLines.safeParse(lines);
  const parsedCoupon = coupon ? CouponCode.safeParse(coupon) : { success: true as const, data: "" };
  const parsedMethod = ShippingMethod.safeParse(method);
  if (!parsedLines.success || !parsedCoupon.success || !parsedMethod.success) return { ok: false, error: "Invalid cart." };
  try {
    return { ok: true, quote: await quoteCart(parsedLines.data, parsedCoupon.data || null, parsedMethod.data) };
  } catch (err) {
    return fail(err);
  }
}

export async function toggleFavoriteAction(productId: string): Promise<ActionResult<{ favorite: boolean }>> {
  const id = Uuid.safeParse(productId);
  if (!id.success) return { ok: false, error: "Invalid product." };
  try {
    const { user } = await assertUser();
    const favorite = await toggleFavorite(user.id, id.data);
    revalidatePath("/account/favorites");
    return { ok: true, data: { favorite } };
  } catch (err) {
    return fail(err);
  }
}

const CheckoutForm = z.object({
  lines: z
    .string()
    .max(8000)
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid cart" });
        return z.NEVER;
      }
    })
    .pipe(CartLines.min(1, "Your cart is empty")),
  coupon: CouponCode.optional().default(""),
  method: ShippingMethod,
  scenario: PaymentScenario.optional(),
  save_address: z.literal("on").optional(),
});

export async function placeOrderAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const get = (k: string) => form.get(k) ?? undefined;
  const parsed = CheckoutForm.safeParse({
    lines: get("lines"),
    coupon: get("coupon"),
    method: get("method"),
    scenario: get("scenario"),
    save_address: get("save_address"),
  });
  const address = Address.safeParse({
    full_name: get("full_name"),
    line1: get("line1"),
    line2: get("line2"),
    city: get("city"),
    region: get("region"),
    postal_code: get("postal_code"),
    country: get("country"),
  });
  if (!parsed.success || !address.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: { ...(address.success ? {} : z.flattenError(address.error).fieldErrors), ...(parsed.success ? {} : z.flattenError(parsed.error).fieldErrors) },
    };
  }
  const provider = activeProvider();
  if (provider === "simulated" && !parsed.data.scenario) return { ok: false, error: "Please choose a payment option." };

  let destination: string;
  try {
    const { user } = await assertUser();
    const order = await placeOrder({
      lines: parsed.data.lines,
      coupon: parsed.data.coupon || null,
      method: parsed.data.method,
      address: address.data,
      provider,
    });
    if (parsed.data.save_address) await saveAddress(user.id, address.data, true).catch(() => undefined);
    if (provider === "stripe") {
      destination = await createStripeCheckout(order);
    } else {
      // The order (and its stock reservation) exists now; if the payment call itself fails, the
      // result page shows the order as awaiting payment and offers a retry.
      await paySimulated(order.id, parsed.data.scenario!).catch((err) => console.error("[acme] payment call failed", err?.code));
      destination = `/checkout/result/${order.id}`;
    }
  } catch (err) {
    return fail(err);
  }
  revalidatePath("/account/orders");
  redirect(destination);
}

export async function retryPaymentAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const orderId = Uuid.safeParse(form.get("order_id"));
  const scenario = PaymentScenario.safeParse(form.get("scenario"));
  if (!orderId.success || !scenario.success) return { ok: false, error: "Please choose a payment option." };
  try {
    await assertUser();
    await paySimulated(orderId.data, scenario.data);
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/checkout/result/${orderId.data}`);
  return { ok: true };
}

export async function completeChallengeAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const orderId = Uuid.safeParse(form.get("order_id"));
  const outcome = z.enum(["success", "fail"]).safeParse(form.get("outcome"));
  if (!orderId.success || !outcome.success) return { ok: false, error: "Invalid request." };
  try {
    await assertUser();
    await completeChallenge(orderId.data, outcome.data === "success");
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/checkout/result/${orderId.data}`);
  return { ok: true };
}

export async function restartStripeCheckoutAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const orderId = Uuid.safeParse(form.get("order_id"));
  if (!orderId.success) return { ok: false, error: "Invalid request." };
  let url: string;
  try {
    const { user } = await assertUser();
    const { getMyOrder } = await import("@/services/orders");
    const order = await getMyOrder(user.id, orderId.data);
    if (!order || order.payment_provider !== "stripe" || order.status_payment !== "pending" || !order.reservation_expires_at) {
      return { ok: false, error: "This order can no longer be paid." };
    }
    url = await createStripeCheckout({ id: order.id, number: order.number, total: Number(order.total) });
  } catch (err) {
    return fail(err);
  }
  redirect(url);
}
