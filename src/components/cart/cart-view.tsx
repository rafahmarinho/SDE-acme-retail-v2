"use client";
import Link from "next/link";
import { useEffect } from "react";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/ui";
import { Spinner } from "@/components/forms";
import { useCart } from "./cart-context";
import { CartLinesList } from "./cart-drawer";
import { useQuote } from "./use-quote";

export function CartView() {
  const { items, hydrated, removeMany } = useCart();
  const { quote, error, pending } = useQuote(items, null, "standard", hydrated);

  useEffect(() => {
    const missing = quote?.lines.filter((l) => l.missing).map((l) => l.variant_id) ?? [];
    if (missing.length) removeMany(missing);
  }, [quote, removeMany]);

  if (!hydrated || (items.length > 0 && !quote && !error)) {
    return (
      <p className="muted flex items-center gap-2 py-10">
        <Spinner /> Loading your cart...
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState title="Your cart is empty" action={<Link href="/catalog" className="btn-primary">Browse the catalog</Link>}>
        Find something you love - favorites and recently viewed items are a good place to start.
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card p-5 lg:col-span-2">
        {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {quote && <CartLinesList quote={quote} />}
      </div>
      {quote && (
        <aside className="card h-fit space-y-2 p-5">
          <h2 className="h2">Order summary</h2>
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{money(quote.subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span>Estimated shipping</span><span>{quote.shipping === 0 ? "Free" : money(quote.shipping)}</span></div>
          <div className="flex justify-between text-sm"><span>Estimated tax (8%, illustrative)</span><span>{money(quote.tax)}</span></div>
          <div className="flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{money(quote.total)}</span></div>
          {!quote.all_available && <p className="text-sm text-red-600">Some items exceed available stock. Adjust quantities to continue.</p>}
          <p className="text-xs text-gray-500">Free standard shipping on orders of $75 or more. Coupons are applied at checkout. {pending && "Updating..."}</p>
          <Link href="/checkout" className={`btn-primary w-full ${quote.all_available ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!quote.all_available}>
            Continue to checkout
          </Link>
        </aside>
      )}
    </div>
  );
}
