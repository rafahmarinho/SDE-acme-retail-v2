/**
 * User-scoped Supabase client for Server Components, Server Actions and Route Handlers.
 * Uses the anon key + the user's session, so Postgres RLS applies to every query (T19, T378).
 * Session cookies are httpOnly, Secure (in production) and SameSite=Lax (T20, T29, T1468).
 */
import "server-only";
import { cookies } from "next/headers";
import { createServerClient as createSsrClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options";
import { publicEnv } from "@/lib/env";

export async function createServerClient() {
  const store = await cookies();
  return createSsrClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) {
            store.set(name, value, { ...options, ...AUTH_COOKIE_OPTIONS });
          }
        } catch {
          // Called from a Server Component: cookies are refreshed by src/proxy.ts instead.
        }
      },
    },
  });
}

export type ServerClient = Awaited<ReturnType<typeof createServerClient>>;
