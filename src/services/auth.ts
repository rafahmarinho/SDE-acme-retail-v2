/**
 * Authentication & authorization context (T17, T338, T20).
 * - The user is validated with supabase.auth.getUser() (server round-trip), never getSession().
 * - Role and permissions come from Postgres (my_permissions) - the same map RLS uses.
 * - Every page, Server Action and Route Handler calls one of these guards itself; layouts and
 *   navigation are UX only.
 */
import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerClient } from "@/db/server";
import { AppError } from "@/lib/errors";
import type { Permission, Role } from "@/lib/permissions";

export interface AuthContext {
  user: User | null;
  role: Role | null;
  permissions: Permission[];
  fullName: string;
}
export type SignedIn = AuthContext & { user: User; role: Role };

export const getAuth = cache(async (): Promise<AuthContext> => {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null, permissions: [], fullName: "" };
  const [{ data: perms }, { data: profile }] = await Promise.all([
    supabase.rpc("my_permissions"),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  const p = (perms ?? {}) as { role?: Role | null; permissions?: Permission[] };
  return { user, role: p.role ?? "customer", permissions: p.permissions ?? [], fullName: profile?.full_name ?? "" };
});

export const can = (auth: AuthContext, p: Permission) => auth.permissions.includes(p);

/** Pages: redirect anonymous users to login (with a validated `next`). */
export async function requireUser(next: string): Promise<SignedIn> {
  const auth = await getAuth();
  if (!auth.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return auth as SignedIn;
}

/** Pages: 404 for users without the permission (doesn't reveal that the page exists). */
export async function requirePagePermission(p: Permission, next: string): Promise<SignedIn> {
  const auth = await requireUser(next);
  if (!can(auth, p)) notFound();
  return auth;
}

/** Server Actions / Route Handlers. */
export async function assertUser(): Promise<SignedIn> {
  const auth = await getAuth();
  if (!auth.user) throw new AppError("NOT_AUTHENTICATED");
  return auth as SignedIn;
}

export async function assertPermission(p: Permission): Promise<SignedIn> {
  const auth = await assertUser();
  if (!can(auth, p)) throw new AppError("FORBIDDEN");
  return auth;
}

/** Step-up check for sensitive actions: the user must have signed in within `minutes` (T338, T49). */
export function assertRecentAuth(user: User, minutes: number): void {
  const last = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0;
  if (Date.now() - last > minutes * 60_000) throw new AppError("REAUTH_REQUIRED");
}
