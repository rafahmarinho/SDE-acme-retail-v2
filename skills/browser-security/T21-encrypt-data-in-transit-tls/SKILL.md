---
name: t21-encrypt-data-in-transit-tls
description: Ensure all traffic between browser, Vercel functions, Supabase and Stripe uses TLS 1.2+ by enforcing HTTPS URLs, HSTS and rejecting plaintext configuration.
---

# T21: Ensure all data in transit is encrypted using a secure TLS channel

**Category:** CODE_FIX
**SD Elements:** [T21](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T21/)
**Priority:** 8

**Spec Context:**
> "login por e-mail e senha ... atualizações em tempo real" ... "README com os passos para rodar e publicar a versão web e a API na Vercel"
> Source: specs/PRD.md, lines 5-7, 47-49

**What the spec implies (naive approach):**
`.env` points at `http://` Supabase URLs, Realtime uses `ws://`, there's no HSTS, and custom domains on Vercel serve HTTP alongside HTTPS.

**Secure Implementation Pattern:**
```ts
// next.config.ts
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];
export default {
  async headers() { return [{ source: "/:path*", headers: securityHeaders }]; },
} satisfies NextConfig;

// src/lib/env.ts - refuse plaintext endpoints outside local dev
NEXT_PUBLIC_SUPABASE_URL: z.string().url().refine(
  (u) => u.startsWith("https://") || process.env.NODE_ENV === "development",
  "Supabase URL must use HTTPS"),
```

**Implementation Guidance:**
- Serve only HTTPS (Vercel does this by default) and send HSTS from the app.
- Validate that every outbound URL (Supabase, Stripe, `APP_BASE_URL`) is `https://` at startup.
- Use `wss://` for Realtime. supabase-js derives it from an https URL.
- For direct Postgres connections (migrations), use `sslmode=require`.
- Never set `NODE_TLS_REJECT_UNAUTHORIZED=0` (see T156).

**Success Criteria:**
- [ ] The HSTS header is present on all responses
- [ ] The app refuses to start with non-HTTPS service URLs in production
- [ ] There are no mixed-content warnings in the browser console

**Status:** Pending
