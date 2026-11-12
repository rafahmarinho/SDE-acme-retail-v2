---
name: t1539-clear-browser-data-on-logout
description: Send the Clear-Site-Data header on logout so cookies, local storage and cached pages for the ACME Retail origin are wiped from the browser.
---

# T1539: Clear browser data on user logout

**Category:** CODE_FIX
**SD Elements:** [T1539](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T1539/)
**Priority:** 8

**Spec Context:**
> "Inclua login, recuperação de senha, perfil, configurações ... favoritos e carrinho lateral ... conta, pedidos, rastreamento"
> Source: specs/PRD.md, lines 11, 21-25

**What the spec implies (naive approach):**
Logout calls `supabase.auth.signOut()` in the browser only. The cart, favorites, cached account pages and Realtime channels stay in the browser for the next person using the device.

**Secure Implementation Pattern:**
```ts
// src/app/auth/logout/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createServerClient();
  await supabase.auth.signOut(); // revokes the refresh token server-side
  const res = NextResponse.redirect(new URL("/", process.env.APP_BASE_URL), 303);
  res.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
  return res;
}
```

**Implementation Guidance:**
- Do logout with a POST route handler (CSRF-safe, see T29), never a GET link.
- Send `Clear-Site-Data: "cache", "cookies", "storage"` on the logout response.
- On the client, unsubscribe Supabase Realtime channels before navigating.
- Set `Cache-Control: private, no-store` on account, orders and back-office pages.
- Give every authenticated layout an easy-to-reach logout control (T338).

**Success Criteria:**
- [ ] The logout response includes the Clear-Site-Data header
- [ ] After logout, the browser's back button doesn't show account data
- [ ] The refresh token is revoked server-side

**Status:** Applied

**Implementation (2026-11-12):** `src/app/auth/logout/route.ts` (POST only, Origin check, server-side `signOut`, `Clear-Site-Data: "cache", "cookies", "storage"`, `no-store`). The logout form is in the header on every page (`src/components/header.tsx`).
