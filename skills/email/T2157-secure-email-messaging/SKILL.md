---
name: t2157-secure-email-messaging
description: Configure SPF, DKIM, DMARC and a custom SMTP provider with TLS for Supabase Auth recovery and order emails, and keep sensitive data out of message bodies.
---

# Task T2157: Secure email and messaging in web applications (NON-CODE)

**Category:** INFRA
**SD Elements:** [T2157](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T2157/)
**Priority:** 7

**Guidance:** Apply TLS for transport, authenticate the sender with SPF/DKIM, set up DMARC, and never send unencrypted sensitive information by email.

**Why Not Code-Fixable:**
- Searched specs: specs/PRD.md lines 5-11 ("login por e-mail e senha ... recuperação de senha") and 7-9 ("integrações externas simuladas").
- Found: the only email the spec requires is the Supabase Auth password-recovery mail. Other notifications are simulated.
- Missing: SPF/DKIM/DMARC are DNS records on the sending domain, and SMTP/TLS is configured in the Supabase Auth SMTP settings. Neither lives in application code.
- Conclusion: INFRA. Email *content* rules (no secrets or PII beyond the necessary, no template injection) are covered by T2 and T1144.

**Recommended Action:** The platform owner configures a custom SMTP provider in Supabase Auth (TLS required), publishes the SPF, DKIM and DMARC (`p=quarantine` or stricter) records for the sending domain, and verifies the recovery emails pass DMARC alignment.

**Status:** Documented
