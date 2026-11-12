/**
 * Inventory (warehouse/admin). Stock levels change only through adjust_inventory(), which keeps
 * on_hand >= reserved and records an event + audit entry (T2602).
 */
import "server-only";
import { createServerClient } from "@/db/server";
import { escapeLike } from "@/db/storage";

export async function listInventory(search: string, lowOnly: boolean, page: number, pageSize = 25) {
  const supabase = await createServerClient();
  let query = supabase
    .from("product_variants")
    .select(`id, sku, name, active, product:products!inner(name, slug), inventory${lowOnly ? "!inner" : ""}(on_hand, reserved)`, {
      count: "exact",
    })
    .order("sku")
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (search) query = query.or(`sku.ilike.${pgrstLike(search)},name.ilike.${pgrstLike(search)}`);
  if (lowOnly) query = query.lte("inventory.on_hand", 5);
  const { data, count, error } = await query;
  if (error) throw error;
  const items = (data ?? []).map((v) => {
    const inv = (Array.isArray(v.inventory) ? v.inventory[0] : v.inventory) as { on_hand: number; reserved: number } | null;
    return { ...v, on_hand: inv?.on_hand ?? 0, reserved: inv?.reserved ?? 0, available: Math.max((inv?.on_hand ?? 0) - (inv?.reserved ?? 0), 0) };
  });
  return { items, total: count ?? 0, pageSize };
}

/**
 * PostgREST `or()` filter values: the search term is restricted to a safe character set before
 * being placed in the filter string, so it can't inject extra filter clauses (T38).
 */
function pgrstLike(term: string): string {
  const safe = escapeLike(term.replace(/[^A-Za-z0-9 \-]/g, "").slice(0, 40));
  return `"*${safe}*"`;
}

export async function adjustInventory(variantId: string, delta: number, reason: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("adjust_inventory", { p_variant_id: variantId, p_delta: delta, p_reason: reason });
  if (error) throw error;
  return data;
}
