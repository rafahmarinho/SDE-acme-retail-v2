---
name: t2598-query-level-access-control
description: Implement table, row and column level permissions in Postgres (RLS policies, column grants) for every ACME Retail role.
---

# T2598: Implement query-level access control

**Category:** CODE_FIX
**SD Elements:** [T2598](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T2598/)
**Priority:** 8

**Spec Context:**
> "Tenha perfis de cliente, catálogo, estoque, financeiro e administrador." ... "painel de produtos, estoque, pedidos e reembolsos"
> Source: specs/PRD.md, lines 25-27, 37-39

**What the spec implies (naive approach):**
Tables are created without RLS (Supabase warns, but the warning is ignored). Every authenticated user can `select *` on `profiles`, `payments` and `refunds` through PostgREST.

**Secure Implementation Pattern:**
```sql
create or replace function public.current_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

alter table public.inventory enable row level security;
create policy inv_read on public.inventory for select using (true);
create policy inv_write on public.inventory for update
  using (public.current_role() in ('warehouse','admin'))
  with check (public.current_role() in ('warehouse','admin'));

alter table public.refunds enable row level security;
create policy refunds_finance on public.refunds for all
  using (public.current_role() in ('finance','admin'))
  with check (public.current_role() in ('finance','admin'));

-- column-level: customers may update only their profile's contact fields
revoke update on public.profiles from authenticated;
grant update (full_name, phone, default_address) on public.profiles to authenticated;
```

**Implementation Guidance:**
- Write a role × table × action matrix (select/insert/update/delete) and implement it 1:1 as policies.
- Enable RLS on every table in `public`. Add a CI check that queries `pg_tables` where `rowsecurity = false`.
- Use column grants so that `role` and `status_*` fields cannot be changed by customers.
- Test the policies with pgTAP or SQL tests run as each role (`set local role authenticated; set local request.jwt.claims ...`).

**Success Criteria:**
- [ ] RLS is enabled on 100% of public tables (CI enforced)
- [ ] Policy tests pass for all 5 roles
- [ ] Customers cannot change `profiles.role`

**Status:** Pending
