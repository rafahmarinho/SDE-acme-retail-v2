---
name: t70-system-account-lockout-throttling
description: Configure lockout or authentication throttling for system accounts (Supabase Postgres roles, service keys, Vercel/Supabase dashboards) to resist brute force.
---

# Task T70: Implement account lockout or authentication throttling for system accounts (NON-CODE)

**Category:** INFRA
**SD Elements:** [T70](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T70/)
**Priority:** 8

**Guidance:** Lock out or progressively throttle system accounts after repeated failed authentication attempts.

**Why Not Code-Fixable:**
- Searched specs: specs/PRD.md lines 5-7, 17-19, 47-49 (Supabase, Vercel, deployment README).
- Found: system accounts are the managed Supabase Postgres roles and the dashboard/API accounts of Supabase, Vercel and Stripe.
- Missing: the application has no login endpoint for system accounts. Their throttling is enforced by Supabase (connection pooler / network restrictions) and by the SaaS dashboards.
- Conclusion: INFRA. End-user login throttling is a code task, handled in T1362.

**Recommended Action:** The platform owner enables Supabase network restrictions (allow-list only the Vercel egress) and Supabase/Vercel/Stripe MFA for dashboard accounts, uses the Supavisor pooler with SSL enforced, and reviews the auth failure logs.

**Status:** Documented
