/**
 * Orders: customer views (RLS: own orders only, T378) and back-office fulfilment (orders:fulfil).
 * State changes go through security definer functions that re-check authorization (T17).
 */
import "server-only";
import { createServerClient } from "@/db/server";
import type { DeliveryStatus, PaymentStatus } from "@/db/types";

const ORDER_SUMMARY = "id, number, created_at, total, refunded_total, status_payment, status_delivery, items:order_items(count)";

export async function listMyOrders(userId: string, page: number, pageSize = 10) {
  const supabase = await createServerClient();
  const { data, count, error } = await supabase
    .from("orders")
    .select(ORDER_SUMMARY, { count: "exact" })
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  return { items: data ?? [], total: count ?? 0, pageSize };
}

const ORDER_DETAIL = `id, number, customer_id, created_at, updated_at, status_payment, status_delivery,
  subtotal, discount, shipping, tax, total, refunded_total, coupon_code, shipping_method, shipping_address,
  payment_provider, payment_scenario, reservation_expires_at, tracking_token, carrier, tracking_number,
  shipped_at, delivered_at, cancelled_at,
  items:order_items(id, product_id, product_name, variant_name, sku, unit_price, qty, line_total, returned_qty),
  returns(id, status, reason, items, amount_suggested, staff_note, created_at),
  refunds(id, amount, reason, created_at, return_id)`;

/** Customer view: the explicit customer_id filter keeps staff accounts from seeing other orders here. */
export async function getMyOrder(userId: string, orderId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("orders").select(ORDER_DETAIL).eq("id", orderId).eq("customer_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getOrderEvents(orderId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, type, data, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export interface TrackingInfo {
  number: string;
  status_delivery: DeliveryStatus;
  carrier: string | null;
  tracking_number: string | null;
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  items: { name: string; variant: string; qty: number }[];
  timeline: { type: string; at: string }[];
}

export async function trackOrder(token: string): Promise<TrackingInfo | null> {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("track_order", { p_token: token });
  if (error) throw error;
  return (data as unknown as TrackingInfo) ?? null;
}

export async function cancelOrder(orderId: string, reason: string) {
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("cancel_order", { p_order_id: orderId, p_reason: reason });
  if (error) throw error;
}

// ---------------------------------------------------------------------------------------------
// Back-office
// ---------------------------------------------------------------------------------------------
export interface OrderFilters {
  number?: string;
  payment?: PaymentStatus;
  delivery?: DeliveryStatus;
  page: number;
}

export async function listOrders(f: OrderFilters, pageSize = 20) {
  const supabase = await createServerClient();
  let query = supabase
    .from("orders")
    .select("id, number, customer_id, created_at, total, refunded_total, status_payment, status_delivery, shipping_method", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((f.page - 1) * pageSize, f.page * pageSize - 1);
  if (f.number) query = query.eq("number", f.number);
  if (f.payment) query = query.eq("status_payment", f.payment);
  if (f.delivery) query = query.eq("status_delivery", f.delivery);
  const { data, count, error } = await query;
  if (error) throw error;
  const names = await customerNames((data ?? []).map((o) => o.customer_id));
  return { items: (data ?? []).map((o) => ({ ...o, customer_name: names.get(o.customer_id) ?? "Customer" })), total: count ?? 0, pageSize };
}

export async function customerNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)].slice(0, 100);
  if (unique.length === 0) return new Map();
  const supabase = await createServerClient();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, p.full_name || "Customer"]));
}

export async function getOrderAdmin(orderId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`${ORDER_DETAIL}, payments(id, provider, scenario, status, amount, provider_ref, created_at)`)
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const names = await customerNames([data.customer_id]);
  return { ...data, customer_name: names.get(data.customer_id) ?? "Customer" };
}

export async function shipOrder(orderId: string, carrier: string, tracking: string | undefined) {
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("ship_order", { p_order_id: orderId, p_carrier: carrier, ...(tracking ? { p_tracking: tracking } : {}) });
  if (error) throw error;
}

export async function markDelivered(orderId: string) {
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("mark_delivered", { p_order_id: orderId });
  if (error) throw error;
}
