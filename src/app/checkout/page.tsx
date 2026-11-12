import type { Metadata } from "next";
import { requireUser } from "@/services/auth";
import { activeProvider } from "@/services/payments";
import { listAddresses } from "@/services/users";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const auth = await requireUser("/checkout");
  const addresses = await listAddresses(auth.user.id);
  return (
    <div className="container-page py-8">
      <h1 className="h1 mb-6">Checkout</h1>
      <CheckoutForm provider={activeProvider()} addresses={addresses} defaultName={auth.fullName} />
    </div>
  );
}
