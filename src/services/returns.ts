/**
 * Returns & refunds. Customers request returns for their own delivered orders; warehouse reviews
 * and receives; finance issues full or partial refunds (all checks enforced in Postgres).
 */
import "server-only";
import { createServerClient } from "@/db/server";
import type { ReturnStatus } from "@/db/types";
import { customerNames } from "./orders";

export async function requestReturn(orderId: string, items: { order_item_id: string; qty: number }[], reason: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("request_return", { p_order_id: orderId, p_items: items, p_reason: reason });
  if (error) throw error;
  return data;
}

export async function listMyReturns(userId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("returns")
    .select("id, status, reason, items, amount_suggested, staff_note, created_at, order:orders(id, number)")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function listReturns(status: ReturnStatus | undefined, page: number, pageSize = 20) {
  const supabase = await createServerClient();
  let query = supabase
    .from("returns")
    .select("id, order_id, customer_id, status, reason, items, amount_suggested, staff_note, created_at, order:orders(number, total, refunded_total, status_payment)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (status) query = query.eq("status", status);
  const { data, count, error } = await query;
  if (error) throw error;
  const names = await customerNames((data ?? []).map((r) => r.customer_id));
  return { items: (data ?? []).map((r) => ({ ...r, customer_name: names.get(r.customer_id) ?? "Customer" })), total: count ?? 0, pageSize };
}

export async function listRecentRefunds(limit = 20) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("refunds")
    .select("id, amount, reason, created_at, return_id, order:orders(id, number)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function reviewReturn(returnId: string, approve: boolean, note: string | undefined) {
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("review_return", { p_return_id: returnId, p_approve: approve, ...(note ? { p_note: note } : {}) });
  if (error) throw error;
}

export async function receiveReturn(returnId: string) {
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("receive_return", { p_return_id: returnId });
  if (error) throw error;
}

export async function issueRefund(orderId: string, amount: number, reason: string, returnId?: string) {
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("issue_refund", {
    p_order_id: orderId,
    p_amount: amount,
    p_reason: reason,
    ...(returnId ? { p_return_id: returnId } : {}),
  });
  if (error) throw error;
}
