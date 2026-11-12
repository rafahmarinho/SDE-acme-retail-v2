import Link from "next/link";
import { getAuth, can } from "@/services/auth";
import { listCategories } from "@/services/catalog";
import { CartButton } from "@/components/cart/cart-drawer";

export async function Header() {
  const [auth, categories] = await Promise.all([getAuth(), listCategories()]);
  const staff = can(auth, "backoffice:access");
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="container-page flex items-center gap-3 py-3">
        <Link href="/" className="shrink-0 text-xl font-extrabold tracking-tight">
          <span className="text-brand-600">ACME</span> <span className="text-ink">Retail</span>
        </Link>
        <form action="/catalog" method="get" role="search" className="mx-2 flex flex-1">
          <label htmlFor="site-search" className="sr-only">
            Search products
          </label>
          <input id="site-search" name="q" type="search" maxLength={80} placeholder="Search products, brands..." className="input rounded-r-none" />
          <button type="submit" className="btn-primary rounded-l-none">
            Search
          </button>
        </form>
        <nav aria-label="Account" className="flex items-center gap-2">
          {staff && (
            <Link href="/admin" className="btn-secondary hidden md:inline-flex">
              Back office
            </Link>
          )}
          <Link href="/account/favorites" className="btn-secondary hidden sm:inline-flex" aria-label="Favorites">
            ♡<span className="hidden lg:inline">Favorites</span>
          </Link>
          {auth.user ? (
            <details className="relative">
              <summary className="btn-secondary list-none">
                <span className="max-w-28 truncate">{auth.fullName.split(" ")[0] || "Account"}</span> ▾
              </summary>
              <div className="card absolute right-0 z-50 mt-2 w-56 p-2 text-sm">
                <Link className="block rounded px-3 py-2 hover:bg-gray-50" href="/account">My account</Link>
                <Link className="block rounded px-3 py-2 hover:bg-gray-50" href="/account/orders">Orders</Link>
                <Link className="block rounded px-3 py-2 hover:bg-gray-50" href="/account/returns">Returns</Link>
                <Link className="block rounded px-3 py-2 hover:bg-gray-50" href="/account/settings">Settings</Link>
                {staff && <Link className="block rounded px-3 py-2 hover:bg-gray-50 md:hidden" href="/admin">Back office</Link>}
                <form action="/auth/logout" method="post">
                  <button type="submit" className="w-full rounded px-3 py-2 text-left text-red-700 hover:bg-red-50">
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          ) : (
            <Link href="/login" className="btn-secondary">
              Sign in
            </Link>
          )}
          <CartButton />
        </nav>
      </div>
      <nav aria-label="Categories" className="border-t border-gray-100">
        <ul className="container-page flex gap-5 overflow-x-auto py-2 text-sm">
          <li><Link href="/catalog" className="whitespace-nowrap text-gray-600 hover:text-brand-700">All products</Link></li>
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/catalog?category=${c.slug}`} className="whitespace-nowrap text-gray-600 hover:text-brand-700">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="container-page grid gap-6 py-10 text-sm text-gray-600 sm:grid-cols-3">
        <div>
          <p className="font-semibold text-ink">ACME Retail</p>
          <p className="mt-2">A fictional store for demonstration. Payments are simulated and no real money moves.</p>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-ink">Help</p>
          <Link href="/account/orders" className="block hover:text-brand-700">Track an order</Link>
          <Link href="/account/returns" className="block hover:text-brand-700">Returns & refunds</Link>
          <p>Free standard shipping on orders of $75+. 30-day returns.</p>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-ink">Privacy</p>
          <Link href="/account/settings" className="block hover:text-brand-700">Privacy choices</Link>
          <p>We only use your data for optional purposes with your consent.</p>
        </div>
      </div>
    </footer>
  );
}
