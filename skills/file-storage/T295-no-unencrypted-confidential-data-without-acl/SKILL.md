---
name: t295-no-unencrypted-confidential-data-without-acl
description: Never place confidential data (reports with PII, exports, secrets, simulation snapshots) in shared or public storage without access control, and encrypt it where access control alone is insufficient.
---

# T295: Avoid storing unencrypted confidential data without access control mechanisms

**Category:** CODE_FIX
**SD Elements:** [T295](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T295/)
**Priority:** 7

**Spec Context:**
> "arquivos" ... "relatórios" ... "consultar eventos e reiniciar os dados. Os resultados devem aparecer nas telas e continuar salvos após recarregar a aplicação."
> Source: specs/PRD.md, lines 3, 7, 43-45

**What the spec implies (naive approach):**
"Reset data" writes a full JSON snapshot of all orders and customers to a public bucket or to `/tmp` on the Vercel function. Finance CSV exports land in a shared folder.

**Secure Implementation Pattern:**
```ts
// simulation reset: snapshot stays inside Postgres, protected by RLS
await admin.rpc("snapshot_and_reset_demo", { p_actor: user.id }); // security definer, admin-only

// exports: private bucket, per-user folder, short TTL
const key = `${user.id}/${randomUUID()}.csv`;
await admin.storage.from("reports").upload(key, csv, { contentType: "text/csv", upsert: false });
const { data } = await admin.storage.from("reports").createSignedUrl(key, 300);
```

**Implementation Guidance:**
- Keep persistent state ("continuar salvos") in Postgres with RLS, not in files or browser storage.
- Never write confidential data to `/tmp` on serverless functions or to public buckets.
- Delete exports after a retention period (scheduled job).
- Supabase encrypts at rest. Add app-level AES-GCM (T60) only for fields needing extra protection (none expected, since there is no card data).

**Success Criteria:**
- [ ] No confidential files in public buckets or `/tmp`
- [ ] Exports are private, per-user and expire
- [ ] The reset snapshot is only accessible to admins

**Status:** Applied

**Implementation (2026-11-12):** All state is in Postgres under RLS. `sim_reset` regenerates data in the database without snapshot files. No code writes confidential data to `/tmp` or a public bucket, and local demo credentials are gitignored. Exports aren't part of this release.
