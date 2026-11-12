"use server";
/**
 * Customer account actions: profile, addresses, privacy choices, cancellations and returns.
 * Ownership is enforced by RLS / security definer functions; IDs come from the session (T378).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/errors";
import { Address, Reason, Uuid } from "@/lib/schemas";
import { assertUser } from "@/services/auth";
import { logSecurityEvent } from "@/services/audit";
import { cancelOrder } from "@/services/orders";
import { requestReturn } from "@/services/returns";
import {
  CONSENT_PURPOSES,
  RESTRICTABLE,
  deleteAddress,
  recordConsents,
  saveAddress,
  setDefaultAddress,
  setRestriction,
  updateProfile,
} from "@/services/users";

const Profile = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .regex(/^$|^[0-9+() -]{6,20}$/, "Enter a valid phone number")
    .transform((v) => v || null),
});

export async function updateProfileAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const parsed = Profile.safeParse({ full_name: form.get("full_name"), phone: form.get("phone") ?? "" });
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try {
    const { user } = await assertUser();
    await updateProfile(user.id, parsed.data);
    revalidatePath("/account", "layout");
    return { ok: true, message: "Profile saved." };
  } catch (err) {
    return fail(err);
  }
}

export async function saveAddressAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const parsed = Address.safeParse(Object.fromEntries(["full_name", "line1", "line2", "city", "region", "postal_code", "country"].map((k) => [k, form.get(k) ?? undefined])));
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try {
    const { user } = await assertUser();
    await saveAddress(user.id, parsed.data, form.get("is_default") === "on");
    revalidatePath("/account/profile");
    return { ok: true, message: "Address saved." };
  } catch (err) {
    return fail(err);
  }
}

export async function addressCommandAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const id = Uuid.safeParse(form.get("address_id"));
  const command = z.enum(["delete", "default"]).safeParse(form.get("command"));
  if (!id.success || !command.success) return { ok: false, error: "Invalid request." };
  try {
    const { user } = await assertUser();
    if (command.data === "delete") await deleteAddress(user.id, id.data);
    else await setDefaultAddress(user.id, id.data);
    revalidatePath("/account/profile");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setConsentAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const purpose = z.enum(CONSENT_PURPOSES).safeParse(form.get("purpose"));
  const granted = z.enum(["true", "false"]).safeParse(form.get("granted"));
  if (!purpose.success || !granted.success) return { ok: false, error: "Invalid request." };
  try {
    const { user } = await assertUser();
    await recordConsents(user.id, { [purpose.data]: granted.data === "true" });
    await logSecurityEvent("privacy.consent_changed", user.id, { purpose: purpose.data, granted: granted.data === "true" }, user.id);
    revalidatePath("/account/settings");
    return { ok: true, message: granted.data === "true" ? "Consent given." : "Consent withdrawn. We've stopped this processing." };
  } catch (err) {
    return fail(err);
  }
}

export async function setRestrictionAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const activity = z.enum(RESTRICTABLE).safeParse(form.get("activity"));
  const restricted = z.enum(["true", "false"]).safeParse(form.get("restricted"));
  if (!activity.success || !restricted.success) return { ok: false, error: "Invalid request." };
  try {
    const { user } = await assertUser();
    await setRestriction(user.id, activity.data, restricted.data === "true");
    await logSecurityEvent("privacy.restriction_changed", user.id, { activity: activity.data, restricted: restricted.data === "true" }, user.id);
    revalidatePath("/account/settings");
    return { ok: true, message: "Preference saved." };
  } catch (err) {
    return fail(err);
  }
}

export async function cancelMyOrderAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const orderId = Uuid.safeParse(form.get("order_id"));
  const reason = Reason.safeParse(form.get("reason"));
  if (!orderId.success) return { ok: false, error: "Invalid order." };
  if (!reason.success) return { ok: false, error: "Please tell us why you're cancelling (at least 3 characters)." };
  try {
    await assertUser();
    await cancelOrder(orderId.data, reason.data);
    revalidatePath(`/account/orders/${orderId.data}`);
    return { ok: true, message: "Your order was cancelled. Any payment has been refunded." };
  } catch (err) {
    return fail(err);
  }
}

export async function requestReturnAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const orderId = Uuid.safeParse(form.get("order_id"));
  const reason = z.string().trim().min(3).max(500).safeParse(form.get("reason"));
  if (!orderId.success) return { ok: false, error: "Invalid order." };
  if (!reason.success) return { ok: false, error: "Please describe the reason for the return." };
  const items: { order_item_id: string; qty: number }[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("qty_")) continue;
    const id = Uuid.safeParse(key.slice(4));
    const qty = z.coerce.number().int().min(0).max(99).safeParse(value);
    if (id.success && qty.success && qty.data > 0) items.push({ order_item_id: id.data, qty: qty.data });
  }
  if (items.length === 0 || items.length > 20) return { ok: false, error: "Select at least one item to return." };
  try {
    await assertUser();
    await requestReturn(orderId.data, items, reason.data);
    revalidatePath(`/account/orders/${orderId.data}`);
    revalidatePath("/account/returns");
    return { ok: true, message: "Return requested. We'll email you once it's reviewed." };
  } catch (err) {
    return fail(err);
  }
}
