/**
 * GET /api/orders - the signed-in customer's orders (cookie session, RLS applies).
 * Private: no CORS headers, no caching, object body (T166, T257, T378).
 */
import type { NextRequest } from "next/server";
import { json, jsonError } from "@/lib/http";
import { Page } from "@/lib/schemas";
import { MyOrderListDTO } from "@/lib/dto";
import { getAuth } from "@/services/auth";
import { listMyOrders } from "@/services/orders";

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  const auth = await getAuth();
  if (!auth.user) return jsonError(401, "Not authenticated");
  const page = Page.parse(request.nextUrl.searchParams.get("page") ?? 1);
  const { items, total, pageSize } = await listMyOrders(auth.user.id, page, 20);
  return json(MyOrderListDTO.parse({
    items: items.map((o) => ({
      id: o.id,
      number: o.number,
      created_at: o.created_at,
      total: Number(o.total),
      refunded_total: Number(o.refunded_total),
      payment_status: o.status_payment,
      delivery_status: o.status_delivery,
    })),
    page,
    page_size: pageSize,
    total,
  }));
}
