import Link from "next/link";
import { headers } from "next/headers";
import { safeRedirectPath } from "@/lib/safe-redirect";
import type { ReactNode } from "react";
import { ROLE_LABELS, type Permission } from "@/lib/permissions";
import { can, requirePagePermission } from "@/services/auth";
import { simulationEnabled } from "@/services/simulation";

const NAV: [string, string, Permission][] = [
  ["/admin", "Dashboard", "backoffice:access"],
  ["/admin/products", "Products", "catalog:write"],
  ["/admin/inventory", "Inventory", "inventory:write"],
  ["/admin/orders", "Orders", "orders:read_all"],
  ["/admin/refunds", "Returns & refunds", "orders:read_all"],
  ["/admin/users", "Users", "customers:read"],
  ["/admin/simulation", "Simulation", "simulation:run"],
  ["/admin/audit", "Audit log", "audit:read"],
];

/** Role-adapted navigation (PRD). Each page re-checks its own permission (T17). */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const auth = await requirePagePermission("backoffice:access", safeRedirectPath((await headers()).get("x-pathname"), "/admin"));
  const sim = simulationEnabled();
  const items = NAV.filter(([href, , p]) => can(auth, p) && (href !== "/admin/simulation" || sim));
  return (
    <div className="container-page grid gap-6 py-8 lg:grid-cols-5">
      <aside className="lg:col-span-1">
        <div className="card p-3">
          <p className="px-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">Back office</p>
          <p className="px-2 pb-2 text-sm">{ROLE_LABELS[auth.role]}</p>
          <nav aria-label="Back office">
            <ul className="flex gap-1 overflow-x-auto lg:flex-col">
              {items.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="block rounded-lg px-3 py-2 text-sm whitespace-nowrap hover:bg-gray-50">{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>
      <div className="min-w-0 lg:col-span-4">{children}</div>
    </div>
  );
}
