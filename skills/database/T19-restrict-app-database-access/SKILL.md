---
name: t19-restrict-app-database-access
description: Limit the application's Supabase/Postgres privileges by using the anon key with RLS for user requests and confining the service-role key to a few audited server jobs.
---

# T19: Restrict application's access to database

**Category:** CODE_FIX
**SD Elements:** [T19](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T19/)
**Priority:** 8

**Spec Context:**
> "Use ... Supabase para PostgreSQL ... Entregue o código completo, configuração do banco, dados iniciais ... Inclua uma área para escolher cenários, avançar a simulação, consultar eventos e reiniciar os dados."
> Source: specs/PRD.md, lines 5, 41-47

**What the spec implies (naive approach):**
A single `createClient(URL, SERVICE_ROLE_KEY)` is used everywhere for convenience. It bypasses RLS and grants full DDL/DML, so any injection or authorization bug exposes the whole database.

**Secure Implementation Pattern:**
```ts
// src/lib/supabase/admin.ts - the ONLY place the service role is used
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient(reason: "simulation-reset" | "seed" | "webhook") {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("service role not configured");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { headers: { "x-acme-reason": reason } },
  });
}
```
```sql
-- least-privilege grants for the API roles
revoke all on all tables in schema public from anon, authenticated;
grant select on public.products, public.categories, public.product_variants to anon, authenticated;
grant select, insert, update on public.carts, public.cart_items, public.favorites to authenticated;
-- writes to orders/payments/refunds only via security-definer RPCs with internal checks
```

**Implementation Guidance:**
- Default to the user-scoped client (`@supabase/ssr`) in all request paths.
- Import the admin client only from `services/simulation.ts`, the seed script and the payment webhook handler. Enforce this with an ESLint `no-restricted-imports` rule.
- Revoke the default broad grants and grant per-table, per-action privileges to `anon` and `authenticated`.
- Put state transitions (checkout, refund, stock reservation) in `security definer` functions with `set search_path = ''` and explicit role checks.

**Success Criteria:**
- [ ] The service-role key is referenced in at most 3 server-only modules
- [ ] `anon` cannot write to any table
- [ ] `authenticated` cannot write to orders, payments or refunds directly

**Status:** Pending
