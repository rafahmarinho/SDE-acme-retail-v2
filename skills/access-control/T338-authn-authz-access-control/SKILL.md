---
name: t338-authn-authz-access-control
description: Implement a central authentication and role-based authorization system for all ACME Retail resources, with step-up checks for sensitive operations and easy logout.
---

# T338: Control access to resources through user authentication and authorization

**Category:** CODE_FIX
**SD Elements:** [T338](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T338/)
**Priority:** 7

**Spec Context:**
> "login por e-mail e senha ... Inclua login, recuperação de senha, perfil, configurações ... Tenha perfis de cliente, catálogo, estoque, financeiro e administrador."
> Source: specs/PRD.md, lines 5-11, 37-39

**What the spec implies (naive approach):**
Authentication is checked ad hoc in some pages. Sensitive actions (refunds, data reset, role changes, email change) need nothing more than an old session, and some pages have no logout.

**Secure Implementation Pattern:**
```ts
// src/lib/authz.ts (extends T17)
const PERMISSIONS = {
  "catalog:write":   ["catalog", "admin"],
  "inventory:write": ["warehouse", "admin"],
  "orders:ship":     ["warehouse", "admin"],
  "refunds:issue":   ["finance", "admin"],
  "simulation:run":  ["admin"],
  "users:manage":    ["admin"],
} as const satisfies Record<string, Role[]>;

export async function requirePermission(p: keyof typeof PERMISSIONS, opts?: { recentAuthMinutes?: number }) {
  const ctx = await requireRole(...PERMISSIONS[p]);
  if (opts?.recentAuthMinutes) {
    const lastSignIn = new Date(ctx.user.last_sign_in_at ?? 0).getTime();
    if (Date.now() - lastSignIn > opts.recentAuthMinutes * 60_000) throw new ReauthRequired();
  }
  return ctx;
}
```

**Implementation Guidance:**
- Define one permission map and use it in server code, RLS policies (via a `has_permission()` SQL function) and navigation.
- Require recent authentication (re-enter the password, or MFA if enabled) for refunds above a threshold, role changes, email/password changes and data reset.
- Put a logout control in every authenticated layout (storefront account and back-office).
- Deny by default: new routes are unreachable until they are added to the map.

**Success Criteria:**
- [ ] A single permission map is used by server code and RLS
- [ ] Sensitive actions require recent re-authentication
- [ ] A logout control is visible on all authenticated pages
- [ ] Unmapped routes return 403

**Status:** Pending
