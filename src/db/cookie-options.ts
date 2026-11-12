import type { CookieOptions } from "@supabase/ssr";

/** Supabase auth cookies: httpOnly (not readable by scripts), Secure in production, SameSite=Lax (T20, T29). */
export const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};
