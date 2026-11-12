# ACME Retail v2

Fictional e-commerce store, scaffolded from `../specs/PRD.md`. Currently **placeholder files only**.

## Product overview (from the PRD)
- **Storefront:** home, catalog, product (variants), favorites, side cart, checkout with coupons
  and illustrative shipping and tax, payment result, account, orders, tracking, returns.
- **Back-office:** products, inventory, orders, refunds (full or partial). Payment status and
  delivery status are tracked separately.
- **Roles:** customer, catalog, warehouse, finance, administrator. Navigation adapts to the role.
- **Payments:** simulated (approve / decline / authentication / timeout), no real money.
  An optional Stripe Checkout adapter runs in test mode.
- **Checkout rules:** inventory is reserved during checkout, and the price used is saved on the order.
- **Simulation area:** choose scenarios, advance the simulation, browse events, reset data.
- **Demo data:** 40 products and 60 orders. The UI is in English.

## Stack
Next.js (App Router), React, TypeScript, pnpm, Supabase (PostgreSQL, email/password Auth,
Storage, Realtime), deployed to Vercel (web and API).

## Getting started
```bash
pnpm install
cp .env.example .env.local   # fill in Supabase values
pnpm dev
```

## Deploying
Deploy to Vercel and set the variables from `.env.example` in the Vercel project settings
(keep `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_*` server-only).

## Security plan
This repository was threat-modeled in SD Elements (project **ACME Retail v2**, ID 35).
See [`AGENTS.md`](./AGENTS.md) for the countermeasure index, and `skills/` for the
per-countermeasure secure implementation recipes.
