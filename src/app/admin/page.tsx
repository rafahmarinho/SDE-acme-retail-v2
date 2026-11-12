import type { Metadata } from "next";
import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHeader, Stat } from "@/components/ui";
import { EVENT_LABELS, dateTime, money } from "@/lib/format";
import { can, requirePagePermission } from "@/services/auth";
import { getDashboardStats } from "@/services/dashboard";
import { listEvents } from "@/services/simulation";

export const metadata: Metadata = { title: "Back office", robots: { index: false } };

export default async function AdminDashboard() {
  const auth = await requirePagePermission("backoffice:access", "/admin");
  const [stats, events] = await Promise.all([getDashboardStats(), can(auth, "events:read") ? listEvents(undefined, 1, 10) : null]);
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Last 30 days" actions={<LiveRefresh tables={["orders", "events", "inventory"]} signedIn />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.revenue_30d !== undefined && <Stat label="Net revenue (30d)" value={money(stats.revenue_30d)} hint="Paid orders minus refunds" />}
        {stats.orders_30d !== undefined && <Stat label="Orders (30d)" value={stats.orders_30d} />}
        {stats.awaiting_fulfilment !== undefined && <Stat label="Awaiting fulfilment" value={stats.awaiting_fulfilment} />}
        {stats.in_transit !== undefined && <Stat label="In transit" value={stats.in_transit} />}
        {stats.open_returns !== undefined && <Stat label="Open returns" value={stats.open_returns} />}
        {stats.refunded_30d !== undefined && <Stat label="Refunded (30d)" value={money(stats.refunded_30d)} />}
        <Stat label="Active products" value={stats.products_active} />
        <Stat label="Low-stock variants" value={stats.variants_low_stock} hint={`${stats.variants_out_of_stock} out of stock`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {can(auth, "orders:fulfil") && <Link href="/admin/orders?delivery=processing" className="card p-4 hover:shadow-md"><p className="font-medium">Ship orders</p><p className="muted">Paid orders waiting to ship</p></Link>}
        {can(auth, "inventory:write") && <Link href="/admin/inventory?low=1" className="card p-4 hover:shadow-md"><p className="font-medium">Restock</p><p className="muted">Variants with 5 or fewer units</p></Link>}
        {can(auth, "refunds:issue") && <Link href="/admin/refunds?status=received" className="card p-4 hover:shadow-md"><p className="font-medium">Refund returns</p><p className="muted">Received returns awaiting refund</p></Link>}
        {can(auth, "catalog:write") && <Link href="/admin/products/new" className="card p-4 hover:shadow-md"><p className="font-medium">Add a product</p><p className="muted">Create a catalog entry</p></Link>}
      </div>
      {events && (
        <section className="card p-5">
          <h2 className="h2 mb-3">Latest activity</h2>
          <ul className="divide-y text-sm">
            {events.items.map((e) => {
              const order = Array.isArray(e.order) ? e.order[0] : e.order;
              return (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    {EVENT_LABELS[e.type] ?? e.type}
                    {order && can(auth, "orders:read_all") && (
                      <> · <Link className="link" href={`/admin/orders/${e.order_id}`}>{order.number}</Link></>
                    )}
                  </span>
                  <span className="text-gray-500">{dateTime(e.created_at)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
