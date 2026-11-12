---
name: t536-restrict-incoming-message-size
description: Bound the size and shape of every incoming API message (cart, checkout, coupons, product admin, simulation) with zod schemas and byte limits.
---

# T536: Restrict the size of incoming messages in services

**Category:** CODE_FIX
**SD Elements:** [T536](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T536/)
**Priority:** 8

**Spec Context:**
> "a API na Vercel" ... "O cliente deve escolher variações, aplicar cupons" ... "painel de produtos, estoque, pedidos e reembolsos"
> Source: specs/PRD.md, lines 25-29, 49

**What the spec implies (naive approach):**
Handlers do `await req.json()` on any size and accept carts with 100,000 line items or product descriptions of many megabytes.

**Secure Implementation Pattern:**
```ts
// src/lib/body.ts
export async function readJson<T>(req: Request, schema: z.ZodType<T>, maxBytes = 32_768): Promise<T> {
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new HttpError(413);
  return schema.parse(JSON.parse(text));
}

export const CartUpdate = z.object({
  items: z.array(z.object({ variantId: z.string().uuid(), qty: z.number().int().min(1).max(20) })).max(50),
  coupon: z.string().regex(/^[A-Z0-9-]{3,24}$/).optional(),
});
```

**Implementation Guidance:**
- Give every endpoint and Server Action a zod schema with `.max()` on strings and arrays.
- Set per-endpoint byte caps (JSON 32 KB; product admin 128 KB).
- Validate size and MIME for file uploads before issuing signed upload URLs (T214).
- When calling Stripe or Supabase, send only bounded, validated payloads.

**Success Criteria:**
- [ ] Every mutation input has a bounded zod schema
- [ ] Oversized bodies return 413
- [ ] A cart with more than 50 lines or qty > 20 is rejected

**Status:** Applied

**Implementation (2026-11-12):** `src/lib/schemas.ts` has bounded schemas (cart ≤ 50 lines, qty ≤ 20, capped strings), and `src/lib/http.ts` `readJson` byte-caps request bodies. On top of that: the Server Action body limit, the webhook size cap, the 2 MB upload check, and DB-level `CART_TOO_LARGE`/`INVALID_QUANTITY`.
