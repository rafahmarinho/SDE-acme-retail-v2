---
name: t2599-connection-string-parameter-pollution
description: Prevent connection string parameter pollution by building Supabase/Postgres connection settings only from server-side environment configuration, never from user input.
---

# T2599: Protect against connection string parameter pollution

**Category:** CODE_FIX
**SD Elements:** [T2599](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T2599/)
**Priority:** 9

**Spec Context:**
> "Entregue o código completo, configuração do banco, dados iniciais, exemplos de variáveis de ambiente" ... "Inclua uma área para escolher cenários ... e reiniciar os dados."
> Source: specs/PRD.md, lines 43-47

**What the spec implies (naive approach):**
The simulation area lets an admin pick a "scenario database" or schema, and the code builds `postgres://...?options=-csearch_path=${scenario}` or `createClient(req.body.url, ...)` from the request.

**Secure Implementation Pattern:**
```ts
// src/lib/env.ts - validated once at startup
import { z } from "zod";
export const env = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().startsWith("https://"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  DATABASE_URL: z.string().startsWith("postgres").optional(), // migrations/seed only
}).parse(process.env);

// scenarios are rows in a table, NOT connection targets
const Scenario = z.enum(["happy-path", "payment-declines", "stockouts", "late-deliveries"]);
```

**Implementation Guidance:**
- Read all connection settings from validated environment variables. Never accept a URL, host, schema or options from users.
- Model simulation scenarios as data (an enum plus rows in `simulation_scenarios`), never as alternate databases.
- Use `DATABASE_URL` only in migration and seed tooling, never at runtime in route handlers.
- Keep `sslmode=require` fixed in the connection string.

**Success Criteria:**
- [ ] No code path constructs a DB/Supabase client from request data
- [ ] Startup fails fast if environment variables are malformed
- [ ] Scenarios are selected from a fixed enum

**Status:** Pending
