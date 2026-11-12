/**
 * Simulation area: scenarios, advance, events, reset (admin only).
 * Gated twice (T49): ENABLE_SIMULATION must be "true" AND the user needs 'simulation:run'
 * (also enforced inside Postgres). Reset requires a recent sign-in.
 */
import "server-only";
import { createServerClient } from "@/db/server";
import { serverEnv } from "@/lib/env.server";
import { AppError } from "@/lib/errors";

export const SCENARIOS = [
  { id: "happy-path", label: "Happy path", description: "Orders get paid, shipped and delivered on time." },
  { id: "payment-declines", label: "Payment declines", description: "60% of new simulated payments are declined." },
  { id: "stockouts", label: "Stock-outs", description: "Random variants sell out; orders for them fail." },
  { id: "late-deliveries", label: "Late deliveries", description: "Carriers report delays and deliveries slow down." },
  { id: "returns-wave", label: "Returns wave", description: "Customers request returns for recent deliveries." },
] as const;
export type ScenarioId = (typeof SCENARIOS)[number]["id"];

export function simulationEnabled(): boolean {
  return serverEnv().ENABLE_SIMULATION;
}

export function assertSimulationEnabled(): void {
  if (!simulationEnabled()) throw new AppError("SIMULATION_DISABLED");
}

export async function getSimulationState() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from("simulation_state").select("scenario, step, updated_at").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function setScenario(scenario: ScenarioId) {
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("sim_set_scenario", { p_scenario: scenario });
  if (error) throw error;
}

export async function advance(steps: number) {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("sim_advance", { p_steps: steps });
  if (error) throw error;
  return data as Record<string, number | string>;
}

export async function resetDemoData() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("sim_reset");
  if (error) throw error;
  return data as { products: number; orders: number };
}

export async function listEvents(typePrefix: string | undefined, page: number, pageSize = 30) {
  const supabase = await createServerClient();
  let query = supabase
    .from("events")
    .select("id, type, order_id, data, created_at, order:orders(number)", { count: "exact" })
    .order("id", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (typePrefix) query = query.like("type", `${typePrefix}.%`);
  const { data, count, error } = await query;
  if (error) throw error;
  return { items: data ?? [], total: count ?? 0, pageSize };
}
