import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !anonKey || !serviceKey) throw new Error("Integration tests need .env.local with the local Supabase keys (pnpm db:start)");

export type Client = SupabaseClient<Database>;
type Role = Database["public"]["Enums"]["app_role"];
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export const admin: Client = createClient<Database>(url, serviceKey, opts);
export const anon = (): Client => createClient<Database>(url, anonKey, opts);

const created: string[] = [];

export async function makeUser(role: Role): Promise<{ id: string; email: string; password: string; client: Client }> {
  const email = `it-${role}-${randomUUID().slice(0, 8)}@example.test`;
  const password = `It-${randomBytes(9).toString("base64url")}9a`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `IT ${role}` } });
  if (error) throw error;
  created.push(data.user.id);
  if (role !== "customer") {
    const { error: e } = await admin.from("profiles").update({ role }).eq("id", data.user.id);
    if (e) throw e;
  }
  const client = createClient<Database>(url, anonKey, opts);
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;
  return { id: data.user.id, email, password, client };
}

export async function cleanupUsers() {
  if (created.length === 0) return;
  // orders restrict user deletion; remove the test users' orders first (cascades items/payments/returns)
  const { data: orders } = await admin
    .from("orders")
    .select("id, reservation_expires_at, items:order_items(variant_id, qty)")
    .in("customer_id", created);
  for (const o of orders ?? []) {
    if (!o.reservation_expires_at) continue;
    // release stock still reserved by unfinished test checkouts
    for (const it of o.items) {
      if (!it.variant_id) continue;
      const inv = await inventoryOf(it.variant_id);
      await admin.from("inventory").update({ reserved: Math.max(inv.reserved - it.qty, 0) }).eq("variant_id", it.variant_id);
    }
  }
  const ids = (orders ?? []).map((o) => o.id);
  if (ids.length) await admin.from("orders").delete().in("id", ids);
  for (const id of created) await admin.auth.admin.deleteUser(id);
  created.length = 0;
}

export const ADDRESS = { full_name: "Test Customer", line1: "100 Test Street", city: "Springfield", region: "IL", postal_code: "62701", country: "US" };

/** A variant with plenty of available stock. */
export async function stockedVariant(minAvailable = 15) {
  const { data, error } = await admin
    .from("inventory")
    .select("variant_id, on_hand, reserved, variant:product_variants!inner(id, price, active, product:products!inner(base_price, active))")
    .gte("on_hand", minAvailable + 5)
    .limit(50);
  if (error) throw error;
  const hit = (data ?? []).find((r) => {
    const v = Array.isArray(r.variant) ? r.variant[0] : r.variant;
    const p = v && (Array.isArray(v.product) ? v.product[0] : v.product);
    return v?.active && p?.active && r.on_hand - r.reserved >= minAvailable;
  });
  if (!hit) throw new Error("No stocked variant found - run pnpm db:seed");
  const v = Array.isArray(hit.variant) ? hit.variant[0] : hit.variant;
  const p = Array.isArray(v!.product) ? v!.product[0] : v!.product;
  return { variantId: hit.variant_id, price: Number(v!.price ?? p!.base_price) };
}

export async function inventoryOf(variantId: string) {
  const { data } = await admin.from("inventory").select("on_hand, reserved").eq("variant_id", variantId).single();
  return data!;
}

export async function placeOrder(client: Client, variantId: string, qty = 1, coupon = "") {
  const { data, error } = await client.rpc("place_order", {
    p_items: [{ variant_id: variantId, qty }],
    p_coupon: coupon,
    p_method: "standard",
    p_address: ADDRESS,
    p_provider: "simulated",
  });
  if (error) throw error;
  return data as string;
}

export async function orderOf(id: string) {
  const { data } = await admin
    .from("orders")
    .select("id, status_payment, status_delivery, total, refunded_total, reservation_expires_at, tracking_token")
    .eq("id", id)
    .single();
  return data!;
}
