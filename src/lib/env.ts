/**
 * Public (browser-safe) environment, validated at load time (T2599, T21).
 * Only NEXT_PUBLIC_* values may live here - never secrets (T76).
 */
import { z } from "zod";

/** HTTPS is required, except for loopback hosts (local Supabase stack), which never leave the machine. */
export function isSecureOrLoopback(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === "https:") return true;
    return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

const PublicEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .refine(isSecureOrLoopback, "NEXT_PUBLIC_SUPABASE_URL must use HTTPS"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

export const publicEnv = PublicEnv.parse({
  // referenced literally so Next.js can inline them in the client bundle
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

export const supabaseOrigin = new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).origin;
