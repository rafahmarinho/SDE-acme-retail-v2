---
name: t151-secure-random-numbers
description: Use cryptographically secure randomness for order numbers, tracking tokens, coupon codes, idempotency keys and CSRF tokens; reserve Math.random for non-security simulation noise.
---

# T151: Use cryptographically secure random numbers

**Category:** CODE_FIX
**SD Elements:** [T151](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T151/)
**Priority:** 7

**Spec Context:**
> "aplicar cupons ... rastreamento ... Prepare dados de demonstração com quarenta produtos e sessenta pedidos ... avançar a simulação"
> Source: specs/PRD.md, lines 25-27, 41-43

**What the spec implies (naive approach):**
`Math.random()` generates coupon codes, public tracking tokens, order numbers and simulated payment IDs, so attackers can guess other customers' tracking links or valid coupons.

**Secure Implementation Pattern:**
```ts
import { randomBytes, randomUUID, randomInt } from "node:crypto";

export const newOrderId      = () => randomUUID();                       // primary key
export const newTrackingTok  = () => randomBytes(24).toString("base64url"); // 192-bit, unguessable
export const newCouponCode   = () => Array.from({ length: 10 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)]).join("");
export const idempotencyKey  = () => randomUUID();

// Simulation: seeded PRNG is OK for reproducible *non-security* scenarios only
```

**Implementation Guidance:**
- Use `crypto.randomUUID`, `randomBytes` and `randomInt` (Node) or `crypto.getRandomValues` (browser) for anything an attacker could benefit from guessing.
- Keep a deterministic seeded PRNG only inside `services/simulation.ts`, documented as non-security.
- Add a lint rule banning `Math.random` outside the simulation module.

**Success Criteria:**
- [ ] `Math.random` doesn't appear outside the simulation code
- [ ] Tracking tokens have ≥ 128 bits of entropy
- [ ] Coupon codes are not sequential or predictable

**Status:** Applied

**Implementation (2026-11-12):** Tracking tokens are 192-bit `gen_random_bytes(24)` and primary keys are `gen_random_uuid()`. Payment refs use `gen_random_bytes`, and channel IDs use `crypto.randomUUID()`. ESLint bans `Math.random`; Postgres `random()` is used only in the simulation functions.
