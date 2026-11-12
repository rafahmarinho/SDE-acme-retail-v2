---
name: t1365-mitigate-ssrf
description: Mitigate SSRF in the Stripe adapter, simulated external integrations and any product-image-by-URL import by allowlisting outbound hosts and schemes.
---

# T1365: Mitigate Server Side Request Forgery

**Category:** CODE_FIX
**SD Elements:** [T1365](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T1365/)
**Priority:** 8

**Spec Context:**
> "com integrações externas simuladas" ... "deixe um adapter opcional para Stripe Checkout em modo de teste" ... "painel de produtos"
> Source: specs/PRD.md, lines 7-9, 25, 33-35

**What the spec implies (naive approach):**
The admin "add product image" form accepts an image URL and the server `fetch()`es it. Simulated carrier/payment integrations call a configurable `callbackUrl` taken from the request.

**Secure Implementation Pattern:**
```ts
// src/lib/outbound.ts
const ALLOWED_HOSTS = new Set(["api.stripe.com", new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host]);

export async function safeFetch(url: string, init?: RequestInit) {
  const u = new URL(url);
  if (u.protocol !== "https:" || !ALLOWED_HOSTS.has(u.hostname)) throw new Error("Outbound host not allowed");
  return fetch(u, { ...init, redirect: "error", signal: AbortSignal.timeout(5000) });
}
```

**Implementation Guidance:**
- Implement simulated integrations in-process (no outbound HTTP), with scenarios selected from an enum.
- Product images: upload files directly to Supabase Storage. Don't fetch arbitrary URLs. If URL import is required, use `safeFetch` and validate the content type and size.
- Never take callback, return or webhook target URLs from user input. Configure them server-side.
- Disable redirects on outbound fetches, and set timeouts.

**Success Criteria:**
- [ ] All outbound HTTP goes through `safeFetch`
- [ ] `http://169.254.169.254/` and `file://` URLs are rejected
- [ ] Simulated integrations make no network calls

**Status:** Applied

**Implementation (2026-11-12):** The app never fetches user-supplied URLs. Simulated integrations run in Postgres, product images are uploaded rather than fetched, and the only outbound HTTP is the Stripe SDK (10 s timeout, fixed callback URLs from `APP_BASE_URL`), in `src/services/payments.ts`.
