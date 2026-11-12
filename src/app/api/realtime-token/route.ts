/**
 * Short-lived access token for the Realtime websocket only. Auth cookies stay httpOnly; the token
 * is kept in memory by the client (T1468). Same-origin fetches only (Sec-Fetch-Site), never cached.
 */
import type { NextRequest } from "next/server";
import { createServerClient } from "@/db/server";
import { json, jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return jsonError(403, "Forbidden");
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(); // validates the session with Supabase first
  if (!user) return jsonError(401, "Not authenticated");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return jsonError(401, "Not authenticated");
  return json({ access_token: session.access_token, expires_at: session.expires_at });
}
