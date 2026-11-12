import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { completeChallengeAction, restartStripeCheckoutAction, retryPaymentAction } from "@/actions/shop";
import { ClearCart } from "@/components/cart/cart-drawer";
import { ActionForm, SubmitButton } from "@/components/forms";
import { LiveRefresh } from "@/components/live-refresh";
import { DeliveryBadge, PaymentBadge } from "@/components/ui";
import { dateTime, money } from "@/lib/format";
import { Uuid } from "@/lib/schemas";
import { requireUser } from "@/services/auth";
import { getMyOrder } from "@/services/orders";
import { confirmStripeSession } from "@/services/payments";

export const metadata: Metadata = { title: "Payment result", robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ session_id?: string; cancelled?: string }> };

const RETRY_OPTIONS = [
  ["approve", "Approve"],
  ["decline", "Decline"],
  ["authenticate", "Require authentication"],
  ["timeout", "Timeout"],
] as const;

export default async function PaymentResultPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  if (!Uuid.safeParse(id).success) notFound();
  const auth = await requireUser(`/checkout/result/${id}`);
  let order = await getMyOrder(auth.user.id, id);
  if (!order) notFound();

  // Stripe: confirm server-to-server; the redirect itself proves nothing (T558)
  if (order.payment_provider === "stripe" && order.status_payment === "pending" && sp.session_id) {
    if (await confirmStripeSession(order.id, sp.session_id).catch(() => false)) {
      order = (await getMyOrder(auth.user.id, id))!;
    }
  }

  const status = order.status_payment;
  const canRetry = order.payment_provider === "simulated" && ["declined", "timed_out", "pending"].includes(status) && !!order.reservation_expires_at;

  return (
    <div className="container-page max-w-3xl py-10">
      <ClearCart />
      <div className="card space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="muted">Order {order.number}</p>
            <h1 className="h1">
              {status === "approved" && "Thank you! Your order is confirmed."}
              {status === "requires_action" && "Confirm your payment"}
              {status === "declined" && "Your payment was declined"}
              {status === "timed_out" && "The payment timed out"}
              {status === "pending" && (sp.cancelled ? "Payment cancelled" : "Awaiting payment")}
              {status === "expired" && "Your reservation expired"}
              {["voided", "refunded", "partially_refunded"].includes(status) && "Order update"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <PaymentBadge status={status} />
            <DeliveryBadge status={order.status_delivery} />
            <LiveRefresh tables={["orders"]} signedIn />
          </div>
        </div>

        {status === "approved" && (
          <p className="text-gray-700">
            We&apos;ve received your payment of <strong>{money(order.total)}</strong>. We&apos;ll let you know when your order ships.
          </p>
        )}

        {status === "requires_action" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="font-medium text-amber-900">Simulated bank authentication (3-D Secure)</p>
            <p className="mt-1 text-sm text-amber-800">Your bank asks you to confirm this payment of {money(order.total)}. Choose the outcome to simulate.</p>
            <ActionForm action={completeChallengeAction} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="order_id" value={order.id} />
              <SubmitButton name="outcome" value="success" pendingText="Confirming...">Complete authentication</SubmitButton>
              <SubmitButton name="outcome" value="fail" className="btn-danger">Fail authentication</SubmitButton>
            </ActionForm>
          </div>
        )}

        {canRetry && (
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-700">
              {status === "declined" && "Your card issuer declined the payment. "}
              {status === "timed_out" && "The payment provider didn't respond in time. You weren't charged. "}
              Your items are reserved until <strong>{dateTime(order.reservation_expires_at)}</strong>. Try again:
            </p>
            <ActionForm action={retryPaymentAction} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="order_id" value={order.id} />
              <label>
                <span className="label">Simulated outcome</span>
                <select name="scenario" className="input" defaultValue="approve">
                  {RETRY_OPTIONS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </label>
              <SubmitButton pendingText="Processing...">Retry payment</SubmitButton>
            </ActionForm>
          </div>
        )}

        {order.payment_provider === "stripe" && status === "pending" && order.reservation_expires_at && (
          <ActionForm action={restartStripeCheckoutAction}>
            <input type="hidden" name="order_id" value={order.id} />
            <p className="mb-2 text-sm text-gray-700">Your items are reserved until {dateTime(order.reservation_expires_at)}.</p>
            <SubmitButton>Pay with Stripe (test mode)</SubmitButton>
          </ActionForm>
        )}

        {status === "expired" && (
          <p className="text-gray-700">
            The 15-minute reservation for these items ended before payment was completed, so the items went back on sale.
          </p>
        )}

        <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
          <ul className="space-y-1 text-sm">
            {order.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-2">
                <span>{i.product_name} · {i.variant_name} × {i.qty}</span>
                <span>{money(i.line_total)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
            {Number(order.discount) > 0 && <div className="flex justify-between"><dt>Discount ({order.coupon_code})</dt><dd>-{money(order.discount)}</dd></div>}
            <div className="flex justify-between"><dt>Shipping</dt><dd>{money(order.shipping)}</dd></div>
            <div className="flex justify-between"><dt>Tax (illustrative)</dt><dd>{money(order.tax)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
          </dl>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/account/orders/${order.id}`} className="btn-primary">View order</Link>
          <Link href="/catalog" className="btn-secondary">Continue shopping</Link>
        </div>
      </div>
    </div>
  );
}
