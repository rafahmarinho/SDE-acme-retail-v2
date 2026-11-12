---
name: t49-disable-debug-for-release
description: Gate the simulation area (scenarios, advance, reset data), demo accounts, seed endpoints and verbose errors behind admin role plus an environment flag, and strip debug features from production builds.
---

# T49: Disable and remove debug capabilities and code/data, and prepare application for release

**Category:** CODE_FIX
**SD Elements:** [T49](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T49/)
**Priority:** 7

**Spec Context:**
> "Prepare dados de demonstração com quarenta produtos e sessenta pedidos. Inclua uma área para escolher cenários, avançar a simulação, consultar eventos e reiniciar os dados."
> Source: specs/PRD.md, lines 41-43

**What the spec implies (naive approach):**
The `/simulation` page and `POST /api/simulation/reset` are reachable by anyone in production, demo admin accounts exist with known passwords, and `console.log` dumps full request bodies.

**Secure Implementation Pattern:**
```ts
// src/lib/features.ts
export const simulationEnabled = () => process.env.ENABLE_SIMULATION === "true";

// src/app/(admin)/simulation/layout.tsx
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!simulationEnabled()) notFound();
  await requirePermission("simulation:run", { recentAuthMinutes: 15 });
  return <>{children}</>;
}

// next.config.ts
compiler: { removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false },
```

**Implementation Guidance:**
- The simulation area requires both `ENABLE_SIMULATION=true` and the admin role. It defaults to off in `.env.example`.
- "Reset data" requires re-authentication and is audit-logged (T349).
- Remove test-only routes, mock credentials and source maps from production (`productionBrowserSourceMaps: false`).
- Use structured logging without request bodies or PII. Show generic error pages (no stack traces).

**Success Criteria:**
- [ ] `/simulation` returns 404 when the flag is off
- [ ] A non-admin gets 403 when the flag is on
- [ ] There are no known demo credentials or debug routes in production

**Status:** Applied

**Implementation (2026-11-12):** In the app: `ENABLE_SIMULATION` + the `simulation:run` permission + recent sign-in (`src/services/simulation.ts`, `src/actions/simulation.ts`, admin simulation page), plus no source maps, `removeConsole` and no `x-powered-by` (`next.config.ts`), and a generic `src/app/error.tsx`. **New:** a database switch `store_settings.simulation_enabled` and a DB step-up on `sim_reset` (migrations 0007/0004). Set it to `false` in production.
