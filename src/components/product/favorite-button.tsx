"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toggleFavoriteAction } from "@/actions/shop";

export function FavoriteButton({ productId, initial, signedIn, nextPath }: { productId: string; initial: boolean; signedIn: boolean; nextPath: string }) {
  const [favorite, setFavorite] = useOptimistic(initial);
  const [pending, start] = useTransition();
  if (!signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="btn-secondary" title="Sign in to save favorites">
        ♡ Save
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={`btn-secondary ${favorite ? "border-brand-600 text-brand-700" : ""}`}
      aria-pressed={favorite}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setFavorite(!favorite);
          await toggleFavoriteAction(productId);
        })
      }
    >
      {favorite ? "♥ Saved" : "♡ Save"}
    </button>
  );
}
