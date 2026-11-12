/**
 * Main commerce flows end to end in the database: quote, checkout with stock reservation and price
 * snapshot, simulated payment outcomes, cancellation, fulfilment, returns, full/partial refunds,
 * search and simulation.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, cleanupUsers, inventoryOf, makeUser, orderOf, placeOrder, stockedVariant } from "./helpers";

let variant: { variantId: string; price: number };

beforeAll(async () => {
  variant = await stockedVariant(20);
});
afterAll(cleanupUsers);

describe("pricing", () => {
  it("applies coupons, illustrative shipping and 8% tax server-side", async () => {
    const c = await makeUser("customer");
    const { data } = await c.client.rpc("quote_cart", { p_items: [{ variant_id: variant.variantId, qty: 2 }], p_coupon: "welcome10", p_method: "standard" });
    const q = data as { subtotal: number; discount: number; shipping: number; tax: number; total: number; coupon: { valid: boolean } };
    expect(q.coupon.valid).toBe(true);
    expect(q.subtotal).toBeCloseTo(variant.price * 2, 2);
    expect(q.discount).toBeCloseTo(Math.round(q.subtotal * 10) / 100, 2);
    expect(q.tax).toBeCloseTo(Math.round((q.subtotal - q.discount) * 8) / 100, 2);
    expect(q.total).toBeCloseTo(q.subtotal - q.discount + q.shipping + q.tax, 2);
  });
  it("rejects expired and exhausted coupons with one generic message", async () => {
    const c = await makeUser("customer");
    for (const code of ["SPRING5", "VIP50", "NOPE123"]) {
      const { data } = await c.client.rpc("quote_cart", { p_items: [{ variant_id: variant.variantId, qty: 1 }], p_coupon: code, p_method: "standard" });
      expect((data as { coupon: { valid: boolean; message: string } }).coupon).toMatchObject({ valid: false, message: "This coupon is not valid." });
    }
  });
  it("search binds parameters and allowlists sort (T38, T42)", async () => {
    const c = await makeUser("customer");
    const evil = await c.client.rpc("search_products", { p_query: "'); drop table products; --", p_sort: "name; drop table x" });
    expect(evil.error).toBeNull();
    expect(evil.data).toEqual([]);
    const ok = await c.client.rpc("search_products", { p_query: "tee", p_limit: 500 });
    expect(ok.data!.length).toBeGreaterThan(0);
    expect(ok.data!.length).toBeLessThanOrEqual(50); // bounded page size (T2600)
  });
});

describe("checkout & simulated payments", () => {
  it("reserves stock, snapshots prices and commits stock on approval", async () => {
    const c = await makeUser("customer");
    const before = await inventoryOf(variant.variantId);
    const id = await placeOrder(c.client, variant.variantId, 2);
    const reserved = await inventoryOf(variant.variantId);
    expect(reserved.reserved).toBe(before.reserved + 2);
    expect(reserved.on_hand).toBe(before.on_hand);

    const { data: items } = await admin.from("order_items").select("unit_price, qty").eq("order_id", id);
    expect(Number(items![0].unit_price)).toBeCloseTo(variant.price, 2);

    const { data: status } = await c.client.rpc("pay_order", { p_order_id: id, p_scenario: "approve" });
    expect(status).toBe("approved");
    const after = await inventoryOf(variant.variantId);
    expect(after.on_hand).toBe(before.on_hand - 2);
    expect(after.reserved).toBe(before.reserved);
    const o = await orderOf(id);
    expect([o.status_payment, o.status_delivery, o.reservation_expires_at]).toEqual(["approved", "processing", null]);
  });

  it("decline keeps the reservation and allows a retry", async () => {
    const c = await makeUser("customer");
    const id = await placeOrder(c.client, variant.variantId, 1);
    expect((await c.client.rpc("pay_order", { p_order_id: id, p_scenario: "decline" })).data).toBe("declined");
    expect((await orderOf(id)).reservation_expires_at).not.toBeNull();
    expect((await c.client.rpc("pay_order", { p_order_id: id, p_scenario: "approve" })).data).toBe("approved");
  });

  it("authentication challenge can succeed or fail", async () => {
    const c = await makeUser("customer");
    const ok = await placeOrder(c.client, variant.variantId, 1);
    expect((await c.client.rpc("pay_order", { p_order_id: ok, p_scenario: "authenticate" })).data).toBe("requires_action");
    expect((await c.client.rpc("complete_payment_challenge", { p_order_id: ok, p_success: true })).data).toBe("approved");
    const ko = await placeOrder(c.client, variant.variantId, 1);
    await c.client.rpc("pay_order", { p_order_id: ko, p_scenario: "authenticate" });
    expect((await c.client.rpc("complete_payment_challenge", { p_order_id: ko, p_success: false })).data).toBe("declined");
  });

  it("timeout returns immediately with a retryable state (T35)", async () => {
    const c = await makeUser("customer");
    const id = await placeOrder(c.client, variant.variantId, 1);
    const t0 = Date.now();
    expect((await c.client.rpc("pay_order", { p_order_id: id, p_scenario: "timeout" })).data).toBe("timed_out");
    expect(Date.now() - t0).toBeLessThan(3000);
    expect((await c.client.rpc("pay_order", { p_order_id: id, p_scenario: "approve" })).data).toBe("approved");
  });

  it("refuses to oversell, invalid coupons and bad addresses", async () => {
    const c = await makeUser("customer");
    const { data: low } = await admin.from("inventory").select("variant_id, on_hand, reserved").lte("on_hand", 3).gt("on_hand", 0).limit(1).single();
    await expect(placeOrder(c.client, low!.variant_id, low!.on_hand - low!.reserved + 1)).rejects.toMatchObject({ message: "OUT_OF_STOCK" });
    await expect(placeOrder(c.client, variant.variantId, 1, "VIP50")).rejects.toMatchObject({ message: "INVALID_COUPON" });
    const bad = await c.client.rpc("place_order", {
      p_items: [{ variant_id: variant.variantId, qty: 1 }], p_coupon: "", p_method: "standard",
      p_address: { full_name: "x", line1: "<script>", city: "", postal_code: "!", country: "USA" }, p_provider: "simulated",
    });
    expect(bad.error?.message).toBe("INVALID_ADDRESS");
  });

  it("limits open checkouts per customer (anti-hoarding, T1362)", async () => {
    const c = await makeUser("customer");
    for (let i = 0; i < 3; i++) await placeOrder(c.client, variant.variantId, 1);
    await expect(placeOrder(c.client, variant.variantId, 1)).rejects.toMatchObject({ message: "TOO_MANY_OPEN_CHECKOUTS" });
  });
});

describe("order lifecycle", () => {
  it("customer cancellation of a paid order restocks and refunds in full", async () => {
    const c = await makeUser("customer");
    const before = await inventoryOf(variant.variantId);
    const id = await placeOrder(c.client, variant.variantId, 1);
    await c.client.rpc("pay_order", { p_order_id: id, p_scenario: "approve" });
    const { error } = await c.client.rpc("cancel_order", { p_order_id: id, p_reason: "Changed my mind" });
    expect(error).toBeNull();
    const o = await orderOf(id);
    expect([o.status_payment, o.status_delivery, Number(o.refunded_total)]).toEqual(["refunded", "cancelled", Number(o.total)]);
    expect((await inventoryOf(variant.variantId)).on_hand).toBe(before.on_hand);
  });

  it("ship -> deliver -> return -> receive -> partial refund, with role checks", async () => {
    const [c, wh, fin] = await Promise.all([makeUser("customer"), makeUser("warehouse"), makeUser("finance")]);
    const id = await placeOrder(c.client, variant.variantId, 2);
    await c.client.rpc("pay_order", { p_order_id: id, p_scenario: "approve" });

    expect((await fin.client.rpc("ship_order", { p_order_id: id, p_carrier: "UPS" })).error?.message).toMatch(/FORBIDDEN/);
    expect((await wh.client.rpc("ship_order", { p_order_id: id, p_carrier: "UPS" })).error).toBeNull();
    expect((await c.client.rpc("cancel_order", { p_order_id: id, p_reason: "too late" })).error?.message).toContain("ORDER_NOT_CANCELLABLE");
    expect((await wh.client.rpc("mark_delivered", { p_order_id: id })).error).toBeNull();

    const { data: item } = await admin.from("order_items").select("id").eq("order_id", id).single();
    const tooMany = await c.client.rpc("request_return", { p_order_id: id, p_items: [{ order_item_id: item!.id, qty: 3 }], p_reason: "Wrong size" });
    expect(tooMany.error?.message).toContain("RETURN_QTY_EXCEEDED");
    const { data: returnId, error: rErr } = await c.client.rpc("request_return", { p_order_id: id, p_items: [{ order_item_id: item!.id, qty: 1 }], p_reason: "Wrong size" });
    expect(rErr).toBeNull();

    expect((await c.client.rpc("review_return", { p_return_id: returnId!, p_approve: true })).error?.message).toMatch(/FORBIDDEN/);
    expect((await wh.client.rpc("review_return", { p_return_id: returnId!, p_approve: true })).error).toBeNull();
    const stock = await inventoryOf(variant.variantId);
    expect((await wh.client.rpc("receive_return", { p_return_id: returnId! })).error).toBeNull();
    expect((await inventoryOf(variant.variantId)).on_hand).toBe(stock.on_hand + 1);

    const { data: ret } = await admin.from("returns").select("amount_suggested").eq("id", returnId!).single();
    const o = await orderOf(id);
    const tooMuch = await fin.client.rpc("issue_refund", { p_order_id: id, p_amount: Number(o.total) + 1, p_reason: "x refund" });
    expect(tooMuch.error?.message).toContain("INVALID_REFUND_AMOUNT");
    expect((await fin.client.rpc("issue_refund", { p_order_id: id, p_amount: Number(ret!.amount_suggested), p_reason: "Return received", p_return_id: returnId! })).error).toBeNull();
    const after = await orderOf(id);
    expect(after.status_payment).toBe("partially_refunded");
    expect(Number(after.refunded_total)).toBeCloseTo(Number(ret!.amount_suggested), 2);

    // full refund of the remainder
    const rest = Math.round((Number(after.total) - Number(after.refunded_total)) * 100) / 100;
    expect((await fin.client.rpc("issue_refund", { p_order_id: id, p_amount: rest, p_reason: "Goodwill" })).error).toBeNull();
    expect((await orderOf(id)).status_payment).toBe("refunded");
  });
});

describe("simulation (T49)", () => {
  it("admins can advance the simulation; results are persisted as events", async () => {
    const a = await makeUser("admin");
    const { data, error } = await a.client.rpc("sim_advance", { p_steps: 2 });
    expect(error).toBeNull();
    expect((data as { steps: number }).steps).toBe(2);
    const { data: ev } = await a.client.from("events").select("type").eq("type", "simulation.advanced").limit(1);
    expect(ev?.length).toBe(1);
    expect((await a.client.rpc("sim_advance", { p_steps: 50 })).error?.message).toContain("INVALID_STEPS");
  });
});
