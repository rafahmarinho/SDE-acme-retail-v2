"use client";
import Link from "next/link";
import { useEffect } from "react";
import { money } from "@/lib/format";
import { ProductImage } from "@/components/ui";
import { Spinner } from "@/components/forms";
import { useCart } from "./cart-context";
import { useQuote } from "./use-quote";
import type { Quote } from "@/db/types";

export function CartButton() {
  const { count, setOpen, hydrated } = useCart();
  return (
    <button type="button" onClick={() => setOpen(true)} className="btn-secondary relative" aria-label={`Open cart, ${count} items`}>
      <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9.5" cy="19.5" r="1.3" />
        <circle cx="17" cy="19.5" r="1.3" />
      </svg>
      <span className="hidden sm:inline">Cart</span>
      {hydrated && count > 0 && (
        <span className="absolute -top-2 -right-2 rounded-full bg-brand-600 px-1.5 text-xs font-semibold text-white">{count}</span>
      )}
    </button>
  );
}

export function CartLinesList({ quote, compact = false }: { quote: Quote; compact?: boolean }) {
  const { setQty, remove } = useCart();
  return (
    <ul className="divide-y divide-gray-100">
      {quote.lines
        .filter((l) => !l.missing)
        .map((l) => (
          <li key={l.variant_id} className="flex gap-3 py-3">
            <div className={compact ? "w-16 shrink-0" : "w-20 shrink-0"}>
              <ProductImage name={l.product_name ?? ""} path={l.image_path} accent={l.accent} size="sm" />
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/product/${l.slug}`} className="block truncate font-medium hover:underline">
                {l.product_name}
              </Link>
              <p className="muted">{l.variant_name}</p>
              {!l.ok && <p className="text-xs font-medium text-red-600">Only {l.available} available</p>}
              <div className="mt-1 flex items-center gap-2">
                <label className="sr-only" htmlFor={`qty-${l.variant_id}`}>
                  Quantity
                </label>
                <select
                  id={`qty-${l.variant_id}`}
                  className="input w-20 py-1"
                  value={l.qty}
                  onChange={(e) => setQty(l.variant_id, Number(e.target.value))}
                >
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <button type="button" className="text-xs text-gray-500 hover:text-red-600" onClick={() => remove(l.variant_id)}>
                  Remove
                </button>
              </div>
            </div>
            <p className="text-sm font-medium">{money(l.line_total)}</p>
          </li>
        ))}
    </ul>
  );
}

export function CartDrawer() {
  const { items, open, setOpen, removeMany } = useCart();
  const { quote, error, pending } = useQuote(items, null, "standard", open);

  useEffect(() => {
    const missing = quote?.lines.filter((l) => l.missing).map((l) => l.variant_id) ?? [];
    if (missing.length) removeMany(missing);
  }, [quote, removeMany]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <button type="button" aria-label="Close cart" className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
      <aside className="absolute top-0 right-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="h2">Your cart</h2>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5">
          {items.length === 0 && <p className="muted py-10 text-center">Your cart is empty.</p>}
          {items.length > 0 && !quote && (
            <p className="muted flex items-center justify-center gap-2 py-10">
              <Spinner /> Loading your cart...
            </p>
          )}
          {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {quote && <CartLinesList quote={quote} compact />}
        </div>
        {quote && items.length > 0 && (
          <div className="space-y-3 border-t px-5 py-4">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-semibold">{money(quote.subtotal)}</span>
            </div>
            <p className="text-xs text-gray-500">Shipping and tax are calculated at checkout. {pending && "Updating..."}</p>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/cart" className="btn-secondary" onClick={() => setOpen(false)}>
                View cart
              </Link>
              <Link href="/checkout" className="btn-primary" onClick={() => setOpen(false)}>
                Checkout
              </Link>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export function ClearCart() {
  const { clear, hydrated } = useCart();
  useEffect(() => {
    if (hydrated) clear();
  }, [hydrated, clear]);
  return null;
}
