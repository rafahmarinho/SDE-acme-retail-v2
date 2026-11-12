/**
 * Open-redirect / DOM-XSS protection for post-login, post-logout and post-payment redirects (T37).
 * Only same-origin paths under an allowlist are accepted.
 */
const ALLOWED_PREFIXES = ["/account", "/checkout", "/catalog", "/product", "/cart", "/admin", "/track"];

export function safeRedirectPath(input: string | null | undefined, fallback = "/"): string {
  if (!input || typeof input !== "string" || input.length > 512) return fallback;
  if (!input.startsWith("/") || input.startsWith("//") || input.includes("\\")) return fallback;
  let url: URL;
  try {
    url = new URL(input, "https://internal.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://internal.invalid") return fallback;
  const path = url.pathname;
  if (path === "/") return "/";
  return ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`)) ? path + url.search : fallback;
}
