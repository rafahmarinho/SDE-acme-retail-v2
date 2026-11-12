import type { Metadata } from "next";
import Link from "next/link";
import { ProductGrid } from "@/components/product/product-card";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/services/auth";
import { listFavoriteProducts, searchProducts } from "@/services/catalog";
import { personalizationAllowed } from "@/services/users";

export const metadata: Metadata = { title: "Favorites" };

export default async function FavoritesPage() {
  const auth = await requireUser("/account/favorites");
  const [favorites, personalize] = await Promise.all([listFavoriteProducts(auth.user.id), personalizationAllowed(auth.user.id)]);
  // Recommendations based on favorites only with consent and no restriction (T178, T754)
  const recommended = personalize && favorites.length > 0 ? (await searchProducts({ sort: "featured", inStock: "1" }, 8)).items.filter((p) => !favorites.some((f) => f.id === p.id)).slice(0, 4) : [];
  return (
    <div className="space-y-8">
      <PageHeader title="Favorites" subtitle={`${favorites.length} saved products`} />
      {favorites.length === 0 ? (
        <EmptyState title="No favorites yet" action={<Link href="/catalog" className="btn-primary">Discover products</Link>}>
          Tap “Save” on any product to keep it here.
        </EmptyState>
      ) : (
        <ProductGrid products={favorites.map((p) => ({ ...p, min_price: null, max_price: null }))} />
      )}
      {recommended.length > 0 && (
        <section>
          <h2 className="h2 mb-3">Recommended for you</h2>
          <ProductGrid products={recommended} />
        </section>
      )}
      {!personalize && favorites.length > 0 && (
        <p className="muted">
          Want recommendations based on your favorites? Turn on personalization in <Link className="link" href="/account/settings">Security & privacy</Link>.
        </p>
      )}
    </div>
  );
}
