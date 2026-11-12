import { publicEnv } from "@/lib/env";

export const PRODUCT_IMAGES_BUCKET = "product-images";

/** Public URL of a product image. Paths are server-generated (products/<uuid>/<uuid>.<ext>), never user input (T50). */
export function productImageUrl(path: string | null | undefined): string | null {
  if (!path || !/^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path)) return null;
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${path}`;
}

/** Escapes LIKE/ILIKE wildcards in user input passed as a bound PostgREST value (T38). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
