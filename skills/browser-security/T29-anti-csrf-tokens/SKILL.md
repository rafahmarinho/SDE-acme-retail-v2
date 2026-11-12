---
name: t29-anti-csrf-tokens
description: Protect state-changing requests (checkout, cart, coupon, refunds, cancellations, simulation reset, logout) from CSRF with Server Actions origin checks, SameSite cookies and tokens for route handlers.
---

# T29: Use anti-Cross-Site Request Forgery (CSRF) tokens

**Category:** CODE_FIX
**SD Elements:** [T29](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T29/)
**Priority:** 7

**Spec Context:**
> "O cliente deve escolher variações, aplicar cupons ... Inclua envio, cancelamento, devolução e reembolso total ou parcial ... reiniciar os dados"
> Source: specs/PRD.md, lines 27-37, 43

**What the spec implies (naive approach):**
Cookie-authenticated `POST /api/refunds` and `GET /api/simulation/reset` route handlers accept requests from any origin, so a malicious page can trigger refunds or wipe data while an admin is signed in.

**Secure Implementation Pattern:**
```ts
// src/lib/csrf.ts - for route handlers (Server Actions already verify Origin)
import "server-only";
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const expected = new URL(process.env.APP_BASE_URL!).origin;
  if (req.method !== "GET" && origin !== expected) throw new Response("Forbidden", { status: 403 });
}

// src/app/api/refunds/route.ts
export async function POST(req: Request) {
  assertSameOrigin(req);
  verifyCsrfToken(req.headers.get("x-csrf-token"), await cookies()); // double-submit, HMAC-signed
  await requirePermission("refunds:issue");
  // ...
}
```

**Implementation Guidance:**
- Prefer Next.js Server Actions for mutations. They only accept POST and check `Origin` against `Host`. Configure `serverActions.allowedOrigins` explicitly.
- Never perform mutations on GET (reset, logout, cancel, add-to-cart).
- For route handlers called by the browser, check `Origin` and require an HMAC-signed double-submit token.
- Keep Supabase auth cookies `SameSite=Lax` (or Strict for back-office), `Secure` and `HttpOnly`.
- Exclude the Stripe webhook from CSRF checks. It authenticates by signature instead (T558).

**Success Criteria:**
- [ ] No state change is reachable via GET
- [ ] A cross-origin POST to a mutation endpoint returns 403
- [ ] Every route-handler mutation verifies the CSRF token

**Status:** Pending
