-- ACME Retail - public order tracking by unguessable token (T151, T378, T2139).
-- Returns delivery information only: no address, customer or payment data.
create or replace function public.track_order(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  o public.orders;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    return null;
  end if;
  select * into o from public.orders where tracking_token = p_token;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'number', o.number,
    'status_delivery', o.status_delivery,
    'carrier', o.carrier,
    'tracking_number', o.tracking_number,
    'created_at', o.created_at,
    'shipped_at', o.shipped_at,
    'delivered_at', o.delivered_at,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.product_name, 'variant', i.variant_name, 'qty', i.qty)
                                        order by i.product_name), '[]'::jsonb)
                from public.order_items i where i.order_id = o.id),
    'timeline', (select coalesce(jsonb_agg(jsonb_build_object('type', e.type, 'at', e.created_at) order by e.created_at), '[]'::jsonb)
                   from public.events e
                  where e.order_id = o.id
                    and e.type in ('order.placed', 'payment.approved', 'order.shipped', 'shipment.delayed',
                                   'order.delivered', 'order.cancelled', 'return.received')));
end $$;

revoke all on function public.track_order(text) from public;
grant execute on function public.track_order(text) to anon, authenticated;
