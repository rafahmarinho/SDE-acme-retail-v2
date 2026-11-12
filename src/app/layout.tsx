import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import "./globals.css";
import { CartProvider } from "@/components/cart/cart-context";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { Footer, Header } from "@/components/header";

export const metadata: Metadata = {
  title: { default: "ACME Retail", template: "%s · ACME Retail" },
  description: "Everyday essentials, outdoor gear and electronics - delivered fast. A demo store.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Render per request: required for the per-request CSP nonce and for session-aware pages.
  await connection();
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
