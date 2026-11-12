import "server-only";
import { headers } from "next/headers";
import { createHmac, hkdfSync } from "node:crypto";
import { serverEnv } from "./env.server";

/** Client IP as seen by Vercel's edge (x-forwarded-for first hop) - used only as a rate-limit key. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (fwd || h.get("x-real-ip") || "unknown").slice(0, 64);
}

let pseudonymKey: Buffer | undefined;

/**
 * Keyed pseudonym for logs, audit entries and rate-limit keys (T744, T60): an HMAC-SHA-256 whose
 * key is derived with HKDF from a server-only secret, under a dedicated purpose label. Unlike a
 * bare hash, it can't be reversed by hashing a list of known emails.
 */
export function pseudonym(value: string): string {
  pseudonymKey ??= Buffer.from(
    hkdfSync("sha256", serverEnv().SUPABASE_SERVICE_ROLE_KEY, "acme-retail", "audit-pseudonym-v1", 32),
  );
  return createHmac("sha256", pseudonymKey).update(value.trim().toLowerCase()).digest("hex").slice(0, 16);
}
