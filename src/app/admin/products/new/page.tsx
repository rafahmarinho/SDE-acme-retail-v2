import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/admin/product-form";
import { PageHeader } from "@/components/ui";
import { requirePagePermission } from "@/services/auth";
import { listCategories } from "@/services/catalog";

export const metadata: Metadata = { title: "New product", robots: { index: false } };

export default async function NewProductPage() {
  await requirePagePermission("catalog:write", "/admin/products/new");
  const categories = await listCategories();
  return (
    <div>
      <PageHeader title="New product" subtitle={<Link href="/admin/products" className="link">Back to products</Link>} />
      <div className="card p-5">
        <ProductForm categories={categories} />
      </div>
    </div>
  );
}
