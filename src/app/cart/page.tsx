import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <div className="container-page py-8">
      <h1 className="h1 mb-6">Shopping cart</h1>
      <CartView />
    </div>
  );
}
