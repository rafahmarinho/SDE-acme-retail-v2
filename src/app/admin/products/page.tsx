import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageHeader, Pagination, ProductImage } from "@/components/ui";
import { money } from "@/lib/format";
import { Page } from "@/lib/schemas";
import { requirePagePermission } from "@/services/auth";
import { listAdminProducts } from "@/services/catalog";

export const metadata: Metadata = { title: "Products", robots: { index: false } };

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePagePermission("catalog:write", "/admin/products");
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const page = Page.parse(sp.page);
  const { items, total, pageSize } = await listAdminProducts(q, page);
  return (
    <div>
      <PageHeader title="Products" subtitle={`${total} products`} actions={<Link href="/admin/products/new" className="btn-primary">New product</Link>} />
      <form className="mb-4 flex gap-2" method="get">
        <input name="q" defaultValue={q} maxLength={80} placeholder="Search by name" className="input max-w-sm" />
        <button className="btn-secondary" type="submit">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-ui">
          <thead><tr><th></th><th>Product</th><th>Category</th><th>Variants</th><th>Base price</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((p) => {
              const category = Array.isArray(p.category) ? p.category[0] : p.category;
              const variants = (p.variants as unknown as { count: number }[])[0]?.count ?? 0;
              return (
                <tr key={p.id}>
                  <td className="w-12"><ProductImage name={p.name} path={p.image_path} accent={p.accent} size="sm" /></td>
                  <td><Link className="link" href={`/admin/products/${p.id}`}>{p.name}</Link><p className="text-xs text-gray-500">{p.brand} · /{p.slug}</p></td>
                  <td>{category?.name}</td>
                  <td>{variants}</td>
                  <td>{money(p.base_price)}</td>
                  <td className="space-x-1">{p.active ? <Badge tone="green">Active</Badge> : <Badge>Hidden</Badge>}{p.featured && <Badge tone="blue">Featured</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={pageSize} href={(p) => `/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`} />
    </div>
  );
}
