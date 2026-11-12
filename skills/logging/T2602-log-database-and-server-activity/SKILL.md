---
name: t2602-log-database-and-server-activity
description: Log significant database and server events (data changes on orders, payments, inventory, refunds; config changes; failures) with actor, IDs and values, using Postgres triggers and structured app logs.
---

# T2602: Log typical database and server activities and related metadata

**Category:** CODE_FIX
**SD Elements:** [T2602](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T2602/)
**Priority:** 8

**Spec Context:**
> "Reserve o estoque durante o checkout e salve o preço usado na compra ... mantendo status de pagamento e entrega separados ... consultar eventos"
> Source: specs/PRD.md, lines 29-37, 43

**What the spec implies (naive approach):**
Status columns are overwritten in place with no history, so nobody can tell who changed a payment to "refunded" or when stock was adjusted.

**Secure Implementation Pattern:**
```sql
create or replace function audit.track_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into audit.log(actor_id, action, target, details)
  values (auth.uid(), tg_op || ':' || tg_table_name, coalesce(new.id, old.id)::text,
          jsonb_build_object('old', to_jsonb(old) - 'shipping_address', 'new', to_jsonb(new) - 'shipping_address'));
  return coalesce(new, old);
end $$;

create trigger orders_audit after insert or update or delete on public.orders
  for each row execute function audit.track_change();
-- repeat for payments, inventory, refunds, profiles(role), coupons
```
```ts
// app logs: structured JSON, no PII
logger.info({ evt: "checkout.reserve", orderId, items: n, durationMs });
```

**Implementation Guidance:**
- Track inserts, updates and deletes on business tables (old/new values minus PII fields) via triggers into `audit.log` (T349).
- Log in the app: auth failures, authorization denials, 4xx/5xx spikes, payment outcomes, simulation actions.
- Include the actor ID, object IDs, timestamp and request ID. Exclude secrets, tokens and addresses.
- Enable Supabase Postgres logs and Vercel runtime logs. Set retention to the policy requirement.

**Success Criteria:**
- [ ] Every status change on orders, payments and refunds has an audit row with the actor
- [ ] Logs are structured JSON with request IDs
- [ ] No PII or secrets appear in logs (sample review)

**Status:** Pending
