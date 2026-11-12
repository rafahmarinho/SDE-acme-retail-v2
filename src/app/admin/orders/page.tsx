import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { LiveRefresh } from "@/components/live-refresh";
import { DeliveryBadge, PageHeader, Pagination, PaymentBadge, withParams } from "@/components/ui";
import { DELIVERY_LABELS, PAYMENT_LABELS, dateTime, money } from "@/lib/format";
import { Page } from "@/lib/schemas";
import { requirePagePermission } from "@/services/auth";
import { listOrders } from "@/services/orders";
import type { DeliveryStatus, PaymentStatus } from "@/db/types";

export const metadata: Metadata = { title: "Orders", robots: { index: false } };

const Filters = z.object({
  number: z.string().trim().toUpperCase().regex(/^ACME-\d{1,10}$/).optional().catch(undefined),
  payment: z.enum(Object.keys(PAYMENT_LABELS) as [PaymentStatus, ...PaymentStatus[]]).optional().catch(undefined),
  delivery: z.enum(Object.keys(DELIVERY_LABELS) as [DeliveryStatus, ...DeliveryStatus[]]).optional().catch(undefined),
});

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePagePermission("orders:read_all", "/admin/orders");
  const sp = await searchParams;
  const f = Filters.parse(sp);
  const page = Page.parse(sp.page);
  const { items, total, pageSize } = await listOrders({ ...f, page });
  return (
    <div>
      <PageHeader title="Orders" subtitle={`${total} orders`} actions={<LiveRefresh tables={["orders"]} signedIn />} />
      <form className="mb-4 flex flex-wrap gap-2" method="get">
        <input name="number" defaultValue={f.number} placeholder="Order number (ACME-100001)" maxLength={16} className="input max-w-56" />
        <select name="payment" defaultValue={f.payment ?? ""} className="input max-w-48">
          <option value="">Any payment status</option>
          {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="delivery" defaultValue={f.delivery ?? ""} className="input max-w-48">
          <option value="">Any delivery status</option>
          {Object.entries(DELIVERY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn-secondary" type="submit">Filter</button>
        <Link href="/admin/orders" className="btn-secondary">Reset</Link>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-ui">
          <thead><tr><th>Order</th><th>Placed</th><th>Customer</th><th>Payment</th><th>Delivery</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id}>
                <td><Link className="link" href={`/admin/orders/${o.id}`}>{o.number}</Link><p className="text-xs text-gray-500">{o.shipping_method}</p></td>
                <td>{dateTime(o.created_at)}</td>
                <td>{o.customer_name}</td>
                <td><PaymentBadge status={o.status_payment} /></td>
                <td><DeliveryBadge status={o.status_delivery} /></td>
                <td className="text-right">{money(o.total)}{Number(o.refunded_total) > 0 && <p className="text-xs text-sky-700">-{money(o.refunded_total)}</p>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={pageSize} href={(p) => withParams("/admin/orders", { number: f.number, payment: f.payment, delivery: f.delivery }, { page: p })} />
    </div>
  );
}
