import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuth } from "@/services/auth";
import { getFavoriteIds, getProductBySlug, searchProducts } from "@/services/catalog";
import { AddToCart } from "@/components/product/add-to-cart";
import { FavoriteButton } from "@/components/product/favorite-button";
import { ProductGrid } from "@/components/product/product-card";
import { LiveRefresh } from "@/components/live-refresh";
import { ProductImage } from "@/components/ui";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  return { title: product?.name ?? "Product not found", description: product?.description.slice(0, 150) };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, auth] = await Promise.all([getProductBySlug(slug), getAuth()]);
  if (!product) notFound();
  const category = Array.isArray(product.category) ? product.category[0] : product.category;
  const [favorites, related] = await Promise.all([
    getFavoriteIds(auth.user?.id),
    searchProducts({ category: category?.slug, sort: "featured" }, 5),
  ]);
  const variants = product.variants.map((v) => ({
    id: v.id,
    name: v.name,
    price: Number(v.price ?? product.base_price),
    available: v.available,
  }));

  return (
    <div className="container-page space-y-12 py-8">
      <nav className="muted" aria-label="Breadcrumb">
        <Link href="/" className="hover:underline">Home</Link> /{" "}
        <Link href={`/catalog?category=${category?.slug}`} className="hover:underline">{category?.name}</Link> / {product.name}
      </nav>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="card p-4">
          <ProductImage name={product.name} path={product.image_path} accent={product.accent} />
        </div>
        <div className="space-y-5">
          <div>
            <p className="text-sm tracking-wide text-gray-500 uppercase">{product.brand}</p>
            <h1 className="h1 mt-1">{product.name}</h1>
          </div>
          <AddToCart variants={variants} />
          <div className="flex items-center gap-3">
            <FavoriteButton productId={product.id} initial={favorites.has(product.id)} signedIn={!!auth.user} nextPath={`/product/${product.slug}`} />
            <LiveRefresh tables={["inventory"]} signedIn={!!auth.user} />
          </div>
          <section className="border-t pt-5">
            <h2 className="h2">About this product</h2>
            {/* Plain text only: rendered as escaped text, never as HTML (T36) */}
            <p className="mt-2 whitespace-pre-line text-gray-700">{product.description}</p>
          </section>
          <ul className="muted space-y-1 border-t pt-5">
            <li>✓ Free standard shipping on orders of $75+</li>
            <li>✓ 30-day returns</li>
            <li>✓ Stock is reserved for 15 minutes during checkout</li>
          </ul>
        </div>
      </div>
      {related.items.filter((p) => p.id !== product.id).length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">You may also like</h2>
          <ProductGrid products={related.items.filter((p) => p.id !== product.id).slice(0, 4)} />
        </section>
      )}
    </div>
  );
}
