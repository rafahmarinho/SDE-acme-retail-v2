/**
 * Request proxy (Next.js 16 "proxy", formerly middleware).
 * 1. Per-request CSP nonce: Next.js applies it to its own scripts (T66, T36, T37, T279).
 * 2. Refreshes the Supabase session cookie (validated with getUser) - convenience only;
 *    authorization is enforced in pages, actions, route handlers and Postgres (T17).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS } from "@/db/cookie-options";
import { buildCsp } from "@/lib/csp";
import { publicEnv, supabaseOrigin } from "@/lib/env";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({
    nonce,
    supabaseOrigin,
    dev: process.env.NODE_ENV === "development",
    stripe: process.env.PAYMENT_PROVIDER === "stripe",
  });

  const forwardHeaders = () => {
    const h = new Headers(request.headers);
    h.set("x-nonce", nonce);
    h.set("content-security-policy", csp);
    h.set("x-pathname", request.nextUrl.pathname); // lets layouts build a precise login `next`
    return h;
  };

  let response = NextResponse.next({ request: { headers: forwardHeaders() } });

  const supabase = createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: forwardHeaders() } });
        for (const { name, value, options } of list) response.cookies.set(name, value, { ...options, ...AUTH_COOKIE_OPTIONS });
      },
    },
  });
  await supabase.auth.getUser();

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|api/webhooks|api/health).*)"],
};
