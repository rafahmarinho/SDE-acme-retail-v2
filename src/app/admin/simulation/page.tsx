import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { advanceAction, resetAction, setScenarioAction } from "@/actions/simulation";
import { ActionForm, SubmitButton } from "@/components/forms";
import { LiveRefresh } from "@/components/live-refresh";
import { Badge, PageHeader, Pagination } from "@/components/ui";
import { EVENT_LABELS, dateTime } from "@/lib/format";
import { Page } from "@/lib/schemas";
import { requirePagePermission } from "@/services/auth";
import { SCENARIOS, getSimulationState, listEvents, simulationEnabled } from "@/services/simulation";

export const metadata: Metadata = { title: "Simulation", robots: { index: false } };

const EVENT_GROUPS = ["order", "payment", "shipment", "return", "refund", "inventory", "simulation"] as const;

export default async function SimulationPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  if (!simulationEnabled()) notFound(); // disabled environments don't expose the area at all (T49)
  await requirePagePermission("simulation:run", "/admin/simulation");
  const sp = await searchParams;
  const type = EVENT_GROUPS.find((g) => g === sp.type);
  const page = Page.parse(sp.page);
  const [state, events] = await Promise.all([getSimulationState(), listEvents(type, page)]);
  const current = SCENARIOS.find((s) => s.id === state?.scenario);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulation"
        subtitle="Drive demo traffic through the store. Results appear on every screen and persist after reload."
        actions={<LiveRefresh tables={["events", "orders"]} signedIn />}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card space-y-3 p-5">
          <h2 className="h2">Scenario</h2>
          <p className="text-sm">Current: <Badge tone="green">{current?.label ?? state?.scenario}</Badge> · step {state?.step ?? 0}</p>
          <ActionForm action={setScenarioAction} className="space-y-2">
            {SCENARIOS.map((s) => (
              <label key={s.id} className="flex cursor-pointer gap-2 rounded-lg border border-gray-200 p-2 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                <input type="radio" name="scenario" value={s.id} defaultChecked={s.id === state?.scenario} className="mt-1" />
                <span><span className="font-medium">{s.label}</span><span className="muted block">{s.description}</span></span>
              </label>
            ))}
            <SubmitButton className="btn-secondary w-full">Use scenario</SubmitButton>
          </ActionForm>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="h2">Advance</h2>
          <p className="muted">Each step ships and delivers orders, creates a new simulated order and applies the scenario.</p>
          <ActionForm action={advanceAction} className="flex flex-wrap gap-2">
            <SubmitButton name="steps" value="1" pendingText="Running...">+1 step</SubmitButton>
            <SubmitButton name="steps" value="5" className="btn-secondary">+5 steps</SubmitButton>
            <SubmitButton name="steps" value="10" className="btn-secondary">+10 steps</SubmitButton>
          </ActionForm>
        </section>
        <section className="card space-y-3 border-red-200 p-5">
          <h2 className="h2">Reset demo data</h2>
          <p className="muted">Restores 40 products and 60 orders. User accounts and the audit log are kept. Requires a sign-in within the last 15 minutes.</p>
          <ActionForm action={resetAction} className="space-y-2">
            <input name="confirm" className="input" placeholder="Type RESET to confirm" maxLength={5} autoComplete="off" />
            <SubmitButton className="btn-danger w-full" pendingText="Resetting...">Reset data</SubmitButton>
          </ActionForm>
          <Link href="/login?reauth=1&next=/admin/simulation" className="link text-xs">Sign in again</Link>
        </section>
      </div>

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="h2">Events</h2>
          <nav className="flex flex-wrap gap-1 text-xs">
            <Link href="/admin/simulation" className={`btn-secondary btn-sm ${!type ? "border-brand-600" : ""}`}>All</Link>
            {EVENT_GROUPS.map((g) => (
              <Link key={g} href={`/admin/simulation?type=${g}`} className={`btn-secondary btn-sm capitalize ${type === g ? "border-brand-600" : ""}`}>{g}</Link>
            ))}
          </nav>
        </div>
        <table className="table-ui">
          <thead><tr><th>#</th><th>When</th><th>Event</th><th>Order</th><th>Details</th></tr></thead>
          <tbody>
            {events.items.map((e) => {
              const order = Array.isArray(e.order) ? e.order[0] : e.order;
              return (
                <tr key={e.id}>
                  <td className="text-gray-400">{e.id}</td>
                  <td className="whitespace-nowrap">{dateTime(e.created_at)}</td>
                  <td>{EVENT_LABELS[e.type] ?? e.type}</td>
                  <td>{order && <Link className="link" href={`/admin/orders/${e.order_id}`}>{order.number}</Link>}</td>
                  <td className="max-w-80 truncate font-mono text-xs text-gray-500">{JSON.stringify(e.data)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination page={page} total={events.total} pageSize={events.pageSize} href={(p) => `/admin/simulation?${new URLSearchParams({ ...(type ? { type } : {}), page: String(p) })}`} />
      </section>
    </div>
  );
}
