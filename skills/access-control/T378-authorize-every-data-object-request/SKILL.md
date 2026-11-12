---
name: t378-authorize-every-data-object-request
description: Prevent IDOR on orders, returns, tracking, profiles and refunds by authorizing each object access against the session user ID, both in services and in RLS.
---

# T378: Authorize every request for data objects

**Category:** CODE_FIX
**SD Elements:** [T378](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T378/)
**Priority:** 8

**Spec Context:**
> "Crie páginas de ... resultado do pagamento, conta, pedidos, rastreamento e devoluções ... Inclua envio, cancelamento, devolução e reembolso total ou parcial"
> Source: specs/PRD.md, lines 23-25, 35-37

**What the spec implies (naive approach):**
`/orders/[id]`, `/tracking/[id]`, `/returns/new?orderId=` and `/checkout/result?order=` load the order by the ID in the URL, so any signed-in user can view or return someone else's order.

**Secure Implementation Pattern:**
```sql
-- supabase/migrations/xxxx_orders_rls.sql
alter table public.orders enable row level security;
create policy "customers read own orders" on public.orders
  for select using (customer_id = auth.uid() or public.has_permission('orders:read_all'));
create policy "customers create returns for own orders" on public.returns
  for insert with check (exists (
    select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));
```
```ts
// src/services/orders.ts
export async function getOrderForCurrentUser(orderId: string) {
  const supabase = await createServerClient();            // user-scoped client => RLS applies
  const { data, error } = await supabase.from("orders")
    .select("id, number, status_payment, status_delivery, total, items:order_items(product_name, qty, unit_price)")
    .eq("id", z.string().uuid().parse(orderId))
    .maybeSingle();
  if (!data) notFound();                                   // 404, don't reveal existence
  return data;
}
```

**Implementation Guidance:**
- Use the user-scoped Supabase client (anon key + session) for all customer reads, so RLS enforces ownership.
- Take the owner ID from `auth.uid()` / the session, never from the request body or query.
- Use UUIDs for order IDs, and a separate human-readable order number for display.
- Return 404 for objects the user doesn't own.
- Check ownership for property-level updates too (for example, customers cannot change `status_payment`).
- Tracking links shared publicly need a random, expiring token, not a guessable order number.

**Success Criteria:**
- [ ] User A gets 404 for user B's order, tracking and return pages
- [ ] RLS policies exist on orders, order_items, returns, refunds, profiles and favorites
- [ ] Customers cannot update payment, delivery or refund status fields

**Status:** Pending
