---
name: t257-secure-cors
description: Configure a strict CORS allowlist for the Vercel-hosted API so only the ACME Retail web origin can make credentialed cross-origin calls, without relying on Origin for access control.
---

# T257: Secure cross origin resource sharing (CORS)

**Category:** CODE_FIX
**SD Elements:** [T257](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T257/)
**Priority:** 8

**Spec Context:**
> "README com os passos para rodar e publicar a versão web e a API na Vercel."
> Source: specs/PRD.md, lines 47-49

**What the spec implies (naive approach):**
Because the web app and API are published separately, the API sets `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`, or reflects any `Origin` header.

**Secure Implementation Pattern:**
```ts
// src/lib/cors.ts
const ALLOWED = new Set([process.env.APP_BASE_URL!]); // e.g. https://acme-retail.vercel.app

export function withCors(req: Request, res: Response) {
  const origin = req.headers.get("origin");
  if (origin && ALLOWED.has(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Vary", "Origin");
  }
  return res;
}

export function preflight(req: Request) {
  const res = new Response(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH");
  res.headers.set("Access-Control-Allow-Headers", "content-type,x-csrf-token");
  res.headers.set("Access-Control-Max-Age", "600");
  return withCors(req, res);
}
```

**Implementation Guidance:**
- Prefer one origin: serve the API under the same Next.js deployment (`/api/*`) so CORS isn't needed at all.
- If separate, keep an explicit origin allowlist from configuration. Never use `*` with credentials and never reflect arbitrary origins.
- Still authenticate and authorize every request (CORS isn't access control).
- Don't send CORS headers on admin/private endpoints that are never called cross-origin.
- Exclude Vercel preview URLs from production allowlists.

**Success Criteria:**
- [ ] Requests from `https://evil.example` get no ACAO header
- [ ] Credentials are allowed only for allowlisted origins
- [ ] Private endpoints still require auth regardless of Origin

**Status:** Pending
