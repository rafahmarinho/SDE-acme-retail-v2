/**
 * Service-role Supabase client - bypasses RLS. Confined to a few audited server-only uses (T19):
 *   rate-limit   -> src/services/rate-limit.ts   (public.check_rate_limit)
 *   audit        -> src/services/audit.ts        (public.audit_write)
 *   payments     -> src/services/payments.ts     (public.mark_order_paid_external, after Stripe verification)
 *   cron         -> src/app/api/cron/advance     (public.sim_advance, CRON_SECRET protected)
 * ESLint forbids importing this module anywhere else (eslint.config.mjs).
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

export type AdminReason = "rate-limit" | "audit" | "payments" | "cron";

export function createAdminClient(reason: AdminReason) {
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-acme-reason": reason } },
  });
}
