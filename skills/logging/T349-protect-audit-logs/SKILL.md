---
name: t349-protect-audit-logs
description: Make the simulation/business events log and admin audit trail append-only, readable only by authorized roles, and immune to the "reset data" action.
---

# T349: Protect audit information and logs against unauthorized access

**Category:** CODE_FIX
**SD Elements:** [T349](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T349/)
**Priority:** 7

**Spec Context:**
> "Inclua uma área para escolher cenários, avançar a simulação, consultar eventos e reiniciar os dados." ... "reembolso total ou parcial"
> Source: specs/PRD.md, lines 35-37, 43

**What the spec implies (naive approach):**
A single `events` table that any signed-in user can read, that admins can update or delete, and that "reiniciar os dados" truncates, so refunds and role changes leave no trace.

**Secure Implementation Pattern:**
```sql
create table audit.log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid, action text not null, target text, details jsonb
);
revoke all on audit.log from anon, authenticated;
create or replace function audit.write(p_action text, p_target text, p_details jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into audit.log(actor_id, action, target, details) values (auth.uid(), p_action, p_target, p_details);
$$;
-- block updates/deletes even for table owner paths used by the app
create rule no_update as on update to audit.log do instead nothing;
create rule no_delete as on delete to audit.log do instead nothing;
```

**Implementation Guidance:**
- Separate the demo `events` (resettable, shown in the simulation UI) from the `audit.log` (never reset).
- Write audit entries for login failures, role changes, refunds, cancellations, simulation resets and settings changes.
- Read access goes through a security-definer RPC for the admin role only (finance sees its own refund events).
- Optionally drain Supabase/Vercel logs to an external, write-once store (Vercel Log Drains).

**Success Criteria:**
- [ ] `audit.log` has no update/delete path
- [ ] "Reset data" doesn't touch `audit.log`
- [ ] Only admins can read the full audit trail

**Status:** Pending
