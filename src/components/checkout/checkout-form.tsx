"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { placeOrderAction } from "@/actions/shop";
import { useCart } from "@/components/cart/cart-context";
import { useQuote } from "@/components/cart/use-quote";
import { Field, FormMessage, Spinner, SubmitButton } from "@/components/forms";
import { EmptyState, ProductImage } from "@/components/ui";
import { money } from "@/lib/format";

interface SavedAddress {
  id: string;
  full_name: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postal_code: string;
  country: string;
}

const SCENARIOS = [
  { id: "approve", label: "Approve", hint: "The payment succeeds immediately." },
  { id: "decline", label: "Decline", hint: "The card is declined - you can retry." },
  { id: "authenticate", label: "Require authentication", hint: "A 3-D Secure style challenge is shown." },
  { id: "timeout", label: "Timeout", hint: "The provider doesn't answer in time - you can retry." },
] as const;

export function CheckoutForm({ provider, addresses, defaultName }: { provider: "simulated" | "stripe"; addresses: SavedAddress[]; defaultName: string }) {
  const { items, hydrated } = useCart();
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | null>(null);
  const [method, setMethod] = useState<"standard" | "express">("standard");
  const [addrIdx, setAddrIdx] = useState(0);
  const { quote, error, pending } = useQuote(items, coupon, method, hydrated);
  const [state, formAction] = useActionState(placeOrderAction, undefined);
  const addr = addresses[addrIdx];

  if (!hydrated) {
    return (
      <p className="muted flex items-center gap-2 py-10">
        <Spinner /> Loading checkout...
      </p>
    );
  }
  if (items.length === 0) {
    return <EmptyState title="Your cart is empty" action={<Link href="/catalog" className="btn-primary">Browse the catalog</Link>} />;
  }

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-3">
      <input type="hidden" name="lines" value={JSON.stringify(items)} />
      <input type="hidden" name="coupon" value={coupon ?? ""} />
      <div className="space-y-6 lg:col-span-2">
        <section className="card space-y-4 p-5">
          <h2 className="h2">Shipping address</h2>
          {addresses.length > 1 && (
            <label className="block">
              <span className="label">Saved addresses</span>
              <select className="input" value={addrIdx} onChange={(e) => setAddrIdx(Number(e.target.value))}>
                {addresses.map((a, i) => (
                  <option key={a.id} value={i}>
                    {a.full_name} - {a.line1}, {a.city}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div key={addrIdx} className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" name="full_name" defaultValue={addr?.full_name ?? defaultName} required autoComplete="name" maxLength={120} className="sm:col-span-2" />
            <Field label="Address line 1" name="line1" defaultValue={addr?.line1} required autoComplete="address-line1" maxLength={120} className="sm:col-span-2" />
            <Field label="Address line 2" name="line2" defaultValue={addr?.line2} autoComplete="address-line2" maxLength={120} className="sm:col-span-2" />
            <Field label="City" name="city" defaultValue={addr?.city} required autoComplete="address-level2" maxLength={80} />
            <Field label="State / region" name="region" defaultValue={addr?.region} autoComplete="address-level1" maxLength={80} />
            <Field label="Postal code" name="postal_code" defaultValue={addr?.postal_code} required autoComplete="postal-code" maxLength={10} />
            <Field label="Country (2 letters)" name="country" defaultValue={addr?.country ?? "US"} required autoComplete="country" maxLength={2} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="save_address" defaultChecked={addresses.length === 0} /> Save as my default address
          </label>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="h2">Shipping method</h2>
          {(
            [
              ["standard", "Standard (3-5 business days)", "$5.99, free on orders of $75+"],
              ["express", "Express (1-2 business days)", "$14.99"],
            ] as const
          ).map(([id, label, price]) => (
            <label key={id} className={`flex cursor-pointer items-center justify-between rounded-lg border p-3 ${method === id ? "border-brand-600 bg-brand-50" : "border-gray-200"}`}>
              <span className="flex items-center gap-2">
                <input type="radio" name="method" value={id} checked={method === id} onChange={() => setMethod(id)} />
                {label}
              </span>
              <span className="muted">{price}</span>
            </label>
          ))}
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="h2">Payment</h2>
          {provider === "simulated" ? (
            <>
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Simulated payment - no real money is charged. Choose the outcome you want to test.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SCENARIOS.map((s, i) => (
                  <label key={s.id} className="flex cursor-pointer gap-2 rounded-lg border border-gray-200 p-3 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                    <input type="radio" name="scenario" value={s.id} defaultChecked={i === 0} className="mt-1" />
                    <span>
                      <span className="block font-medium">{s.label}</span>
                      <span className="muted">{s.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
              You&apos;ll be redirected to Stripe Checkout in test mode. Use a Stripe test card - no real money is charged.
            </p>
          )}
        </section>
      </div>

      <aside className="card h-fit space-y-3 p-5">
        <h2 className="h2">Order summary</h2>
        {!quote && !error && (
          <p className="muted flex items-center gap-2">
            <Spinner /> Calculating...
          </p>
        )}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {quote && (
          <>
            <ul className="space-y-2">
              {quote.lines
                .filter((l) => !l.missing)
                .map((l) => (
                  <li key={l.variant_id} className="flex items-center gap-3 text-sm">
                    <div className="w-10 shrink-0">
                      <ProductImage name={l.product_name ?? ""} path={l.image_path} accent={l.accent} size="sm" />
                    </div>
                    <span className="flex-1">
                      {l.product_name} <span className="text-gray-500">· {l.variant_name} × {l.qty}</span>
                      {!l.ok && <span className="block text-xs text-red-600">Only {l.available} available</span>}
                    </span>
                    <span>{money(l.line_total)}</span>
                  </li>
                ))}
            </ul>
            <div className="flex gap-2 border-t pt-3">
              <input
                className="input"
                placeholder="Coupon code"
                value={couponInput}
                maxLength={24}
                aria-label="Coupon code"
                onChange={(e) => setCouponInput(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
              />
              <button type="button" className="btn-secondary" onClick={() => setCoupon(couponInput || null)}>
                Apply
              </button>
            </div>
            {quote.coupon && (
              <p className={`text-sm ${quote.coupon.valid ? "text-brand-700" : "text-red-600"}`}>
                {quote.coupon.code}: {quote.coupon.message}
              </p>
            )}
            <dl className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(quote.subtotal)}</dd></div>
              {quote.discount > 0 && <div className="flex justify-between text-brand-700"><dt>Discount</dt><dd>-{money(quote.discount)}</dd></div>}
              <div className="flex justify-between"><dt>Shipping</dt><dd>{quote.shipping === 0 ? "Free" : money(quote.shipping)}</dd></div>
              <div className="flex justify-between"><dt>Tax (8%, illustrative)</dt><dd>{money(quote.tax)}</dd></div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Total</dt><dd>{money(quote.total)}</dd></div>
            </dl>
            {pending && <p className="text-xs text-gray-500">Updating...</p>}
            {!quote.all_available && <p className="text-sm text-red-600">Some items exceed available stock. Update your cart to continue.</p>}
          </>
        )}
        <SubmitButton className="btn-primary w-full py-3" pendingText="Placing order..." disabled={!quote || !quote.all_available || (!!coupon && !quote.coupon?.valid)}>
          {provider === "stripe" ? "Continue to Stripe" : "Place order"}
        </SubmitButton>
        {coupon && quote?.coupon && !quote.coupon.valid && <p className="text-xs text-red-600">Remove or fix the coupon to place your order.</p>}
        <p className="text-xs text-gray-500">Items are reserved for 15 minutes while you complete payment.</p>
        <FormMessage state={state} />
      </aside>
    </form>
  );
}
