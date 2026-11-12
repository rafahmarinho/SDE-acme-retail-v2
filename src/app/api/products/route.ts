/**
 * Public catalog API: GET /api/products?q=&category=&sort=&page=
 * Bounded, validated query params (T42, T2600), explicit fields (T2139), JSON object body (T166),
 * CORS allowlist from CORS_ALLOWED_ORIGINS (T257), no credentials.
 */
import type { NextRequest } from "next/server";
import { CatalogQuery } from "@/lib/schemas";
import { ProductListDTO } from "@/lib/dto";
import { json, jsonError, parseAllowedOrigins, preflight, withCors } from "@/lib/http";
import { serverEnv } from "@/lib/env.server";
import { searchProducts } from "@/services/catalog";

export const maxDuration = 10;

function allowed() {
  const env = serverEnv();
  return parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS, env.APP_BASE_URL);
}

export async function GET(request: NextRequest) {
  const q = CatalogQuery.parse(Object.fromEntries(request.nextUrl.searchParams));
  try {
    const result = await searchProducts(q, 24);
    const items = result.items.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      category: p.category_slug,
      price_from: Number(p.min_price ?? p.base_price),
      price_to: Number(p.max_price ?? p.base_price),
      in_stock: p.available > 0,
      url: `/product/${p.slug}`,
    }));
    const body = ProductListDTO.parse({ items, page: result.page, page_size: result.pageSize, total: result.total });
    return withCors(request, json(body, { cache: "public" }), allowed());
  } catch {
    return jsonError(500, "Unable to load products");
  }
}

export function OPTIONS(request: NextRequest) {
  return preflight(request, allowed(), "GET");
}
