/**
 * JSON API helpers.
 * - json(): object-only bodies, application/json, nosniff, private no-store (T166).
 * - withCors(): strict allowlist, never "*" with credentials, Vary: Origin (T257).
 * - readJson(): byte-limited body + zod schema (T536).
 */
import type { z } from "zod";

export function json<T extends object>(data: T, init?: ResponseInit & { cache?: "private" | "public" }): Response {
  if (Array.isArray(data)) throw new Error("Wrap arrays in an object: { items: [...] }");
  const { cache = "private", ...rest } = init ?? {};
  const headers = new Headers(rest.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", cache === "public" ? "public, max-age=60, s-maxage=60" : "private, no-store");
  return new Response(JSON.stringify(data), { ...rest, headers });
}

export function jsonError(status: number, error: string): Response {
  return json({ error }, { status });
}

export function parseAllowedOrigins(csv: string, appBaseUrl: string): Set<string> {
  const set = new Set<string>([new URL(appBaseUrl).origin]);
  for (const raw of csv.split(",")) {
    const v = raw.trim();
    if (!v) continue;
    try {
      const u = new URL(v);
      if (u.protocol === "https:" || u.hostname === "localhost" || u.hostname === "127.0.0.1") set.add(u.origin);
    } catch {
      /* ignore invalid entries */
    }
  }
  return set;
}

export function withCors(req: Request, res: Response, allowed: Set<string>, opts: { credentials?: boolean } = {}): Response {
  const origin = req.headers.get("origin");
  res.headers.append("Vary", "Origin");
  if (origin && allowed.has(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    if (opts.credentials) res.headers.set("Access-Control-Allow-Credentials", "true");
  }
  return res;
}

export function preflight(req: Request, allowed: Set<string>, methods = "GET"): Response {
  const res = new Response(null, { status: 204 });
  res.headers.set("Access-Control-Allow-Methods", methods);
  res.headers.set("Access-Control-Allow-Headers", "content-type");
  res.headers.set("Access-Control-Max-Age", "600");
  return withCors(req, res, allowed);
}

export async function readJson<S extends z.ZodType>(req: Request, schema: S, maxBytes = 32_768): Promise<z.infer<S>> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) throw new HttpError(413, "Payload too large");
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new HttpError(413, "Payload too large");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new HttpError(400, "Invalid request");
  return result.data;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
