import type { Metadata } from "next";
import Link from "next/link";
import { DeliveryBadge, EmptyState, PageHeader, Pagination, PaymentBadge } from "@/components/ui";
import { LiveRefresh } from "@/components/live-refresh";
import { date, money } from "@/lib/format";
import { Page } from "@/lib/schemas";
import { requireUser } from "@/services/auth";
import { listMyOrders } from "@/services/orders";

export const metadata: Metadata = { title: "My orders" };

export default async function MyOrdersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const auth = await requireUser("/account/orders");
  const page = Page.parse((await searchParams).page);
  const { items, total, pageSize } = await listMyOrders(auth.user.id, page);
  return (
    <div>
      <PageHeader title="My orders" subtitle={`${total} orders`} actions={<LiveRefresh tables={["orders"]} signedIn />} />
      {items.length === 0 ? (
        <EmptyState title="You haven't placed any orders yet" action={<Link href="/catalog" className="btn-primary">Browse products</Link>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-ui">
            <thead>
              <tr><th>Order</th><th>Date</th><th>Items</th><th>Payment</th><th>Delivery</th><th className="text-right">Total</th></tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/account/orders/${o.id}`} className="link">{o.number}</Link></td>
                  <td>{date(o.created_at)}</td>
                  <td>{(o.items as unknown as { count: number }[])[0]?.count ?? 0}</td>
                  <td><PaymentBadge status={o.status_payment} /></td>
                  <td><DeliveryBadge status={o.status_delivery} /></td>
                  <td className="text-right font-medium">{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} total={total} pageSize={pageSize} href={(p) => `/account/orders?page=${p}`} />
    </div>
  );
}
