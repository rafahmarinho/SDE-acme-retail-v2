import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { ReturnActions } from "@/components/admin/return-actions";
import { PageHeader, Pagination, ReturnBadge } from "@/components/ui";
import { RETURN_LABELS, date, money } from "@/lib/format";
import { Page } from "@/lib/schemas";
import { can, requirePagePermission } from "@/services/auth";
import { listRecentRefunds, listReturns } from "@/services/returns";
import type { ReturnStatus } from "@/db/types";

export const metadata: Metadata = { title: "Returns & refunds", robots: { index: false } };

export default async function RefundsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const auth = await requirePagePermission("orders:read_all", "/admin/refunds");
  const sp = await searchParams;
  const status = z.enum(Object.keys(RETURN_LABELS) as [ReturnStatus, ...ReturnStatus[]]).optional().catch(undefined).parse(sp.status);
  const page = Page.parse(sp.page);
  const [returns, refunds] = await Promise.all([listReturns(status, page), listRecentRefunds()]);
  return (
    <div className="space-y-6">
      <PageHeader title="Returns & refunds" subtitle="Warehouse approves and receives returns; finance issues refunds." />
      <nav className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/refunds" className={`btn-secondary btn-sm ${!status ? "border-brand-600" : ""}`}>All</Link>
        {Object.entries(RETURN_LABELS).map(([k, v]) => (
          <Link key={k} href={`/admin/refunds?status=${k}`} className={`btn-secondary btn-sm ${status === k ? "border-brand-600" : ""}`}>{v}</Link>
        ))}
      </nav>
      <div className="card overflow-x-auto">
        <table className="table-ui">
          <thead><tr><th>Order</th><th>Customer</th><th>Requested</th><th>Items & reason</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {returns.items.map((r) => {
              const order = Array.isArray(r.order) ? r.order[0] : r.order;
              const remaining = order ? Math.round((Number(order.total) - Number(order.refunded_total)) * 100) / 100 : 0;
              return (
                <tr key={r.id}>
                  <td><Link className="link" href={`/admin/orders/${r.order_id}`}>{order?.number}</Link></td>
                  <td>{r.customer_name}</td>
                  <td>{date(r.created_at)}</td>
                  <td className="max-w-64">{(r.items as unknown as { qty: number; product_name: string }[]).map((i) => `${i.qty} × ${i.product_name}`).join(", ")}<p className="text-xs text-gray-500">“{r.reason}” · suggested {money(r.amount_suggested)}</p></td>
                  <td><ReturnBadge status={r.status} /></td>
                  <td><ReturnActions ret={{ ...r, amount_suggested: Number(r.amount_suggested) }} orderId={r.order_id} remaining={remaining} canManage={can(auth, "returns:manage")} canRefund={can(auth, "refunds:issue")} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={returns.total} pageSize={returns.pageSize} href={(p) => `/admin/refunds?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) })}`} />

      <section className="card p-5">
        <h2 className="h2 mb-3">Recent refunds</h2>
        <table className="table-ui">
          <thead><tr><th>Date</th><th>Order</th><th>Reason</th><th>Type</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {refunds.map((f) => {
              const order = Array.isArray(f.order) ? f.order[0] : f.order;
              return (
                <tr key={f.id}>
                  <td>{date(f.created_at)}</td>
                  <td>{order && <Link className="link" href={`/admin/orders/${order.id}`}>{order.number}</Link>}</td>
                  <td>{f.reason}</td>
                  <td>{f.return_id ? "Return" : "Manual"}</td>
                  <td className="text-right">{money(f.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
