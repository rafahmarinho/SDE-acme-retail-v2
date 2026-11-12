---
name: t2600-limit-query-result-size
description: Cap and paginate result sets for catalog search, order lists, inventory, refunds and event logs to prevent data scraping and resource exhaustion.
---

# T2600: Control the result set size returned by a query

**Category:** CODE_FIX
**SD Elements:** [T2600](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T2600/)
**Priority:** 7

**Spec Context:**
> "Inclua ... busca, filtros, estados de carregamento ... grade de produtos ... painel de produtos, estoque, pedidos e reembolsos ... consultar eventos"
> Source: specs/PRD.md, lines 11, 21, 25-27, 43

**What the spec implies (naive approach):**
The product grid, admin order list and events page call `.select("*")` with no limit, or accept `?limit=100000` from the client.

**Secure Implementation Pattern:**
```ts
// src/db/pagination.ts
export const Page = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(24),
});

export function range({ page, pageSize }: z.infer<typeof Page>) {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1] as const;
}

// usage
const p = Page.parse(searchParams);
const { data, count } = await supabase.from("orders")
  .select("id, number, total, status_payment, status_delivery", { count: "estimated" })
  .order("created_at", { ascending: false })
  .range(...range(p));
```

**Implementation Guidance:**
- Enforce a server-side maximum page size (for example 50) on every list endpoint, whatever the client sends.
- Set the PostgREST `max_rows` in Supabase (API settings) as a global backstop.
- Select explicit columns, never `*` (this also supports T2139).
- For exports (finance reports), stream in batches with a hard cap and restrict them to the finance/admin roles.

**Success Criteria:**
- [ ] All list endpoints are paginated with max ≤ 50
- [ ] PostgREST `max_rows` is configured
- [ ] `?pageSize=10000` is clamped or rejected

**Status:** Pending
