import Link from "next/link";
import { money } from "@/lib/format";
import { Badge, ProductImage } from "@/components/ui";

export interface ProductCardData {
  slug: string;
  name: string;
  brand: string;
  min_price: number | null;
  max_price: number | null;
  base_price: number;
  image_path: string | null;
  accent: string;
  available?: number;
  featured?: boolean;
}

export function ProductCard({ p }: { p: ProductCardData }) {
  const min = Number(p.min_price ?? p.base_price);
  const max = Number(p.max_price ?? p.base_price);
  return (
    <Link href={`/product/${p.slug}`} className="card group flex flex-col overflow-hidden p-3 transition hover:shadow-md">
      <div className="relative">
        <ProductImage name={p.name} path={p.image_path} accent={p.accent} />
        <div className="absolute top-2 left-2 flex gap-1">
          {p.featured && <Badge tone="green">Featured</Badge>}
          {p.available === 0 && <Badge tone="gray">Sold out</Badge>}
          {p.available !== undefined && p.available > 0 && p.available <= 5 && <Badge tone="amber">Low stock</Badge>}
        </div>
      </div>
      <p className="mt-3 text-xs tracking-wide text-gray-500 uppercase">{p.brand}</p>
      <p className="font-medium group-hover:text-brand-700">{p.name}</p>
      <p className="mt-auto pt-2 font-semibold">{min === max ? money(min) : `${money(min)} - ${money(max)}`}</p>
    </Link>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.slug} p={p} />
      ))}
    </div>
  );
}
