import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, ReturnBadge } from "@/components/ui";
import { date, money } from "@/lib/format";
import { requireUser } from "@/services/auth";
import { listMyReturns } from "@/services/returns";

export const metadata: Metadata = { title: "My returns" };

export default async function MyReturnsPage() {
  const auth = await requireUser("/account/returns");
  const returns = await listMyReturns(auth.user.id);
  return (
    <div>
      <PageHeader title="Returns" subtitle="Start a return from a delivered order's page. Returns are accepted for 30 days after delivery." />
      {returns.length === 0 ? (
        <EmptyState title="No returns" action={<Link href="/account/orders" className="btn-primary">View orders</Link>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-ui">
            <thead><tr><th>Order</th><th>Requested</th><th>Items</th><th>Status</th><th className="text-right">Estimated refund</th></tr></thead>
            <tbody>
              {returns.map((r) => {
                const order = Array.isArray(r.order) ? r.order[0] : r.order;
                return (
                  <tr key={r.id}>
                    <td>{order ? <Link className="link" href={`/account/orders/${order.id}`}>{order.number}</Link> : "-"}</td>
                    <td>{date(r.created_at)}</td>
                    <td>{(r.items as unknown as { product_name: string; qty: number }[]).map((i) => `${i.qty} × ${i.product_name}`).join(", ")}</td>
                    <td><ReturnBadge status={r.status} /></td>
                    <td className="text-right">{money(r.amount_suggested)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
