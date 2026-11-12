---
name: t17-server-side-authorization
description: Enforce role checks (customer, catalog, warehouse, finance, admin) on the server and in Postgres RLS, never only in React navigation or client components.
---

# T17: Do not only rely on client-side authorization

**Category:** CODE_FIX
**SD Elements:** [T17](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T17/)
**Priority:** 8

**Spec Context:**
> "Adapte a navegação aos perfis de usuário." ... "além do painel de produtos, estoque, pedidos e reembolsos ... Tenha perfis de cliente, catálogo, estoque, financeiro e administrador."
> Source: specs/PRD.md, lines 13-15, 25-27, 37-39

**What the spec implies (naive approach):**
Hide back-office menu items when `user.role !== "admin"` in a client component, while the `/admin/*` pages, server actions and API routes still serve anyone who browses to them directly.

**Secure Implementation Pattern:**
```ts
// src/lib/authz.ts
import "server-only";
import { createServerClient } from "@/lib/supabase/server";

export type Role = "customer" | "catalog" | "warehouse" | "finance" | "admin";

export async function requireRole(...allowed: Role[]) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthzError(401);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !allowed.includes(profile.role)) throw new AuthzError(403);
  return { user, role: profile.role as Role };
}

// usage in a server action
export async function issueRefund(input: unknown) {
  await requireRole("finance", "admin");
  // ...
}
```

**Implementation Guidance:**
- Treat role-based navigation as UX only. Call `requireRole()` at the top of every server action, route handler and back-office `page.tsx` / `layout.tsx`.
- Read roles from the `profiles` table (or a custom JWT claim set by a Postgres auth hook), never from client-supplied input.
- Mirror every rule in Postgres RLS (see T2598) so that direct Supabase REST calls with the anon key are also denied.
- Keep a role-to-permission matrix in `docs/authz.md`: catalog for products, warehouse for inventory and shipments, finance for refunds, admin for everything plus simulation.

**Success Criteria:**
- [ ] Every back-office route and action calls `requireRole`
- [ ] A customer session receives 403 on `/admin/*` and on refund actions
- [ ] Direct PostgREST calls are blocked by RLS for unauthorized roles

**Status:** Pending
