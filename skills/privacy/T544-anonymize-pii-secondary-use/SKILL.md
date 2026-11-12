---
name: t544-anonymize-pii-secondary-use
description: Anonymize customer data used for demo seeds, simulation, finance reports and analytics so individuals cannot be identified; never copy real PII into demo datasets.
---

# T544: Anonymize (de-identify) identifying information before using it for a secondary purpose

**Category:** CODE_FIX
**SD Elements:** [T544](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T544/)
**Priority:** 8

**Spec Context:**
> "Prepare dados de demonstração com quarenta produtos e sessenta pedidos. Inclua uma área para escolher cenários ... consultar eventos e reiniciar os dados." ... "relatórios"
> Source: specs/PRD.md, lines 3, 41-43

**What the spec implies (naive approach):**
Demo orders are built by copying a production export. Finance reports and the events viewer show customer names and addresses in full.

**Secure Implementation Pattern:**
```ts
// supabase/seed.ts - synthetic identities only
import { faker } from "@faker-js/faker";
faker.seed(42);
const demoCustomers = Array.from({ length: 20 }, (_, i) => ({
  email: `demo+${i}@example.test`,          // reserved TLD, never deliverable
  full_name: faker.person.fullName(),
  address: faker.location.streetAddress(),
}));

// reports: aggregate, no direct identifiers
create view public.sales_by_day as
  select date_trunc('day', created_at) d, count(*) orders, sum(total) revenue from public.orders group by 1;
```

**Implementation Guidance:**
- Seeds and simulation use generated data on `example.test` emails only.
- Build finance/analytics reports from aggregate views without names, emails or addresses.
- In the events viewer, log user UUIDs, not emails or addresses (see also T744).
- Document which fields count as identifiers in `docs/data-classification.md`.

**Success Criteria:**
- [ ] Seed data contains only synthetic identities
- [ ] Report views contain no direct identifiers
- [ ] Event payloads exclude PII

**Status:** Applied

**Implementation (2026-11-12):** Demo identities are synthetic on `example.test` (`scripts/seed.mjs`, `app.sim_address`). Events hold IDs and amounts only, the dashboard uses aggregates (`admin_dashboard`), and audit entries strip name, phone and address columns.
