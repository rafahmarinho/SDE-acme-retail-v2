-- ACME Retail - demo catalog (40 products), demo orders (60) and the simulation engine.
-- Demo data is synthetic (T544). Simulation randomness uses Postgres random(), which is acceptable
-- for non-security simulation only (T151). All simulation entry points require 'simulation:run' (T49).

create or replace function app.clamp_ts(t timestamptz) returns timestamptz
language sql stable set search_path = '' as $$ select least(t, now()) $$;

-- ---------------------------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------------------------
create or replace function app.seed_catalog() returns int
language plpgsql security definer set search_path = '' as $$
declare
  p record;
  v_pid uuid;
  v_cat uuid;
  v_idx int := 0;
  v_vidx int;
  v_opts text[];
  v_opt text;
  v_label text;
  v_price numeric(10, 2);
  v_vid uuid;
begin
  insert into public.categories (slug, name, description, sort) values
    ('apparel', 'Apparel', 'Everyday clothing made to last.', 1),
    ('footwear', 'Footwear', 'Shoes and boots for every step.', 2),
    ('home-kitchen', 'Home & Kitchen', 'Tools and comforts for the home.', 3),
    ('electronics', 'Electronics', 'Gadgets, audio and accessories.', 4),
    ('outdoor', 'Outdoor', 'Gear for trails and campsites.', 5),
    ('beauty', 'Beauty', 'Clean, simple everyday care.', 6);

  for p in
    select * from (values
      ('everyday-cotton-tee', 'Everyday Cotton Tee', 'Northline', 'apparel', 19.99, '#2563eb', true, 'size',
       'A soft, breathable crew-neck tee in combed cotton. Pre-shrunk, with a relaxed fit for daily wear.'),
      ('classic-oxford-shirt', 'Classic Oxford Shirt', 'Northline', 'apparel', 44.00, '#0ea5e9', false, 'size',
       'A button-down oxford shirt in a durable cotton weave that softens with every wash.'),
      ('merino-crew-sweater', 'Merino Crew Sweater', 'Northline', 'apparel', 79.00, '#7c3aed', true, 'size',
       'Fine-gauge merino wool that regulates temperature and resists odor. Warm without the bulk.'),
      ('relaxed-chino-pants', 'Relaxed Chino Pants', 'Northline', 'apparel', 54.00, '#a16207', false, 'size',
       'Stretch cotton chinos with a relaxed taper, deep pockets and a comfortable waistband.'),
      ('lightweight-rain-jacket', 'Lightweight Rain Jacket', 'Northline', 'apparel', 89.00, '#0f766e', false, 'size',
       'A packable, waterproof shell with taped seams and an adjustable hood.'),
      ('performance-running-shorts', 'Performance Running Shorts', 'Northline', 'apparel', 29.00, '#dc2626', false, 'size',
       'Quick-dry running shorts with a built-in liner and a zip pocket for keys.'),
      ('fleece-zip-hoodie', 'Fleece Zip Hoodie', 'Northline', 'apparel', 59.00, '#475569', false, 'size',
       'A midweight fleece hoodie with a full zip, kangaroo pockets and ribbed cuffs.'),
      ('organic-cotton-socks', 'Organic Cotton Socks (3-Pack)', 'Northline', 'apparel', 14.99, '#65a30d', false, 'size',
       'Cushioned crew socks in organic cotton with a reinforced heel and toe.'),
      ('trail-runner-pro', 'Trail Runner Pro', 'Stride & Co.', 'footwear', 129.00, '#ea580c', true, 'shoe',
       'Grippy lugged outsole, rock plate and a responsive midsole for technical trails.'),
      ('canvas-low-top-sneaker', 'Canvas Low-Top Sneaker', 'Stride & Co.', 'footwear', 49.00, '#f59e0b', false, 'shoe',
       'A timeless canvas sneaker with a vulcanized rubber sole and cushioned insole.'),
      ('leather-chelsea-boot', 'Leather Chelsea Boot', 'Stride & Co.', 'footwear', 159.00, '#78350f', false, 'shoe',
       'Full-grain leather Chelsea boots with elastic gussets and a stacked heel.'),
      ('recovery-slide', 'Recovery Slide', 'Stride & Co.', 'footwear', 34.00, '#14b8a6', false, 'shoe',
       'Contoured foam slides that support tired feet after a long run.'),
      ('waterproof-hiking-boot', 'Waterproof Hiking Boot', 'Stride & Co.', 'footwear', 149.00, '#57534e', false, 'shoe',
       'A waterproof membrane, ankle support and a Vibram-style outsole for long hikes.'),
      ('minimalist-court-shoe', 'Minimalist Court Shoe', 'Stride & Co.', 'footwear', 89.00, '#e11d48', false, 'shoe',
       'A clean leather court shoe with a cupsole and padded collar.'),
      ('cast-iron-skillet', 'Cast Iron Skillet 10"', 'Hearth Lane', 'home-kitchen', 39.00, '#1f2937', true, 'single',
       'Pre-seasoned cast iron that holds heat evenly. Oven, stovetop and campfire safe.'),
      ('pour-over-coffee-set', 'Pour-Over Coffee Set', 'Hearth Lane', 'home-kitchen', 45.00, '#92400e', false, 'single',
       'A ceramic dripper, glass carafe and 100 filters for a clean, bright cup.'),
      ('stoneware-dinner-plates', 'Stoneware Dinner Plates (Set of 4)', 'Hearth Lane', 'home-kitchen', 48.00, '#64748b', false, 'color:Sand|Slate|Sage',
       'Reactive-glaze stoneware plates that are dishwasher and microwave safe.'),
      ('linen-throw-blanket', 'Linen Throw Blanket', 'Hearth Lane', 'home-kitchen', 69.00, '#d97706', false, 'color:Oat|Charcoal',
       'A stonewashed linen throw that gets softer over time. 130 x 170 cm.'),
      ('chefs-knife-8', 'Chef''s Knife 8"', 'Hearth Lane', 'home-kitchen', 89.00, '#334155', true, 'single',
       'High-carbon stainless steel blade with a full tang and an ergonomic handle.'),
      ('glass-food-storage-set', 'Glass Food Storage Set', 'Hearth Lane', 'home-kitchen', 32.00, '#0891b2', false, 'single',
       'Ten borosilicate containers with leak-proof locking lids.'),
      ('bamboo-cutting-board', 'Bamboo Cutting Board', 'Hearth Lane', 'home-kitchen', 24.00, '#ca8a04', false, 'single',
       'A sturdy bamboo board with a juice groove, gentle on knife edges.'),
      ('ceramic-table-lamp', 'Ceramic Table Lamp', 'Hearth Lane', 'home-kitchen', 74.00, '#be185d', false, 'color:White|Terracotta',
       'A hand-glazed ceramic base with a linen shade and warm-dim LED bulb included.'),
      ('noise-cancelling-headphones', 'Wireless Noise-Cancelling Headphones', 'Voltix', 'electronics', 199.00, '#111827', true, 'color:Black|Silver',
       'Adaptive noise cancelling, 30-hour battery life and multipoint Bluetooth.'),
      ('portable-bluetooth-speaker', 'Portable Bluetooth Speaker', 'Voltix', 'electronics', 79.00, '#16a34a', false, 'color:Black|Green|Blue',
       'A rugged, waterproof speaker with 12 hours of rich, room-filling sound.'),
      ('smart-led-bulb-2-pack', 'Smart LED Bulb (2-Pack)', 'Voltix', 'electronics', 29.99, '#facc15', false, 'single',
       'Dimmable, color-changing bulbs with schedules and voice assistant support.'),
      ('fast-wireless-charger', 'Fast Wireless Charger', 'Voltix', 'electronics', 39.00, '#4f46e5', false, 'single',
       'A 15 W charging pad with foreign object detection and a braided cable.'),
      ('usb-c-hub-7-in-1', 'USB-C Hub 7-in-1', 'Voltix', 'electronics', 49.00, '#6b7280', false, 'single',
       'HDMI 4K, two USB-A, SD and microSD, and 100 W pass-through charging.'),
      ('fitness-tracker-band', 'Fitness Tracker Band', 'Voltix', 'electronics', 99.00, '#059669', false, 'color:Graphite|Mint',
       'Heart rate, sleep and step tracking with a 7-day battery.'),
      ('mechanical-keyboard', 'Mechanical Keyboard', 'Voltix', 'electronics', 119.00, '#9333ea', false, 'option:Tactile=119|Linear=119|Silent=129',
       'A hot-swappable 75% keyboard with PBT keycaps and per-key lighting.'),
      ('ultralight-2-person-tent', 'Ultralight 2-Person Tent', 'Summit Gear', 'outdoor', 249.00, '#15803d', true, 'single',
       'A freestanding two-door tent that weighs under 1.5 kg packed.'),
      ('insulated-water-bottle', 'Insulated Water Bottle 32oz', 'Summit Gear', 'outdoor', 34.00, '#0284c7', false, 'color:Glacier|Forest|Stone',
       'Double-wall vacuum insulation keeps drinks cold for 24 hours.'),
      ('down-sleeping-bag', 'Down Sleeping Bag', 'Summit Gear', 'outdoor', 189.00, '#b91c1c', false, 'option:Regular=189|Long=209',
       'Responsibly sourced 650-fill down, rated to -5 °C.'),
      ('trekking-poles-pair', 'Trekking Poles (Pair)', 'Summit Gear', 'outdoor', 69.00, '#525252', false, 'single',
       'Aluminum poles with cork grips and quick-lock adjustment.'),
      ('daypack-24l', 'Daypack 24L', 'Summit Gear', 'outdoor', 79.00, '#047857', false, 'color:Moss|Black',
       'A ventilated back panel, hip belt and hydration sleeve for day hikes.'),
      ('camping-headlamp', 'Camping Headlamp', 'Summit Gear', 'outdoor', 29.00, '#f97316', false, 'single',
       '400 lumens, red night mode and a USB-C rechargeable battery.'),
      ('mineral-sunscreen-spf50', 'Daily Mineral Sunscreen SPF 50', 'Bloom Botanics', 'beauty', 22.00, '#fb923c', false, 'volume:50 ml=22|100 ml=36',
       'A lightweight zinc sunscreen that is reef-friendly and leaves no white cast.'),
      ('hydrating-face-serum', 'Hydrating Face Serum', 'Bloom Botanics', 'beauty', 38.00, '#f472b6', true, 'single',
       'Hyaluronic acid and niacinamide for plump, balanced skin.'),
      ('shea-butter-hand-cream', 'Shea Butter Hand Cream', 'Bloom Botanics', 'beauty', 14.00, '#a3e635', false, 'single',
       'A rich, fast-absorbing hand cream with shea butter and calendula.'),
      ('bamboo-hair-brush', 'Bamboo Hair Brush', 'Bloom Botanics', 'beauty', 18.00, '#a8a29e', false, 'single',
       'A paddle brush with bamboo bristles that detangle gently.'),
      ('botanical-shampoo-bar', 'Botanical Shampoo Bar', 'Bloom Botanics', 'beauty', 12.00, '#22c55e', false, 'single',
       'A plastic-free shampoo bar with rosemary and peppermint oils.')
    ) as t (slug, name, brand, cat, price, accent, featured, vspec, descr)
  loop
    v_idx := v_idx + 1;
    select id into v_cat from public.categories where slug = p.cat;
    insert into public.products (slug, name, brand, description, category_id, base_price, accent, featured, created_at, updated_at)
    values (p.slug, p.name, p.brand, p.descr, v_cat, p.price, p.accent, p.featured,
            -- staggered launch dates so "newest" sorting is meaningful
            now() - make_interval(days => (41 - v_idx) * 3), now() - make_interval(days => (41 - v_idx) * 3))
    returning id into v_pid;

    v_opts := case
      when p.vspec = 'size' then array['S', 'M', 'L', 'XL']
      when p.vspec = 'shoe' then array['8', '9', '10', '11', '12']
      when p.vspec = 'single' then array['Standard']
      else string_to_array(split_part(p.vspec, ':', 2), '|') end;
    v_vidx := 0;
    foreach v_opt in array v_opts loop
      v_vidx := v_vidx + 1;
      v_label := split_part(v_opt, '=', 1);
      v_price := case when position('=' in v_opt) > 0 then split_part(v_opt, '=', 2)::numeric end;
      insert into public.product_variants (product_id, sku, name, size, color, price, sort)
      values (v_pid,
              'AC' || lpad(v_idx::text, 3, '0') || '-' || left(regexp_replace(upper(v_label), '[^A-Z0-9]', '', 'g'), 10),
              case when p.vspec in ('size', 'shoe') then 'Size ' || v_label else v_label end,
              case when p.vspec in ('size', 'shoe') or p.vspec like 'volume:%' then v_label end,
              case when p.vspec like 'color:%' then v_label end,
              v_price, v_vidx)
      returning id into v_vid;
      insert into public.inventory (variant_id, on_hand)
      values (v_vid, case
        when v_idx % 13 = 0 and v_vidx = 1 then 0               -- a few sold-out variants
        when v_idx % 9 = 0 then 3                                -- low stock
        else 15 + ((v_idx * 7 + v_vidx * 13) % 85) end);
    end loop;
  end loop;

  insert into public.coupons (code, description, kind, value, min_subtotal, expires_at, max_redemptions) values
    ('WELCOME10', '10% off your order', 'percent', 10, 0, null, null),
    ('SAVE20', '$20 off orders of $100 or more', 'fixed', 20, 100, null, null),
    ('FREESHIP', 'Free standard shipping', 'free_shipping', 0, 0, null, null),
    ('SPRING5', '5% off (expired)', 'percent', 5, 0, now() - interval '1 day', null),
    ('VIP50', '50% off (fully redeemed)', 'percent', 50, 0, null, 0);
  return v_idx;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Simulation primitives
-- ---------------------------------------------------------------------------------------------
create or replace function app.sim_random_items(n int, p_require_stock boolean default true) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select jsonb_agg(jsonb_build_object('variant_id', x.id, 'qty', 1 + floor(random() * 2)::int))
    from (select v.id
            from public.product_variants v
            join public.products p on p.id = v.product_id
            join public.inventory i on i.variant_id = v.id
           where v.active and p.active and (not p_require_stock or i.on_hand - i.reserved >= 3)
           order by random()
           limit greatest(n, 1)) x
$$;

create or replace function app.sim_address(p_customer uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v jsonb;
  v_name text;
  v_streets text[] := array['Maple Ave', 'Oak Street', 'Pine Road', 'Cedar Lane', 'Elm Court', 'Birch Way', 'Willow Drive'];
  v_cities text[] := array['Springfield|IL|62701', 'Riverton|WY|82501', 'Fairview|OR|97024', 'Lakeside|CA|92040',
                           'Greenville|SC|29601', 'Madison|WI|53703', 'Burlington|VT|05401'];
  v_city text;
begin
  select jsonb_build_object('full_name', a.full_name, 'line1', a.line1, 'line2', a.line2, 'city', a.city,
                            'region', a.region, 'postal_code', a.postal_code, 'country', a.country)
    into v
    from public.addresses a where a.user_id = p_customer and a.is_default;
  if v is not null then
    return v;
  end if;
  select coalesce(nullif(full_name, ''), 'Demo Customer') into v_name from public.profiles where id = p_customer;
  v_city := v_cities[1 + floor(random() * array_length(v_cities, 1))::int];
  return jsonb_build_object(
    'full_name', coalesce(v_name, 'Demo Customer'),
    'line1', (100 + floor(random() * 8900))::int || ' ' || v_streets[1 + floor(random() * array_length(v_streets, 1))::int],
    'line2', null, 'city', split_part(v_city, '|', 1), 'region', split_part(v_city, '|', 2),
    'postal_code', split_part(v_city, '|', 3), 'country', 'US');
end $$;

create or replace function app.sim_create_order(p_customer uuid, p_items jsonb, p_method text, p_coupon text, p_at timestamptz)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  q jsonb := app.price_cart(p_items, p_coupon, p_method);
  v_order uuid;
begin
  insert into public.orders (customer_id, subtotal, discount, shipping, tax, total, coupon_code, shipping_method,
                             shipping_address, payment_provider, payment_scenario, created_at, updated_at)
  values (p_customer, (q ->> 'subtotal')::numeric, (q ->> 'discount')::numeric, (q ->> 'shipping')::numeric,
          (q ->> 'tax')::numeric, (q ->> 'total')::numeric,
          case when coalesce((q -> 'coupon' ->> 'valid')::boolean, false) then upper(p_coupon) end,
          p_method, app.sim_address(p_customer), 'simulated', 'approve', p_at, p_at)
  returning id into v_order;
  insert into public.order_items (order_id, product_id, variant_id, product_name, variant_name, sku, unit_price, qty, line_total)
  select v_order, (x ->> 'product_id')::uuid, (x ->> 'variant_id')::uuid, x ->> 'product_name', x ->> 'variant_name',
         x ->> 'sku', (x ->> 'unit_price')::numeric, (x ->> 'qty')::int, (x ->> 'line_total')::numeric
    from jsonb_array_elements(q -> 'lines') x
   where not (x ->> 'missing')::boolean;
  insert into public.events (type, order_id, actor_id, data, created_at)
  values ('order.placed', v_order, p_customer, jsonb_build_object('total', q -> 'total', 'simulated', true), p_at);
  return v_order;
end $$;

create or replace function app.sim_pay(p_order uuid, p_at timestamptz, p_approve boolean, p_reason text default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if p_approve then
    update public.inventory i
       set on_hand = greatest(i.on_hand - x.qty, i.reserved)
      from (select variant_id, sum(qty)::int as qty from public.order_items where order_id = p_order group by 1) x
     where i.variant_id = x.variant_id;
    update public.orders set status_payment = 'approved', status_delivery = 'processing',
           provider_ref = 'sim_' || encode(extensions.gen_random_bytes(8), 'hex') where id = p_order;
    if o.coupon_code is not null then
      update public.coupons set redemptions = redemptions + 1 where code = o.coupon_code;
    end if;
    insert into public.payments (order_id, provider, scenario, status, amount, created_at)
    values (p_order, 'simulated', 'approve', 'approved', o.total, p_at);
    insert into public.events (type, order_id, data, created_at)
    values ('payment.approved', p_order, jsonb_build_object('amount', o.total, 'simulated', true), p_at);
  else
    update public.orders set status_payment = 'expired', status_delivery = 'cancelled', payment_scenario = 'decline',
           cancelled_at = app.clamp_ts(p_at + interval '15 minutes') where id = p_order;
    insert into public.payments (order_id, provider, scenario, status, amount, created_at)
    values (p_order, 'simulated', 'decline', 'declined', o.total, p_at);
    insert into public.events (type, order_id, data, created_at) values
      ('payment.declined', p_order, jsonb_build_object('reason', coalesce(p_reason, 'Card declined (simulated)')), p_at),
      ('order.expired', p_order, jsonb_build_object('reason', 'Payment not completed'), app.clamp_ts(p_at + interval '15 minutes'));
  end if;
end $$;

create or replace function app.sim_ship(p_order uuid, p_at timestamptz) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_carriers text[] := array['UPS', 'FedEx', 'USPS', 'DHL'];
  v_carrier text := v_carriers[1 + floor(random() * 4)::int];
  v_tracking text := 'TRK' || upper(encode(extensions.gen_random_bytes(6), 'hex'));
begin
  update public.orders set status_delivery = 'shipped', carrier = v_carrier, tracking_number = v_tracking, shipped_at = p_at
   where id = p_order;
  insert into public.events (type, order_id, data, created_at)
  values ('order.shipped', p_order, jsonb_build_object('carrier', v_carrier, 'tracking_number', v_tracking), p_at);
end $$;

create or replace function app.sim_deliver(p_order uuid, p_at timestamptz) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  update public.orders set status_delivery = 'delivered', delivered_at = p_at where id = p_order;
  insert into public.events (type, order_id, data, created_at) values ('order.delivered', p_order, '{}', p_at);
end $$;

create or replace function app.sim_cancel_paid(p_order uuid, p_at timestamptz) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  update public.inventory i set on_hand = i.on_hand + x.qty
    from (select variant_id, sum(qty)::int as qty from public.order_items where order_id = p_order group by 1) x
   where i.variant_id = x.variant_id;
  insert into public.refunds (order_id, amount, reason, created_at)
  values (p_order, o.total, 'Order cancelled: customer changed their mind', p_at);
  update public.orders set status_payment = 'refunded', refunded_total = total, status_delivery = 'cancelled',
         cancelled_at = p_at where id = p_order;
  insert into public.events (type, order_id, data, created_at) values
    ('order.cancelled', p_order, jsonb_build_object('by', 'customer', 'reason', 'Changed my mind'), p_at),
    ('refund.issued', p_order, jsonb_build_object('amount', o.total, 'kind', 'full'), p_at);
end $$;

create or replace function app.sim_return(p_order uuid, p_stage text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  o public.orders;
  it public.order_items;
  v_amount numeric(10, 2);
  v_at timestamptz;
  v_ret uuid;
begin
  select * into o from public.orders where id = p_order for update;
  select * into it from public.order_items where order_id = p_order and returned_qty < qty order by unit_price desc limit 1;
  if it.id is null or o.subtotal <= 0 then
    return;
  end if;
  v_amount := least(round(it.unit_price / o.subtotal * (o.total - o.shipping), 2), o.total - o.refunded_total);
  v_at := app.clamp_ts(coalesce(o.delivered_at, now()) + interval '1 day');
  insert into public.returns (order_id, customer_id, status, reason, items, amount_suggested, created_at, updated_at)
  values (p_order, o.customer_id, case when p_stage = 'refunded' then 'refunded'::public.return_status else 'requested'::public.return_status end,
          'Size or fit not as expected',
          jsonb_build_array(jsonb_build_object('order_item_id', it.id, 'qty', 1, 'sku', it.sku,
                                               'product_name', it.product_name, 'variant_name', it.variant_name)),
          v_amount, v_at, v_at)
  returning id into v_ret;
  insert into public.events (type, order_id, data, created_at)
  values ('return.requested', p_order, jsonb_build_object('return_id', v_ret, 'items', 1), v_at);
  if p_stage = 'refunded' and v_amount > 0 then
    update public.order_items set returned_qty = returned_qty + 1 where id = it.id;
    update public.inventory set on_hand = on_hand + 1 where variant_id = it.variant_id;
    insert into public.refunds (order_id, return_id, amount, reason, created_at)
    values (p_order, v_ret, v_amount, 'Return received', app.clamp_ts(v_at + interval '3 days'));
    update public.orders
       set refunded_total = refunded_total + v_amount,
           status_payment = case when refunded_total + v_amount >= total then 'refunded'::public.payment_status
                                 else 'partially_refunded'::public.payment_status end
     where id = p_order;
    if not exists (select 1 from public.order_items where order_id = p_order and returned_qty < qty) then
      update public.orders set status_delivery = 'returned' where id = p_order;
    end if;
    insert into public.events (type, order_id, data, created_at) values
      ('return.approved', p_order, jsonb_build_object('return_id', v_ret), app.clamp_ts(v_at + interval '1 day')),
      ('return.received', p_order, jsonb_build_object('return_id', v_ret), app.clamp_ts(v_at + interval '3 days')),
      ('refund.issued', p_order, jsonb_build_object('amount', v_amount, 'kind', 'partial', 'return_id', v_ret),
       app.clamp_ts(v_at + interval '3 days'));
  end if;
end $$;

create or replace function app.sim_full_refund(p_order uuid, p_reason text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  o public.orders;
  v_at timestamptz;
begin
  select * into o from public.orders where id = p_order for update;
  v_at := app.clamp_ts(coalesce(o.delivered_at, now()) + interval '2 days');
  insert into public.refunds (order_id, amount, reason, created_at) values (p_order, o.total - o.refunded_total, p_reason, v_at);
  update public.orders set refunded_total = total, status_payment = 'refunded' where id = p_order;
  insert into public.events (type, order_id, data, created_at)
  values ('refund.issued', p_order, jsonb_build_object('amount', o.total - o.refunded_total, 'kind', 'full', 'reason', p_reason), v_at);
end $$;

create or replace function app.seed_orders(p_count int) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_customers uuid[];
  v_cust uuid;
  v_at timestamptz;
  v_t timestamptz;
  v_items jsonb;
  v_order uuid;
  v_r float8;
  n int := 0;
begin
  select array_agg(id order by created_at, id) into v_customers from public.profiles where role = 'customer';
  if v_customers is null then
    return 0;
  end if;
  perform setseed(0.4242);
  for i in 1..p_count loop
    v_cust := v_customers[1 + floor(random() * array_length(v_customers, 1))::int];
    v_at := now() - make_interval(mins => (60 * 24 * 50 * random())::int);
    v_items := app.sim_random_items(1 + floor(random() * 3)::int);
    continue when v_items is null;
    v_order := app.sim_create_order(v_cust, v_items, case when random() < 0.2 then 'express' else 'standard' end,
                                    case when random() < 0.15 then 'WELCOME10' end, v_at);
    n := n + 1;
    v_r := random();
    if v_r < 0.06 then
      perform app.sim_pay(v_order, v_at + interval '1 minute', false);
      continue;
    end if;
    perform app.sim_pay(v_order, v_at + interval '1 minute', true);
    if v_r < 0.12 then
      perform app.sim_cancel_paid(v_order, app.clamp_ts(v_at + interval '2 hours'));
      continue;
    end if;
    continue when v_r < 0.27 or v_at > now() - interval '1 day';                 -- awaiting fulfilment
    v_t := app.clamp_ts(v_at + interval '1 day');
    perform app.sim_ship(v_order, v_t);
    continue when v_r < 0.42 or v_at > now() - interval '4 days';                -- in transit
    perform app.sim_deliver(v_order, app.clamp_ts(v_t + make_interval(days => 2 + floor(random() * 3)::int)));
    continue when v_r < 0.86;
    if v_r < 0.92 then
      perform app.sim_return(v_order, 'refunded');
    elsif v_r < 0.96 then
      perform app.sim_return(v_order, 'requested');
    else
      perform app.sim_full_refund(v_order, 'Item arrived damaged');
    end if;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Simulation API (admin only, or the server's service role for seeding / cron)
-- ---------------------------------------------------------------------------------------------
create or replace function app.require_simulation() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return; -- trusted server tooling (seed script, CRON_SECRET-protected cron)
  end if;
  if not app.has_permission('simulation:run') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  -- T49: database-level switch (store_settings, migration 0007); set to false in production
  if not app.simulation_enabled() then
    raise exception 'SIMULATION_DISABLED' using errcode = '42501';
  end if;
end $$;

create or replace function public.sim_reset() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_products int;
  v_orders int;
begin
  perform app.require_simulation();
  if coalesce(auth.role(), '') <> 'service_role' then
    perform app.require_recent_auth(15); -- T49/T338: destructive reset needs a fresh sign-in
  end if;
  perform set_config('acme.audit_skip', 'on', true);
  truncate table public.refunds, public.returns, public.payments, public.events, public.order_items, public.orders,
                 public.favorites, public.inventory, public.product_variants, public.products, public.categories,
                 public.coupons restart identity;
  perform setval('public.order_number_seq', 100001, false);
  v_products := app.seed_catalog();
  v_orders := app.seed_orders(60);
  perform set_config('acme.audit_skip', 'off', true);
  perform setseed(extract(epoch from clock_timestamp())::float8 / 1e10);   -- don't leave a fixed seed behind
  update public.simulation_state set scenario = 'happy-path', step = 0 where id = 1;
  perform audit.write(auth.uid(), 'simulation.reset', null, jsonb_build_object('products', v_products, 'orders', v_orders));
  insert into public.events (type, actor_id, data)
  values ('simulation.reset', auth.uid(), jsonb_build_object('products', v_products, 'orders', v_orders));
  return jsonb_build_object('products', v_products, 'orders', v_orders);
end $$;

create or replace function public.sim_set_scenario(p_scenario text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform app.require_simulation();
  if p_scenario not in ('happy-path', 'payment-declines', 'stockouts', 'late-deliveries', 'returns-wave') then
    raise exception 'INVALID_SCENARIO' using errcode = '22023';
  end if;
  update public.simulation_state set scenario = p_scenario where id = 1;
  insert into public.events (type, actor_id, data)
  values ('simulation.scenario_changed', auth.uid(), jsonb_build_object('scenario', p_scenario));
  perform audit.write(auth.uid(), 'simulation.scenario', p_scenario, '{}');
end $$;

create or replace function public.sim_advance(p_steps int default 1) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  st public.simulation_state;
  o record;
  v_customers uuid[];
  v_cust uuid;
  v_items jsonb;
  v_order uuid;
  v_ok boolean;
  n_ship int := 0; n_deliv int := 0; n_new int := 0; n_decl int := 0;
  n_delay int := 0; n_ret int := 0; n_stock int := 0; n_exp int := 0;
  v_summary jsonb;
  v_decline_p float8;
begin
  perform app.require_simulation();
  if p_steps is null or p_steps not between 1 and 20 then
    raise exception 'INVALID_STEPS' using errcode = '22023';
  end if;
  select array_agg(id) into v_customers from public.profiles where role = 'customer';

  for s in 1..p_steps loop
    update public.simulation_state set step = step + 1 where id = 1 returning * into st;
    v_decline_p := case when st.scenario = 'payment-declines' then 0.6 else 0.1 end;
    n_exp := n_exp + app.expire_reservations();

    for o in select id from public.orders where status_delivery = 'shipped' order by shipped_at
             limit case when st.scenario = 'late-deliveries' then 1 else 3 end loop
      perform app.sim_deliver(o.id, now());
      n_deliv := n_deliv + 1;
    end loop;

    if st.scenario = 'late-deliveries' then
      for o in select id from public.orders where status_delivery = 'shipped' order by shipped_at limit 3 loop
        insert into public.events (type, order_id, data)
        values ('shipment.delayed', o.id, jsonb_build_object('reason', 'Carrier delay (simulated)'));
        n_delay := n_delay + 1;
      end loop;
    end if;

    for o in select id from public.orders
              where status_delivery = 'processing' and status_payment in ('approved', 'partially_refunded')
              order by created_at limit 3 loop
      perform app.sim_ship(o.id, now());
      n_ship := n_ship + 1;
    end loop;

    if st.scenario = 'stockouts' then
      for o in select i.variant_id from public.inventory i where i.on_hand - i.reserved > 0 order by random() limit 2 loop
        update public.inventory set on_hand = reserved where variant_id = o.variant_id;
        insert into public.events (type, data) values ('inventory.stockout', jsonb_build_object('variant_id', o.variant_id));
        n_stock := n_stock + 1;
      end loop;
    end if;

    if v_customers is not null then
      v_cust := v_customers[1 + floor(random() * array_length(v_customers, 1))::int];
      v_items := app.sim_random_items(1 + floor(random() * 2)::int, st.scenario <> 'stockouts');
      if v_items is not null then
        v_order := app.sim_create_order(v_cust, v_items, 'standard', null, now());
        n_new := n_new + 1;
        select not exists (select 1 from public.order_items oi join public.inventory i on i.variant_id = oi.variant_id
                            where oi.order_id = v_order and i.on_hand - i.reserved < oi.qty) into v_ok;
        if not v_ok then
          perform app.sim_pay(v_order, now(), false, 'Insufficient stock');
          n_decl := n_decl + 1;
        elsif random() < v_decline_p then
          perform app.sim_pay(v_order, now(), false);
          n_decl := n_decl + 1;
        else
          perform app.sim_pay(v_order, now(), true);
        end if;
      end if;
    end if;

    if st.scenario = 'returns-wave' then
      for o in select ord.id from public.orders ord
                where ord.status_delivery = 'delivered' and ord.delivered_at > now() - interval '30 days'
                  and not exists (select 1 from public.returns r where r.order_id = ord.id)
                order by random() limit 2 loop
        perform app.sim_return(o.id, 'requested');
        n_ret := n_ret + 1;
      end loop;
    end if;
  end loop;

  v_summary := jsonb_build_object('step', st.step, 'scenario', st.scenario, 'steps', p_steps,
    'delivered', n_deliv, 'shipped', n_ship, 'new_orders', n_new, 'declined', n_decl, 'delayed', n_delay,
    'returns', n_ret, 'stockouts', n_stock, 'expired', n_exp);
  insert into public.events (type, actor_id, data) values ('simulation.advanced', auth.uid(), v_summary);
  return v_summary;
end $$;

revoke all on all functions in schema app from public, anon, authenticated;
revoke all on function public.sim_reset(), public.sim_set_scenario(text), public.sim_advance(int) from public, anon, authenticated;
grant execute on function app.user_role(), app.has_permission(text), app.permissions_for(public.app_role) to anon, authenticated;
grant execute on function public.sim_reset(), public.sim_set_scenario(text), public.sim_advance(int) to authenticated, service_role;
