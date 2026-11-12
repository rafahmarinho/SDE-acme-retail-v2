---
name: t279-safe-dynamic-code-loading
description: Restrict dynamic code loading to bundled local modules (next/dynamic) and pinned first-party scripts (Stripe.js), never from user input or untrusted CDNs.
---

# T279: Avoid dynamically loading any code without proper security considerations

**Category:** CODE_FIX
**SD Elements:** [T279](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T279/)
**Priority:** 8

**Spec Context:**
> "deve usar Next.js, React e TypeScript" ... "adapter opcional para Stripe Checkout" ... "integrações externas simuladas"
> Source: specs/PRD.md, lines 7-9, 17, 33-35

**What the spec implies (naive approach):**
The optional payment adapter is chosen with `await import(\`./adapters/${process.env.PAYMENT_PROVIDER ?? req.query.provider}\`)`, and third-party widgets are injected with `<script src={cmsValue}>`.

**Secure Implementation Pattern:**
```ts
// src/services/payments.ts
import { simulatedProvider } from "./payments/simulated";
const PROVIDERS = {
  simulated: async () => simulatedProvider,
  stripe: async () => (await import("./payments/stripe")).stripeProvider, // static specifier => bundled
} as const;

export async function getProvider() {
  const key = z.enum(["simulated", "stripe"]).parse(process.env.PAYMENT_PROVIDER ?? "simulated");
  return PROVIDERS[key]();
}
```
```tsx
// Stripe.js from the official loader only
import { loadStripe } from "@stripe/stripe-js";
```

**Implementation Guidance:**
- Use only static import specifiers (`next/dynamic(() => import("./X"))`), so code is bundled at build time.
- Select the provider from a fixed map and server configuration, never from request data.
- Load external scripts only from allowlisted origins enforced by CSP `script-src` (T66). Use `@stripe/stripe-js` rather than raw `<script>` tags.
- No `eval`/`new Function`.

**Success Criteria:**
- [ ] No dynamic `import()` with template or variable specifiers
- [ ] CSP blocks scripts from non-allowlisted origins
- [ ] The payment provider is selected from a fixed enum

**Status:** Applied

**Implementation (2026-11-12):** `src/services/payments.ts` uses a static `import("stripe")` and picks the provider from a validated env enum. The CSP (`src/lib/csp.ts`) allows no third-party script origins, so Stripe.js isn't loaded (Checkout is a redirect). ESLint enforces `no-eval`, `no-implied-eval` and `no-new-func`.
