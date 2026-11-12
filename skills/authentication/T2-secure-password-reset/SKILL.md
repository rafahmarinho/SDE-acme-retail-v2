---
name: t2-secure-password-reset
description: Secure the password recovery flow (Supabase Auth) against account enumeration, token reuse and automation, as required by SD Elements countermeasure T2.
---

# T2: Secure the password reset mechanism

**Category:** CODE_FIX
**SD Elements:** [T2](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T2/)
**Priority:** 9

**Spec Context:**
> "Use ... Supabase para PostgreSQL, login por e-mail e senha ... Inclua login, recuperação de senha, perfil, configurações"
> Source: specs/PRD.md, lines 5-11

**What the spec implies (naive approach):**
A "Forgot password" form calls `supabase.auth.resetPasswordForEmail(email)`, shows "No account with that email" when the user doesn't exist, has no rate limit, and the reset page accepts any `redirectTo` URL.

**Secure Implementation Pattern:**
```ts
// src/app/(auth)/forgot-password/actions.ts
"use server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const Input = z.object({ email: z.string().email().max(254) });

export async function requestReset(form: FormData) {
  const { email } = Input.parse({ email: form.get("email") });
  await rateLimit(`pwreset:${email}`, { max: 3, windowSec: 3600 });
  const supabase = await createServerClient();
  // redirect target is a fixed server-side constant, never user input
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.APP_BASE_URL}/auth/update-password`,
  });
  // Same response whether or not the account exists
  return { message: "If an account exists for that email, a reset link has been sent." };
}
```

**Implementation Guidance:**
- Return an identical message and similar response timing for existing and non-existing emails.
- Add anti-automation: a per-email and per-IP rate limit, plus a CAPTCHA (Supabase Auth supports hCaptcha/Turnstile).
- Set a short OTP/link expiry in Supabase Auth settings (for example 15-60 minutes). Links are single-use.
- Use a fixed `redirectTo` and add it to the Supabase "Redirect URLs" allowlist.
- On `/auth/update-password`, require the recovery session, enforce the password policy, then call `supabase.auth.signOut({ scope: "others" })` to revoke other sessions.
- Send a "your password was changed" notification email.

**Success Criteria:**
- [ ] Reset response is identical for known and unknown emails
- [ ] More than 3 reset requests per hour per email/IP are throttled
- [ ] Reset links expire and cannot be reused
- [ ] `redirectTo` cannot be influenced by the client
- [ ] Other sessions are revoked after the password changes

**Status:** Pending
