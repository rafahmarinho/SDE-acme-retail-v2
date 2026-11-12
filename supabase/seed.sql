-- Demo catalog (40 products, variants, stock, coupons). Synthetic data only (T544).
-- Demo users and the 60 demo orders are created by `pnpm db:seed` (scripts/seed.mjs), because users
-- must be created through the Supabase Auth admin API.
select set_config('acme.audit_skip', 'on', false);
select app.seed_catalog();
select set_config('acme.audit_skip', 'off', false);
