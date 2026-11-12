/**
 * Browser Supabase client - used ONLY for Realtime subscriptions.
 * It holds no persisted session (auth cookies are httpOnly); a short-lived access token is
 * fetched from /api/realtime-token and kept in memory only (T1468).
 */
"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { publicEnv } from "@/lib/env";

let client: SupabaseClient<Database> | undefined;

export function getBrowserClient(): SupabaseClient<Database> {
  client ??= createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
