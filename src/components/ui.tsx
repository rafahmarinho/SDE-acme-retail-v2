/**
 * Small presentational building blocks (server-safe). User data is always rendered as JSX text,
 * which React escapes contextually (T36).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { DELIVERY_LABELS, PAYMENT_LABELS, RETURN_LABELS, initials, money } from "@/lib/format";
import { productImageUrl } from "@/db/storage";

const TONES = {
  green: "bg-brand-50 text-brand-800 ring-brand-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  gray: "bg-gray-100 text-gray-700 ring-gray-200",
} as const;

export function Badge({ tone = "gray", children }: { tone?: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>{children}</span>;
}

const PAYMENT_TONE: Record<string, keyof typeof TONES> = {
  approved: "green", pending: "amber", requires_action: "amber", timed_out: "amber",
  declined: "red", expired: "gray", voided: "gray", refunded: "blue", partially_refunded: "blue",
};
const DELIVERY_TONE: Record<string, keyof typeof TONES> = {
  unfulfilled: "gray", processing: "amber", shipped: "blue", delivered: "green", cancelled: "gray", returned: "blue",
};
const RETURN_TONE: Record<string, keyof typeof TONES> = {
  requested: "amber", approved: "blue", rejected: "red", received: "blue", refunded: "green",
};

export function PaymentBadge({ status }: { status: string }) {
  return <Badge tone={PAYMENT_TONE[status] ?? "gray"}>{PAYMENT_LABELS[status] ?? status}</Badge>;
}
export function DeliveryBadge({ status }: { status: string }) {
  return <Badge tone={DELIVERY_TONE[status] ?? "gray"}>{DELIVERY_LABELS[status] ?? status}</Badge>;
}
export function ReturnBadge({ status }: { status: string }) {
  return <Badge tone={RETURN_TONE[status] ?? "gray"}>{RETURN_LABELS[status] ?? status}</Badge>;
}

export function Money({ value, className }: { value: number | string | null | undefined; className?: string }) {
  return <span className={className}>{money(value)}</span>;
}

export function ProductImage({
  name,
  path,
  accent,
  className = "aspect-square",
  size = "lg",
}: {
  name: string;
  path?: string | null;
  accent?: string | null;
  className?: string;
  size?: "sm" | "lg";
}) {
  const url = productImageUrl(path);
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- images are served by Supabase Storage
    return <img src={url} alt={name} loading="lazy" className={`${className} w-full rounded-lg object-cover`} />;
  }
  const color = accent && /^#[0-9a-f]{6}$/.test(accent) ? accent : "#16a34a";
  return (
    <div
      role="img"
      aria-label={name}
      className={`${className} flex w-full items-center justify-center rounded-lg`}
      style={{ background: `linear-gradient(135deg, ${color}22, ${color}55)` }}
    >
      <span className={`${size === "sm" ? "text-sm" : "text-3xl"} font-bold`} style={{ color }}>
        {initials(name)}
      </span>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-10 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="muted max-w-md">{children}</div>}
      {action}
    </div>
  );
}

export function Pagination({ page, total, pageSize, href }: { page: number; total: number; pageSize: number; href: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-2">
      <span className="muted">
        Page {page} of {pages} · {total} results
      </span>
      <div className="flex gap-2">
        {page > 1 ? <Link className="btn-secondary btn-sm" href={href(page - 1)}>Previous</Link> : <span className="btn-secondary btn-sm opacity-50">Previous</span>}
        {page < pages ? <Link className="btn-secondary btn-sm" href={href(page + 1)}>Next</Link> : <span className="btn-secondary btn-sm opacity-50">Next</span>}
      </div>
    </nav>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="muted mt-1">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Builds a URL that keeps the current search params, with overrides (null removes a key). */
export function withParams(base: string, current: Record<string, string | undefined>, overrides: Record<string, string | number | null>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) if (v) p.set(k, v);
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) p.delete(k);
    else p.set(k, String(v));
  }
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}
