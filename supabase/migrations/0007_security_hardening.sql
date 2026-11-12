-- ACME Retail - security hardening applied by apply-fixes-from-security-specs.
-- T558: the database knows which payment provider the store runs, so a client cannot pick the
--       simulated provider (and "approve" itself) when the store is configured for Stripe.
-- T49:  the simulation area has a database-level switch, not only an app environment flag.
-- T338: step-up checks (recent password sign-in) are enforced in Postgres from the JWT `amr`
--       claim, so calling the RPCs directly with a stale session doesn't bypass them.

create table public.store_settings (
  id int primary key default 1 check (id = 1),
  payment_provider text not null default 'simulated' check (payment_provider in ('simulated', 'stripe')),
  simulation_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.store_settings default values;
alter table public.store_settings enable row level security;   -- no policies: read through functions only
revoke all on public.store_settings from anon, authenticated;
create trigger store_settings_touch before update on public.store_settings for each row execute function app.touch_updated_at();
create trigger store_settings_audit after update on public.store_settings for each row execute function audit.track_change();

create or replace function app.payment_provider() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select payment_provider from public.store_settings where id = 1), 'simulated')
$$;

create or replace function app.simulation_enabled() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select simulation_enabled from public.store_settings where id = 1), false)
$$;

-- True when the caller authenticated with a password (or recovery link / OTP) within p_minutes.
create or replace function app.recent_auth(p_minutes int) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select max((x ->> 'timestamp')::bigint)
       from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) x
      where x ->> 'method' in ('password', 'recovery', 'otp', 'magiclink'))
      >= extract(epoch from now())::bigint - p_minutes * 60,
    false)
$$;

create or replace function app.require_recent_auth(p_minutes int) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.recent_auth(p_minutes) then
    raise exception 'REAUTH_REQUIRED' using errcode = '28000';
  end if;
end $$;

-- Public read of the non-sensitive store configuration (lets the UI match the DB).
create or replace function public.store_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('payment_provider', app.payment_provider(), 'simulation_enabled', app.simulation_enabled())
$$;

revoke all on all functions in schema app from public, anon, authenticated;
grant execute on function app.user_role(), app.has_permission(text), app.permissions_for(public.app_role) to anon, authenticated;
revoke all on function public.store_config() from public;
grant execute on function public.store_config() to anon, authenticated, service_role;
