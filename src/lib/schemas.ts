/**
 * Bounded input schemas shared by server actions and route handlers (T536, T42, T742).
 */
import { z } from "zod";

export const Uuid = z.string().uuid();

export const CartLine = z.object({
  variantId: Uuid,
  qty: z.number().int().min(1).max(20),
});
export const CartLines = z.array(CartLine).max(50);
export type CartLineT = z.infer<typeof CartLine>;

export const CouponCode = z
  .string()
  .trim()
  .toUpperCase()
  .max(24)
  .regex(/^[A-Z0-9-]*$/, "Coupon codes contain letters, digits and dashes");

export const ShippingMethod = z.enum(["standard", "express"]);
export const PaymentScenario = z.enum(["approve", "decline", "authenticate", "timeout"]);

export const Address = z.object({
  full_name: z.string().trim().min(2).max(120),
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional().transform((v) => v || undefined),
  city: z.string().trim().min(2).max(80),
  region: z.string().trim().max(80).optional().transform((v) => v || undefined),
  postal_code: z.string().trim().regex(/^[A-Za-z0-9 -]{3,10}$/, "Enter a valid postal code"),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a 2-letter country code"),
});

export const Email = z.string().trim().toLowerCase().email().max(254);
export const Password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(72)
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a digit");

export const SORTS = ["featured", "price-asc", "price-desc", "newest", "name"] as const;
export const CatalogQuery = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  category: z
    .string()
    .regex(/^[a-z0-9-]{2,60}$/)
    .optional()
    .catch(undefined),
  min: z.coerce.number().min(0).max(100000).optional().catch(undefined),
  max: z.coerce.number().min(0).max(100000).optional().catch(undefined),
  inStock: z
    .enum(["1"])
    .optional()
    .catch(undefined),
  sort: z.enum(SORTS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(200).optional().catch(undefined),
});

export const Page = z.coerce.number().int().min(1).max(1000).catch(1);

export const ProductInput = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,80}$/, "Use lowercase letters, digits and dashes"),
  brand: z.string().trim().min(1).max(60),
  description: z.string().trim().max(4000),
  category_id: Uuid,
  base_price: z.coerce.number().min(0).max(100000),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i).transform((v) => v.toLowerCase()),
  featured: z.coerce.boolean(),
  active: z.coerce.boolean(),
});

export const VariantInput = z.object({
  name: z.string().trim().min(1).max(80),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,40}$/, "SKU: 3-40 letters, digits or dashes"),
  price: z
    .union([z.literal(""), z.coerce.number().min(0).max(100000)])
    .transform((v) => (v === "" ? null : v)),
  active: z.coerce.boolean(),
});

export const Reason = z.string().trim().min(3, "Please enter a reason").max(300);
