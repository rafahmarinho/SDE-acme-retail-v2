---
name: t742-personal-info-accuracy
description: Let customers maintain their own profile and addresses with validated input, and keep personal data consistent across profiles, orders and auth.users.
---

# T742: Implement technical measures to ensure the accuracy of personal information

**Category:** CODE_FIX
**SD Elements:** [T742](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T742/)
**Priority:** 7

**Spec Context:**
> "Inclua login, recuperação de senha, perfil, configurações" ... "conta, pedidos, rastreamento" ... "Inclua envio"
> Source: specs/PRD.md, lines 11, 23-25, 35

**What the spec implies (naive approach):**
The email lives in both `auth.users` and `profiles` and drifts out of sync. Addresses are free text with no validation, and duplicate addresses pile up.

**Secure Implementation Pattern:**
```ts
const Address = z.object({
  line1: z.string().trim().min(3).max(120),
  city: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().regex(/^[A-Za-z0-9 -]{3,10}$/),
  country: z.string().length(2),
});

export async function updateEmail(newEmail: string) {
  const supabase = await createServerClient();
  // single source of truth: auth.users; Supabase sends confirmation to the new address
  await supabase.auth.updateUser({ email: z.string().email().parse(newEmail) });
}
```

**Implementation Guidance:**
- Provide self-service screens for name, phone and addresses (profile/settings).
- Keep the email only in `auth.users`. Read it through a view or join, not a copied column.
- Validate every field (T31-style) and de-duplicate saved addresses.
- Order rows hold an address snapshot by design. Document that this is intentional (historical accuracy).

**Success Criteria:**
- [ ] Users can view and edit their own personal data
- [ ] The email is stored in exactly one place
- [ ] Address input is validated and de-duplicated

**Status:** Pending
