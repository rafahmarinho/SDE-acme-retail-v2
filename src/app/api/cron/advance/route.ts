/**
 * Vercel Cron: advances the simulation by one step. Requires ENABLE_SIMULATION=true and the
 * CRON_SECRET bearer token (T49, T558). Compared in constant time (T59).
 */
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/db/admin";
import { json, jsonError } from "@/lib/http";
import { serverEnv } from "@/lib/env.server";

export const maxDuration = 10;

function authorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: NextRequest) {
  const env = serverEnv();
  if (!env.ENABLE_SIMULATION || !env.CRON_SECRET) return jsonError(404, "Not found");
  if (!authorized(request.headers.get("authorization"), env.CRON_SECRET)) return jsonError(401, "Unauthorized");
  const { data, error } = await createAdminClient("cron").rpc("sim_advance", { p_steps: 1 });
  if (error) return jsonError(500, "Simulation step failed");
  return json({ ok: true, summary: data as object });
}
