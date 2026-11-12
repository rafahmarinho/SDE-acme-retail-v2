import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelMyOrderAction, requestReturnAction } from "@/actions/account";
import { ActionForm, SubmitButton } from "@/components/forms";
import { LiveRefresh } from "@/components/live-refresh";
import { OrderTimeline } from "@/components/order-timeline";
import { DeliveryBadge, PageHeader, PaymentBadge, ReturnBadge } from "@/components/ui";
import { date, dateTime, money, withinDays } from "@/lib/format";
import { Uuid } from "@/lib/schemas";
import { requireUser } from "@/services/auth";
import { getMyOrder, getOrderEvents } from "@/services/orders";
import type { Address } from "@/db/types";

export const metadata: Metadata = { title: "Order details" };

export default async function MyOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Uuid.safeParse(id).success) notFound();
  const auth = await requireUser(`/account/orders/${id}`);
  const order = await getMyOrder(auth.user.id, id); // RLS + explicit owner filter (T378)
  if (!order) notFound();
  const events = await getOrderEvents(order.id);
  const addr = order.shipping_address as unknown as Address;
  const cancellable = ["unfulfilled", "processing"].includes(order.status_delivery) && !["expired", "voided", "refunded"].includes(order.status_payment);
  const deliveredRecently = order.status_delivery === "delivered" && withinDays(order.delivered_at, 30);
  const pending = new Map<string, number>();
  for (const r of order.returns.filter((r) => ["requested", "approved"].includes(r.status))) {
    for (const it of r.items as unknown as { order_item_id: string; qty: number }[]) pending.set(it.order_item_id, (pending.get(it.order_item_id) ?? 0) + it.qty);
  }
  const returnable = order.items.map((i) => ({ ...i, max: i.qty - i.returned_qty - (pending.get(i.id) ?? 0) })).filter((i) => i.max > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.number}`}
        subtitle={`Placed ${dateTime(order.created_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <PaymentBadge status={order.status_payment} />
            <DeliveryBadge status={order.status_delivery} />
            <LiveRefresh tables={["orders", "events"]} signedIn />
          </div>
        }
      />
      {["pending", "declined", "timed_out", "requires_action"].includes(order.status_payment) && order.reservation_expires_at && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">Payment isn&apos;t complete. Items are reserved until {dateTime(order.reservation_expires_at)}.</p>
          <Link href={`/checkout/result/${order.id}`} className="btn-primary">Complete payment</Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="h2 mb-3">Items</h2>
          <ul className="divide-y">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 py-2 text-sm">
                <span>
                  {i.product_name} <span className="text-gray-500">· {i.variant_name} · SKU {i.sku}</span>
                  {i.returned_qty > 0 && <span className="ml-2 text-xs text-sky-700">{i.returned_qty} returned</span>}
                </span>
                <span>{i.qty} × {money(i.unit_price)} = <strong>{money(i.line_total)}</strong></span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
            {Number(order.discount) > 0 && <div className="flex justify-between"><dt>Discount ({order.coupon_code})</dt><dd>-{money(order.discount)}</dd></div>}
            <div className="flex justify-between"><dt>Shipping ({order.shipping_method})</dt><dd>{money(order.shipping)}</dd></div>
            <div className="flex justify-between"><dt>Tax (illustrative)</dt><dd>{money(order.tax)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
            {Number(order.refunded_total) > 0 && <div className="flex justify-between text-sky-700"><dt>Refunded</dt><dd>-{money(order.refunded_total)}</dd></div>}
          </dl>
        </section>
        <aside className="space-y-4">
          <section className="card p-5 text-sm">
            <h2 className="h2 mb-2">Shipping to</h2>
            <p>{addr.full_name}</p>
            <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
            <p>{addr.city}{addr.region ? `, ${addr.region}` : ""} {addr.postal_code}</p>
            <p>{addr.country}</p>
            {order.carrier && <p className="mt-3">Carrier: {order.carrier} · <span className="font-mono">{order.tracking_number}</span></p>}
            <Link href={`/track/${order.tracking_token}`} className="link mt-3 inline-block">Shareable tracking page</Link>
          </section>
          <section className="card p-5">
            <h2 className="h2 mb-3">Tracking</h2>
            <OrderTimeline events={events} />
          </section>
        </aside>
      </div>

      {(order.returns.length > 0 || order.refunds.length > 0) && (
        <section className="card p-5">
          <h2 className="h2 mb-3">Returns & refunds</h2>
          <ul className="space-y-2 text-sm">
            {order.returns.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <ReturnBadge status={r.status} /> Return requested {date(r.created_at)} · estimated refund {money(r.amount_suggested)}
                {r.staff_note && <span className="text-gray-500">· “{r.staff_note}”</span>}
              </li>
            ))}
            {order.refunds.map((f) => (
              <li key={f.id}>Refund of <strong>{money(f.amount)}</strong> on {date(f.created_at)} · {f.reason}</li>
            ))}
          </ul>
        </section>
      )}

      {deliveredRecently && returnable.length > 0 && (
        <section className="card p-5">
          <h2 className="h2">Return items</h2>
          <p className="muted mb-3">Returns are accepted within 30 days of delivery.</p>
          <ActionForm action={requestReturnAction} className="space-y-3">
            <input type="hidden" name="order_id" value={order.id} />
            {returnable.map((i) => (
              <label key={i.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{i.product_name} · {i.variant_name}</span>
                <select name={`qty_${i.id}`} className="input w-24" defaultValue="0">
                  {Array.from({ length: i.max + 1 }, (_, n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            ))}
            <label className="block">
              <span className="label">Reason</span>
              <textarea name="reason" className="input" rows={2} maxLength={500} required placeholder="e.g. Wrong size" />
            </label>
            <SubmitButton pendingText="Submitting...">Request return</SubmitButton>
          </ActionForm>
        </section>
      )}

      {cancellable && (
        <section className="card p-5">
          <h2 className="h2">Cancel order</h2>
          <p className="muted mb-3">You can cancel until the order ships. Paid orders are refunded in full.</p>
          <ActionForm action={cancelMyOrderAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="order_id" value={order.id} />
            <label className="flex-1">
              <span className="label">Reason</span>
              <input name="reason" className="input" required minLength={3} maxLength={300} placeholder="e.g. Ordered by mistake" />
            </label>
            <SubmitButton className="btn-danger" pendingText="Cancelling...">Cancel order</SubmitButton>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
