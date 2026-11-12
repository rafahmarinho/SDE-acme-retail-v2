import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderTimeline } from "@/components/order-timeline";
import { DeliveryBadge } from "@/components/ui";
import { date } from "@/lib/format";
import { trackOrder } from "@/services/orders";

export const metadata: Metadata = { title: "Track your order", robots: { index: false, follow: false } };

/** Public tracking by unguessable 192-bit token: delivery info only, no personal data (T151, T2139). */
export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const info = await trackOrder((await params).token);
  if (!info) notFound();
  return (
    <div className="container-page max-w-2xl py-10">
      <div className="card space-y-5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="muted">Order {info.number} · placed {date(info.created_at)}</p>
            <h1 className="h1">Shipment tracking</h1>
          </div>
          <DeliveryBadge status={info.status_delivery} />
        </div>
        {info.carrier ? (
          <p className="text-sm">
            Carrier: <strong>{info.carrier}</strong> · Tracking number: <strong className="font-mono">{info.tracking_number}</strong>
          </p>
        ) : (
          <p className="muted">Your order hasn&apos;t shipped yet.</p>
        )}
        <ul className="text-sm">
          {info.items.map((i, n) => (
            <li key={n}>{i.qty} × {i.name} ({i.variant})</li>
          ))}
        </ul>
        <OrderTimeline events={info.timeline} />
      </div>
    </div>
  );
}
