-- ACME Retail - schema, least-privilege grants and row level security.
-- SDE: T19 (restrict app DB access), T2598 (query-level access control), T378 (object authorization),
--      T742 (data accuracy), T178/T604/T754 (consent & restriction), T2600 (bounded results).

create schema if not exists app;    -- internal helpers, NOT exposed through PostgREST
create schema if not exists audit;  -- append-only audit trail, NOT exposed through PostgREST

-- ---------------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------------
create type public.app_role as enum ('customer', 'catalog', 'warehouse', 'finance', 'admin');
create type public.payment_status as enum (
  'pending', 'requires_action', 'approved', 'declined', 'timed_out', 'expired', 'voided',
  'refunded', 'partially_refunded');
create type public.delivery_status as enum (
  'unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled', 'returned');
create type public.return_status as enum ('requested', 'approved', 'rejected', 'received', 'refunded');

-- ---------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (phone is null or phone ~ '^[0-9+() -]{6,20}$'),
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  line1 text not null check (char_length(line1) between 3 and 120),
  line2 text check (line2 is null or char_length(line2) <= 120),
  city text not null check (char_length(city) between 2 and 80),
  region text check (region is null or char_length(region) <= 80),
  postal_code text not null check (postal_code ~ '^[A-Za-z0-9 -]{3,10}$'),
  country text not null check (country ~ '^[A-Z]{2}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, line1, postal_code, country)                       -- de-duplication (T742)
);
create unique index addresses_one_default on public.addresses (user_id) where is_default;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 300),
  sort int not null default 0
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  name text not null check (char_length(name) between 2 and 120),
  brand text not null default 'ACME' check (char_length(brand) between 1 and 60),
  description text not null default '' check (char_length(description) <= 4000),
  category_id uuid not null references public.categories (id),
  base_price numeric(10, 2) not null check (base_price >= 0 and base_price <= 100000),
  image_path text check (image_path is null or image_path ~ '^products/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  accent text not null default '#16a34a' check (accent ~ '^#[0-9a-f]{6}$'),
  featured boolean not null default false,
  active boolean not null default true,
  search_tsv tsvector generated always as (
    to_tsvector('english', name || ' ' || brand || ' ' || description)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_search_idx on public.products using gin (search_tsv);
create index products_category_idx on public.products (category_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique check (sku ~ '^[A-Z0-9-]{3,40}$'),
  name text not null check (char_length(name) between 1 and 80),
  size text check (size is null or char_length(size) <= 20),
  color text check (color is null or char_length(color) <= 30),
  price numeric(10, 2) check (price is null or (price >= 0 and price <= 100000)),
  active boolean not null default true,
  sort int not null default 0
);
create index product_variants_product_idx on public.product_variants (product_id);

create table public.inventory (
  variant_id uuid primary key references public.product_variants (id) on delete cascade,
  on_hand int not null default 0 check (on_hand >= 0),
  reserved int not null default 0 check (reserved >= 0),
  updated_at timestamptz not null default now(),
  check (reserved <= on_hand)
);

create table public.coupons (
  code text primary key check (code ~ '^[A-Z0-9-]{3,24}$'),
  description text not null default '',
  kind text not null check (kind in ('percent', 'fixed', 'free_shipping')),
  value numeric(10, 2) not null default 0 check (value >= 0),
  min_subtotal numeric(10, 2) not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  max_redemptions int,
  redemptions int not null default 0
);

create sequence public.order_number_seq start 100001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('ACME-' || nextval('public.order_number_seq')),
  customer_id uuid not null references auth.users (id) on delete restrict,
  status_payment public.payment_status not null default 'pending',
  status_delivery public.delivery_status not null default 'unfulfilled',
  subtotal numeric(10, 2) not null,
  discount numeric(10, 2) not null default 0,
  shipping numeric(10, 2) not null default 0,
  tax numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  refunded_total numeric(10, 2) not null default 0,
  coupon_code text,
  shipping_method text not null check (shipping_method in ('standard', 'express')),
  shipping_address jsonb not null,
  payment_provider text not null default 'simulated' check (payment_provider in ('simulated', 'stripe')),
  payment_scenario text,
  provider_ref text,
  reservation_expires_at timestamptz,
  -- 192-bit random token for public tracking links (T151)
  tracking_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  carrier text,
  tracking_number text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (refunded_total >= 0 and refunded_total <= total)
);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_status_idx on public.orders (status_delivery, status_payment);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  variant_name text not null,
  sku text not null,
  unit_price numeric(10, 2) not null,       -- price snapshot used in the purchase
  qty int not null check (qty between 1 and 99),
  line_total numeric(10, 2) not null,
  returned_qty int not null default 0 check (returned_qty >= 0),
  check (returned_qty <= qty)
);
create index order_items_order_idx on public.order_items (order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  provider text not null,
  scenario text,
  status public.payment_status not null,
  amount numeric(10, 2) not null,
  provider_ref text,
  created_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);

create table public.returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  customer_id uuid not null references auth.users (id) on delete cascade,
  status public.return_status not null default 'requested',
  reason text not null check (char_length(reason) between 3 and 500),
  items jsonb not null,
  amount_suggested numeric(10, 2) not null default 0,
  staff_note text check (staff_note is null or char_length(staff_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index returns_order_idx on public.returns (order_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  return_id uuid references public.returns (id) on delete set null,
  amount numeric(10, 2) not null check (amount > 0),
  reason text not null check (char_length(reason) between 3 and 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index refunds_order_idx on public.refunds (order_id);

-- business / simulation events (resettable). Contain IDs only, never PII (T544, T744).
create table public.events (
  id bigint generated always as identity primary key,
  type text not null check (type ~ '^[a-z_]+\.[a-z_]+$'),
  order_id uuid references public.orders (id) on delete cascade,
  actor_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index events_order_idx on public.events (order_id, created_at desc);
create index events_created_idx on public.events (created_at desc);

create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- append-only consent ledger (T178, T604)
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('marketing_email', 'analytics', 'personalization')),
  granted boolean not null,
  policy_version text not null check (char_length(policy_version) <= 20),
  created_at timestamptz not null default now()
);
create index consents_user_idx on public.consents (user_id, purpose, created_at desc);

-- restriction of processing (T754)
create table public.processing_restrictions (
  user_id uuid not null references auth.users (id) on delete cascade,
  activity text not null check (activity in ('marketing', 'personalization', 'analytics')),
  restricted boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, activity)
);

create table public.simulation_state (
  id int primary key default 1 check (id = 1),
  scenario text not null default 'happy-path'
    check (scenario in ('happy-path', 'payment-declines', 'stockouts', 'late-deliveries', 'returns-wave')),
  step int not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.simulation_state (id) values (1);

create table app.rate_limits (
  key text primary key check (char_length(key) <= 200),
  window_start timestamptz not null,
  hits int not null
);

-- ---------------------------------------------------------------------------------------------
-- Generic triggers
-- ---------------------------------------------------------------------------------------------
create or replace function app.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles for each row execute function app.touch_updated_at();
create trigger products_touch before update on public.products for each row execute function app.touch_updated_at();
create trigger orders_touch before update on public.orders for each row execute function app.touch_updated_at();
create trigger returns_touch before update on public.returns for each row execute function app.touch_updated_at();
create trigger inventory_touch before update on public.inventory for each row execute function app.touch_updated_at();

-- New auth user -> customer profile. Role is ALWAYS 'customer'; only admins change roles.
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- Authorization helpers: single permission map used by RLS, RPCs and the app (T17, T338)
-- ---------------------------------------------------------------------------------------------
create or replace function app.user_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create or replace function app.permissions_for(r public.app_role) returns text[]
language sql immutable set search_path = '' as $$
  select case r
    when 'admin' then array['catalog:write', 'inventory:write', 'orders:read_all', 'orders:fulfil',
      'returns:manage', 'refunds:issue', 'payments:read_all', 'customers:read', 'events:read',
      'users:manage', 'simulation:run', 'audit:read', 'backoffice:access']
    when 'catalog' then array['catalog:write', 'events:read', 'backoffice:access']
    when 'warehouse' then array['inventory:write', 'orders:read_all', 'orders:fulfil', 'returns:manage',
      'customers:read', 'events:read', 'backoffice:access']
    when 'finance' then array['orders:read_all', 'refunds:issue', 'payments:read_all', 'customers:read',
      'events:read', 'backoffice:access']
    else array[]::text[]
  end
$$;

create or replace function app.has_permission(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(p = any (app.permissions_for(app.user_role())), false)
$$;

create or replace function app.require_permission(p text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;
  if not app.has_permission(p) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Grants: deny by default, then grant the minimum (T19)
-- ---------------------------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema app from public, anon, authenticated;
revoke all on schema audit from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema app revoke all on functions from public, anon, authenticated;

grant usage on schema app to anon, authenticated;
grant execute on function app.user_role() to anon, authenticated;
grant execute on function app.has_permission(text) to anon, authenticated;
grant execute on function app.permissions_for(public.app_role) to anon, authenticated;

-- catalog: public read
grant select on public.categories, public.products, public.product_variants, public.inventory to anon, authenticated;
-- catalog management: RLS restricts to catalog/admin
grant insert, update, delete on public.categories, public.products, public.product_variants to authenticated;
-- own data
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;          -- column-level (T2598)
grant select, insert, update, delete on public.addresses, public.favorites, public.processing_restrictions to authenticated;
grant select, insert on public.consents to authenticated;                       -- append-only
-- orders & related: read via RLS, writes ONLY through security definer functions
grant select on public.orders, public.order_items, public.payments, public.returns, public.refunds, public.events to authenticated;
grant select on public.simulation_state to authenticated;
-- coupons: never directly readable (prevents enumeration); validated in functions

-- ---------------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.returns enable row level security;
alter table public.refunds enable row level security;
alter table public.events enable row level security;
alter table public.favorites enable row level security;
alter table public.consents enable row level security;
alter table public.processing_restrictions enable row level security;
alter table public.simulation_state enable row level security;
alter table app.rate_limits enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or app.has_permission('customers:read'));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy addresses_own on public.addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy categories_read on public.categories for select to anon, authenticated using (true);
create policy categories_write on public.categories for all to authenticated
  using (app.has_permission('catalog:write')) with check (app.has_permission('catalog:write'));

create policy products_read on public.products for select to anon, authenticated
  using (active or app.has_permission('catalog:write'));
create policy products_write on public.products for all to authenticated
  using (app.has_permission('catalog:write')) with check (app.has_permission('catalog:write'));

create policy variants_read on public.product_variants for select to anon, authenticated
  using (active or app.has_permission('catalog:write'));
create policy variants_write on public.product_variants for all to authenticated
  using (app.has_permission('catalog:write')) with check (app.has_permission('catalog:write'));

create policy inventory_read on public.inventory for select to anon, authenticated using (true);

create policy orders_select on public.orders for select to authenticated
  using (customer_id = auth.uid() or app.has_permission('orders:read_all'));

create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
                 and (o.customer_id = auth.uid() or app.has_permission('orders:read_all'))));

create policy payments_select on public.payments for select to authenticated
  using (app.has_permission('payments:read_all')
         or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

create policy returns_select on public.returns for select to authenticated
  using (customer_id = auth.uid() or app.has_permission('orders:read_all'));

create policy refunds_select on public.refunds for select to authenticated
  using (app.has_permission('orders:read_all')
         or exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

-- customers see the order timeline of their own orders; staff see everything
create policy events_select on public.events for select to authenticated
  using (app.has_permission('events:read')
         or (type like 'order.%' or type like 'payment.%' or type like 'shipment.%' or type like 'return.%' or type like 'refund.%')
            and exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()));

create policy favorites_own on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy consents_select_own on public.consents for select to authenticated using (user_id = auth.uid());
create policy consents_insert_own on public.consents for insert to authenticated with check (user_id = auth.uid());

create policy restrictions_own on public.processing_restrictions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy simulation_state_admin on public.simulation_state for select to authenticated
  using (app.has_permission('simulation:run'));
-- coupons and app.rate_limits: no policies => no access for anon/authenticated
