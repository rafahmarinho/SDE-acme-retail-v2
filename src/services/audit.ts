/**
 * Security event logging to the append-only audit trail (T349, T2602).
 * Details must never contain secrets or raw PII - use pseudonym() for identifiers (T744).
 */
import "server-only";
import { createAdminClient } from "@/db/admin";
import { createServerClient } from "@/db/server";
import type { Json } from "@/db/types";

export async function logSecurityEvent(
  action: string,
  target: string | null,
  details: Record<string, Json> = {},
  actorId: string | null = null,
): Promise<void> {
  try {
    const admin = createAdminClient("audit");
    // The generated types mark p_actor / p_target as non-nullable; SQL accepts NULL.
    await admin.rpc("audit_write", {
      p_actor: actorId as string,
      p_action: action,
      p_target: target as string,
      p_details: details,
    });
  } catch (err) {
    console.error("[acme] audit write failed", err instanceof Error ? err.message : "unknown");
  }
}

export async function listAudit(page: number, action?: string) {
  const pageSize = 50;
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("admin_audit_log", {
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
    ...(action ? { p_action: action } : {}),
  });
  if (error) throw error;
  return { items: data ?? [], total: Number(data?.[0]?.total_count ?? 0), pageSize };
}
