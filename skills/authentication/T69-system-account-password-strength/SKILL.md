---
name: t69-system-account-password-strength
description: Ensure Supabase database passwords, service-role keys and Stripe keys used for server-to-server authentication meet at least the end-user password strength policy.
---

# Task T69: Strong password requirements for server-to-server system accounts (NON-CODE)

**Category:** INFRA
**SD Elements:** [T69](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T69/)
**Priority:** 8

**Guidance:** System accounts used for server-to-server authentication must meet at least the same minimum password requirements as end-user accounts.

**Why Not Code-Fixable:**
- Searched specs: specs/PRD.md lines 5-7 ("Supabase para PostgreSQL"), 17-19 ("com Supabase e Vercel"), 45-49 ("exemplos de variáveis de ambiente").
- Found: the app uses hosted Supabase and Vercel and reads credentials from environment variables.
- Missing: the system credentials (Postgres password, service-role JWT secret, Stripe secret) are created and rotated in the Supabase, Stripe and Vercel dashboards, not in application code.
- Conclusion: INFRA. The application only consumes these secrets (see T76 for how it handles them).

**Recommended Action:** The platform owner sets a 32+ character random Postgres password in Supabase, keeps the JWT secret at its generated default, uses Stripe restricted test keys, stores all of them only in Vercel encrypted environment variables, and documents a rotation schedule.

**Status:** Documented
