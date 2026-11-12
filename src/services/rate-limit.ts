/**
 * IP / account based throttling for login, sign-up and password recovery (T1362, T2).
 * Counters live in Postgres (app.rate_limits) so limits hold across serverless instances.
 * Coupon, checkout and payment limits are enforced inside the database functions themselves.
 */
import "server-only";
import { createAdminClient } from "@/db/admin";
import { AppError } from "@/lib/errors";

export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<void> {
  const admin = createAdminClient("rate-limit");
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_key: key.slice(0, 200),
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[acme] rate limit check failed", error.code);
    throw new AppError("RATE_LIMITED"); // fail closed
  }
  if (!data) throw new AppError("RATE_LIMITED");
}
