---
name: t178-consent-before-collecting-pii
description: Collect explicit, separate, recorded consent at sign-up and checkout before processing customer personal data beyond what's strictly needed to fulfil orders.
---

# T178: Obtain consent from users prior to collecting personal information

**Category:** CODE_FIX
**SD Elements:** [T178](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T178/)
**Priority:** 10

**Spec Context:**
> "login por e-mail e senha ... Inclua login, recuperação de senha, perfil, configurações" ... "checkout ... Inclua envio"
> Source: specs/PRD.md, lines 5-11, 23, 35

**What the spec implies (naive approach):**
The sign-up form collects name, email, phone and address, and silently enrolls the user in marketing emails and analytics, with consent buried in the Terms.

**Secure Implementation Pattern:**
```sql
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('marketing_email','analytics','personalization')),
  granted boolean not null,
  policy_version text not null,
  created_at timestamptz not null default now()
);
alter table public.consents enable row level security;
create policy own_consents on public.consents for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```
```tsx
<fieldset>
  <legend>Optional</legend>
  <label><input type="checkbox" name="consent_marketing_email" /> Email me offers (you can change this in Settings)</label>
</fieldset>
```

**Implementation Guidance:**
- Separate required processing (account, order fulfilment) from optional purposes (marketing, analytics). Optional boxes start unchecked.
- Show a short purpose summary and link the full privacy notice. Mark fields as required or optional with tooltips explaining why.
- Store each consent decision with a policy version and timestamp (append-only).
- Have the privacy officer confirm the PIA (organizational step, outside code).

**Success Criteria:**
- [ ] Consent is recorded per purpose with version and timestamp
- [ ] No optional processing happens without a `granted = true` record
- [ ] The consent UI is separate from the Terms acceptance

**Status:** Applied

**Implementation (2026-11-12):** The `consents` ledger (0001) is append-only and stores the policy version. The sign-up form (`src/app/(auth)/signup/page.tsx`) has separate, unchecked optional consents, recorded by `src/actions/auth.ts`. Recommendations are gated by consent (`personalizationAllowed`). The PIA review is organizational.
