---
name: t156-validate-certificate-chain
description: Keep default TLS certificate validation for all outbound connections (Supabase, Stripe, Postgres) and never disable it via NODE_TLS_REJECT_UNAUTHORIZED or custom agents.
---

# T156: Validate certificate and its chain of trust properly

**Category:** CODE_FIX
**SD Elements:** [T156](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T156/)
**Priority:** 7

**Spec Context:**
> "Use ... Supabase para PostgreSQL" ... "adapter opcional para Stripe Checkout em modo de teste" ... "publicar ... na Vercel"
> Source: specs/PRD.md, lines 5, 33-35, 47-49

**What the spec implies (naive approach):**
During local development against Supabase or a proxy, someone sets `NODE_TLS_REJECT_UNAUTHORIZED=0` or `ssl: { rejectUnauthorized: false }` for Postgres, and it ships to production.

**Secure Implementation Pattern:**
```ts
// src/lib/env.ts - fail closed
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  throw new Error("TLS certificate validation must not be disabled");
}

// scripts/seed.ts - direct Postgres with verified TLS
const sql = postgres(process.env.DATABASE_URL!, { ssl: { rejectUnauthorized: true, ca: process.env.SUPABASE_CA_CERT } });
```

**Implementation Guidance:**
- Use the default `fetch`/undici TLS validation for Supabase and Stripe (hostname and chain are verified).
- For direct Postgres, use `sslmode=verify-full` with the Supabase CA certificate.
- Ban `rejectUnauthorized: false` and `NODE_TLS_REJECT_UNAUTHORIZED` in code review and with a semgrep rule.

**Success Criteria:**
- [ ] No TLS-validation bypasses in the code or Vercel environment
- [ ] The startup check fails if validation is disabled
- [ ] Postgres connections use verify-full

**Status:** Pending
