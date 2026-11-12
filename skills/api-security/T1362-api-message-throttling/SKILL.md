---
name: t1362-api-message-throttling
description: Rate-limit login, password recovery, coupon validation, checkout and search APIs per IP and per user to stop brute force, coupon guessing and scraping.
---

# T1362: Perform message throttling in Web APIs

**Category:** CODE_FIX
**SD Elements:** [T1362](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T1362/)
**Priority:** 8

**Spec Context:**
> "login por e-mail e senha ... Inclua login, recuperação de senha ... busca ... aplicar cupons ... Reserve o estoque durante o checkout"
> Source: specs/PRD.md, lines 5-11, 27-29

**What the spec implies (naive approach):**
Unlimited login attempts, unlimited coupon validations (so codes can be enumerated), and unlimited checkouts, which let a bot reserve all inventory.

**Secure Implementation Pattern:**
```ts
// src/lib/rate-limit.ts - sliding window in Postgres (or Upstash Redis via Vercel Marketplace)
export async function rateLimit(key: string, { max, windowSec }: { max: number; windowSec: number }) {
  const admin = createAdminClient("rate-limit");
  const { data: allowed } = await admin.rpc("hit_rate_limit", { p_key: key, p_max: max, p_window: windowSec });
  if (!allowed) throw new HttpError(429, { "Retry-After": String(windowSec) });
}

// policies
await rateLimit(`login:ip:${ip}`, { max: 10, windowSec: 300 });
await rateLimit(`coupon:user:${userId}`, { max: 10, windowSec: 600 });
await rateLimit(`checkout:user:${userId}`, { max: 5, windowSec: 600 });
```

**Implementation Guidance:**
- Throttle per IP and per account. Use exponential backoff on repeated login failures.
- Rely on Supabase Auth's built-in rate limits for sign-in/OTP. Tune them in project settings, and add app-level limits on the custom endpoints.
- Make inventory reservations expire (for example after 15 minutes) and cap concurrent reservations per user.
- Return 429 with `Retry-After`. Log throttling events (T2602).

**Success Criteria:**
- [ ] The 11th login attempt in 5 minutes from one IP gets 429
- [ ] Coupon brute force is throttled
- [ ] Reservations expire, and one user cannot hold more than N reservations

**Status:** Pending
