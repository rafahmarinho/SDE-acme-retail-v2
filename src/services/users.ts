/**
 * Profile, addresses, privacy preferences (T178, T604, T742, T754) and user administration.
 * The email address lives only in auth.users (single source of truth, T742).
 */
import "server-only";
import { createServerClient } from "@/db/server";
import type { AppRole } from "@/db/types";
import type { z } from "zod";
import type { Address } from "@/lib/schemas";

export const POLICY_VERSION = "2026-11";
export const CONSENT_PURPOSES = ["marketing_email", "analytics", "personalization"] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];
export const RESTRICTABLE = ["marketing", "personalization", "analytics"] as const;
export type Restrictable = (typeof RESTRICTABLE)[number];

export async function getProfile(userId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name, phone, role, created_at").eq("id", userId).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, input: { full_name: string; phone: string | null }) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("profiles").update(input).eq("id", userId);
  if (error) throw error;
}

export async function listAddresses(userId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("addresses")
    .select("id, full_name, line1, line2, city, region, postal_code, country, is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at")
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function saveAddress(userId: string, a: z.infer<typeof Address>, makeDefault: boolean) {
  const supabase = await createServerClient();
  if (makeDefault) await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId).eq("is_default", true);
  const { error } = await supabase
    .from("addresses")
    .upsert({ ...a, line2: a.line2 ?? null, region: a.region ?? null, user_id: userId, is_default: makeDefault }, {
      onConflict: "user_id,line1,postal_code,country",
    });
  if (error) throw error;
}

export async function setDefaultAddress(userId: string, addressId: string) {
  const supabase = await createServerClient();
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId).eq("is_default", true);
  const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", addressId).eq("user_id", userId);
  if (error) throw error;
}

export async function deleteAddress(userId: string, addressId: string) {
  const supabase = await createServerClient();
  const { error } = await supabase.from("addresses").delete().eq("id", addressId).eq("user_id", userId);
  if (error) throw error;
}

/** Latest decision per purpose from the append-only consent ledger. */
export async function getConsents(userId: string): Promise<Record<ConsentPurpose, { granted: boolean; at: string | null }>> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("consents")
    .select("purpose, granted, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  const result = Object.fromEntries(CONSENT_PURPOSES.map((p) => [p, { granted: false, at: null }])) as Record<
    ConsentPurpose,
    { granted: boolean; at: string | null }
  >;
  const seen = new Set<string>();
  for (const c of data ?? []) {
    if (seen.has(c.purpose)) continue;
    seen.add(c.purpose);
    result[c.purpose as ConsentPurpose] = { granted: c.granted, at: c.created_at };
  }
  return result;
}

export async function recordConsents(userId: string, decisions: Partial<Record<ConsentPurpose, boolean>>) {
  const rows = Object.entries(decisions).map(([purpose, granted]) => ({
    user_id: userId,
    purpose,
    granted: !!granted,
    policy_version: POLICY_VERSION,
  }));
  if (rows.length === 0) return;
  const supabase = await createServerClient();
  const { error } = await supabase.from("consents").insert(rows);
  if (error) throw error;
}

export async function getRestrictions(userId: string): Promise<Record<Restrictable, boolean>> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("processing_restrictions").select("activity, restricted").eq("user_id", userId);
  const result = { marketing: false, personalization: false, analytics: false };
  for (const r of data ?? []) result[r.activity as Restrictable] = r.restricted;
  return result;
}

export async function setRestriction(userId: string, activity: Restrictable, restricted: boolean) {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("processing_restrictions")
    .upsert({ user_id: userId, activity, restricted, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/**
 * Personalization (e.g. "recommended for you" based on favorites) runs only with consent and
 * without a restriction (T178, T754).
 */
export async function personalizationAllowed(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const [consents, restrictions] = await Promise.all([getConsents(userId), getRestrictions(userId)]);
  return consents.personalization.granted && !restrictions.personalization;
}

export async function listUsers(search: string, page: number, pageSize = 25) {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("admin_list_users", { p_search: search, p_limit: pageSize, p_offset: (page - 1) * pageSize });
  if (error) throw error;
  return { items: data ?? [], total: Number(data?.[0]?.total_count ?? 0), pageSize };
}

export async function setUserRole(userId: string, role: AppRole) {
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("set_user_role", { p_user_id: userId, p_role: role });
  if (error) throw error;
}
