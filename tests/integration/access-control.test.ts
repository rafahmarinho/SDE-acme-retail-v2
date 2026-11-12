/**
 * Row level security, grants and function permissions against the real local database.
 * SDE: T17, T19, T338, T378, T2598, T2599, T558, T49, T349.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, anon, cleanupUsers, makeUser, placeOrder, stockedVariant, type Client } from "./helpers";

let alice: Awaited<ReturnType<typeof makeUser>>;
let bob: Awaited<ReturnType<typeof makeUser>>;
let catalog: Awaited<ReturnType<typeof makeUser>>;
let warehouse: Awaited<ReturnType<typeof makeUser>>;
let adminUser: Awaited<ReturnType<typeof makeUser>>;
let bobOrder: string;
let variantId: string;

beforeAll(async () => {
  [alice, bob, catalog, warehouse, adminUser] = await Promise.all([
    makeUser("customer"),
    makeUser("customer"),
    makeUser("catalog"),
    makeUser("warehouse"),
    makeUser("admin"),
  ]);
  variantId = (await stockedVariant()).variantId;
  bobOrder = await placeOrder(bob.client, variantId, 1);
});
afterAll(cleanupUsers);

const denied = (res: { error: unknown; data: unknown }) => {
  // either a permission error, or RLS filtered everything out
  expect(res.error !== null || (Array.isArray(res.data) ? res.data.length === 0 : res.data === null)).toBe(true);
};

describe("anonymous visitors", () => {
  it("can browse active products", async () => {
    const { data, error } = await anon().from("products").select("id, name").limit(5);
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });
  it("cannot read orders, profiles, coupons or events", async () => {
    for (const table of ["orders", "profiles", "coupons", "events", "payments", "refunds"] as const) {
      denied(await anon().from(table).select("id").limit(1));
    }
  });
  it("cannot place orders", async () => {
    await expect(placeOrder(anon(), variantId)).rejects.toMatchObject({ message: expect.stringMatching(/NOT_AUTHENTICATED|permission denied/) });
  });
  it("cannot apply coupons (anti-enumeration)", async () => {
    const { data } = await anon().rpc("quote_cart", { p_items: [{ variant_id: variantId, qty: 1 }], p_coupon: "WELCOME10", p_method: "standard" });
    expect((data as { coupon: { valid: boolean } }).coupon.valid).toBe(false);
  });
});

describe("customers (T378)", () => {
  it("cannot read another customer's order, items or events", async () => {
    denied(await alice.client.from("orders").select("id").eq("id", bobOrder).maybeSingle());
    denied(await alice.client.from("order_items").select("id").eq("order_id", bobOrder));
    denied(await alice.client.from("events").select("id").eq("order_id", bobOrder));
  });
  it("can read their own order and its timeline", async () => {
    const { data } = await bob.client.from("orders").select("id, status_payment").eq("id", bobOrder).single();
    expect(data?.status_payment).toBe("pending");
    const { data: ev } = await bob.client.from("events").select("type").eq("order_id", bobOrder);
    expect(ev?.map((e) => e.type)).toContain("order.placed");
  });
  it("cannot pay or cancel someone else's order", async () => {
    const pay = await alice.client.rpc("pay_order", { p_order_id: bobOrder, p_scenario: "approve" });
    expect(pay.error?.message).toContain("ORDER_NOT_FOUND");
    const cancel = await alice.client.rpc("cancel_order", { p_order_id: bobOrder, p_reason: "not mine" });
    expect(cancel.error?.message).toContain("ORDER_NOT_FOUND");
  });
  it("cannot escalate their own role (column-level grant, T2598)", async () => {
    const { error } = await alice.client.from("profiles").update({ role: "admin" } as never).eq("id", alice.id);
    expect(error?.message).toMatch(/permission denied/);
    const { data } = await admin.from("profiles").select("role").eq("id", alice.id).single();
    expect(data?.role).toBe("customer");
  });
  it("cannot write orders, payments or inventory directly (T19)", async () => {
    const ins = await alice.client.from("orders").insert({ customer_id: alice.id, subtotal: 0, total: 0, shipping_method: "standard", shipping_address: {} } as never);
    expect(ins.error).not.toBeNull();
    const inv = await alice.client.from("inventory").update({ on_hand: 9999 }).eq("variant_id", variantId);
    expect(inv.error).not.toBeNull();
    const upd = await bob.client.from("orders").update({ status_payment: "approved" } as never).eq("id", bobOrder);
    expect(upd.error).not.toBeNull();
  });
  it("cannot call back-office or simulation functions", async () => {
    const calls = [
      alice.client.rpc("ship_order", { p_order_id: bobOrder, p_carrier: "UPS" }),
      alice.client.rpc("issue_refund", { p_order_id: bobOrder, p_amount: 1, p_reason: "steal" }),
      alice.client.rpc("adjust_inventory", { p_variant_id: variantId, p_delta: 100, p_reason: "free stock" }),
      alice.client.rpc("set_user_role", { p_user_id: alice.id, p_role: "admin" }),
      alice.client.rpc("admin_list_users", {}),
      alice.client.rpc("admin_audit_log", {}),
      alice.client.rpc("sim_reset"),
      alice.client.rpc("sim_advance", { p_steps: 1 }),
    ];
    for (const res of await Promise.all(calls)) expect(res.error?.message).toMatch(/FORBIDDEN/);
  });
  it("cannot call server-only functions (T558, T19)", async () => {
    const calls = [
      alice.client.rpc("mark_order_paid_external", { p_order_id: bobOrder, p_provider_ref: "fake" }),
      alice.client.rpc("check_rate_limit", { p_key: "x", p_max: 1, p_window_seconds: 1 }),
      alice.client.rpc("audit_write", { p_actor: alice.id, p_action: "fake", p_target: "x", p_details: {} }),
    ];
    for (const res of await Promise.all(calls)) expect(res.error?.message).toMatch(/permission denied/);
  });
});

describe("staff roles (T17, T2598)", () => {
  it("catalog can edit products; warehouse and customers cannot", async () => {
    const { data: p } = await admin.from("products").select("id, brand").limit(1).single();
    const ok = await catalog.client.from("products").update({ brand: p!.brand }).eq("id", p!.id).select("id");
    expect(ok.data?.length).toBe(1);
    for (const c of [warehouse.client, alice.client] as Client[]) {
      const res = await c.from("products").update({ brand: "Hacked" }).eq("id", p!.id).select("id");
      expect(res.error !== null || res.data?.length === 0).toBe(true);
    }
  });
  it("warehouse can read all orders but cannot refund", async () => {
    const { data } = await warehouse.client.from("orders").select("id").eq("id", bobOrder).single();
    expect(data?.id).toBe(bobOrder);
    const res = await warehouse.client.rpc("issue_refund", { p_order_id: bobOrder, p_amount: 1, p_reason: "test" });
    expect(res.error?.message).toMatch(/FORBIDDEN/);
  });
  it("catalog cannot read customer orders", async () => {
    denied(await catalog.client.from("orders").select("id").eq("id", bobOrder).maybeSingle());
  });
  it("admins cannot change their own role; role changes are audited (T349)", async () => {
    const self = await adminUser.client.rpc("set_user_role", { p_user_id: adminUser.id, p_role: "customer" });
    expect(self.error?.message).toContain("CANNOT_CHANGE_OWN_ROLE");
    const res = await adminUser.client.rpc("set_user_role", { p_user_id: alice.id, p_role: "finance" });
    expect(res.error).toBeNull();
    const { data: log } = await adminUser.client.rpc("admin_audit_log", { p_limit: 20, p_action: "update:profiles" });
    expect(log?.some((l) => l.target === alice.id)).toBe(true);
    await adminUser.client.rpc("set_user_role", { p_user_id: alice.id, p_role: "customer" });
  });
  it("the audit log has no update/delete path", async () => {
    // even the service role's DELETE is swallowed by the rule
    const before = await adminUser.client.rpc("admin_audit_log", { p_limit: 1 });
    expect(before.data?.length).toBe(1);
    const { error } = await admin.schema("audit" as never).from("log" as never).delete().neq("id", 0);
    expect(error).not.toBeNull(); // schema isn't exposed through the API at all
  });
});

describe("public tracking (T151, T2139)", () => {
  it("returns delivery info only for a valid token", async () => {
    const { data: o } = await admin.from("orders").select("tracking_token, number").eq("id", bobOrder).single();
    const { data } = await anon().rpc("track_order", { p_token: o!.tracking_token });
    const info = data as Record<string, unknown>;
    expect(info.number).toBe(o!.number);
    expect(Object.keys(info)).not.toContain("shipping_address");
    expect(JSON.stringify(info)).not.toContain("Test Customer");
  });
  it("returns nothing for guessed or malformed tokens", async () => {
    for (const t of ["0".repeat(48), "ACME-100001", "' or 1=1 --"]) {
      const { data } = await anon().rpc("track_order", { p_token: t });
      expect(data).toBeNull();
    }
  });
});
