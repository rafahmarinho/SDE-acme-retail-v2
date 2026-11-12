---
name: t37-avoid-dom-xss
description: Avoid DOM-based XSS in client components that read location, query strings or hash (search, filters, checkout return URLs) by using safe DOM APIs and validated redirects.
---

# T37: Avoid DOM-based Cross-Site Scripting (XSS)

**Category:** CODE_FIX
**SD Elements:** [T37](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T37/)
**Priority:** 8

**Spec Context:**
> "Inclua ... busca, filtros" ... "checkout, resultado do pagamento" ... "deixe um adapter opcional para Stripe Checkout"
> Source: specs/PRD.md, lines 11, 23, 31-33

**What the spec implies (naive approach):**
Client components read `window.location.search` / `useSearchParams()` for filters or `?returnTo=` and write them into `innerHTML`, or call `window.location = params.get("next")` after login or payment.

**Secure Implementation Pattern:**
```ts
// src/lib/safe-redirect.ts
const ALLOWED_PREFIXES = ["/account", "/orders", "/checkout/result", "/catalog", "/"];

export function safeRedirectPath(input: string | null): string {
  if (!input || !input.startsWith("/") || input.startsWith("//")) return "/";
  const url = new URL(input, "https://internal.invalid");
  return ALLOWED_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"))
    ? url.pathname + url.search
    : "/";
}
```

**Implementation Guidance:**
- In client code, use React state and JSX only. Never use `innerHTML`, `outerHTML`, `document.write` or `insertAdjacentHTML`.
- Validate redirect targets after login, logout and payment with `safeRedirectPath()` (same-origin path allowlist).
- Parse filter params with zod enums (sort, category UUID, price range) before using them.
- Enable Trusted Types through CSP (`require-trusted-types-for 'script'`) once third-party scripts allow it.

**Success Criteria:**
- [ ] No `innerHTML`/`document.write` usage in `src/` (lint enforced)
- [ ] `?returnTo=javascript:alert(1)` and `?returnTo=//evil.com` redirect to `/`
- [ ] Filter params outside the allowed enums are ignored

**Status:** Applied

**Implementation (2026-11-12):** `src/lib/safe-redirect.ts` is used for login, email-link and layout redirects. ESLint bans `innerHTML`, `outerHTML`, `document.write` and `insertAdjacentHTML`, and filters are zod enums (`src/lib/schemas.ts`). Unit-tested.
