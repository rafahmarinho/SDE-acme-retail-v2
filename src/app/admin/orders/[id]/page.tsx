import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deliverOrderAction, issueRefundAction, shipOrderAction, staffCancelOrderAction } from "@/actions/admin";
import { ReturnActions } from "@/components/admin/return-actions";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { LiveRefresh } from "@/components/live-refresh";
import { OrderTimeline } from "@/components/order-timeline";
import { DeliveryBadge, PageHeader, PaymentBadge, ReturnBadge } from "@/components/ui";
import { PAYMENT_LABELS, dateTime, money } from "@/lib/format";
import { Uuid } from "@/lib/schemas";
import { can, requirePagePermission } from "@/services/auth";
import { getOrderAdmin, getOrderEvents } from "@/services/orders";
import type { Address } from "@/db/types";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Uuid.safeParse(id).success) notFound();
  const auth = await requirePagePermission("orders:read_all", `/admin/orders/${id}`);
  const order = await getOrderAdmin(id);
  if (!order) notFound();
  const events = await getOrderEvents(order.id);
  const addr = order.shipping_address as unknown as Address;
  const remaining = Math.round((Number(order.total) - Number(order.refunded_total)) * 100) / 100;
  const paid = ["approved", "partially_refunded"].includes(order.status_payment);
  const canFulfil = can(auth, "orders:fulfil");
  const canRefund = can(auth, "refunds:issue");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.number}`}
        subtitle={<><Link href="/admin/orders" className="link">All orders</Link> · placed {dateTime(order.created_at)} by {order.customer_name}</>}
        actions={<div className="flex items-center gap-2"><PaymentBadge status={order.status_payment} /><DeliveryBadge status={order.status_delivery} /><LiveRefresh tables={["orders", "events"]} signedIn /></div>}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className="card p-5">
            <h2 className="h2 mb-3">Items</h2>
            <table className="table-ui">
              <thead><tr><th>Product</th><th>SKU</th><th>Unit price (at purchase)</th><th>Qty</th><th>Returned</th><th className="text-right">Line total</th></tr></thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id}><td>{i.product_name}<p className="text-xs text-gray-500">{i.variant_name}</p></td><td className="font-mono text-xs">{i.sku}</td><td>{money(i.unit_price)}</td><td>{i.qty}</td><td>{i.returned_qty}</td><td className="text-right">{money(i.line_total)}</td></tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-4 grid grid-cols-2 gap-1 text-sm sm:grid-cols-4">
              <div><dt className="muted">Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
              <div><dt className="muted">Discount</dt><dd>{money(order.discount)} {order.coupon_code && `(${order.coupon_code})`}</dd></div>
              <div><dt className="muted">Shipping</dt><dd>{money(order.shipping)} ({order.shipping_method})</dd></div>
              <div><dt className="muted">Tax</dt><dd>{money(order.tax)}</dd></div>
              <div><dt className="muted">Total</dt><dd className="font-semibold">{money(order.total)}</dd></div>
              <div><dt className="muted">Refunded</dt><dd>{money(order.refunded_total)}</dd></div>
              <div><dt className="muted">Remaining</dt><dd>{money(remaining)}</dd></div>
              <div><dt className="muted">Provider</dt><dd>{order.payment_provider}</dd></div>
            </dl>
          </section>

          {canFulfil && order.status_delivery === "processing" && paid && (
            <section className="card p-5">
              <h2 className="h2 mb-3">Ship order</h2>
              <ActionForm action={shipOrderAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="order_id" value={order.id} />
                <label><span className="label">Carrier</span>
                  <select name="carrier" className="input">{["UPS", "FedEx", "USPS", "DHL"].map((c) => <option key={c}>{c}</option>)}</select>
                </label>
                <Field label="Tracking number" name="tracking" maxLength={30} placeholder="Leave empty to generate" />
                <SubmitButton pendingText="Saving...">Mark as shipped</SubmitButton>
              </ActionForm>
            </section>
          )}
          {canFulfil && order.status_delivery === "shipped" && (
            <section className="card flex items-center justify-between p-5">
              <p className="text-sm">Shipped with {order.carrier} · <span className="font-mono">{order.tracking_number}</span></p>
              <ActionForm action={deliverOrderAction}>
                <input type="hidden" name="order_id" value={order.id} />
                <SubmitButton>Mark as delivered</SubmitButton>
              </ActionForm>
            </section>
          )}

          {canRefund && paid && remaining > 0 && (
            <section className="card p-5">
              <h2 className="h2 mb-1">Issue a refund</h2>
              <p className="muted mb-3">Full or partial. Refunds over $200 require that you signed in within the last 30 minutes.</p>
              <ActionForm action={issueRefundAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="order_id" value={order.id} />
                <Field label="Amount (USD)" name="amount" type="number" step="0.01" min={0.01} max={remaining} defaultValue={remaining.toFixed(2)} required />
                <Field label="Reason" name="reason" required maxLength={300} placeholder="e.g. Goodwill - late delivery" className="flex-1" />
                <SubmitButton pendingText="Refunding...">Refund</SubmitButton>
              </ActionForm>
            </section>
          )}

          {order.returns.length > 0 && (
            <section className="card p-5">
              <h2 className="h2 mb-3">Returns</h2>
              <ul className="space-y-3">
                {order.returns.map((r) => (
                  <li key={r.id} className="rounded-lg border border-gray-100 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2"><ReturnBadge status={r.status} /> {dateTime(r.created_at)} · suggested refund {money(r.amount_suggested)}</span>
                      <ReturnActions ret={{ ...r, amount_suggested: Number(r.amount_suggested) }} orderId={order.id} remaining={remaining} canManage={can(auth, "returns:manage")} canRefund={canRefund} />
                    </div>
                    <p className="mt-1 text-gray-600">“{r.reason}” · {(r.items as unknown as { qty: number; product_name: string }[]).map((i) => `${i.qty} × ${i.product_name}`).join(", ")}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {canFulfil && ["unfulfilled", "processing"].includes(order.status_delivery) && !["expired", "voided", "refunded"].includes(order.status_payment) && (
            <section className="card p-5">
              <h2 className="h2 mb-3">Cancel order</h2>
              <ActionForm action={staffCancelOrderAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="order_id" value={order.id} />
                <Field label="Reason" name="reason" required maxLength={300} className="flex-1" />
                <SubmitButton className="btn-danger" pendingText="Cancelling...">Cancel & refund</SubmitButton>
              </ActionForm>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {can(auth, "orders:fulfil") && (
            <section className="card p-5 text-sm">
              <h2 className="h2 mb-2">Ship to</h2>
              <p>{addr.full_name}</p>
              <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
              <p>{addr.city}{addr.region ? `, ${addr.region}` : ""} {addr.postal_code} · {addr.country}</p>
            </section>
          )}
          {can(auth, "payments:read_all") && (
            <section className="card p-5 text-sm">
              <h2 className="h2 mb-2">Payment attempts</h2>
              <ul className="space-y-1">
                {(order.payments ?? []).map((p) => (
                  <li key={p.id} className="flex justify-between gap-2"><span>{PAYMENT_LABELS[p.status]} · {p.scenario ?? p.provider}</span><span className="text-gray-500">{dateTime(p.created_at)}</span></li>
                ))}
              </ul>
              {order.refunds.length > 0 && <h3 className="mt-3 font-medium">Refunds</h3>}
              <ul className="space-y-1">
                {order.refunds.map((f) => <li key={f.id}>{money(f.amount)} · {f.reason} · {dateTime(f.created_at)}</li>)}
              </ul>
            </section>
          )}
          <section className="card p-5">
            <h2 className="h2 mb-3">Timeline</h2>
            <OrderTimeline events={events} />
          </section>
        </aside>
      </div>
    </div>
  );
}
