/**
 * Checkout: place_order() re-prices the cart in Postgres, validates the address and coupon,
 * reserves stock atomically for 15 minutes and snapshots the unit prices used (PRD).
 */
import "server-only";
import { createServerClient } from "@/db/server";
import type { z } from "zod";
import type { Address, CartLineT } from "@/lib/schemas";
import type { ProviderId } from "./payments";

export async function placeOrder(input: {
  lines: CartLineT[];
  coupon: string | null;
  method: "standard" | "express";
  address: z.infer<typeof Address>;
  provider: ProviderId;
}): Promise<{ id: string; number: string; total: number }> {
  const supabase = await createServerClient();
  const { data: id, error } = await supabase.rpc("place_order", {
    p_items: input.lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
    p_coupon: input.coupon ?? "",
    p_method: input.method,
    p_address: input.address,
    p_provider: input.provider,
  });
  if (error) throw error;
  const { data: order, error: readErr } = await supabase.from("orders").select("id, number, total").eq("id", id).single();
  if (readErr) throw readErr;
  return order;
}
