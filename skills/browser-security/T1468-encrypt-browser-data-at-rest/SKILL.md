---
name: t1468-encrypt-browser-data-at-rest
description: Avoid storing sensitive data (tokens, addresses, order details, PII) in localStorage/IndexedDB for the side cart, favorites and checkout; keep only non-sensitive identifiers client-side.
---

# T1468: Encrypt sensitive data at rest in the browser

**Category:** CODE_FIX
**SD Elements:** [T1468](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T1468/)
**Priority:** 9

**Spec Context:**
> "favoritos e carrinho lateral ... O cliente deve escolher variações, aplicar cupons ... Os resultados devem aparecer nas telas e continuar salvos após recarregar a aplicação."
> Source: specs/PRD.md, lines 21, 27, 45

**What the spec implies (naive approach):**
To "stay saved after reload", the app writes the whole cart, shipping address, email, and even the Supabase access token or payment result into `localStorage`.

**Secure Implementation Pattern:**
```ts
// src/lib/guest-cart.ts - only non-sensitive identifiers client-side
type GuestCart = { v: 1; items: { variantId: string; qty: number }[] }; // no prices, no PII

export function saveGuestCart(cart: GuestCart) {
  try { localStorage.setItem("acme.cart", JSON.stringify(cart)); } catch {}
}
// Signed-in users: cart, favorites, addresses persist server-side (Supabase, RLS).
// Prices are always recomputed on the server at checkout.
```

**Implementation Guidance:**
- Persistence after reload comes from the database ("dados persistidos"), not browser storage.
- Allowed client-side: guest cart variant IDs and quantities, UI preferences.
- Forbidden client-side: auth tokens outside the Supabase httpOnly cookies, addresses, emails, order or payment details, coupon secrets.
- Configure `@supabase/ssr` to use cookies (httpOnly), not localStorage, for sessions.
- If offline storage is ever needed, encrypt it with a server-derived key using Web Crypto AES-GCM (see the countermeasure how-to).
- Clear client storage on logout (T1539).

**Success Criteria:**
- [ ] `localStorage`/`sessionStorage` contain no PII or tokens (checked in a browser test)
- [ ] Sessions use httpOnly cookies
- [ ] Prices in client storage are never trusted by the server

**Status:** Applied

**Implementation (2026-11-12):** `src/components/cart/cart-context.tsx` stores only zod-validated `{variantId, qty}`. Sessions use httpOnly cookies, the Realtime token is kept in memory (`src/components/live-refresh.tsx`), prices are always re-quoted by `price_cart`, and storage is cleared on logout.
