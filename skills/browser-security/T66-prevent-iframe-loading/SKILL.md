---
name: t66-prevent-iframe-loading
description: Prevent clickjacking on checkout, account and back-office pages by denying framing via CSP frame-ancestors and X-Frame-Options, together with a baseline Content-Security-Policy.
---

# T66: Prevent web pages from being loaded inside iFrame

**Category:** CODE_FIX
**SD Elements:** [T66](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T66/)
**Priority:** 7

**Spec Context:**
> "Crie páginas de ... carrinho, checkout, resultado do pagamento, conta ... além do painel de produtos, estoque, pedidos e reembolsos" ... "adapter opcional para Stripe Checkout"
> Source: specs/PRD.md, lines 23-27, 31-33

**What the spec implies (naive approach):**
No framing headers are set, so an attacker can frame "Confirm refund" or "Place order" buttons under a decoy page.

**Secure Implementation Pattern:**
```ts
// next.config.ts
const csp = [
  "default-src 'self'",
  "script-src 'self' https://js.stripe.com",
  "frame-src https://js.stripe.com https://checkout.stripe.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
  "img-src 'self' data: https://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com",
].join("; ");

export default {
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ]}];
  },
} satisfies NextConfig;
```

**Implementation Guidance:**
- Set `frame-ancestors 'none'` and `X-Frame-Options: DENY` globally. No page needs to be framed.
- Allow outbound framing (`frame-src`) only for Stripe when the Stripe adapter is enabled.
- Move to a nonce-based `script-src` with Next.js middleware once inline scripts are inventoried.

**Success Criteria:**
- [ ] CSP with `frame-ancestors 'none'` is on every response
- [ ] Embedding `/checkout` in an iframe on another origin is blocked
- [ ] The Stripe Checkout redirect still works

**Status:** Pending
