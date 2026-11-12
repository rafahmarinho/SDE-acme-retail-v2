/**
 * Content-Security-Policy builder (T66 framing, T36/T37 XSS defense in depth, T279 script origins).
 * A fresh nonce is generated per request in src/proxy.ts. No third-party scripts are loaded:
 * Stripe Checkout is a redirect, so js.stripe.com isn't needed.
 */
export interface CspOptions {
  nonce: string;
  supabaseOrigin: string;
  dev: boolean;
  stripe: boolean;
}

export function buildCsp({ nonce, supabaseOrigin, dev, stripe }: CspOptions): string {
  const supabaseWs = supabaseOrigin.replace(/^http/, "ws");
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", supabaseOrigin],
    "font-src": ["'self'"],
    "connect-src": ["'self'", supabaseOrigin, supabaseWs, ...(dev ? ["ws:"] : [])],
    "frame-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'", ...(stripe ? ["https://checkout.stripe.com"] : [])],
    "worker-src": ["'self'", "blob:"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!dev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
