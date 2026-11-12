import Link from "next/link";
import { listCategories, searchProducts } from "@/services/catalog";
import { ProductGrid } from "@/components/product/product-card";

const CATEGORY_ICONS: Record<string, string> = {
  apparel: "👕", footwear: "👟", "home-kitchen": "🍳", electronics: "🎧", outdoor: "⛺", beauty: "🌿",
};

export default async function HomePage() {
  const [categories, featured, newest] = await Promise.all([
    listCategories(),
    searchProducts({ sort: "featured" }, 8),
    searchProducts({ sort: "newest", inStock: "1" }, 4),
  ]);
  return (
    <div className="space-y-14 pb-6">
      <section className="bg-gradient-to-br from-brand-50 via-white to-brand-100">
        <div className="container-page grid items-center gap-8 py-14 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">New season essentials</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">Everyday gear, thoughtfully made.</h1>
            <p className="mt-4 max-w-lg text-lg text-gray-600">
              From trail runners to cast iron, discover pieces built to last. Free standard shipping on orders of $75 or more.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/catalog" className="btn-primary px-6 py-3 text-base">Shop all products</Link>
              <Link href="/catalog?category=outdoor" className="btn-secondary px-6 py-3 text-base">Explore outdoor</Link>
            </div>
            <p className="mt-6 inline-block rounded-lg border border-dashed border-brand-600 bg-white px-4 py-2 text-sm">
              Welcome offer: use <strong className="text-brand-700">WELCOME10</strong> for 10% off your first order.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {categories.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/catalog?category=${c.slug}`} className="card flex aspect-square flex-col items-center justify-center gap-2 p-3 text-center transition hover:shadow-md">
                <span className="text-3xl" aria-hidden>{CATEGORY_ICONS[c.slug] ?? "🛍️"}</span>
                <span className="text-sm font-medium">{c.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold">Featured products</h2>
          <Link href="/catalog" className="link text-sm">View all</Link>
        </div>
        <ProductGrid products={featured.items} />
      </section>

      <section className="container-page">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-2xl font-bold">Just in</h2>
          <Link href="/catalog?sort=newest" className="link text-sm">See what&apos;s new</Link>
        </div>
        <ProductGrid products={newest.items} />
      </section>

      <section className="container-page grid gap-4 sm:grid-cols-3">
        {[
          ["Free shipping", "On standard orders of $75 or more."],
          ["30-day returns", "Changed your mind? Return it within 30 days of delivery."],
          ["Secure checkout", "Your stock is reserved while you pay. Payments in this demo are simulated."],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <p className="font-semibold text-brand-700">{t}</p>
            <p className="muted mt-1">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
