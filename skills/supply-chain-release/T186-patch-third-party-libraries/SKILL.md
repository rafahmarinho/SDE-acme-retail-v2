---
name: t186-patch-third-party-libraries
description: Keep Next.js, React, supabase-js, Stripe and all pnpm dependencies on current patched versions with a lockfile, automated updates and vulnerability scanning.
---

# T186: Use recommended settings and the latest patches for third party libraries and software

**Category:** CODE_FIX
**SD Elements:** [T186](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T186/)
**Priority:** 10

**Spec Context:**
> "Use versões atuais e estáveis das tecnologias e Supabase" ... "deve usar Next.js, React e TypeScript com Supabase e Vercel. Use pnpm."
> Source: specs/PRD.md, lines 5, 17-19

**What the spec implies (naive approach):**
The developer installs the current versions once and never updates them. Next.js security advisories (for example middleware auth bypasses or Server Action issues) go unpatched, and the lockfile isn't committed.

**Secure Implementation Pattern:**
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule: { interval: "weekly" }
    groups: { nextjs: { patterns: ["next", "eslint-config-next", "react", "react-dom"] } }
```
```bash
pnpm install --frozen-lockfile   # CI
pnpm audit --prod --audit-level=high
```

**Implementation Guidance:**
- Commit `pnpm-lock.yaml`. CI installs with `--frozen-lockfile`.
- Enable Dependabot or Renovate. Run `pnpm audit` (or Snyk/OSV) in CI and fail on high/critical.
- Subscribe to the Next.js, Supabase and Stripe security advisories, and patch critical ones within 72 h.
- Use secure settings: `poweredByHeader: false`, and keep middleware from being the only auth layer (T17).
- Set `pnpm` `onlyBuiltDependencies` to restrict install scripts.

**Success Criteria:**
- [ ] The lockfile is committed and CI uses a frozen install
- [ ] Automated dependency PRs are enabled
- [ ] `pnpm audit` shows no high/critical issues at release

**Status:** Pending
