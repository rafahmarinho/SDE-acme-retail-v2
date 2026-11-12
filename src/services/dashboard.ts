import "server-only";
import { createServerClient } from "@/db/server";

export interface DashboardStats {
  products_active: number;
  variants_low_stock: number;
  variants_out_of_stock: number;
  orders_30d?: number;
  revenue_30d?: number;
  awaiting_fulfilment?: number;
  in_transit?: number;
  open_returns?: number;
  refunded_30d?: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("admin_dashboard");
  if (error) throw error;
  return data as unknown as DashboardStats;
}
