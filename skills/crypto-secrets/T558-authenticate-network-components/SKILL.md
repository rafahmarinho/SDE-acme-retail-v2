---
name: t558-authenticate-network-components
description: Mutually authenticate every network peer - Supabase (keys over TLS), Stripe (secret key, signed webhooks), internal cron/simulation endpoints (bearer secrets) - before exchanging data.
---

# T558: Authenticate all other components before any network communication with them

**Category:** CODE_FIX
**SD Elements:** [T558](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T558/)
**Priority:** 9

**Spec Context:**
> "Supabase para PostgreSQL, login por e-mail e senha, arquivos e atualizações em tempo real ... integrações externas simuladas" ... "adapter opcional para Stripe Checkout"
> Source: specs/PRD.md, lines 5-9, 33-35

**What the spec implies (naive approach):**
The payment result page trusts `?status=approved` in the redirect URL, the Stripe webhook route accepts any POST, and the "advance simulation" cron endpoint is publicly callable.

**Secure Implementation Pattern:**
```ts
// src/app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  const raw = await req.text();
  const event = stripe.webhooks.constructEvent(raw, req.headers.get("stripe-signature")!, serverEnv.STRIPE_WEBHOOK_SECRET!);
  await markPaymentFromStripeEvent(event);   // idempotent on event.id
  return new Response(null, { status: 200 });
}

// src/app/checkout/result/page.tsx - never trust query params for status
const session = await stripe.checkout.sessions.retrieve(searchParams.session_id); // server-to-server, authenticated

// src/app/api/cron/advance/route.ts
if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response(null, { status: 401 });
```

**Implementation Guidance:**
- Supabase: connect only to the configured `https://<ref>.supabase.co` with the anon/service key (TLS verifies the server, T156).
- Stripe: verify webhook signatures and re-fetch the session server-side to confirm the payment status.
- Simulated provider: payment outcomes come from server state, never from client-supplied flags.
- Protect internal endpoints (cron, simulation, seed) with secrets and admin authorization.

**Success Criteria:**
- [ ] Unsigned or forged webhooks are rejected (400)
- [ ] `?status=approved` in the URL cannot mark an order paid
- [ ] The cron endpoint returns 401 without the secret

**Status:** Applied

**Implementation (2026-11-12):** Stripe sessions are re-fetched server-side and webhooks are signature-checked (`src/services/payments.ts`, `src/app/api/webhooks/stripe/route.ts`). The cron endpoint needs a constant-time bearer secret, and `mark_order_paid_external` is service-role only. **New:** `store_settings.payment_provider` (migration 0007) is enforced by `place_order`, `pay_order` and `complete_payment_challenge`, so clients can't choose the simulated provider when the store runs Stripe (`tests/integration/hardening.test.ts`).
