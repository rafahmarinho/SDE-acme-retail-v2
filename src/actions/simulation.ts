"use server";
/**
 * Simulation area actions (T49): feature flag + admin permission + DB check; reset also needs a
 * sign-in within the last 15 minutes and an explicit confirmation.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, type ActionResult } from "@/lib/errors";
import { assertPermission, assertRecentAuth } from "@/services/auth";
import { advance, assertSimulationEnabled, resetDemoData, SCENARIOS, setScenario } from "@/services/simulation";

const ScenarioId = z.enum(SCENARIOS.map((s) => s.id) as [string, ...string[]]);

export async function setScenarioAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const scenario = ScenarioId.safeParse(form.get("scenario"));
  if (!scenario.success) return { ok: false, error: "Choose a scenario." };
  try {
    assertSimulationEnabled();
    await assertPermission("simulation:run");
    await setScenario(scenario.data as (typeof SCENARIOS)[number]["id"]);
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Scenario updated." };
  } catch (err) {
    return fail(err);
  }
}

export async function advanceAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const steps = z.coerce.number().int().min(1).max(20).safeParse(form.get("steps"));
  if (!steps.success) return { ok: false, error: "Choose between 1 and 20 steps." };
  try {
    assertSimulationEnabled();
    await assertPermission("simulation:run");
    const r = await advance(steps.data);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `Step ${r.step}: ${r.new_orders} new orders (${r.declined} declined), ${r.shipped} shipped, ${r.delivered} delivered, ${r.delayed} delayed, ${r.returns} returns, ${r.stockouts} stock-outs, ${r.expired} expired checkouts.`,
    };
  } catch (err) {
    return fail(err);
  }
}

export async function resetAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  if (form.get("confirm") !== "RESET") return { ok: false, error: 'Type RESET to confirm.' };
  try {
    assertSimulationEnabled();
    const { user } = await assertPermission("simulation:run");
    assertRecentAuth(user, 15);
    const r = await resetDemoData();
    revalidatePath("/", "layout");
    return { ok: true, message: `Demo data reset: ${r.products} products and ${r.orders} orders.` };
  } catch (err) {
    return fail(err);
  }
}
