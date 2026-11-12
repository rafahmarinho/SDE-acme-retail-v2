const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export const money = (n: number | string | null | undefined) => usd.format(Number(n ?? 0));
export const date = (d: string | Date | null | undefined) => (d ? dateFmt.format(new Date(d)) : "-");
export const dateTime = (d: string | Date | null | undefined) => (d ? dateTimeFmt.format(new Date(d)) : "-");

export const PAYMENT_LABELS: Record<string, string> = {
  pending: "Awaiting payment",
  requires_action: "Authentication required",
  approved: "Paid",
  declined: "Declined",
  timed_out: "Timed out",
  expired: "Expired",
  voided: "Voided",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

export const DELIVERY_LABELS: Record<string, string> = {
  unfulfilled: "Not fulfilled",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const RETURN_LABELS: Record<string, string> = {
  requested: "Requested",
  approved: "Approved - awaiting item",
  rejected: "Rejected",
  received: "Received - awaiting refund",
  refunded: "Refunded",
};

export const EVENT_LABELS: Record<string, string> = {
  "order.placed": "Order placed",
  "order.expired": "Checkout expired",
  "order.cancelled": "Order cancelled",
  "order.shipped": "Shipped",
  "order.delivered": "Delivered",
  "payment.approved": "Payment approved",
  "payment.declined": "Payment declined",
  "payment.requires_action": "Payment authentication requested",
  "payment.timed_out": "Payment timed out",
  "shipment.delayed": "Shipment delayed",
  "return.requested": "Return requested",
  "return.approved": "Return approved",
  "return.rejected": "Return rejected",
  "return.received": "Return received",
  "refund.issued": "Refund issued",
  "inventory.adjusted": "Inventory adjusted",
  "inventory.stockout": "Stock-out (simulated)",
  "simulation.reset": "Demo data reset",
  "simulation.advanced": "Simulation advanced",
  "simulation.scenario_changed": "Scenario changed",
};

/** True when `d` is within the last `days` days. */
export function withinDays(d: string | null | undefined, days: number): boolean {
  return !!d && Date.now() - Date.parse(d) < days * 86_400_000;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
