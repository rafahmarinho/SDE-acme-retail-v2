"use client";
import { useEffect, useState, useTransition } from "react";
import { quoteCartAction } from "@/actions/shop";
import type { Quote } from "@/db/types";
import type { CartLineT } from "@/lib/schemas";

/** Server-side quote for the current cart (debounced). Missing variants are reported back. */
export function useQuote(items: CartLineT[], coupon: string | null, method: "standard" | "express", enabled = true) {
  const [result, setResult] = useState<{ key: string; quote: Quote | null; error: string | null } | null>(null);
  const [pending, startTransition] = useTransition();
  const key = JSON.stringify([items, coupon, method]);
  const empty = items.length === 0;

  useEffect(() => {
    if (!enabled || empty) return;
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await quoteCartAction(JSON.parse(key)[0], coupon, method);
        setResult(res.ok ? { key, quote: res.quote, error: null } : { key, quote: null, error: res.error });
      });
    }, 250);
    return () => clearTimeout(t);
  }, [key, enabled, empty, coupon, method]);

  if (empty) return { quote: null, error: null, pending: false };
  // keep showing the previous quote while a new one loads
  return { quote: result?.quote ?? null, error: result?.error ?? null, pending: pending || result?.key !== key };
}
