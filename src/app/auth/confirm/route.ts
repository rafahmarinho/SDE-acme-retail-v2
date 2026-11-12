/**
 * Email link handler (recovery, sign-up confirmation, email change). Verifies the one-time
 * token hash with Supabase (single use, 30-minute expiry) and redirects to a validated path (T2, T37).
 */
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient } from "@/db/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { serverEnv } from "@/lib/env.server";

const TYPES: EmailOtpType[] = ["recovery", "signup", "email", "email_change", "invite", "magiclink"];

export async function GET(request: NextRequest) {
  const base = serverEnv().APP_BASE_URL;
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"), "/account");
  if (!tokenHash || !/^[A-Za-z0-9_-]{10,200}$/.test(tokenHash) || !type || !TYPES.includes(type)) {
    return NextResponse.redirect(new URL("/login?error=link", base), 303);
  }
  const supabase = await createServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return NextResponse.redirect(new URL("/forgot-password?expired=1", base), 303);
  return NextResponse.redirect(new URL(type === "recovery" ? "/account/update-password" : next, base), 303);
}
