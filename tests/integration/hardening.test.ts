/**
 * Database-level guards added by apply-fixes-from-security-specs:
 *  - T558: payment provider fixed by store_settings (no "simulated approve" when the store runs Stripe)
 *  - T49:  simulation switch in the database
 *  - T338: step-up (recent password sign-in) enforced from the JWT `amr` claim
 */
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { admin, cleanupUsers, makeUser, placeOrder, stockedVariant } from "./helpers";

const jwtSecret = process.env.SUPABASE_JWT_SECRET;

/** HS256 JWT for an existing user with a chosen `amr` timestamp (local stack secret only). */
function mintJwt(userId: string, email: string, amrSecondsAgo: number): string {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: userId, email, role: "authenticated", aud: "authenticated", iat: now - 5, exp: now + 600,
    amr: [{ method: "password", timestamp: now - amrSecondsAgo }], session_id: crypto.randomUUID(),
  });
  const sig = createHmac("sha256", jwtSecret!).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

function clientWithToken(token: string) {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

async function setStore(values: { payment_provider?: "simulated" | "stripe"; simulation_enabled?: boolean }) {
  const { error } = await admin.from("store_settings").update(values).eq("id", 1);
  if (error) throw error;
}

let variantId: string;
beforeAll(async () => {
  variantId = (await stockedVariant()).variantId;
});
afterAll(async () => {
  await setStore({ payment_provider: "simulated", simulation_enabled: true });
  await cleanupUsers();
});

describe("T558 - payment provider enforced by the database", () => {
  it("rejects the simulated provider when the store runs Stripe", async () => {
    const c = await makeUser("customer");
    const pending = await placeOrder(c.client, variantId, 1); // placed while simulated
    try {
      await setStore({ payment_provider: "stripe" });
      await expect(placeOrder(c.client, variantId, 1)).rejects.toMatchObject({ message: "INVALID_PROVIDER" });
      const pay = await c.client.rpc("pay_order", { p_order_id: pending, p_scenario: "approve" });
      expect(pay.error?.message).toBe("WRONG_PROVIDER");
    } finally {
      await setStore({ payment_provider: "simulated" });
    }
  });
  it("customers can't read or change store settings", async () => {
    const c = await makeUser("customer");
    const read = await c.client.from("store_settings").select("payment_provider");
    expect(read.error !== null || read.data?.length === 0).toBe(true);
    const write = await c.client.from("store_settings").update({ payment_provider: "simulated" }).eq("id", 1);
    expect(write.error).not.toBeNull();
  });
});

describe("T49 - simulation switch in the database", () => {
  it("blocks admins from advancing or resetting when disabled", async () => {
    const a = await makeUser("admin");
    try {
      await setStore({ simulation_enabled: false });
      expect((await a.client.rpc("sim_advance", { p_steps: 1 })).error?.message).toBe("SIMULATION_DISABLED");
      expect((await a.client.rpc("sim_reset")).error?.message).toBe("SIMULATION_DISABLED");
    } finally {
      await setStore({ simulation_enabled: true });
    }
  });
});

describe.skipIf(!jwtSecret)("T338 - step-up enforced from the JWT amr claim", () => {
  it("rejects large refunds, role changes and resets with a stale sign-in", async () => {
    const [fin, adm, victim] = await Promise.all([makeUser("finance"), makeUser("admin"), makeUser("customer")]);
    const order = await placeOrder(victim.client, variantId, 1);
    const staleFin = clientWithToken(mintJwt(fin.id, fin.email, 2 * 3600));
    const staleAdm = clientWithToken(mintJwt(adm.id, adm.email, 2 * 3600));

    expect((await staleFin.rpc("issue_refund", { p_order_id: order, p_amount: 250, p_reason: "Large refund" })).error?.message).toBe("REAUTH_REQUIRED");
    expect((await staleAdm.rpc("set_user_role", { p_user_id: victim.id, p_role: "finance" })).error?.message).toBe("REAUTH_REQUIRED");
    expect((await staleAdm.rpc("sim_reset")).error?.message).toBe("REAUTH_REQUIRED");

    // small refunds don't need step-up (they fail later only because the order isn't paid)
    expect((await staleFin.rpc("issue_refund", { p_order_id: order, p_amount: 5, p_reason: "Small refund" })).error?.message).toBe("ORDER_NOT_REFUNDABLE");
  });
  it("accepts the same actions with a fresh sign-in", async () => {
    const [adm, victim] = await Promise.all([makeUser("admin"), makeUser("customer")]);
    const fresh = clientWithToken(mintJwt(adm.id, adm.email, 60));
    expect((await fresh.rpc("set_user_role", { p_user_id: victim.id, p_role: "finance" })).error).toBeNull();
  });
});
