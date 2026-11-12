---
name: t59-standard-crypto-libraries
description: Use only vetted cryptographic implementations (Node crypto / Web Crypto, Stripe SDK, Supabase Auth) for signatures, tokens and hashing; never homemade crypto.
---

# T59: Use standard libraries for cryptography

**Category:** CODE_FIX
**SD Elements:** [T59](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T59/)
**Priority:** 8

**Spec Context:**
> "login por e-mail e senha" ... "adapter opcional para Stripe Checkout em modo de teste" ... "rastreamento"
> Source: specs/PRD.md, lines 5-7, 25, 33-35

**What the spec implies (naive approach):**
The developer writes their own "signature" for tracking links (`base64(orderId + secret)`), verifies Stripe webhooks by string-comparing hashes, or hashes passwords with SHA-256.

**Secure Implementation Pattern:**
```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function signToken(payload: string) {
  return createHmac("sha256", process.env.LINK_SIGNING_SECRET!).update(payload).digest("base64url");
}
export function verifyToken(payload: string, sig: string) {
  const a = Buffer.from(signToken(payload)); const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Stripe webhooks: use the SDK, never hand-rolled verification
const event = stripe.webhooks.constructEvent(rawBody, req.headers.get("stripe-signature")!, process.env.STRIPE_WEBHOOK_SECRET!);
```

**Implementation Guidance:**
- Leave password hashing to Supabase Auth (bcrypt). Never store or hash passwords in app tables.
- Use `node:crypto` / Web Crypto for HMAC, random values (T151) and AES-GCM. Use `jose` for any JWT work.
- Use the official Stripe SDK for webhook verification.
- Never use Base64, ROT13 or compression as "encryption".

**Success Criteria:**
- [ ] No custom crypto primitives in `src/`
- [ ] No password columns in `public` tables
- [ ] Signature comparisons use `timingSafeEqual` or SDK helpers

**Status:** Pending
