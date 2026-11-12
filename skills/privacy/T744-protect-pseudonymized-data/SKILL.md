---
name: t744-protect-pseudonymized-data
description: Use pseudonymous identifiers (user UUIDs) in events, logs and data shared with processors such as Stripe, and keep the mapping to real identities access-controlled.
---

# T744: Protect pseudonymized personal information

**Category:** CODE_FIX
**SD Elements:** [T744](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T744/)
**Priority:** 8

**Spec Context:**
> "consultar eventos" ... "adapter opcional para Stripe Checkout em modo de teste" ... "Tenha perfis de cliente, catálogo, estoque, financeiro e administrador."
> Source: specs/PRD.md, lines 33-39, 43

**What the spec implies (naive approach):**
Event logs and Stripe metadata contain `customer_email`, `full_name` and `address`. Every back-office role can read the full events table.

**Secure Implementation Pattern:**
```ts
// events carry pseudonymous IDs only
await logEvent({ type: "order.paid", actorId: user.id, orderId, amount });

// Stripe: pass the internal reference, not identity fields
await stripe.checkout.sessions.create({
  mode: "payment",
  client_reference_id: orderId,
  metadata: { order_id: orderId },        // no names/addresses
  line_items, success_url, cancel_url,
});
```

**Implementation Guidance:**
- Use the user/order UUID as the pseudonym in events, logs and processor metadata.
- The mapping (UUID to profile) lives in `profiles`, readable only by the owner and the admin role (RLS).
- Re-identification for support goes through an audited admin action.
- Don't send identifying data to Stripe beyond what Checkout itself collects.

**Success Criteria:**
- [ ] Event and log payloads contain no names, emails or addresses
- [ ] Stripe metadata holds only internal IDs
- [ ] Profile-to-UUID lookup is restricted by RLS

**Status:** Pending
