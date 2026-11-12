# ACME Retail - security configuration outside the code

SD Elements project **ACME Retail v2** (ID 35). This file covers the countermeasures classified as
**INFRA**: things that must be configured in the Supabase, Vercel, Stripe or DNS consoles rather than
in this repository. Code-level countermeasures are mapped in the README's **Security** section.

| SDE | What to configure | Where | Owner |
|-----|-------------------|-------|-------|
| [T69](../skills/authentication/T69-system-account-password-strength/SKILL.md) | Use a generated 32+ character database password. Keep the Supabase JWT secret / signing keys at generated values. Use Stripe **restricted test** keys. Store `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_*` and `CRON_SECRET` only as Vercel encrypted env vars (Production + Preview, never `NEXT_PUBLIC_`). Rotate them every 90 days and immediately on staff changes. | Supabase → Settings → Database / API; Vercel → Project → Environment Variables; Stripe → Developers → API keys | Platform owner |
| [T70](../skills/authentication/T70-system-account-lockout-throttling/SKILL.md) | Enable Supabase **Network Restrictions**, so only the Vercel egress / your IPs reach Postgres. Enforce SSL. Turn on MFA for every Supabase, Vercel and Stripe dashboard account. Review the Auth logs for failed logins. | Supabase → Settings → Database → Network restrictions / SSL; account security settings | Platform owner |
| [T374](../skills/api-security/T374-offload-http-request-handling/SKILL.md) | Enable the **Vercel Firewall** managed rulesets. Add rate-limit rules for `/api/*`, `/login`, `/signup`, `/forgot-password` and Server Action POSTs. Keep *Attack Challenge Mode* ready for incidents. Keep the Supabase Auth rate limits (`[auth.rate_limit]` in `supabase/config.toml`) enabled on the hosted project. | Vercel → Project → Firewall; Supabase → Auth → Rate limits | Platform owner |
| [T2157](../skills/email/T2157-secure-email-messaging/SKILL.md) | Configure a custom SMTP provider with TLS for Supabase Auth. Publish SPF, DKIM and DMARC (`p=quarantine` or stricter) for the sending domain. Upload `supabase/templates/recovery.html` as the recovery template. Set Site URL and Redirect URLs to the production domain (`https://<domain>/auth/confirm`). | Supabase → Auth → SMTP / Email templates / URL configuration; DNS provider | Platform owner |
| [T2170](../skills/privacy/T2170-data-localization/SKILL.md) | Legal/privacy confirms the target markets. Create the Supabase project in a compliant region and pin Vercel Functions to the same region (`regions` in `vercel.json` or project settings). Record Supabase, Vercel and Stripe as sub-processors. | Supabase project creation; Vercel → Settings → Functions | Legal + platform owner |

## Store security settings (database)

Migration `0007_security_hardening.sql` adds `public.store_settings`. It's readable only through
`store_config()` and changeable only with the service role or SQL editor, and every change is audited. Keep it consistent
with the Vercel environment:

```sql
-- production: real checkout through Stripe (test mode) and no simulation area
update public.store_settings set payment_provider = 'stripe', simulation_enabled = false where id = 1;
```

- `payment_provider` is enforced by `place_order`, `pay_order` and `complete_payment_challenge` (T558). If it doesn't
  match `PAYMENT_PROVIDER`, checkout fails safely with "Payment method unavailable".
- `simulation_enabled = false` blocks the simulation RPCs for every user, even admins calling the API directly (T49).
- Step-up checks for refunds over $200, role changes and data reset are enforced in Postgres from the JWT `amr` claim
  (T338). Staff must have signed in with a password in the last 30 minutes (15 for reset).

## Hosted Supabase checklist (mirrors `supabase/config.toml`)

The local stack is already configured this way. Replicate it on the hosted project, because
`config.toml` only applies to local development:

- Auth → Providers → Email: **confirm email ON** in production (local is off for demos), secure password change ON,
  double-confirm email changes ON, minimum password length 10 with lowercase, uppercase and digits.
- Auth → OTP/link expiry: **1800 s** (30 minutes). Email rate: 1 per 60 s per address.
- Auth → JWT expiry 3600 s, refresh-token rotation ON.
- Auth → CAPTCHA (hCaptcha or Turnstile): **recommended** for sign-up, login and recovery (T2). Needs provider keys.
- Auth → Notifications: enable "Password changed" with `supabase/templates/password-changed.html` (T2).
- Auth → MFA (TOTP): enable for staff accounts (T338 recommendation).
- API → max rows **200** (T2600). Exposed schemas: `public`, `graphql_public` only (`app` and `audit` stay private).
- Storage: the `product-images` bucket is created by migration `0005` (2 MB, JPEG/PNG/WebP, no listing).
- Realtime: `orders`, `events` and `inventory` are in the `supabase_realtime` publication (migration `0005`). RLS applies.

## Vercel checklist

- Environment variables from `.env.example`. Set `APP_BASE_URL` to the production origin, `ENABLE_SIMULATION=false` in
  production (or protect the deployment), `PAYMENT_PROVIDER=simulated` unless Stripe test keys are configured.
- `CRON_SECRET` (≥ 32 random chars) is required for the `/api/cron/advance` cron in `vercel.json`. Without it the
  endpoint returns 404.
- Turn on Deployment Protection for Preview deployments (they share the Supabase project).
- Optional: Log Drains to a write-once store for long-term retention of runtime logs (T349).

## Process countermeasures (noted in SD Elements, not tracked here)

CT1, CT2 (onboarding tickets), T755 (data processing register), T1386 (email classification policy and training),
T2128 (breach notification procedure), T2348 (code reviews).
