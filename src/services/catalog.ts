/**
 * Catalog reads (public, RLS: active products only) and catalog management (catalog/admin).
 * Queries use bound parameters and explicit column lists (T38, T2139); lists are paginated (T2600).
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@/db/server";
import { escapeLike, PRODUCT_IMAGES_BUCKET } from "@/db/storage";
import { AppError } from "@/lib/errors";
import { detectImage } from "@/lib/upload";
import type { z } from "zod";
import type { CatalogQuery, ProductInput, VariantInput } from "@/lib/schemas";

export const CATALOG_PAGE_SIZE = 12;

export async function listCategories() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("categories").select("id, slug, name, description").order("sort");
  if (error) throw error;
  return data ?? [];
}

export async function searchProducts(q: z.infer<typeof CatalogQuery>, pageSize = CATALOG_PAGE_SIZE) {
  const page = q.page ?? 1;
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("search_products", {
    p_query: q.q ?? "",
    p_category: q.category ?? (null as unknown as string),
    p_min: q.min ?? (null as unknown as number),
    p_max: q.max ?? (null as unknown as number),
    p_in_stock: q.inStock === "1",
    p_sort: q.sort ?? "featured",
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) throw error;
  const items = data ?? [];
  return { items, total: Number(items[0]?.total_count ?? 0), page, pageSize };
}

export type ProductSummary = Awaited<ReturnType<typeof searchProducts>>["items"][number];

const PRODUCT_DETAIL = `id, slug, name, brand, description, base_price, image_path, accent, featured, active, category_id,
  category:categories(slug, name),
  variants:product_variants(id, sku, name, size, color, price, active, sort, inventory(on_hand, reserved))`;

function normalizeVariants<T extends { inventory: unknown; sort: number }>(variants: T[]) {
  return variants
    .map((v) => {
      const inv = (Array.isArray(v.inventory) ? v.inventory[0] : v.inventory) as { on_hand: number; reserved: number } | null;
      return { ...v, on_hand: inv?.on_hand ?? 0, reserved: inv?.reserved ?? 0, available: Math.max((inv?.on_hand ?? 0) - (inv?.reserved ?? 0), 0) };
    })
    .sort((a, b) => a.sort - b.sort);
}

export async function getProductBySlug(slug: string) {
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return null;
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("products").select(PRODUCT_DETAIL).eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!data || !data.active) return null;
  return { ...data, variants: normalizeVariants(data.variants).filter((v) => v.active) };
}

export async function getFavoriteIds(userId: string | undefined): Promise<Set<string>> {
  if (!userId) return new Set();
  const supabase = await createServerClient();
  const { data } = await supabase.from("favorites").select("product_id").eq("user_id", userId).limit(500);
  return new Set((data ?? []).map((f) => f.product_id));
}

export async function listFavoriteProducts(userId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("created_at, product:products(id, slug, name, brand, base_price, image_path, accent, active)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((f) => f.product).filter((p): p is NonNullable<typeof p> => !!p && p.active);
}

export async function toggleFavorite(userId: string, productId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: existing } = await supabase
    .from("favorites")
    .select("product_id")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase.from("favorites").delete().eq("user_id", userId).eq("product_id", productId);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from("favorites").insert({ user_id: userId, product_id: productId });
  if (error) throw error;
  return true;
}

// ---------------------------------------------------------------------------------------------
// Back-office (RLS: catalog:write)
// ---------------------------------------------------------------------------------------------
export async function listAdminProducts(search: string, page: number, pageSize = 20) {
  const supabase = await createServerClient();
  let query = supabase
    .from("products")
    .select("id, slug, name, brand, base_price, active, featured, image_path, accent, category:categories(name), variants:product_variants(count)", {
      count: "exact",
    })
    .order("name")
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (search) query = query.ilike("name", `%${escapeLike(search)}%`);
  const { data, count, error } = await query;
  if (error) throw error;
  return { items: data ?? [], total: count ?? 0, pageSize };
}

export async function getAdminProduct(id: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("products").select(PRODUCT_DETAIL).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, variants: normalizeVariants(data.variants) };
}

export async function saveProduct(id: string | null, input: z.infer<typeof ProductInput>): Promise<string> {
  const supabase = await createServerClient();
  if (id) {
    const { error } = await supabase.from("products").update(input).eq("id", id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase.from("products").insert(input).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function saveVariant(productId: string, variantId: string | null, input: z.infer<typeof VariantInput>) {
  const supabase = await createServerClient();
  if (variantId) {
    const { error } = await supabase.from("product_variants").update(input).eq("id", variantId).eq("product_id", productId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("product_variants").insert({ ...input, product_id: productId });
  if (error) throw error;
}

/** Uploads a validated image under a server-generated key (T50, T214) and links it to the product. */
export async function uploadProductImage(productId: string, file: File): Promise<void> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectImage(bytes, file.type);
  if (!kind) throw new AppError("INVALID_FILE");
  const supabase = await createServerClient();
  const { data: product } = await supabase.from("products").select("id, image_path").eq("id", productId).maybeSingle();
  if (!product) throw new AppError("FORBIDDEN");
  const key = `products/${productId}/${randomUUID()}.${kind.ext}`;
  const { error: upErr } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(key, bytes, { contentType: kind.mime, upsert: false, cacheControl: "31536000" });
  if (upErr) throw upErr;
  const { error } = await supabase.from("products").update({ image_path: key }).eq("id", productId);
  if (error) throw error;
  if (product.image_path) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([product.image_path]);
}
