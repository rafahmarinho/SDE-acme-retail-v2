---
name: t604-consent-withdrawal
description: Provide a Settings page where customers can review and withdraw each consent, and stop the related processing immediately.
---

# T604: Implement a consent withdrawal mechanism

**Category:** CODE_FIX
**SD Elements:** [T604](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T604/)
**Priority:** 10

**Spec Context:**
> "Inclua login, recuperação de senha, perfil, configurações"
> Source: specs/PRD.md, line 11

**What the spec implies (naive approach):**
The Settings page offers only theme and password options. Unsubscribing from marketing requires contacting support, and the analytics scripts keep running.

**Secure Implementation Pattern:**
```ts
// src/app/account/settings/actions.ts
"use server";
const Withdraw = z.object({ purpose: z.enum(["marketing_email", "analytics", "personalization"]) });

export async function withdrawConsent(form: FormData) {
  const { purpose } = Withdraw.parse({ purpose: form.get("purpose") });
  const { user } = await requireRole("customer", "catalog", "warehouse", "finance", "admin");
  const supabase = await createServerClient();
  await supabase.from("consents").insert({ user_id: user.id, purpose, granted: false, policy_version: CURRENT_POLICY });
  await stopProcessing(user.id, purpose); // e.g. remove from mailing segment, disable analytics cookie
  revalidatePath("/account/settings");
}
```

**Implementation Guidance:**
- List every consent item with its current state, read from the latest `consents` row per purpose.
- Withdrawal takes effect immediately and is as easy as granting (one toggle).
- Every processing job checks the current consent before running (for example, the marketing email sender).
- Communicate withdrawals to processors (email provider) through their API, where applicable.

**Success Criteria:**
- [ ] Settings shows a toggle for each consent purpose
- [ ] After withdrawal, no marketing emails or analytics events are sent
- [ ] Withdrawal is recorded with a timestamp

**Status:** Pending
