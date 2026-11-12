import type { Metadata } from "next";
import Link from "next/link";
import { DeliveryBadge, EmptyState, PageHeader, PaymentBadge } from "@/components/ui";
import { date, money } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import { can, requireUser } from "@/services/auth";
import { listMyOrders } from "@/services/orders";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const auth = await requireUser("/account");
  const sp = await searchParams;
  const { items } = await listMyOrders(auth.user.id, 1, 3);
  return (
    <div className="space-y-6">
      <PageHeader title={`Hi, ${auth.fullName.split(" ")[0] || "there"}`} subtitle={`Signed in as ${auth.user.email} · ${ROLE_LABELS[auth.role]}`} />
      {sp.password === "updated" && <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">Your password was updated and other sessions were signed out.</p>}
      {can(auth, "backoffice:access") && (
        <div className="card flex items-center justify-between p-4">
          <p className="text-sm">You have access to the back office.</p>
          <Link href="/admin" className="btn-primary">Open back office</Link>
        </div>
      )}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="h2">Recent orders</h2>
          <Link href="/account/orders" className="link text-sm">All orders</Link>
        </div>
        {items.length === 0 ? (
          <EmptyState title="No orders yet" action={<Link className="btn-primary" href="/catalog">Start shopping</Link>} />
        ) : (
          <ul className="divide-y">
            {items.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <Link href={`/account/orders/${o.id}`} className="link">{o.number}</Link>
                <span className="muted">{date(o.created_at)}</span>
                <span className="flex gap-1"><PaymentBadge status={o.status_payment} /><DeliveryBadge status={o.status_delivery} /></span>
                <span className="font-medium">{money(o.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/account/favorites" className="card p-4 hover:shadow-md"><p className="font-medium">Favorites</p><p className="muted">Products you saved</p></Link>
        <Link href="/account/profile" className="card p-4 hover:shadow-md"><p className="font-medium">Addresses</p><p className="muted">Manage shipping details</p></Link>
        <Link href="/account/settings" className="card p-4 hover:shadow-md"><p className="font-medium">Privacy</p><p className="muted">Consents and preferences</p></Link>
      </div>
    </div>
  );
}
