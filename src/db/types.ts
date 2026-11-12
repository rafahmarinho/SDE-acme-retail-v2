import type { Database, Json } from "./database.types";

export type { Json };
export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type DeliveryStatus = Database["public"]["Enums"]["delivery_status"];
export type ReturnStatus = Database["public"]["Enums"]["return_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export interface QuoteLine {
  variant_id: string;
  product_id?: string;
  product_name?: string;
  slug?: string;
  variant_name?: string;
  sku?: string;
  unit_price?: number;
  qty: number;
  line_total?: number;
  available?: number;
  accent?: string;
  image_path?: string | null;
  missing: boolean;
  ok: boolean;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  tax_rate: number;
  total: number;
  all_available: boolean;
  coupon: { code: string; valid: boolean; message: string | null } | null;
}

export interface Address {
  full_name: string;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postal_code: string;
  country: string;
}
