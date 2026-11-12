/**
 * Logout (POST only, same-origin check against CSRF - T29). Revokes the refresh token server-side
 * and tells the browser to wipe cookies, storage and cache for this origin (T1539).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/db/server";
import { serverEnv } from "@/lib/env.server";
import { logSecurityEvent } from "@/services/audit";

export async function POST(request: NextRequest) {
  const base = new URL(serverEnv().APP_BASE_URL);
  const origin = request.headers.get("origin");
  if (origin && origin !== base.origin) return new NextResponse("Forbidden", { status: 403 });
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.auth.signOut();
  if (user) await logSecurityEvent("auth.logout", user.id, {}, user.id);
  const res = NextResponse.redirect(new URL("/", base), 303);
  res.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
  res.headers.set("Cache-Control", "no-store");
  return res;
}
