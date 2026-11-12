---
name: t166-protect-against-json-hijacking
description: Return JSON API responses as top-level objects with application/json and require authenticated, CSRF-protected requests for sensitive JSON (orders, profile, refunds).
---

# T166: Protect against JSON hijacking

**Category:** CODE_FIX
**SD Elements:** [T166](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T166/)
**Priority:** 7

**Spec Context:**
> "a versão web e a API na Vercel" ... "conta, pedidos, rastreamento e devoluções"
> Source: specs/PRD.md, lines 23-25, 49

**What the spec implies (naive approach):**
`GET /api/orders` returns a bare JSON array of the user's orders, authenticated by cookie only, and is sometimes served as `text/html`.

**Secure Implementation Pattern:**
```ts
// src/lib/http.ts
export function json<T extends object>(data: T, init?: ResponseInit) {
  if (Array.isArray(data)) throw new Error("Wrap arrays: return { items: [...] }");
  return Response.json(data, {
    ...init,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store",
               "X-Content-Type-Options": "nosniff", ...init?.headers },
  });
}

// usage
return json({ items: orders, page, total });
```

**Implementation Guidance:**
- Always wrap lists in an object (`{ items: [...] }`).
- Always use `application/json` with `nosniff`.
- Send `Cache-Control: private, no-store` on user-specific data.
- Fetch sensitive JSON through Server Components or Actions where possible, rather than public GET endpoints.
- Combine this with the CSRF protections of T29 for any custom JSON GET that returns private data.

**Success Criteria:**
- [ ] No API returns a top-level JSON array
- [ ] All JSON responses use `application/json` and `nosniff`
- [ ] User-specific JSON is not cacheable

**Status:** Applied

**Implementation (2026-11-12):** `src/lib/http.ts` `json()` refuses top-level arrays and sets `application/json`, `nosniff` and `private, no-store`. Every route handler uses it. Unit-tested.
