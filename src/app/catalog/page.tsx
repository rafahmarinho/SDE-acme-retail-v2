import type { Metadata } from "next";
import Link from "next/link";
import { listCategories, searchProducts } from "@/services/catalog";
import { CatalogQuery } from "@/lib/schemas";
import { ProductGrid } from "@/components/product/product-card";
import { EmptyState, Pagination, withParams } from "@/components/ui";

export const metadata: Metadata = { title: "Catalog" };

const SORT_LABELS = { featured: "Featured", "price-asc": "Price: low to high", "price-desc": "Price: high to low", newest: "Newest", name: "Name" } as const;

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const q = CatalogQuery.parse(flat); // invalid values fall back to defaults (T42)
  const [categories, result] = await Promise.all([listCategories(), searchProducts(q)]);
  const category = categories.find((c) => c.slug === q.category);
  const current = { q: q.q, category: q.category, min: q.min?.toString(), max: q.max?.toString(), inStock: q.inStock, sort: q.sort };

  return (
    <div className="container-page py-8">
      <div className="mb-6">
        <nav className="muted mb-2" aria-label="Breadcrumb">
          <Link href="/" className="hover:underline">Home</Link> / <Link href="/catalog" className="hover:underline">Catalog</Link>
          {category && <> / {category.name}</>}
        </nav>
        <h1 className="h1">{q.q ? <>Results for “{q.q}”</> : category ? category.name : "All products"}</h1>
        <p className="muted mt-1">{category?.description ?? "Browse our full range."} {result.total} products.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-4">
        <aside>
          <form method="get" action="/catalog" className="card space-y-4 p-4">
            {q.q && <input type="hidden" name="q" value={q.q} />}
            <label className="block">
              <span className="label">Category</span>
              <select name="category" defaultValue={q.category ?? ""} className="input">
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label><span className="label">Min $</span><input className="input" name="min" type="number" min={0} step="1" defaultValue={q.min} /></label>
              <label><span className="label">Max $</span><input className="input" name="max" type="number" min={0} step="1" defaultValue={q.max} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="inStock" value="1" defaultChecked={q.inStock === "1"} /> In stock only
            </label>
            <label className="block">
              <span className="label">Sort by</span>
              <select name="sort" defaultValue={q.sort ?? "featured"} className="input">
                {Object.entries(SORT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">Apply</button>
              <Link href="/catalog" className="btn-secondary">Reset</Link>
            </div>
          </form>
        </aside>
        <section className="lg:col-span-3">
          {result.items.length === 0 ? (
            <EmptyState title="No products found" action={<Link href="/catalog" className="btn-primary">Clear filters</Link>}>
              Try a different search term or remove some filters.
            </EmptyState>
          ) : (
            <ProductGrid products={result.items} />
          )}
          <Pagination page={result.page} total={result.total} pageSize={result.pageSize} href={(p) => withParams("/catalog", current, { page: p })} />
        </section>
      </div>
    </div>
  );
}
