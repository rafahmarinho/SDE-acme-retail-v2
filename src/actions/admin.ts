"use server";
/**
 * Back-office actions. Each one checks the permission itself (T17) - the database re-checks it
 * again inside RLS / security definer functions. Sensitive actions require a recent sign-in (T338).
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/errors";
import { ROLES } from "@/lib/permissions";
import { ProductInput, Reason, Uuid, VariantInput } from "@/lib/schemas";
import { assertPermission, assertRecentAuth } from "@/services/auth";
import { logSecurityEvent } from "@/services/audit";
import { saveProduct, saveVariant, uploadProductImage } from "@/services/catalog";
import { adjustInventory } from "@/services/inventory";
import { cancelOrder, markDelivered, shipOrder } from "@/services/orders";
import { issueRefund, receiveReturn, reviewReturn } from "@/services/returns";
import { setUserRole } from "@/services/users";

const LARGE_REFUND = 200; // refunds above this amount require a sign-in within the last 30 minutes

export async function saveProductAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const id = form.get("id") ? Uuid.safeParse(form.get("id")) : { success: true as const, data: null };
  const parsed = ProductInput.safeParse({
    name: form.get("name"),
    slug: form.get("slug"),
    brand: form.get("brand"),
    description: form.get("description") ?? "",
    category_id: form.get("category_id"),
    base_price: form.get("base_price"),
    accent: form.get("accent"),
    featured: form.get("featured") === "on",
    active: form.get("active") === "on",
  });
  if (!id.success) return { ok: false, error: "Invalid product." };
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  let savedId: string;
  try {
    await assertPermission("catalog:write");
    savedId = await saveProduct(id.data, parsed.data);
  } catch (err) {
    return fail(err);
  }
  revalidatePath("/admin/products");
  revalidatePath("/catalog");
  if (!id.data) redirect(`/admin/products/${savedId}?created=1`);
  return { ok: true, message: "Product saved." };
}

export async function saveVariantAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const productId = Uuid.safeParse(form.get("product_id"));
  const variantId = form.get("variant_id") ? Uuid.safeParse(form.get("variant_id")) : { success: true as const, data: null };
  const parsed = VariantInput.safeParse({
    name: form.get("name"),
    sku: form.get("sku"),
    price: form.get("price") ?? "",
    active: form.get("active") === "on",
  });
  if (!productId.success || !variantId.success) return { ok: false, error: "Invalid variant." };
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try {
    await assertPermission("catalog:write");
    await saveVariant(productId.data, variantId.data, parsed.data);
    revalidatePath(`/admin/products/${productId.data}`);
    return { ok: true, message: variantId.data ? "Variant saved." : "Variant added. Ask the warehouse team to add stock." };
  } catch (err) {
    return fail(err);
  }
}

export async function uploadImageAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const productId = Uuid.safeParse(form.get("product_id"));
  const file = form.get("image");
  if (!productId.success || !(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image to upload." };
  try {
    await assertPermission("catalog:write");
    await uploadProductImage(productId.data, file);
    revalidatePath(`/admin/products/${productId.data}`);
    return { ok: true, message: "Image uploaded." };
  } catch (err) {
    return fail(err);
  }
}

export async function adjustInventoryAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const variantId = Uuid.safeParse(form.get("variant_id"));
  const delta = z.coerce.number().int().min(-10000).max(10000).refine((v) => v !== 0).safeParse(form.get("delta"));
  const reason = z.string().trim().min(3).max(200).safeParse(form.get("reason"));
  if (!variantId.success || !delta.success) return { ok: false, error: "Enter a non-zero quantity." };
  if (!reason.success) return { ok: false, error: "Enter a reason (e.g. 'Cycle count')." };
  try {
    await assertPermission("inventory:write");
    const onHand = await adjustInventory(variantId.data, delta.data, reason.data);
    revalidatePath("/admin/inventory");
    return { ok: true, message: `Stock updated. On hand: ${onHand}.` };
  } catch (err) {
    return fail(err);
  }
}

export async function shipOrderAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const orderId = Uuid.safeParse(form.get("order_id"));
  const carrier = z.enum(["UPS", "FedEx", "USPS", "DHL"]).safeParse(form.get("carrier"));
  const tracking = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^$|^[A-Z0-9]{8,30}$/, "Tracking numbers have 8-30 letters or digits")
    .safeParse(form.get("tracking") ?? "");
  if (!orderId.success || !carrier.success) return { ok: false, error: "Choose a carrier." };
  if (!tracking.success) return { ok: false, error: "Tracking numbers have 8-30 letters or digits." };
  try {
    await assertPermission("orders:fulfil");
    await shipOrder(orderId.data, carrier.data, tracking.data || undefined);
    revalidatePath(`/admin/orders/${orderId.data}`);
    return { ok: true, message: "Order marked as shipped." };
  } catch (err) {
    return fail(err);
  }
}

export async function deliverOrderAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const orderId = Uuid.safeParse(form.get("order_id"));
  if (!orderId.success) return { ok: false, error: "Invalid order." };
  try {
    await assertPermission("orders:fulfil");
    await markDelivered(orderId.data);
    revalidatePath(`/admin/orders/${orderId.data}`);
    return { ok: true, message: "Order marked as delivered." };
  } catch (err) {
    return fail(err);
  }
}

export async function staffCancelOrderAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const orderId = Uuid.safeParse(form.get("order_id"));
  const reason = Reason.safeParse(form.get("reason"));
  if (!orderId.success) return { ok: false, error: "Invalid order." };
  if (!reason.success) return { ok: false, error: "Enter a cancellation reason." };
  try {
    await assertPermission("orders:fulfil");
    await cancelOrder(orderId.data, reason.data);
    revalidatePath(`/admin/orders/${orderId.data}`);
    return { ok: true, message: "Order cancelled." };
  } catch (err) {
    return fail(err);
  }
}

export async function reviewReturnAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const returnId = Uuid.safeParse(form.get("return_id"));
  const decision = z.enum(["approve", "reject", "receive"]).safeParse(form.get("decision"));
  const note = z.string().trim().max(500).optional().safeParse(form.get("note") ?? undefined);
  if (!returnId.success || !decision.success || !note.success) return { ok: false, error: "Invalid request." };
  try {
    await assertPermission("returns:manage");
    if (decision.data === "receive") await receiveReturn(returnId.data);
    else await reviewReturn(returnId.data, decision.data === "approve", note.data || undefined);
    revalidatePath("/admin/refunds");
    revalidatePath("/admin/orders", "layout");
    return { ok: true, message: decision.data === "receive" ? "Return received and restocked." : `Return ${decision.data}d.` };
  } catch (err) {
    return fail(err);
  }
}

export async function issueRefundAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const orderId = Uuid.safeParse(form.get("order_id"));
  const returnId = form.get("return_id") ? Uuid.safeParse(form.get("return_id")) : { success: true as const, data: undefined };
  const amount = z.coerce.number().positive().max(100000).multipleOf(0.01).safeParse(form.get("amount"));
  const reason = Reason.safeParse(form.get("reason"));
  if (!orderId.success || !returnId.success) return { ok: false, error: "Invalid request." };
  if (!amount.success) return { ok: false, error: "Enter a valid refund amount." };
  if (!reason.success) return { ok: false, error: "Enter a refund reason." };
  try {
    const { user } = await assertPermission("refunds:issue");
    if (amount.data > LARGE_REFUND) assertRecentAuth(user, 30);
    await issueRefund(orderId.data, amount.data, reason.data, returnId.data);
    revalidatePath(`/admin/orders/${orderId.data}`);
    revalidatePath("/admin/refunds");
    return { ok: true, message: "Refund issued." };
  } catch (err) {
    return fail(err);
  }
}

export async function setRoleAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const userId = Uuid.safeParse(form.get("user_id"));
  const role = z.enum(ROLES as [string, ...string[]]).safeParse(form.get("role"));
  if (!userId.success || !role.success) return { ok: false, error: "Invalid request." };
  try {
    const { user } = await assertPermission("users:manage");
    assertRecentAuth(user, 30);
    await setUserRole(userId.data, role.data as (typeof ROLES)[number]);
    await logSecurityEvent("users.role_changed", userId.data, { role: role.data }, user.id);
    revalidatePath("/admin/users");
    return { ok: true, message: "Role updated. It applies on the user's next request." };
  } catch (err) {
    return fail(err);
  }
}
