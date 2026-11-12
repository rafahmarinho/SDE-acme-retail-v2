---
name: t76-no-hardcoded-secrets
description: Keep Supabase service-role keys, Stripe secrets and signing keys out of source code, seed scripts and client bundles; load them from validated server-only environment variables.
---

# T76: Do not hardcode passwords

**Category:** CODE_FIX
**SD Elements:** [T76](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T76/)
**Priority:** 10

**Spec Context:**
> "Entregue o código completo, configuração do banco, dados iniciais, exemplos de variáveis de ambiente e um README com os passos para rodar e publicar"
> Source: specs/PRD.md, lines 45-49

**What the spec implies (naive approach):**
To make the demo "just run", real keys are committed in `.env.example`, seeds contain demo admin passwords like `admin123`, and `SUPABASE_SERVICE_ROLE_KEY` is exposed as `NEXT_PUBLIC_...`.

**Secure Implementation Pattern:**
```ts
// src/lib/env.server.ts
import "server-only";
export const serverEnv = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_test_").optional(), // test mode only
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
}).parse(process.env);
```
```bash
# .github / pre-commit: block secrets
gitleaks protect --staged --redact
```

**Implementation Guidance:**
- Keep `.env.example` with empty or placeholder values only. Ignore `.env*.local` in `.gitignore` (already done).
- Never prefix secrets with `NEXT_PUBLIC_`. Import server env only from `server-only` modules.
- Seed demo users with random passwords printed once to the console, or with magic-link login. Never commit fixed credentials.
- Add gitleaks (or GitHub secret scanning) as a pre-commit hook and in CI.
- Enforce that only Stripe `sk_test_` keys are accepted ("modo de teste").

**Success Criteria:**
- [ ] gitleaks reports 0 findings
- [ ] The client bundle contains no service-role or Stripe secret (`grep` on `.next/static`)
- [ ] Seeds contain no fixed passwords

**Status:** Applied

**Implementation (2026-11-12):** `src/lib/env.server.ts` is server-only and accepts only `sk_test_` Stripe keys. `.env.example` has empty secrets, `.gitignore` covers `.env*.local` and `.demo-credentials.local`, and `scripts/seed.mjs` takes the password from env or generates a random one. A gitleaks job runs in `.github/workflows/ci.yml`.
