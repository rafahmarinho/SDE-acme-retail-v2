import type { Metadata } from "next";
import { PageHeader, Pagination } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { Page } from "@/lib/schemas";
import { requirePagePermission } from "@/services/auth";
import { listAudit } from "@/services/audit";

export const metadata: Metadata = { title: "Audit log", robots: { index: false } };

/** Append-only audit trail (T349): readable by admins only, never reset with demo data. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; page?: string }> }) {
  await requirePagePermission("audit:read", "/admin/audit");
  const sp = await searchParams;
  const action = /^[a-z_.:]{1,40}$/.test(sp.action ?? "") ? sp.action : undefined;
  const page = Page.parse(sp.page);
  const { items, total, pageSize } = await listAudit(page, action);
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Security events and changes to orders, payments, refunds, inventory, products and roles. PII is excluded." />
      <form className="mb-4 flex gap-2" method="get">
        <select name="action" defaultValue={action ?? ""} className="input max-w-xs">
          <option value="">All actions</option>
          <option value="auth.">Authentication</option>
          <option value="update:orders">Order changes</option>
          <option value="insert:refunds">Refunds</option>
          <option value="update:inventory">Inventory</option>
          <option value="update:profiles">Role changes</option>
          <option value="simulation.">Simulation</option>
          <option value="privacy.">Privacy choices</option>
        </select>
        <button className="btn-secondary" type="submit">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-ui">
          <thead><tr><th>#</th><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.id}>
                <td className="text-gray-400">{l.id}</td>
                <td className="whitespace-nowrap">{dateTime(l.at)}</td>
                <td>{l.actor_email ?? (l.actor_id ? l.actor_id.slice(0, 8) : "system")}</td>
                <td className="font-mono text-xs">{l.action}</td>
                <td className="font-mono text-xs">{l.target?.slice(0, 12)}</td>
                <td className="max-w-96 truncate font-mono text-xs text-gray-500" title={JSON.stringify(l.details)}>{JSON.stringify(l.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={pageSize} href={(p) => `/admin/audit?${new URLSearchParams({ ...(action ? { action } : {}), page: String(p) })}`} />
    </div>
  );
}
