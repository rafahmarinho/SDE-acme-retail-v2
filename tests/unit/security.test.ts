import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildCsp } from "@/lib/csp";
import { isSecureOrLoopback } from "@/lib/env";
import { userMessage } from "@/lib/errors";
import { HttpError, json, parseAllowedOrigins, readJson, withCors } from "@/lib/http";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { CartLines, CatalogQuery, CouponCode, Password } from "@/lib/schemas";
import { detectImage, MAX_IMAGE_BYTES } from "@/lib/upload";
import { escapeLike, productImageUrl } from "@/db/storage";

describe("safeRedirectPath (T37)", () => {
  it.each([
    ["/account/orders", "/account/orders"],
    ["/checkout/result/abc?x=1", "/checkout/result/abc?x=1"],
    ["/", "/"],
  ])("allows %s", (input, expected) => expect(safeRedirectPath(input)).toBe(expected));

  it.each(["javascript:alert(1)", "//evil.com", "https://evil.com/account", "/\\evil.com", "/../etc", "/unknown", "", null])(
    "rejects %s",
    (input) => expect(safeRedirectPath(input as string, "/fallback")).toBe("/fallback"),
  );
});

describe("buildCsp (T66, T36, T279)", () => {
  const csp = buildCsp({ nonce: "abc", supabaseOrigin: "https://x.supabase.co", dev: false, stripe: false });
  it("denies framing and plugins", () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
  it("uses a nonce + strict-dynamic, no unsafe-eval in production", () => {
    expect(csp).toContain("'nonce-abc'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
  });
  it("allows Supabase REST and websocket only", () => {
    expect(csp).toContain("connect-src 'self' https://x.supabase.co wss://x.supabase.co");
  });
  it("adds Stripe Checkout to form-action only when enabled", () => {
    expect(csp).not.toContain("checkout.stripe.com");
    expect(buildCsp({ nonce: "n", supabaseOrigin: "https://x.supabase.co", dev: false, stripe: true })).toContain("form-action 'self' https://checkout.stripe.com");
  });
});

describe("isSecureOrLoopback (T21)", () => {
  it("accepts https and loopback http", () => {
    expect(isSecureOrLoopback("https://abc.supabase.co")).toBe(true);
    expect(isSecureOrLoopback("http://127.0.0.1:55321")).toBe(true);
    expect(isSecureOrLoopback("http://localhost:3000")).toBe(true);
  });
  it("rejects plaintext over the network", () => {
    expect(isSecureOrLoopback("http://abc.supabase.co")).toBe(false);
    expect(isSecureOrLoopback("ftp://x")).toBe(false);
    expect(isSecureOrLoopback("not a url")).toBe(false);
  });
});

describe("detectImage (T214)", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  it("accepts matching magic bytes and MIME", () => {
    expect(detectImage(png, "image/png")).toEqual({ mime: "image/png", ext: "png" });
    expect(detectImage(jpg, "image/jpeg")?.ext).toBe("jpg");
  });
  it("rejects spoofed MIME types and SVG", () => {
    expect(detectImage(png, "image/jpeg")).toBeNull();
    expect(detectImage(new TextEncoder().encode('<svg onload="alert(1)"></svg>'), "image/svg+xml")).toBeNull();
  });
  it("rejects oversized files", () => {
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(png);
    expect(detectImage(big, "image/png")).toBeNull();
  });
});

describe("HTTP helpers (T166, T257, T536)", () => {
  it("json() refuses top-level arrays and sets safe headers", async () => {
    expect(() => json([1, 2] as unknown as object)).toThrow();
    const res = json({ a: 1 });
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
  it("CORS reflects only allowlisted origins", () => {
    const allowed = parseAllowedOrigins("https://partner.example, http://evil.example, nonsense", "https://shop.example");
    expect([...allowed]).toEqual(["https://shop.example", "https://partner.example"]);
    const ok = withCors(new Request("https://shop.example/api", { headers: { origin: "https://partner.example" } }), new Response(null), allowed);
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://partner.example");
    const bad = withCors(new Request("https://shop.example/api", { headers: { origin: "https://evil.example" } }), new Response(null), allowed);
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
    expect(bad.headers.get("access-control-allow-credentials")).toBeNull();
  });
  it("readJson enforces size and schema", async () => {
    const schema = z.object({ a: z.number() });
    await expect(readJson(new Request("http://x", { method: "POST", body: JSON.stringify({ a: 1 }) }), schema)).resolves.toEqual({ a: 1 });
    await expect(readJson(new Request("http://x", { method: "POST", body: "x".repeat(40_000) }), schema)).rejects.toBeInstanceOf(HttpError);
    await expect(readJson(new Request("http://x", { method: "POST", body: JSON.stringify({ a: "no" }) }), schema)).rejects.toMatchObject({ status: 400 });
  });
});

describe("input schemas (T536, T42)", () => {
  it("bounds cart lines", () => {
    const id = "6f1c2c9e-8a1b-4c3d-9e8f-1a2b3c4d5e6f";
    expect(CartLines.safeParse([{ variantId: id, qty: 2 }]).success).toBe(true);
    expect(CartLines.safeParse([{ variantId: id, qty: 21 }]).success).toBe(false);
    expect(CartLines.safeParse([{ variantId: "x", qty: 1 }]).success).toBe(false);
    expect(CartLines.safeParse(Array.from({ length: 51 }, () => ({ variantId: id, qty: 1 }))).success).toBe(false);
  });
  it("falls back to defaults for unknown catalog params", () => {
    const q = CatalogQuery.parse({ sort: "price desc; drop table", category: "../etc", min: "-5", page: "99999" });
    expect(q).toEqual({ sort: undefined, category: undefined, min: undefined, page: undefined, q: undefined, max: undefined, inStock: undefined });
  });
  it("normalizes coupons and rejects odd characters", () => {
    expect(CouponCode.parse(" welcome10 ")).toBe("WELCOME10");
    expect(CouponCode.safeParse("WELCOME10'--").success).toBe(false);
  });
  it("enforces the password policy", () => {
    expect(Password.safeParse("short").success).toBe(false);
    expect(Password.safeParse("alllowercase123").success).toBe(false);
    expect(Password.safeParse("Valid-Passw0rd").success).toBe(true);
  });
});

describe("errors and storage helpers (T2139, T38, T50)", () => {
  it("maps known database errors to friendly messages", () => {
    expect(userMessage({ message: "OUT_OF_STOCK" })).toMatch(/no longer available/);
    expect(userMessage(new Error("RATE_LIMITED"))).toMatch(/Too many attempts/);
  });
  it("hides unknown internal errors behind a reference", () => {
    const msg = userMessage(new Error('relation "secret_table" does not exist at line 3'));
    expect(msg).not.toContain("secret_table");
    expect(msg).toMatch(/ref /);
  });
  it("escapes LIKE wildcards", () => expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\"));
  it("only builds image URLs for server-generated keys", () => {
    expect(productImageUrl("products/6f1c2c9e-8a1b-4c3d-9e8f-1a2b3c4d5e6f/6f1c2c9e-8a1b-4c3d-9e8f-1a2b3c4d5e6f.png")).toContain("/storage/v1/object/public/product-images/");
    expect(productImageUrl("../../secret.png")).toBeNull();
    expect(productImageUrl("javascript:alert(1)")).toBeNull();
  });
});
