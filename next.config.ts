/**
 * Next.js configuration.
 * - Security headers on every response (T21 HSTS, T66 framing, nosniff, referrer policy).
 *   The Content-Security-Policy (with a per-request nonce) is set in src/proxy.ts.
 * - Server Action body limit + origin allowlist (T35, T29, T536).
 * - No source maps / x-powered-by in production; console.* stripped (T49).
 */
import type { NextConfig } from "next";

function appHost(): string {
  try {
    return new URL(process.env.APP_BASE_URL ?? "http://localhost:3000").host;
  } catch {
    return "localhost:3000";
  }
}

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb", // product image uploads (bucket limit is also 2 MB)
      allowedOrigins: [appHost()],
    },
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
