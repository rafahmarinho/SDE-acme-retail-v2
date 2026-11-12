/**
 * Cart pricing. The browser only stores {variantId, qty}; prices, coupons, shipping and tax are
 * always computed by Postgres (app.price_cart) - client values are never trusted (T1468).
 */
import "server-only";
import { createServerClient } from "@/db/server";
import type { Quote } from "@/db/types";
import type { CartLineT } from "@/lib/schemas";

export async function quoteCart(lines: CartLineT[], coupon: string | null, method: "standard" | "express"): Promise<Quote | null> {
  if (lines.length === 0) return null;
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("quote_cart", {
    p_items: lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
    p_coupon: coupon ?? undefined,
    p_method: method,
  });
  if (error) throw error;
  return data as unknown as Quote;
}
