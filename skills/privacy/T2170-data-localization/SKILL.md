---
name: t2170-data-localization
description: Choose Supabase project region and Vercel function region to satisfy any data localization requirements for ACME Retail customer data.
---

# Task T2170: Ensure that personal information processed by the application meets data localization requirements (NON-CODE)

**Category:** INFRA
**SD Elements:** [T2170](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T2170/)
**Priority:** 9

**Guidance:** Identify where personal information is stored and processed, research the localization laws for each country, and use locally based infrastructure where required.

**Why Not Code-Fixable:**
- Searched specs: specs/PRD.md, the whole document (no country, region or legal jurisdiction mentioned). Lines 17-19 and 47-49 name Supabase and Vercel.
- Found: data is stored in Supabase Postgres/Storage and processed in Vercel functions.
- Missing: the data location is set by the Supabase project region and the Vercel function region (`vercel.json` / project settings), chosen at provisioning time by the platform owner.
- Conclusion: INFRA plus legal input. No application logic is needed.

**Recommended Action:** Legal/privacy confirms the target markets. The platform owner then creates the Supabase project in a compliant region, pins Vercel functions to the same region, and records the subprocessors (Supabase, Vercel, Stripe) in the data processing register.

**Status:** Documented
