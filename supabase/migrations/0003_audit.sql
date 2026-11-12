-- ACME Retail - append-only audit trail (T349, T2602).
-- Lives in the "audit" schema (not exposed by PostgREST), is never truncated by "reset data",
-- and has no update/delete path. PII columns are stripped from change records (T744).

create table audit.log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  action text not null check (char_length(action) <= 80),
  target text check (target is null or char_length(target) <= 120),
  details jsonb not null default '{}'::jsonb
);
create index audit_log_at_idx on audit.log (at desc);

create rule audit_log_no_update as on update to audit.log do instead nothing;
create rule audit_log_no_delete as on delete to audit.log do instead nothing;
revoke all on audit.log from public, anon, authenticated;

create or replace function audit.write(p_actor uuid, p_action text, p_target text, p_details jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into audit.log (actor_id, action, target, details)
  values (p_actor, left(p_action, 80), left(p_target, 120), coalesce(p_details, '{}'::jsonb))
$$;

create or replace function audit.track_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_strip text[] := array['shipping_address', 'full_name', 'phone', 'search_tsv', 'tracking_token',
                          'description', 'updated_at'];
  v_old jsonb;
  v_new jsonb;
begin
  -- bulk seeding inside sim_reset is logged once as "simulation.reset"
  if current_setting('acme.audit_skip', true) = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    v_old := to_jsonb(old) - v_strip;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new := to_jsonb(new) - v_strip;
  end if;
  if tg_op = 'UPDATE' and v_old = v_new then
    return new;
  end if;
  insert into audit.log (actor_id, action, target, details)
  values (auth.uid(), lower(tg_op) || ':' || tg_table_name,
          coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'variant_id', v_old ->> 'variant_id',
                   v_new ->> 'code', v_old ->> 'code'),
          jsonb_build_object('old', v_old, 'new', v_new));
  return coalesce(new, old);
end $$;

create trigger orders_audit after update on public.orders
  for each row execute function audit.track_change();
create trigger refunds_audit after insert on public.refunds
  for each row execute function audit.track_change();
create trigger returns_audit after insert or update on public.returns
  for each row execute function audit.track_change();
create trigger inventory_audit after update on public.inventory
  for each row execute function audit.track_change();
create trigger profiles_role_audit after update of role on public.profiles
  for each row execute function audit.track_change();
create trigger products_audit after insert or update or delete on public.products
  for each row execute function audit.track_change();
create trigger variants_audit after insert or update or delete on public.product_variants
  for each row execute function audit.track_change();
create trigger coupons_audit after insert or update or delete on public.coupons
  for each row execute function audit.track_change();

-- server-side security events (login failures, password resets, ...) - service role only
create or replace function public.audit_write(p_actor uuid, p_action text, p_target text, p_details jsonb) returns void
language sql security definer set search_path = '' as $$
  select audit.write(p_actor, p_action, p_target, p_details)
$$;

-- read access: admins only, paginated
create or replace function public.admin_audit_log(p_limit int default 50, p_offset int default 0, p_action text default null)
returns table (id bigint, at timestamptz, actor_id uuid, actor_email text, action text, target text, details jsonb,
               total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_permission('audit:read');
  return query
    select l.id, l.at, l.actor_id, u.email::text, l.action, l.target, l.details, count(*) over ()
      from audit.log l left join auth.users u on u.id = l.actor_id
     where p_action is null or l.action like left(p_action, 40) || '%'
     order by l.id desc
     limit least(greatest(coalesce(p_limit, 50), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;

revoke all on all functions in schema audit from public, anon, authenticated;
revoke all on function public.audit_write(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_audit_log(int, int, text) from public, anon, authenticated;
grant execute on function public.audit_write(uuid, text, text, jsonb) to service_role;
grant execute on function public.admin_audit_log(int, int, text) to authenticated;
