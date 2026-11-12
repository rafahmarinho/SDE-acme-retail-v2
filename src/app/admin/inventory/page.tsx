import type { Metadata } from "next";
import Link from "next/link";
import { adjustInventoryAction } from "@/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { LiveRefresh } from "@/components/live-refresh";
import { Badge, PageHeader, Pagination } from "@/components/ui";
import { Page } from "@/lib/schemas";
import { requirePagePermission } from "@/services/auth";
import { listInventory } from "@/services/inventory";

export const metadata: Metadata = { title: "Inventory", robots: { index: false } };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; low?: string; page?: string }> }) {
  await requirePagePermission("inventory:write", "/admin/inventory");
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 40);
  const low = sp.low === "1";
  const page = Page.parse(sp.page);
  const { items, total, pageSize } = await listInventory(q, low, page);
  return (
    <div>
      <PageHeader title="Inventory" subtitle="Available = on hand minus units reserved by open checkouts." actions={<LiveRefresh tables={["inventory"]} signedIn />} />
      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <input name="q" defaultValue={q} maxLength={40} placeholder="SKU or variant" className="input max-w-xs" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="low" value="1" defaultChecked={low} /> Low stock only (≤ 5)</label>
        <button className="btn-secondary" type="submit">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-ui">
          <thead><tr><th>Product / variant</th><th>SKU</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Adjust stock</th></tr></thead>
          <tbody>
            {items.map((v) => {
              const product = Array.isArray(v.product) ? v.product[0] : v.product;
              return (
                <tr key={v.id}>
                  <td><Link className="link" href={`/product/${product?.slug}`}>{product?.name}</Link><p className="text-xs text-gray-500">{v.name}{!v.active && " · inactive"}</p></td>
                  <td className="font-mono text-xs">{v.sku}</td>
                  <td>{v.on_hand}</td>
                  <td>{v.reserved}</td>
                  <td><Badge tone={v.available > 5 ? "green" : v.available > 0 ? "amber" : "red"}>{v.available}</Badge></td>
                  <td>
                    <ActionForm action={adjustInventoryAction} className="flex flex-wrap gap-1" resetOnSuccess>
                      <input type="hidden" name="variant_id" value={v.id} />
                      <input name="delta" type="number" min={-10000} max={10000} required className="input w-20 py-1" placeholder="+/-" aria-label="Quantity change" />
                      <input name="reason" required minLength={3} maxLength={200} className="input w-36 py-1" placeholder="Reason" aria-label="Reason" />
                      <SubmitButton className="btn-secondary btn-sm">Apply</SubmitButton>
                    </ActionForm>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={total} pageSize={pageSize} href={(p) => `/admin/inventory?${new URLSearchParams({ ...(q ? { q } : {}), ...(low ? { low: "1" } : {}), page: String(p) })}`} />
    </div>
  );
}
