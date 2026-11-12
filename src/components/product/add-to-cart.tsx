"use client";
import { useState } from "react";
import { money } from "@/lib/format";
import { useCart } from "@/components/cart/cart-context";

interface VariantOption {
  id: string;
  name: string;
  price: number;
  available: number;
}

export function AddToCart({ variants }: { variants: VariantOption[] }) {
  const { add, setOpen } = useCart();
  const firstAvailable = variants.find((v) => v.available > 0) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id);
  const [qty, setQty] = useState(1);
  const selected = variants.find((v) => v.id === variantId) ?? firstAvailable;
  if (!selected) return <p className="muted">This product is currently unavailable.</p>;
  const max = Math.min(20, selected.available);

  return (
    <div className="space-y-4">
      <p className="text-2xl font-semibold">{money(selected.price)}</p>
      {variants.length > 1 && (
        <fieldset>
          <legend className="label">Choose an option</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setVariantId(v.id);
                  setQty(1);
                }}
                aria-pressed={v.id === selected.id}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  v.id === selected.id ? "border-brand-600 bg-brand-50 text-brand-800" : "border-gray-300 bg-white hover:border-gray-400"
                } ${v.available === 0 ? "text-gray-400 line-through" : ""}`}
              >
                {v.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <p className={`text-sm ${selected.available === 0 ? "text-red-600" : selected.available <= 5 ? "text-amber-700" : "text-brand-700"}`}>
        {selected.available === 0 ? "Out of stock" : selected.available <= 5 ? `Only ${selected.available} left` : "In stock"}
      </p>
      <div className="flex items-end gap-3">
        <label>
          <span className="label">Quantity</span>
          <input
            className="input w-24"
            type="number"
            min={1}
            max={Math.max(1, max)}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(Math.max(1, max), Number(e.target.value) || 1)))}
          />
        </label>
        <button
          type="button"
          className="btn-primary flex-1 py-2.5"
          disabled={selected.available === 0}
          onClick={() => {
            add(selected.id, qty);
            setOpen(true);
          }}
        >
          Add to cart
        </button>
      </div>
    </div>
  );
}
