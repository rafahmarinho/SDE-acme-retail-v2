# ACME Retail

A fictional, production-style e-commerce store: storefront, customer account and back office, built with
**Next.js 16 (App Router) · React 19 · TypeScript · Supabase (PostgreSQL, Auth, Storage, Realtime) · Vercel · pnpm**.
Payments are **simulated** (approve / decline / authentication / timeout); no real money moves. An optional
**Stripe Checkout (test mode)** adapter is included.

Built from [`../specs/PRD.md`](../specs/PRD.md) and threat-modeled in SD Elements (project *ACME Retail v2*, ID 35).
See [Security](#security).

## Features

| Area | What's included |
|------|-----------------|
| Storefront | Home, catalog with header search, categories, filters (price, stock), sorting and pagination, product page with variants and live stock, favorites, side cart and cart page |
| Checkout | Saved addresses, standard/express shipping, coupons (`WELCOME10`, `SAVE20`, `FREESHIP`; `SPRING5` expired, `VIP50` exhausted), illustrative shipping and 8% tax, **stock reserved for 15 minutes**, **unit price snapshot** on every order line |
| Payments | Simulated provider: approve, decline (retry), 3-D Secure-style authentication challenge, timeout (retry). Optional Stripe Checkout in test mode |
| Account | Sign-up with separate opt-in consents, login, password recovery by email, profile, addresses, email/password change, orders, order tracking (timeline and shareable tracking link), cancellation, returns, consent withdrawal and processing restrictions |
| Back office (role-adapted) | Dashboard, products and variants with image upload, inventory adjustments, orders (ship, deliver, cancel), returns (approve, reject, receive) and **full or partial refunds**, users and roles, audit log |
| Statuses | **Payment status and delivery status are tracked separately** (`pending / requires_action / approved / declined / timed_out / expired / voided / refunded / partially_refunded` and `unfulfilled / processing / shipped / delivered / cancelled / returned`) |
| Roles | customer, catalog, warehouse (inventory & fulfilment), finance, administrator |
| Simulation | Choose a scenario (happy path, payment declines, stock-outs, late deliveries, returns wave), advance 1/5/10 steps, browse events, reset demo data. Results persist in Postgres and push to open screens via Realtime |
| Demo data | 40 products (103 variants) in 6 categories, 60 orders across all statuses, 16 demo users |

## Architecture

```
src/
  app/            screens (App Router pages, layouts, route handlers under app/api)
  components/     UI components (cart, checkout, product, admin, forms, live refresh)
  actions/        Server Actions: validate input (zod), check permissions, call services
  services/       server-only domain logic (catalog, cart, checkout, payments, orders, returns, ...)
  db/             Supabase clients (user-scoped, browser realtime, service role), generated types
  lib/            env validation, CSP, safe redirects, schemas, HTTP helpers, formatting
  proxy.ts        per-request CSP nonce + session refresh (Next 16 "proxy")
supabase/
  migrations/     schema, RLS, business functions, audit trail, seed & simulation, storage/realtime
  seed.sql        demo catalog (scripts/seed.mjs adds users + orders)
  templates/      Auth email templates
tests/            unit (vitest) and integration tests against the local Supabase stack
docs/security.md  security configuration outside the code (Supabase, Vercel, DNS)
```

Business rules (pricing, coupons, stock reservation, payment outcomes, cancellation, returns, refunds,
fulfilment, simulation) live in Postgres `security definer` functions with explicit permission checks, plus row level
security on every table. The app talks to Supabase with the **user's session** (anon key + RLS), so the database
enforces access even if the UI is bypassed.

## Run locally

Requirements: Node 20.9+, pnpm 10, Docker (for the local Supabase stack).

```bash
pnpm install
pnpm db:start                          # local Supabase (API on :55321, Studio :55323, Mailpit :55324)
cp .env.example .env.local
pnpm exec supabase status -o env       # copy API_URL / ANON_KEY / SERVICE_ROLE_KEY into .env.local
                                       # set ENABLE_SIMULATION=true to use the simulation area
pnpm db:seed                           # demo users + 40 products + 60 orders
pnpm dev                               # http://localhost:3000
```

**Demo accounts** (all share the password from `DEMO_USER_PASSWORD`, or the random one written to
`.demo-credentials.local`): `admin@example.test`, `catalog@example.test`, `warehouse@example.test`,
`finance@example.test`, `customer@example.test` (plus 11 more customers).

Password-recovery and email-change messages are delivered to Mailpit at http://127.0.0.1:55324.

> The local ports are moved to the 553xx range in `supabase/config.toml` so they don't clash with other local
> Supabase projects.

### Scripts

| Command | Purpose |
|---------|---------|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js dev server / production build / production server |
| `pnpm lint` | ESLint (Next rules + security rules: no raw HTML sinks, no `Math.random`, no `select("*")`, service-role import restrictions) |
| `pnpm typecheck` | TypeScript |
| `pnpm test` | Unit tests |
| `pnpm test:integration` | Integration tests against the local Supabase stack (needs `.env.local`) |
| `pnpm db:start` / `db:stop` / `db:reset` | Local Supabase lifecycle (`db:reset` re-applies migrations and the catalog seed) |
| `pnpm db:seed` | Demo users and data (uses the service-role key - trusted machines only) |
| `pnpm audit` | Dependency vulnerability audit |

## Deploy to Vercel (web and API)

The web UI and the JSON API (`/api/*` route handlers) deploy together as one Vercel project.

1. **Create a Supabase project** in the region you need (see `docs/security.md`, T2170), then push the schema:
   ```bash
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push            # applies supabase/migrations
   ```
   Load the catalog once from the SQL editor: `select app.seed_catalog();`. Optionally, run `pnpm db:seed` locally
   against the hosted project to create demo users and orders.
2. Replicate the Auth settings from `supabase/config.toml` in the dashboard: Site URL, Redirect URL
   `https://<domain>/auth/confirm`, password policy, 30-minute OTP expiry, recovery template, custom SMTP. See the
   checklist in `docs/security.md`.
3. **Import the repository in Vercel** (framework: Next.js; `vercel.json` sets `pnpm install --frozen-lockfile`).
4. Add the environment variables from `.env.example` (Production and Preview). Keep `SUPABASE_SERVICE_ROLE_KEY`,
   `STRIPE_*` and `CRON_SECRET` server-only. Set `APP_BASE_URL` to the production URL.
5. Deploy: `vercel --prod` (or push to the production branch). The daily cron in `vercel.json` advances the simulation
   only when `ENABLE_SIMULATION=true` and `CRON_SECRET` is set.
6. Optional Stripe test mode: set `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY=sk_test_...`, and create a webhook for
   `checkout.session.completed` pointing to `https://<domain>/api/webhooks/stripe` (`STRIPE_WEBHOOK_SECRET=whsec_...`).
   Live keys are rejected at startup.

### Public API

| Endpoint | Auth | Notes |
|----------|------|-------|
| `GET /api/products?q=&category=&sort=&page=` | public | CORS allowlist (`CORS_ALLOWED_ORIGINS`), 60 s cache, max 24 per page |
| `GET /api/orders?page=` | session cookie | the signed-in customer's orders |
| `GET /api/health` | public | liveness |
| `POST /api/webhooks/stripe` | Stripe signature | optional adapter |
| `GET /api/cron/advance` | `Authorization: Bearer $CRON_SECRET` | simulation step |

## Security

Threat model: SD Elements project **ACME Retail v2** (ID 35). It has 57 countermeasures: 46 CODE_FIX, 5 INFRA and
6 PROCESS. The per-countermeasure recipes are in [`skills/`](./skills) and indexed in [`AGENTS.md`](./AGENTS.md), where
statuses are **46 Applied / 5 Documented**. INFRA items are documented in [`docs/security.md`](./docs/security.md).
PROCESS items (CT1, CT2, T755, T1386, T2128, T2348) are organizational and noted in SD Elements.
`apply-fixes-from-security-specs` ran on 2026-11-12 and added an audit note to every countermeasure in SD Elements.
Statuses in SD Elements are synced separately (`sync-completion-status-to-sde`).

**Fixed during apply-fixes (code review findings):**
- **HIGH:** the payment provider was chosen by the caller, so with Stripe enabled a client could call the RPCs directly,
  pick the simulated provider and approve its own payment. The database now enforces `store_settings.payment_provider` (T558).
- **MEDIUM:** step-up checks were app-only. They're now enforced in Postgres from the JWT `amr` claim (T338).
- **MEDIUM:** the simulation could be driven through the API when `ENABLE_SIMULATION=false`. There's now a database
  switch (T49).
- **LOW:** audit pseudonyms were unkeyed SHA-256; they're now keyed HMAC (T744). Unused client placeholders were removed (T19).

Status: ✅ implemented · ◐ partially implemented (gap described) · 📄 INFRA, documented in `docs/security.md`

| SDE | Countermeasure | Where | Status / notes |
|-----|----------------|-------|----------------|
| T2 | Secure password reset | `src/actions/auth.ts` (`requestPasswordResetAction`, `updatePasswordAction`), `src/app/auth/confirm/route.ts`, `supabase/templates/recovery.html`, `supabase/templates/password-changed.html`, `supabase/config.toml` | ◐ Same response for known and unknown emails, per-IP/email rate limits, single-use 30-minute token-hash link, fixed redirect, password policy, other sessions revoked, password-changed notification. **Pending:** CAPTCHA (needs hCaptcha/Turnstile keys) |
| T17 | Server-side authorization | `src/services/auth.ts`, every page/action (`requirePagePermission` / `assertPermission`), `supabase/migrations/0001_init.sql` (RLS), `0002` (function checks) | ✅ Navigation is UX only. Every page, action and RPC re-checks |
| T19 | Restrict app DB access | `src/db/server.ts` (user-scoped client), `src/db/admin.ts`, `eslint.config.mjs`, grants in `0001`/`0002` | ✅ Deny-by-default grants, no direct writes to orders/payments/inventory. Service role confined to 4 server modules (rate-limit, audit, payments, cron) + the seed script, enforced by ESLint |
| T20 | Session IDs regenerated | `src/db/server.ts`, `src/db/cookie-options.ts`, `src/proxy.ts`, `src/services/auth.ts` | ✅ Supabase-issued sessions only, httpOnly/SameSite cookies, `getUser()` validation, refresh rotation. Roles are read from the DB per request, so role changes apply immediately |
| T21 | TLS in transit | `next.config.ts` (HSTS), `src/lib/env.ts`, `src/lib/env.server.ts`, `src/lib/csp.ts` (`upgrade-insecure-requests`) | ✅ Non-HTTPS service URLs rejected (except loopback). TLS termination: Vercel/Supabase |
| T29 | CSRF | Server Actions (Origin check, `allowedOrigins` in `next.config.ts`), `src/app/auth/logout/route.ts` (POST + Origin check) | ✅ No state change on GET. The webhook is signature-authenticated |
| T35 | HTTP server settings | `next.config.ts` (`bodySizeLimit`), `maxDuration` in route handlers, timeout modelled as state (`pay_order`) | ✅ Platform limits: see T374 |
| T36 | Escape output | React JSX everywhere, ESLint `react/no-danger`, CSP nonce (`src/proxy.ts`, `src/lib/csp.ts`) | ✅ Product descriptions are plain text |
| T37 | DOM XSS | `src/lib/safe-redirect.ts`, ESLint bans on `innerHTML`/`document.write`/`insertAdjacentHTML` | ✅ |
| T38 | Bind SQL variables | All queries via supabase-js builders/RPC, `0002` functions (`search_products`, ...), `src/db/storage.ts` (`escapeLike`), `src/services/inventory.ts` | ✅ Integration test with injection payloads |
| T42 | No untrusted server-side selection | `src/lib/schemas.ts` (enums with `.catch`), sort allowlist in `search_products`, scenario enum, bounded steps | ✅ |
| T49 | Remove debug / release readiness | `src/services/simulation.ts`, `src/actions/simulation.ts`, `src/app/admin/simulation/page.tsx`, `next.config.ts`, `src/app/error.tsx`, `0007_security_hardening.sql` | ✅ Simulation requires `ENABLE_SIMULATION`, the admin permission and the DB switch `store_settings.simulation_enabled`; reset also needs a recent sign-in, enforced in Postgres. No source maps or `x-powered-by`; console stripped; no committed demo passwords |
| T50 | Indirect file references | `src/services/catalog.ts` (`uploadProductImage`), `src/db/storage.ts`, `0005_storage_realtime.sql` | ✅ Server-generated keys, path regex in policy. (Return-photo uploads aren't part of this release) |
| T59 | Standard crypto libraries | Supabase Auth (bcrypt), `node:crypto` (`timingSafeEqual` in cron, hashing in `src/lib/request.ts`), Stripe SDK webhook verification, `pgcrypto` | ✅ |
| T60 | Approved algorithms | SHA-256 pseudonyms, 192-bit tokens (`gen_random_bytes`), Stripe HMAC | ✅ No app-level field encryption is needed (no card data) |
| T66 | Anti-framing | `next.config.ts` (`X-Frame-Options: DENY`), CSP `frame-ancestors 'none'` | ✅ |
| T76 | No hardcoded secrets | `src/lib/env.server.ts`, `.env.example`, `.gitignore`, `scripts/seed.mjs`, `.github/workflows/ci.yml` (gitleaks) | ✅ Secrets come only from env, Stripe live keys rejected, no fixed demo passwords, secret scanning in CI |
| T151 | Secure randomness | `gen_random_bytes` tracking tokens and refs, `crypto.randomUUID`, ESLint ban on `Math.random` | ✅ Postgres `random()` is used only for simulation |
| T156 | Certificate validation | `src/lib/env.server.ts` (fails if `NODE_TLS_REJECT_UNAUTHORIZED=0`), default fetch/TLS | ✅ |
| T166 | JSON hijacking | `src/lib/http.ts` (`json()`), all route handlers | ✅ |
| T178 | Consent before collecting PII | `src/app/(auth)/signup/page.tsx`, `src/actions/auth.ts`, `consents` ledger (`0001`), `src/services/users.ts` | ✅ Separate opt-in consents with policy version. (PIA review is organizational) |
| T186 | Patched dependencies | `package.json` (pinned current versions), `pnpm-lock.yaml`, `.github/dependabot.yml`, `.github/workflows/ci.yml` (`pnpm audit`) | ✅ `pnpm audit --prod`: 0 known vulnerabilities. Dependabot is active once the repo is on GitHub |
| T214 | Protect confidential files | `0005_storage_realtime.sql` (2 MB, MIME allowlist, catalog-only writes, no listing), `src/lib/upload.ts` (magic bytes, no SVG) | ✅ |
| T257 | Secure CORS | `src/lib/http.ts`, `src/app/api/products/route.ts` | ✅ Allowlist only. Private endpoints send no CORS headers |
| T279 | Safe dynamic code loading | `src/services/payments.ts` (static `import("stripe")`), CSP `strict-dynamic` with no third-party scripts | ✅ |
| T295 | No unprotected confidential data | All state in Postgres under RLS, nothing in `/tmp` or public buckets | ✅ |
| T338 | Authn/authz system | `app.permissions_for` (single permission map, `0001`), `my_permissions()`, `src/services/auth.ts` (`assertRecentAuth`), `app.require_recent_auth` (`0007`), `src/components/header.tsx` | ◐ Recent sign-in is required (in the app **and** in Postgres from the JWT `amr`) for refunds over $200, role changes and data reset; logout is on every page. **Pending:** MFA for staff accounts (Supabase TOTP) |
| T349 | Protect audit logs | `0003_audit.sql` (private schema, no-update/no-delete rules, never reset), `src/app/admin/audit/page.tsx` | ✅ Admin-only read. Optional log drains: see `docs/security.md` |
| T378 | Authorize every object | RLS on orders/items/payments/returns/refunds/events/favorites/addresses, owner filters in `src/services/orders.ts`, 404 on foreign IDs | ✅ Integration tests: cross-customer reads, pays and cancels are denied |
| T536 | Bounded messages | `src/lib/schemas.ts`, Server Action body limit, `price_cart` (≤ 50 lines, qty ≤ 20), webhook size check | ✅ |
| T544 | Anonymize for secondary use | `0004` seed (synthetic identities on `example.test`), events with IDs only, aggregate dashboard | ✅ |
| T558 | Authenticate components | `src/services/payments.ts` (Stripe session re-fetch + webhook signature), `mark_order_paid_external` (service role only), cron bearer secret, `store_settings.payment_provider` (`0007`) | ✅ Simulated outcomes are decided in Postgres, and only while the store runs in simulated mode. The Stripe path is implemented but **not exercised** (no test keys in this environment) |
| T604 | Consent withdrawal | `src/app/account/settings/page.tsx`, `setConsentAction` | ✅ Recommendations stop immediately |
| T742 | Accuracy of personal data | `src/app/account/profile/page.tsx`, `addresses` unique key (dedupe), email only in `auth.users` | ✅ |
| T744 | Pseudonymized data | UUIDs in events and audit, keyed HMAC pseudonyms for emails (`src/lib/request.ts`), Stripe metadata holds the order ID only | ✅ |
| T754 | Restrict processing | `processing_restrictions` (`0001`), `src/services/users.ts` (`personalizationAllowed`), settings page | ✅ Enforced for personalization, the only optional processing in this release |
| T1144 | Prevent SSTI | No template engines. Email template is static and version-controlled | ✅ |
| T1362 | API throttling | `src/services/rate-limit.ts` (login, sign-up, reset, password/email change), `app.rate_limit_hit` in `quote_cart` (coupons), `place_order`, `pay_order`; max 3 open checkouts per customer | ✅ |
| T1365 | SSRF | No server-side fetch of user-supplied URLs. Simulated integrations run in-process; images are uploaded, not fetched | ✅ |
| T1468 | Browser data at rest | `src/components/cart/cart-context.tsx` (IDs and quantities only, schema-validated), httpOnly cookies, realtime token in memory (`src/components/live-refresh.tsx`) | ✅ |
| T1539 | Clear data on logout | `src/app/auth/logout/route.ts` (`Clear-Site-Data`) | ✅ |
| T2139 | API information exposure | Explicit column lists (ESLint), strict zod response DTOs (`src/lib/dto.ts`) validated in `src/app/api/*`, `src/lib/errors.ts` (generic messages with a reference) | ✅ |
| T2598 | Query-level access control | RLS on all tables, column grant on `profiles` (role not updatable), storage policies | ✅ Integration-tested for all 5 roles |
| T2599 | Connection string pollution | `src/lib/env.ts`, `src/lib/env.server.ts`. Scenarios are data, not connections | ✅ |
| T2600 | Result-set size | Paginated lists, `search_products` ≤ 50, PostgREST `max_rows = 200` | ✅ |
| T2602 | DB/server activity logging | `0003_audit.sql` triggers (orders, refunds, returns, inventory, roles, products, variants, coupons), `src/services/audit.ts` security events | ✅ |
| T69, T70, T374, T2157, T2170 | INFRA | [`docs/security.md`](./docs/security.md) | 📄 |

**Other known limitations:** Realtime is wired up (publication, RLS, token endpoint, client subscription) and the
"Live" indicator renders, but push delivery across sessions was **not verified**: there are no automated or manual
tests for it yet. Pages show current data on every load either way. Local Supabase runs with email confirmation disabled for demos
(enable it on the hosted project).

### Tests executed (2026-11-12)

| Check | Result |
|-------|--------|
| `pnpm lint` (incl. security rules) | ✅ 0 problems |
| `pnpm typecheck` | ✅ |
| `pnpm test` - unit (safe redirects, CSP, TLS env checks, upload magic bytes, JSON/CORS helpers, input schemas, error masking, storage helpers) | ✅ 31/31 |
| `pnpm test:integration` - real local Supabase: anonymous/customer/staff RLS isolation, role escalation, direct-write denial, forbidden RPCs, server-only functions, public tracking, pricing/coupons, SQL-injection-style search, reservation + price snapshot + stock commit, decline→retry, 3-DS success/failure, timeout→retry, oversell/invalid coupon/bad address, open-checkout cap, cancellation refund + restock, ship→deliver→return→receive→partial and full refund, simulation; **hardening**: provider bypass blocked, DB simulation switch, stale-session step-up (JWT `amr`) | ✅ 35/35 |
| `pnpm build` (Next.js 16 production build) | ✅ |
| `pnpm audit --prod` | ✅ no known vulnerabilities |
| CI workflow (`.github/workflows/ci.yml`: gitleaks, lint, types, unit, audit, integration on a local Supabase) | added; not yet run (the repo has no GitHub remote) |
| HTTP smoke test on the production build: security headers (CSP nonce, HSTS, XFO, nosniff, Referrer/Permissions-Policy), 307 for protected pages, 404 for unknown products and tracking tokens, CORS denial for foreign origins, 403 for cross-origin logout, 401 for cron without secret | ✅ |
| Browser walk-through (Chrome): product → variant → side cart → checkout login redirect → coupon → 3-DS challenge → paid order; admin: ship, partial refund, simulation (payment-declines scenario, +5 steps), audit log | ✅ no console errors |
| Recovery email (local Mailpit): custom template, token-hash link, 30-minute notice | ✅ |
