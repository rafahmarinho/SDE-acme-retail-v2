---
name: t754-restrict-processing-of-pii
description: Allow customers to restrict specific processing activities on their data (marketing, personalization) and flag restricted accounts so jobs skip them.
---

# T754: Enable the restriction of processing personal information of an individual for a specific purpose

**Category:** CODE_FIX
**SD Elements:** [T754](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T754/)
**Priority:** 8

**Spec Context:**
> "perfil, configurações" ... "favoritos" ... "Tenha perfis de cliente ... e administrador."
> Source: specs/PRD.md, lines 11, 21, 37-39

**What the spec implies (naive approach):**
Favorites and order history are always used for recommendations and marketing segments, and there's no way to object or pause processing.

**Secure Implementation Pattern:**
```sql
create table public.processing_restrictions (
  user_id uuid references auth.users(id) on delete cascade,
  activity text check (activity in ('marketing','personalization','analytics')),
  restricted boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, activity)
);
-- jobs must filter: where not exists (select 1 from processing_restrictions r where r.user_id = u.id and r.activity = 'marketing' and r.restricted)
```

**Implementation Guidance:**
- Show the restrictable activities in Settings, next to the consents (T604).
- Every batch or recommendation job filters out restricted users (helper `isRestricted(userId, activity)`).
- An admin can apply a restriction on request (logged, T349).
- Get the list of activities from the PIA / data processing register (PROCESS T755, noted in SD Elements).

**Success Criteria:**
- [ ] Users can restrict each listed activity
- [ ] Jobs skip restricted users (unit-tested)
- [ ] Restriction changes are audit-logged

**Status:** Pending
