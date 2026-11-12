---
name: t20-regenerate-session-ids
description: Generate unique session identifiers and rotate them after login and privilege changes to prevent session fixation, using Supabase Auth with @supabase/ssr cookies.
---

# T20: Generate unique session IDs and reset old IDs after authentication

**Category:** CODE_FIX
**SD Elements:** [T20](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T20/)
**Priority:** 9

**Spec Context:**
> "login por e-mail e senha ... Adapte a navegação aos perfis de usuário ... Tenha perfis de cliente, catálogo, estoque, financeiro e administrador."
> Source: specs/PRD.md, lines 5-7, 13-15, 37-39

**What the spec implies (naive approach):**
A custom "session" cookie holding the user ID or role, set from the client and reused after login or after an admin changes the user's role.

**Secure Implementation Pattern:**
```ts
// src/middleware.ts - only Supabase-issued sessions are recognized
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (c) => c.forEach(({ name, value, options }) =>
        res.cookies.set(name, value, { ...options, httpOnly: true, secure: true, sameSite: "lax" })),
    },
  });
  await supabase.auth.getUser(); // validates the JWT with Supabase and refreshes it
  return res;
}
```

**Implementation Guidance:**
- Never create your own session or role cookies. Rely only on Supabase Auth tokens, which are generated server-side and random.
- Use `supabase.auth.getUser()` (server-validated), not `getSession()`, for authorization decisions.
- After login, Supabase issues a new token pair, so discard any pre-login anonymous state (for example, merge the guest cart server-side and drop guest identifiers).
- When an admin changes a user's role, call `auth.admin.signOut(userId)` (service role) or force a refresh, so the old JWT claims are not reused.
- Set a short JWT expiry (for example 1 hour) with refresh-token rotation enabled in Supabase Auth settings.

**Success Criteria:**
- [ ] No application-defined session or role cookies exist
- [ ] Tokens change after a successful login
- [ ] Role changes invalidate existing sessions
- [ ] Authorization uses `getUser()` on the server

**Status:** Applied

**Implementation (2026-11-12):** `src/proxy.ts` + `src/db/server.ts` + `src/db/cookie-options.ts` (Supabase sessions only, httpOnly/SameSite/Secure cookies), `src/services/auth.ts` (`getUser()` validation, roles read from Postgres per request), `supabase/config.toml` (1 h JWT, refresh-token rotation).
