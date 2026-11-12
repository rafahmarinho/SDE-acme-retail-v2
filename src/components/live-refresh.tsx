"use client";
/**
 * Supabase Realtime -> router.refresh(). Postgres changes are delivered only for rows the viewer
 * can read under RLS. Signed-in viewers authenticate the socket with a short-lived token from
 * /api/realtime-token, kept in memory only.
 */
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserClient } from "@/db/browser";

type Table = "orders" | "events" | "inventory";

export function LiveRefresh({ tables, signedIn }: { tables: Table[]; signedIn: boolean }) {
  const router = useRouter();
  const key = tables.join(",");

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tokenTimer: ReturnType<typeof setInterval> | undefined;
    const client = getBrowserClient();
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 700);
    };
    const authenticate = async () => {
      const res = await fetch("/api/realtime-token", { cache: "no-store", credentials: "same-origin" });
      if (res.ok) {
        const { access_token } = (await res.json()) as { access_token: string };
        await client.realtime.setAuth(access_token);
      }
    };

    (async () => {
      try {
        if (signedIn) {
          await authenticate();
          tokenTimer = setInterval(() => void authenticate().catch(() => undefined), 45 * 60_000);
        }
        if (cancelled) return;
        channel = client.channel(`live:${key}:${crypto.randomUUID()}`);
        for (const table of key.split(",") as Table[]) {
          channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
        }
        channel.subscribe();
      } catch {
        /* realtime is a progressive enhancement */
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(tokenTimer);
      if (channel) void client.removeChannel(channel);
    };
  }, [key, signedIn, router]);

  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500" title="This page updates in real time">
      <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" aria-hidden /> Live
    </span>
  );
}
