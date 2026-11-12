/**
 * Response DTO schemas for the public JSON API (T2139). Responses are parsed with `.strict()`
 * schemas before they're sent, so an accidentally added field (cost, customer data, internal IDs)
 * fails closed instead of leaking.
 */
import { z } from "zod";

export const ProductDTO = z
  .object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    brand: z.string(),
    category: z.string(),
    price_from: z.number(),
    price_to: z.number(),
    in_stock: z.boolean(),
    url: z.string().startsWith("/product/"),
  })
  .strict();

export const ProductListDTO = z
  .object({ items: z.array(ProductDTO), page: z.number().int(), page_size: z.number().int(), total: z.number().int() })
  .strict();

export const MyOrderDTO = z
  .object({
    id: z.string().uuid(),
    number: z.string(),
    created_at: z.string(),
    total: z.number(),
    refunded_total: z.number(),
    payment_status: z.string(),
    delivery_status: z.string(),
  })
  .strict();

export const MyOrderListDTO = z
  .object({ items: z.array(MyOrderDTO), page: z.number().int(), page_size: z.number().int(), total: z.number().int() })
  .strict();
