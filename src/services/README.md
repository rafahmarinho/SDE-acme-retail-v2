# Services (placeholder)

Server-only business logic, one module per domain described in specs/PRD.md:

| Module | Responsibility |
|--------|----------------|
| `auth.ts` | login, logout, password recovery, session helpers |
| `catalog.ts` | categories, products, variants, search and filters |
| `cart.ts` | cart and favorites |
| `checkout.ts` | coupons, illustrative shipping and tax, inventory reservation, price snapshot |
| `payments.ts` | simulated provider (approve / decline / auth / timeout) and optional Stripe test adapter |
| `orders.ts` | orders, shipment, cancellation, tracking (payment and delivery status kept separate) |
| `returns.ts` | returns and full or partial refunds |
| `inventory.ts` | stock levels and reservations |
| `users.ts` | profiles, settings, roles |
| `simulation.ts` | scenarios, advance simulation, events, reset data |

Implement each module by following the recipes indexed in `../../AGENTS.md`.
