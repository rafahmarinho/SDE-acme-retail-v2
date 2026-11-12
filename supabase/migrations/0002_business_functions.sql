-- ACME Retail - business rules as security definer functions with explicit authorization.
-- Every write to orders/payments/inventory/returns/refunds goes through these functions (T19, T378, T558).
-- All functions: set search_path = '' and bound parameters only (T38).

-- ---------------------------------------------------------------------------------------------
-- Rate limiting (fixed window) - T1362
-- ---------------------------------------------------------------------------------------------
create or replace function app.rate_limit_hit(p_key text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_hits int;
begin
  insert into app.rate_limits as r (key, window_start, hits)
  values (left(p_key, 200), now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

-- service-role only wrapper used by the app for IP-based limits (login, password reset)
create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int) returns boolean
language sql security definer set search_path = '' as $$
  select app.rate_limit_hit(p_key, least(greatest(p_max, 1), 1000), least(greatest(p_window_seconds, 1), 86400))
$$;

-- ---------------------------------------------------------------------------------------------
-- Validation helpers
-- ---------------------------------------------------------------------------------------------
create or replace function app.validate_address(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'INVALID_ADDRESS' using errcode = '22023';
  end if;
  v := jsonb_build_object(
    'full_name', btrim(coalesce(p ->> 'full_name', '')),
    'line1', btrim(coalesce(p ->> 'line1', '')),
    'line2', nullif(btrim(coalesce(p ->> 'line2', '')), ''),
    'city', btrim(coalesce(p ->> 'city', '')),
    'region', nullif(btrim(coalesce(p ->> 'region', '')), ''),
    'postal_code', btrim(coalesce(p ->> 'postal_code', '')),
    'country', upper(btrim(coalesce(p ->> 'country', ''))));
  if char_length(v ->> 'full_name') not between 2 and 120
     or char_length(v ->> 'line1') not between 3 and 120
     or char_length(coalesce(v ->> 'line2', '')) > 120
     or char_length(v ->> 'city') not between 2 and 80
     or char_length(coalesce(v ->> 'region', '')) > 80
     or (v ->> 'postal_code') !~ '^[A-Za-z0-9 -]{3,10}$'
     or (v ->> 'country') !~ '^[A-Z]{2}$' then
    raise exception 'INVALID_ADDRESS' using errcode = '22023';
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Pricing: single source of truth for prices, coupons, illustrative shipping & tax.
-- Client-supplied prices are never used.
-- ---------------------------------------------------------------------------------------------
create or replace function app.price_cart(p_items jsonb, p_coupon text, p_method text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_lines jsonb := '[]'::jsonb;
  v_subtotal numeric(10, 2) := 0;
  v_discount numeric(10, 2) := 0;
  v_shipping numeric(10, 2);
  v_tax numeric(10, 2);
  v_coupon public.coupons;
  v_coupon_ok boolean := false;
  v_coupon_msg text;
  v_all_ok boolean := true;
  v_ok boolean;
  r record;
begin
  if p_method is null or p_method not in ('standard', 'express') then
    raise exception 'INVALID_SHIPPING_METHOD' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'CART_TOO_LARGE' using errcode = '22023';
  end if;

  for r in
    with req as (
      select (e ->> 'variant_id')::uuid as variant_id, sum((e ->> 'qty')::int)::int as qty
      from jsonb_array_elements(p_items) e
      group by 1)
    select req.variant_id, req.qty, v.sku, v.name as variant_name, v.active as v_active,
           p.id as product_id, p.name as product_name, p.slug, p.active as p_active, p.accent, p.image_path,
           coalesce(v.price, p.base_price) as unit_price,
           coalesce(i.on_hand - i.reserved, 0) as available
    from req
    left join public.product_variants v on v.id = req.variant_id
    left join public.products p on p.id = v.product_id
    left join public.inventory i on i.variant_id = v.id
    order by p.name, v.sort
  loop
    if r.qty is null or r.qty < 1 or r.qty > 20 then
      raise exception 'INVALID_QUANTITY' using errcode = '22023';
    end if;
    if r.sku is null then
      v_all_ok := false;
      v_lines := v_lines || jsonb_build_object('variant_id', r.variant_id, 'qty', r.qty, 'missing', true, 'ok', false);
      continue;
    end if;
    v_ok := r.v_active and r.p_active and r.available >= r.qty;
    if not v_ok then
      v_all_ok := false;
    end if;
    v_lines := v_lines || jsonb_build_object(
      'variant_id', r.variant_id, 'product_id', r.product_id, 'product_name', r.product_name, 'slug', r.slug,
      'variant_name', r.variant_name, 'sku', r.sku, 'unit_price', r.unit_price, 'qty', r.qty,
      'line_total', round(r.unit_price * r.qty, 2), 'available', greatest(r.available, 0),
      'accent', r.accent, 'image_path', r.image_path, 'missing', false, 'ok', v_ok);
    v_subtotal := v_subtotal + round(r.unit_price * r.qty, 2);
  end loop;

  if coalesce(p_coupon, '') <> '' then
    select * into v_coupon from public.coupons c where c.code = upper(p_coupon);
    if not found or not v_coupon.active
       or (v_coupon.expires_at is not null and v_coupon.expires_at < now())
       or (v_coupon.max_redemptions is not null and v_coupon.redemptions >= v_coupon.max_redemptions) then
      v_coupon_msg := 'This coupon is not valid.';
    elsif v_subtotal < v_coupon.min_subtotal then
      v_coupon_msg := format('This coupon requires a subtotal of at least $%s.', v_coupon.min_subtotal);
    else
      v_coupon_ok := true;
      v_coupon_msg := v_coupon.description;
      v_discount := case v_coupon.kind
        when 'percent' then round(v_subtotal * v_coupon.value / 100, 2)
        when 'fixed' then least(v_coupon.value, v_subtotal)
        else 0 end;
    end if;
  end if;

  v_shipping := case
    when v_subtotal = 0 then 0
    when p_method = 'express' then 14.99
    when v_subtotal - v_discount >= 75 then 0
    else 5.99 end;
  if v_coupon_ok and v_coupon.kind = 'free_shipping' then
    v_shipping := 0;
  end if;
  v_tax := round((v_subtotal - v_discount) * 0.08, 2);

  return jsonb_build_object(
    'lines', v_lines,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'shipping', v_shipping,
    'tax', v_tax,
    'tax_rate', 0.08,
    'total', v_subtotal - v_discount + v_shipping + v_tax,
    'all_available', v_all_ok,
    'coupon', case when coalesce(p_coupon, '') <> '' then
      jsonb_build_object('code', upper(p_coupon), 'valid', v_coupon_ok, 'message', v_coupon_msg) end);
end $$;

-- Public quote (cart drawer, checkout). Coupons only for signed-in users, rate limited (T1362).
create or replace function public.quote_cart(p_items jsonb, p_coupon text default null, p_method text default 'standard')
returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(p_coupon, '') <> '' then
    if auth.uid() is null then
      return app.price_cart(p_items, null, p_method)
        || jsonb_build_object('coupon', jsonb_build_object('code', upper(p_coupon), 'valid', false,
                                                           'message', 'Sign in to apply coupons.'));
    end if;
    if not app.rate_limit_hit('coupon:' || auth.uid()::text, 20, 600) then
      raise exception 'RATE_LIMITED' using errcode = 'P0429';
    end if;
    if char_length(p_coupon) > 24 then
      return app.price_cart(p_items, null, p_method)
        || jsonb_build_object('coupon', jsonb_build_object('code', left(upper(p_coupon), 24), 'valid', false,
                                                           'message', 'This coupon is not valid.'));
    end if;
  end if;
  return app.price_cart(p_items, p_coupon, p_method);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Inventory reservation helpers
-- ---------------------------------------------------------------------------------------------
create or replace function app.release_reservation(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.inventory i
     set reserved = greatest(i.reserved - x.qty, 0)
    from (select variant_id, sum(qty)::int as qty from public.order_items
          where order_id = p_order and variant_id is not null group by 1) x
   where i.variant_id = x.variant_id;
  update public.orders set reservation_expires_at = null where id = p_order;
end $$;

create or replace function app.commit_reservation(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.inventory i
     set on_hand = i.on_hand - least(x.qty, i.on_hand),
         reserved = greatest(i.reserved - x.qty, 0)
    from (select variant_id, sum(qty)::int as qty from public.order_items
          where order_id = p_order and variant_id is not null group by 1) x
   where i.variant_id = x.variant_id;
  update public.orders set reservation_expires_at = null where id = p_order;
end $$;

-- Releases stock held by abandoned checkouts (default hold: 15 minutes).
create or replace function app.expire_reservations() returns int
language plpgsql security definer set search_path = '' as $$
declare
  v record;
  n int := 0;
begin
  for v in
    select id from public.orders
     where reservation_expires_at is not null and reservation_expires_at < now()
       and status_payment in ('pending', 'requires_action', 'declined', 'timed_out')
     for update skip locked
  loop
    perform app.release_reservation(v.id);
    update public.orders
       set status_payment = 'expired', status_delivery = 'cancelled', cancelled_at = now()
     where id = v.id;
    insert into public.events (type, order_id, data)
    values ('order.expired', v.id, jsonb_build_object('reason', 'Checkout not completed within 15 minutes'));
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function app.approve_order(p_order uuid, p_provider_ref text, p_actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  perform app.commit_reservation(p_order);
  update public.orders
     set status_payment = 'approved', status_delivery = 'processing',
         provider_ref = coalesce(p_provider_ref, provider_ref)
   where id = p_order;
  if o.coupon_code is not null then
    update public.coupons set redemptions = redemptions + 1 where code = o.coupon_code;
  end if;
  insert into public.payments (order_id, provider, scenario, status, amount, provider_ref)
  values (p_order, o.payment_provider, o.payment_scenario, 'approved', o.total, p_provider_ref);
  insert into public.events (type, order_id, actor_id, data)
  values ('payment.approved', p_order, p_actor, jsonb_build_object('amount', o.total, 'provider', o.payment_provider));
end $$;

-- ---------------------------------------------------------------------------------------------
-- Checkout
-- ---------------------------------------------------------------------------------------------
create or replace function public.place_order(
  p_items jsonb, p_coupon text, p_method text, p_address jsonb, p_provider text default 'simulated')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_addr jsonb;
  q jsonb;
  l jsonb;
  v_order uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  -- T558: only the provider the store is configured for (store_settings, migration 0007)
  if p_provider is null or p_provider not in ('simulated', 'stripe') or p_provider <> app.payment_provider() then
    raise exception 'INVALID_PROVIDER' using errcode = '22023';
  end if;
  if not app.rate_limit_hit('checkout:' || v_uid::text, 10, 600) then
    raise exception 'RATE_LIMITED' using errcode = 'P0429';
  end if;
  v_addr := app.validate_address(p_address);
  perform app.expire_reservations();

  -- anti-hoarding: at most 3 open checkouts holding stock per customer
  if (select count(*) from public.orders
       where customer_id = v_uid and reservation_expires_at is not null and reservation_expires_at > now()) >= 3 then
    raise exception 'TOO_MANY_OPEN_CHECKOUTS' using errcode = 'P0429';
  end if;

  q := app.price_cart(p_items, p_coupon, p_method);
  if (q ->> 'subtotal')::numeric <= 0 then
    raise exception 'EMPTY_CART' using errcode = '22023';
  end if;
  if not (q ->> 'all_available')::boolean then
    raise exception 'OUT_OF_STOCK' using errcode = 'P0409';
  end if;
  if coalesce(p_coupon, '') <> '' and not coalesce((q -> 'coupon' ->> 'valid')::boolean, false) then
    raise exception 'INVALID_COUPON' using errcode = '22023';
  end if;

  -- reserve stock atomically; concurrent checkouts cannot oversell
  for l in select * from jsonb_array_elements(q -> 'lines') loop
    update public.inventory
       set reserved = reserved + (l ->> 'qty')::int
     where variant_id = (l ->> 'variant_id')::uuid
       and on_hand - reserved >= (l ->> 'qty')::int;
    if not found then
      raise exception 'OUT_OF_STOCK' using errcode = 'P0409';
    end if;
  end loop;

  insert into public.orders (customer_id, subtotal, discount, shipping, tax, total, coupon_code, shipping_method,
                             shipping_address, payment_provider, reservation_expires_at)
  values (v_uid, (q ->> 'subtotal')::numeric, (q ->> 'discount')::numeric, (q ->> 'shipping')::numeric,
          (q ->> 'tax')::numeric, (q ->> 'total')::numeric,
          case when coalesce((q -> 'coupon' ->> 'valid')::boolean, false) then upper(p_coupon) end,
          p_method, v_addr, p_provider,
          -- Stripe Checkout sessions live at least 30 minutes, so hold stock a bit longer for them
          now() + case when p_provider = 'stripe' then interval '35 minutes' else interval '15 minutes' end)
  returning id into v_order;

  insert into public.order_items (order_id, product_id, variant_id, product_name, variant_name, sku, unit_price, qty, line_total)
  select v_order, (x ->> 'product_id')::uuid, (x ->> 'variant_id')::uuid, x ->> 'product_name', x ->> 'variant_name',
         x ->> 'sku', (x ->> 'unit_price')::numeric, (x ->> 'qty')::int, (x ->> 'line_total')::numeric
  from jsonb_array_elements(q -> 'lines') x;

  insert into public.events (type, order_id, actor_id, data)
  values ('order.placed', v_order, v_uid,
          jsonb_build_object('total', q -> 'total', 'lines', jsonb_array_length(q -> 'lines'), 'provider', p_provider));
  return v_order;
end $$;

-- Simulated payment provider: approve / decline / authenticate (challenge) / timeout. No real money.
create or replace function public.pay_order(p_order_id uuid, p_scenario text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_ref text := 'sim_' || encode(extensions.gen_random_bytes(8), 'hex');
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if p_scenario is null or p_scenario not in ('approve', 'decline', 'authenticate', 'timeout') then
    raise exception 'INVALID_SCENARIO' using errcode = '22023';
  end if;
  if not app.rate_limit_hit('pay:' || auth.uid()::text, 20, 600) then
    raise exception 'RATE_LIMITED' using errcode = 'P0429';
  end if;
  perform app.expire_reservations();

  select * into o from public.orders where id = p_order_id for update;
  if not found or o.customer_id <> auth.uid() then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- T558: the simulated provider can only settle orders while the store runs in simulated mode
  if o.payment_provider <> 'simulated' or app.payment_provider() <> 'simulated' then
    raise exception 'WRONG_PROVIDER' using errcode = '22023';
  end if;
  if o.status_payment not in ('pending', 'declined', 'timed_out') or o.reservation_expires_at is null then
    raise exception 'ORDER_NOT_PAYABLE' using errcode = 'P0409';
  end if;

  update public.orders set payment_scenario = p_scenario where id = o.id;

  if p_scenario = 'approve' then
    perform app.approve_order(o.id, v_ref, auth.uid());
    return 'approved';
  end if;

  update public.orders
     set status_payment = case p_scenario when 'decline' then 'declined'::public.payment_status
                                          when 'authenticate' then 'requires_action'::public.payment_status
                                          else 'timed_out'::public.payment_status end
   where id = o.id;
  insert into public.payments (order_id, provider, scenario, status, amount, provider_ref)
  values (o.id, 'simulated', p_scenario,
          case p_scenario when 'decline' then 'declined'::public.payment_status
                          when 'authenticate' then 'requires_action'::public.payment_status
                          else 'timed_out'::public.payment_status end,
          o.total, v_ref);
  insert into public.events (type, order_id, actor_id, data)
  values (case p_scenario when 'decline' then 'payment.declined'
                          when 'authenticate' then 'payment.requires_action'
                          else 'payment.timed_out' end,
          o.id, auth.uid(), jsonb_build_object('amount', o.total));
  return case p_scenario when 'decline' then 'declined' when 'authenticate' then 'requires_action' else 'timed_out' end;
end $$;

create or replace function public.complete_payment_challenge(p_order_id uuid, p_success boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  perform app.expire_reservations();
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.customer_id is distinct from auth.uid() then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if o.status_payment <> 'requires_action' or o.reservation_expires_at is null then
    raise exception 'ORDER_NOT_PAYABLE' using errcode = 'P0409';
  end if;
  if o.payment_provider <> 'simulated' or app.payment_provider() <> 'simulated' then
    raise exception 'WRONG_PROVIDER' using errcode = '22023';
  end if;
  if p_success then
    perform app.approve_order(o.id, 'sim_3ds_' || encode(extensions.gen_random_bytes(6), 'hex'), auth.uid());
    return 'approved';
  end if;
  update public.orders set status_payment = 'declined' where id = o.id;
  insert into public.payments (order_id, provider, scenario, status, amount)
  values (o.id, 'simulated', 'authenticate', 'declined', o.total);
  insert into public.events (type, order_id, actor_id, data)
  values ('payment.declined', o.id, auth.uid(), jsonb_build_object('reason', 'Authentication failed'));
  return 'declined';
end $$;

-- Stripe (test mode) confirmation. Called ONLY by the server with the service role after verifying
-- the Stripe session / webhook signature (T558).
create or replace function public.mark_order_paid_external(p_order_id uuid, p_provider_ref text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.payment_provider <> 'stripe' then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if o.status_payment = 'approved' then
    return 'approved';                                         -- idempotent (webhook + redirect)
  end if;
  if o.reservation_expires_at is null then
    raise exception 'ORDER_NOT_PAYABLE' using errcode = 'P0409';
  end if;
  perform app.approve_order(o.id, p_provider_ref, null);
  return 'approved';
end $$;

-- ---------------------------------------------------------------------------------------------
-- Order lifecycle: cancel, ship, deliver
-- ---------------------------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_is_staff boolean := app.has_permission('orders:fulfil');
  v_remaining numeric(10, 2);
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found or not (o.customer_id = auth.uid() or v_is_staff) then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if o.status_delivery not in ('unfulfilled', 'processing')
     or o.status_payment in ('expired', 'voided', 'refunded') then
    raise exception 'ORDER_NOT_CANCELLABLE' using errcode = 'P0409';
  end if;
  if char_length(coalesce(p_reason, '')) not between 3 and 300 then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;

  if o.status_payment in ('approved', 'partially_refunded') then
    update public.inventory i
       set on_hand = i.on_hand + x.qty
      from (select variant_id, sum(qty - returned_qty)::int as qty from public.order_items
            where order_id = o.id and variant_id is not null group by 1) x
     where i.variant_id = x.variant_id;
    v_remaining := o.total - o.refunded_total;
    if v_remaining > 0 then
      insert into public.refunds (order_id, amount, reason, created_by)
      values (o.id, v_remaining, 'Order cancelled: ' || p_reason, auth.uid());
      insert into public.events (type, order_id, actor_id, data)
      values ('refund.issued', o.id, auth.uid(), jsonb_build_object('amount', v_remaining, 'reason', 'cancellation'));
    end if;
    update public.orders set status_payment = 'refunded', refunded_total = total where id = o.id;
  elsif o.reservation_expires_at is not null then
    perform app.release_reservation(o.id);
    update public.orders set status_payment = 'voided' where id = o.id;
  else
    update public.orders set status_payment = 'voided' where id = o.id;
  end if;

  update public.orders set status_delivery = 'cancelled', cancelled_at = now() where id = o.id;
  insert into public.events (type, order_id, actor_id, data)
  values ('order.cancelled', o.id, auth.uid(),
          jsonb_build_object('by', case when o.customer_id = auth.uid() then 'customer' else 'staff' end,
                             'reason', p_reason));
end $$;

create or replace function public.ship_order(p_order_id uuid, p_carrier text, p_tracking text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_tracking text := upper(coalesce(nullif(btrim(p_tracking), ''), 'TRK' || encode(extensions.gen_random_bytes(6), 'hex')));
begin
  perform app.require_permission('orders:fulfil');
  if p_carrier not in ('UPS', 'FedEx', 'USPS', 'DHL') then
    raise exception 'INVALID_CARRIER' using errcode = '22023';
  end if;
  if v_tracking !~ '^[A-Z0-9]{8,30}$' then
    raise exception 'INVALID_TRACKING_NUMBER' using errcode = '22023';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if o.status_delivery <> 'processing' or o.status_payment not in ('approved', 'partially_refunded') then
    raise exception 'ORDER_NOT_SHIPPABLE' using errcode = 'P0409';
  end if;
  update public.orders
     set status_delivery = 'shipped', carrier = p_carrier, tracking_number = v_tracking, shipped_at = now()
   where id = o.id;
  insert into public.events (type, order_id, actor_id, data)
  values ('order.shipped', o.id, auth.uid(), jsonb_build_object('carrier', p_carrier, 'tracking_number', v_tracking));
end $$;

create or replace function public.mark_delivered(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_permission('orders:fulfil');
  update public.orders set status_delivery = 'delivered', delivered_at = now()
   where id = p_order_id and status_delivery = 'shipped';
  if not found then
    raise exception 'ORDER_NOT_DELIVERABLE' using errcode = 'P0409';
  end if;
  insert into public.events (type, order_id, actor_id, data) values ('order.delivered', p_order_id, auth.uid(), '{}');
end $$;

-- ---------------------------------------------------------------------------------------------
-- Returns and refunds
-- ---------------------------------------------------------------------------------------------
create or replace function public.request_return(p_order_id uuid, p_items jsonb, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  e jsonb;
  it public.order_items;
  v_pending int;
  v_items jsonb := '[]'::jsonb;
  v_value numeric := 0;
  v_amount numeric(10, 2);
  v_id uuid;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.customer_id is distinct from auth.uid() then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if o.status_delivery <> 'delivered' then
    raise exception 'ORDER_NOT_RETURNABLE' using errcode = 'P0409';
  end if;
  if o.delivered_at < now() - interval '30 days' then
    raise exception 'RETURN_WINDOW_CLOSED' using errcode = 'P0409';
  end if;
  if char_length(coalesce(p_reason, '')) not between 3 and 500 then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'INVALID_RETURN_ITEMS' using errcode = '22023';
  end if;

  for e in select * from jsonb_array_elements(p_items) loop
    select * into it from public.order_items where id = (e ->> 'order_item_id')::uuid and order_id = o.id;
    if not found or (e ->> 'qty')::int < 1 then
      raise exception 'INVALID_RETURN_ITEMS' using errcode = '22023';
    end if;
    select coalesce(sum((x ->> 'qty')::int), 0) into v_pending
      from public.returns r, jsonb_array_elements(r.items) x
     where r.order_id = o.id and r.status in ('requested', 'approved') and (x ->> 'order_item_id')::uuid = it.id;
    if (e ->> 'qty')::int > it.qty - it.returned_qty - v_pending then
      raise exception 'RETURN_QTY_EXCEEDED' using errcode = '22023';
    end if;
    v_items := v_items || jsonb_build_object('order_item_id', it.id, 'qty', (e ->> 'qty')::int,
                                             'sku', it.sku, 'product_name', it.product_name, 'variant_name', it.variant_name);
    v_value := v_value + it.unit_price * (e ->> 'qty')::int;
  end loop;

  -- proportional share of what was paid for goods (includes discount and tax, excludes shipping)
  v_amount := case when o.subtotal > 0 then round(v_value / o.subtotal * (o.total - o.shipping), 2) else 0 end;
  v_amount := least(v_amount, o.total - o.refunded_total);

  insert into public.returns (order_id, customer_id, reason, items, amount_suggested)
  values (o.id, o.customer_id, p_reason, v_items, v_amount)
  returning id into v_id;
  insert into public.events (type, order_id, actor_id, data)
  values ('return.requested', o.id, auth.uid(), jsonb_build_object('return_id', v_id, 'items', jsonb_array_length(v_items)));
  return v_id;
end $$;

create or replace function public.review_return(p_return_id uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.returns;
begin
  perform app.require_permission('returns:manage');
  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'INVALID_NOTE' using errcode = '22023';
  end if;
  select * into r from public.returns where id = p_return_id for update;
  if not found or r.status <> 'requested' then
    raise exception 'RETURN_NOT_REVIEWABLE' using errcode = 'P0409';
  end if;
  update public.returns
     set status = case when p_approve then 'approved'::public.return_status else 'rejected'::public.return_status end,
         staff_note = p_note
   where id = r.id;
  insert into public.events (type, order_id, actor_id, data)
  values (case when p_approve then 'return.approved' else 'return.rejected' end, r.order_id, auth.uid(),
          jsonb_build_object('return_id', r.id));
end $$;

create or replace function public.receive_return(p_return_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.returns;
  e jsonb;
  v_variant uuid;
begin
  perform app.require_permission('returns:manage');
  select * into r from public.returns where id = p_return_id for update;
  if not found or r.status <> 'approved' then
    raise exception 'RETURN_NOT_RECEIVABLE' using errcode = 'P0409';
  end if;
  for e in select * from jsonb_array_elements(r.items) loop
    update public.order_items set returned_qty = returned_qty + (e ->> 'qty')::int
     where id = (e ->> 'order_item_id')::uuid
     returning variant_id into v_variant;
    if v_variant is not null then
      update public.inventory set on_hand = on_hand + (e ->> 'qty')::int where variant_id = v_variant;
    end if;
  end loop;
  update public.returns set status = 'received' where id = r.id;
  if not exists (select 1 from public.order_items where order_id = r.order_id and returned_qty < qty) then
    update public.orders set status_delivery = 'returned' where id = r.order_id;
  end if;
  insert into public.events (type, order_id, actor_id, data)
  values ('return.received', r.order_id, auth.uid(), jsonb_build_object('return_id', r.id));
end $$;

create or replace function public.issue_refund(p_order_id uuid, p_amount numeric, p_reason text, p_return_id uuid default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  r public.returns;
  v_amount numeric(10, 2) := round(p_amount, 2);
  v_id uuid;
begin
  perform app.require_permission('refunds:issue');
  -- T338: refunds above $200 need a password sign-in within the last 30 minutes (JWT amr)
  if round(p_amount, 2) > 200 then
    perform app.require_recent_auth(30);
  end if;
  if char_length(coalesce(p_reason, '')) not between 3 and 300 then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if o.status_payment not in ('approved', 'partially_refunded') then
    raise exception 'ORDER_NOT_REFUNDABLE' using errcode = 'P0409';
  end if;
  if v_amount is null or v_amount <= 0 or v_amount > o.total - o.refunded_total then
    raise exception 'INVALID_REFUND_AMOUNT' using errcode = '22023';
  end if;
  if p_return_id is not null then
    select * into r from public.returns where id = p_return_id and order_id = o.id for update;
    if not found or r.status <> 'received' then
      raise exception 'RETURN_NOT_REFUNDABLE' using errcode = 'P0409';
    end if;
    update public.returns set status = 'refunded' where id = r.id;
  end if;

  insert into public.refunds (order_id, return_id, amount, reason, created_by)
  values (o.id, p_return_id, v_amount, p_reason, auth.uid())
  returning id into v_id;
  update public.orders
     set refunded_total = refunded_total + v_amount,
         status_payment = case when refunded_total + v_amount >= total then 'refunded'::public.payment_status
                               else 'partially_refunded'::public.payment_status end
   where id = o.id;
  insert into public.events (type, order_id, actor_id, data)
  values ('refund.issued', o.id, auth.uid(),
          jsonb_build_object('amount', v_amount, 'refund_id', v_id, 'return_id', p_return_id,
                             'kind', case when o.refunded_total + v_amount >= o.total then 'full' else 'partial' end));
  return v_id;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Inventory & users (back-office)
-- ---------------------------------------------------------------------------------------------
create or replace function public.adjust_inventory(p_variant_id uuid, p_delta int, p_reason text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_on_hand int;
begin
  perform app.require_permission('inventory:write');
  if p_delta is null or p_delta = 0 or abs(p_delta) > 10000 then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;
  if char_length(coalesce(p_reason, '')) not between 3 and 200 then
    raise exception 'INVALID_REASON' using errcode = '22023';
  end if;
  if not exists (select 1 from public.product_variants where id = p_variant_id) then
    raise exception 'UNKNOWN_VARIANT' using errcode = 'P0002';
  end if;
  insert into public.inventory (variant_id, on_hand) values (p_variant_id, 0) on conflict (variant_id) do nothing;
  update public.inventory set on_hand = on_hand + p_delta
   where variant_id = p_variant_id and on_hand + p_delta >= reserved
   returning on_hand into v_on_hand;
  if not found then
    raise exception 'INVALID_STOCK_LEVEL' using errcode = '22023';
  end if;
  insert into public.events (type, actor_id, data)
  values ('inventory.adjusted', auth.uid(), jsonb_build_object('variant_id', p_variant_id, 'delta', p_delta,
                                                                'on_hand', v_on_hand, 'reason', p_reason));
  return v_on_hand;
end $$;

create or replace function public.set_user_role(p_user_id uuid, p_role public.app_role) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_permission('users:manage');
  perform app.require_recent_auth(30); -- T338 step-up enforced in the database
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_CHANGE_OWN_ROLE' using errcode = '22023';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Read helpers
-- ---------------------------------------------------------------------------------------------
create or replace function public.my_permissions() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('role', app.user_role(), 'permissions', to_jsonb(app.permissions_for(app.user_role())))
$$;

-- Catalog search: bound parameters, allowlisted sort, bounded page size (T38, T42, T2600). RLS applies.
create or replace function public.search_products(
  p_query text default null, p_category text default null, p_min numeric default null, p_max numeric default null,
  p_in_stock boolean default false, p_sort text default 'featured', p_limit int default 24, p_offset int default 0)
returns table (
  id uuid, slug text, name text, brand text, base_price numeric, min_price numeric, max_price numeric,
  image_path text, accent text, category_slug text, category_name text, available int, featured boolean,
  total_count bigint)
language sql stable security invoker set search_path = '' as $$
  with params as (
    select left(btrim(coalesce(p_query, '')), 80) as q),
  base as (
    select p.id, p.slug, p.name, p.brand, p.base_price, p.image_path, p.accent, p.featured, p.created_at,
           c.slug as category_slug, c.name as category_name,
           (select min(coalesce(v.price, p.base_price)) from public.product_variants v where v.product_id = p.id and v.active) as min_price,
           (select max(coalesce(v.price, p.base_price)) from public.product_variants v where v.product_id = p.id and v.active) as max_price,
           (select coalesce(sum(greatest(i.on_hand - i.reserved, 0)), 0)::int
              from public.product_variants v join public.inventory i on i.variant_id = v.id
             where v.product_id = p.id and v.active) as available
      from public.products p
      join public.categories c on c.id = p.category_id, params
     where p.active
       and (p_category is null or c.slug = p_category)
       and (params.q = ''
            or p.search_tsv @@ websearch_to_tsquery('english', params.q)
            or p.name ilike '%' || replace(replace(replace(params.q, '\', '\\'), '%', '\%'), '_', '\_') || '%'))
  select id, slug, name, brand, base_price, min_price, max_price, image_path, accent, category_slug, category_name,
         available, featured, count(*) over () as total_count
    from base
   where (p_min is null or min_price >= p_min)
     and (p_max is null or min_price <= p_max)
     and (not coalesce(p_in_stock, false) or available > 0)
   order by
     case when p_sort = 'price-asc' then min_price end asc,
     case when p_sort = 'price-desc' then min_price end desc,
     case when p_sort = 'newest' then created_at end desc,
     case when p_sort = 'name' then name end asc,
     featured desc, name asc
   limit least(greatest(coalesce(p_limit, 24), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 10000)
$$;

create or replace function public.admin_list_users(p_search text default null, p_limit int default 25, p_offset int default 0)
returns table (id uuid, email text, full_name text, role public.app_role, created_at timestamptz,
               last_sign_in_at timestamptz, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_permission('customers:read');
  return query
    select p.id, u.email::text, p.full_name, p.role, p.created_at, u.last_sign_in_at, count(*) over ()
      from public.profiles p join auth.users u on u.id = p.id
     where coalesce(p_search, '') = ''
        or p.full_name ilike '%' || replace(replace(left(p_search, 60), '%', '\%'), '_', '\_') || '%'
        or u.email ilike '%' || replace(replace(left(p_search, 60), '%', '\%'), '_', '\_') || '%'
     order by p.role desc, p.full_name
     limit least(greatest(coalesce(p_limit, 25), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
end $$;

create or replace function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
begin
  perform app.require_permission('backoffice:access');
  v := jsonb_build_object(
    'products_active', (select count(*) from public.products where active),
    'variants_low_stock', (select count(*) from public.inventory where on_hand - reserved between 1 and 5),
    'variants_out_of_stock', (select count(*) from public.inventory where on_hand - reserved <= 0));
  if app.has_permission('orders:read_all') then
    v := v || jsonb_build_object(
      'orders_30d', (select count(*) from public.orders where created_at > now() - interval '30 days'),
      'revenue_30d', (select coalesce(sum(total - refunded_total), 0) from public.orders
                       where created_at > now() - interval '30 days'
                         and status_payment in ('approved', 'partially_refunded', 'refunded')),
      'awaiting_fulfilment', (select count(*) from public.orders where status_delivery = 'processing'),
      'in_transit', (select count(*) from public.orders where status_delivery = 'shipped'),
      'open_returns', (select count(*) from public.returns where status in ('requested', 'approved', 'received')),
      'refunded_30d', (select coalesce(sum(amount), 0) from public.refunds where created_at > now() - interval '30 days'));
  end if;
  return v;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Grants (functions are NOT executable by default - revoked in 0001)
-- ---------------------------------------------------------------------------------------------
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema app from public, anon, authenticated;
grant execute on function app.user_role(), app.has_permission(text), app.permissions_for(public.app_role) to anon, authenticated;

grant execute on function public.quote_cart(jsonb, text, text) to anon, authenticated;
grant execute on function public.search_products(text, text, numeric, numeric, boolean, text, int, int) to anon, authenticated;
grant execute on function public.my_permissions() to anon, authenticated;

grant execute on function public.place_order(jsonb, text, text, jsonb, text) to authenticated;
grant execute on function public.pay_order(uuid, text) to authenticated;
grant execute on function public.complete_payment_challenge(uuid, boolean) to authenticated;
grant execute on function public.cancel_order(uuid, text) to authenticated;
grant execute on function public.request_return(uuid, jsonb, text) to authenticated;
-- back-office (permission checked inside)
grant execute on function public.ship_order(uuid, text, text) to authenticated;
grant execute on function public.mark_delivered(uuid) to authenticated;
grant execute on function public.review_return(uuid, boolean, text) to authenticated;
grant execute on function public.receive_return(uuid) to authenticated;
grant execute on function public.issue_refund(uuid, numeric, text, uuid) to authenticated;
grant execute on function public.adjust_inventory(uuid, int, text) to authenticated;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_list_users(text, int, int) to authenticated;
grant execute on function public.admin_dashboard() to authenticated;
-- server-only (service role)
grant execute on function public.mark_order_paid_external(uuid, text) to service_role;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
