import Link from "next/link";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { requireUser } from "@/services/auth";

const NAV = [
  ["/account", "Overview"],
  ["/account/orders", "Orders"],
  ["/account/returns", "Returns"],
  ["/account/favorites", "Favorites"],
  ["/account/profile", "Profile & addresses"],
  ["/account/settings", "Security & privacy"],
] as const;

/**
 * Redirects anonymous visitors before anything streams. Every account page still checks the
 * session itself, because layouts don't re-run on client-side navigation (T17).
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  await requireUser(safeRedirectPath((await headers()).get("x-pathname"), "/account"));
  return (
    <div className="container-page grid gap-6 py-8 md:grid-cols-4">
      <nav aria-label="Account" className="md:col-span-1">
        <ul className="card flex gap-1 overflow-x-auto p-2 md:flex-col">
          {NAV.map(([href, label]) => (
            <li key={href}>
              <Link href={href} className="block rounded-lg px-3 py-2 text-sm whitespace-nowrap hover:bg-gray-50">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="md:col-span-3">{children}</div>
    </div>
  );
}
