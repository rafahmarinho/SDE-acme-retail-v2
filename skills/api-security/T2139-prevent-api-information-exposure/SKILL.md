---
name: t2139-prevent-api-information-exposure
description: Return only explicitly selected fields through response DTOs from ACME Retail APIs and Server Components; never expose full database rows, cost prices, other customers' data or internal errors.
---

# T2139: Prevent information exposure through APIs

**Category:** CODE_FIX
**SD Elements:** [T2139](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T2139/)
**Priority:** 7

**Spec Context:**
> "Organize o projeto em telas, componentes, serviços e acesso ao banco" ... "a API na Vercel" ... "salve o preço usado na compra"
> Source: specs/PRD.md, lines 9, 29, 49

**What the spec implies (naive approach):**
`supabase.from("orders").select("*, profiles(*)")` is passed straight to the client. That leaks customer emails and addresses, internal cost and margin, payment provider IDs and the stack traces of errors.

**Secure Implementation Pattern:**
```ts
// src/services/orders.ts
const OrderSummaryDTO = z.object({
  id: z.string().uuid(), number: z.string(), createdAt: z.string(),
  total: z.number(), statusPayment: z.enum(["pending","approved","declined","refunded","partially_refunded"]),
  statusDelivery: z.enum(["processing","shipped","delivered","returned","cancelled"]),
});

export async function listMyOrders() {
  const { data } = await (await createServerClient()).from("orders")
    .select("id, number, created_at, total, status_payment, status_delivery").limit(50);
  return z.array(OrderSummaryDTO).parse(data?.map(toCamel));
}
```

**Implementation Guidance:**
- Use explicit column lists, never `select("*")` in code that serves clients.
- Validate outbound data against DTO schemas (an extra layer that catches accidental fields).
- Pass only DTOs from Server Components to Client Components. Props are serialized to the browser.
- Return generic error bodies (`{ error: "Something went wrong", ref }`) and log the details server-side.
- Remove unused API routes and Supabase RPC functions. Revoke `execute` on internal functions from `anon`/`authenticated`.

**Success Criteria:**
- [ ] No `select("*")` in client-serving code (lint check)
- [ ] All API responses are validated against DTO schemas
- [ ] Error responses contain no stack traces or SQL

**Status:** Pending
