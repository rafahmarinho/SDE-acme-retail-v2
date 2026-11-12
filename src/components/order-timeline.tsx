import { EVENT_LABELS, dateTime, money } from "@/lib/format";

interface TimelineEvent {
  id?: number;
  type: string;
  created_at?: string;
  at?: string;
  data?: unknown;
}

function detail(e: TimelineEvent): string | null {
  const d = (e.data ?? {}) as Record<string, unknown>;
  if (e.type === "order.shipped" && d.carrier) return `${String(d.carrier)} · ${String(d.tracking_number ?? "")}`;
  if (e.type === "refund.issued" && d.amount) return `${money(Number(d.amount))} (${String(d.kind ?? "refund")})`;
  if ((e.type === "order.cancelled" || e.type === "payment.declined" || e.type === "shipment.delayed") && d.reason) return String(d.reason);
  return null;
}

export function OrderTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <p className="muted">No updates yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-gray-200 pl-5">
      {events.map((e, i) => (
        <li key={e.id ?? i}>
          <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand-600" aria-hidden />
          <p className="text-sm font-medium">{EVENT_LABELS[e.type] ?? e.type}</p>
          <p className="text-xs text-gray-500">
            {dateTime(e.created_at ?? e.at)}
            {detail(e) && ` · ${detail(e)}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
