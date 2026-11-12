"use client";
/**
 * Cart state persisted in localStorage so it survives reloads. Only variant IDs and quantities are
 * stored - no prices, PII or tokens (T1468). Stored data is schema-validated on every read.
 * Prices are always quoted by the server.
 */
import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { z } from "zod";
import { CartLines, type CartLineT } from "@/lib/schemas";

const STORAGE_KEY = "acme.cart.v1";
const Stored = z.object({ v: z.literal(1), items: CartLines });
const EMPTY: CartLineT[] = [];

// --- tiny external store over localStorage (with in-memory fallback) -------------------------
const listeners = new Set<() => void>();
let memory: string | null = null;
let cache: { raw: string | null; items: CartLineT[] } = { raw: null, items: EMPTY };

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return memory;
  }
}

function snapshot(): CartLineT[] {
  const raw = readRaw();
  if (raw === cache.raw) return cache.items;
  let items = EMPTY;
  try {
    const parsed = Stored.safeParse(JSON.parse(raw ?? "null"));
    if (parsed.success) items = parsed.data.items;
  } catch {
    /* corrupted value: treat as empty */
  }
  cache = { raw, items };
  return items;
}

function write(items: CartLineT[]) {
  const raw = JSON.stringify({ v: 1, items });
  try {
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    memory = raw;
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const noopSubscribe = () => () => {};

// --- context -----------------------------------------------------------------------------------
interface CartCtx {
  items: CartLineT[];
  count: number;
  hydrated: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (variantId: string, qty: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  removeMany: (variantIds: string[]) => void;
  clear: () => void;
}

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [open, setOpen] = useState(false);

  const update = useCallback((fn: (prev: CartLineT[]) => CartLineT[]) => write(fn(snapshot())), []);
  const add = useCallback(
    (variantId: string, qty: number) =>
      update((prev) => {
        if (prev.some((l) => l.variantId === variantId)) {
          return prev.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(20, l.qty + qty) } : l));
        }
        return prev.length >= 50 ? prev : [...prev, { variantId, qty: Math.min(20, Math.max(1, qty)) }];
      }),
    [update],
  );
  const setQty = useCallback(
    (variantId: string, qty: number) => update((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(20, Math.max(1, qty)) } : l))),
    [update],
  );
  const remove = useCallback((variantId: string) => update((prev) => prev.filter((l) => l.variantId !== variantId)), [update]);
  const removeMany = useCallback((ids: string[]) => update((prev) => prev.filter((l) => !ids.includes(l.variantId))), [update]);
  const clear = useCallback(() => write(EMPTY), []);

  const value = useMemo<CartCtx>(
    () => ({ items, count: items.reduce((n, l) => n + l.qty, 0), hydrated, open, setOpen, add, setQty, remove, removeMany, clear }),
    [items, hydrated, open, add, setQty, remove, removeMany, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
