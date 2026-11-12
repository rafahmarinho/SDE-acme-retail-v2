---
name: t38-bind-sql-variables
description: Prevent SQL injection in search, filters, coupons and Postgres functions by always binding variables and never concatenating untrusted data into SQL or PostgREST filter strings.
---

# T38: Bind variables in SQL statements

**Category:** CODE_FIX
**SD Elements:** [T38](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T38/)
**Priority:** 10

**Spec Context:**
> "Supabase para PostgreSQL ... Inclua ... busca, filtros ... com busca no cabeçalho, categorias, grade de produtos ... aplicar cupons"
> Source: specs/PRD.md, lines 5, 11, 19-21, 27-29

**What the spec implies (naive approach):**
Header search builds `.or(\`name.ilike.%${q}%,description.ilike.%${q}%\`)` from raw input, or a Postgres function runs `EXECUTE 'select ... where code = ''' || p_code || ''''`. Both are injectable.

**Secure Implementation Pattern:**
```ts
// src/services/catalog.ts
const Search = z.object({ q: z.string().trim().max(80).optional(), category: z.string().uuid().optional() });

export async function searchProducts(raw: unknown) {
  const { q, category } = Search.parse(raw);
  const supabase = await createServerClient();
  // full-text search via RPC with bound parameters
  const { data } = await supabase.rpc("search_products", { p_query: q ?? "", p_category: category ?? null });
  return data;
}
```
```sql
create or replace function public.search_products(p_query text, p_category uuid)
returns setof public.products language sql stable security invoker set search_path = '' as $$
  select p.* from public.products p
  where (p_category is null or p.category_id = p_category)
    and (p_query = '' or p.search_tsv @@ websearch_to_tsquery('english', p_query))
  limit 50;
$$;
```

**Implementation Guidance:**
- Use the supabase-js query builder methods (`.eq`, `.ilike`, `.in`) with values as arguments. Never interpolate user input into `.or()`, `.filter()` or `.textSearch()` raw strings.
- In PL/pgSQL, use `EXECUTE ... USING` or `format('%I', ...)` for identifiers, and never `||` with user data.
- Validate the type and shape with zod before querying (UUIDs, enums for sort fields).
- Add a CI grep/ESLint check for template literals passed to `.or(` and `.filter(`.

**Success Criteria:**
- [ ] No string-built SQL or PostgREST filters contain user input
- [ ] Search input `'); drop table products;--` returns 0 results and no error leak
- [ ] All RPC functions use bound parameters and `set search_path = ''`

**Status:** Pending
