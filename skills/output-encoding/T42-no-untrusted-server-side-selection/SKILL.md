---
name: t42-no-untrusted-server-side-selection
description: Never let user-supplied values pick server-side pages, templates, sort columns, simulation scenarios or file paths; map them through strict allowlists and range checks.
---

# T42: Avoid relying on untrusted data for server-side selection

**Category:** CODE_FIX
**SD Elements:** [T42](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T42/)
**Priority:** 10

**Spec Context:**
> "Inclua ... busca, filtros" ... "Inclua uma área para escolher cenários, avançar a simulação" ... "relatórios"
> Source: specs/PRD.md, lines 3, 11, 41-43

**What the spec implies (naive approach):**
`?sort=price desc` is passed straight to `.order(sort)`, `?scenario=` imports `./scenarios/${scenario}.ts`, and `?report=` selects a file to render. Huge `?qty=` or `?steps=` values drive loops.

**Secure Implementation Pattern:**
```ts
const SORTS = {
  "price-asc":  { column: "price", ascending: true },
  "price-desc": { column: "price", ascending: false },
  newest:       { column: "created_at", ascending: false },
} as const;
const SortKey = z.enum(Object.keys(SORTS) as [keyof typeof SORTS, ...(keyof typeof SORTS)[]]);

const SCENARIOS = { "happy-path": happyPath, "payment-declines": declines, stockouts } as const;
const AdvanceInput = z.object({
  scenario: z.enum(["happy-path", "payment-declines", "stockouts"]),
  steps: z.number().int().min(1).max(100), // bounded: prevents DoS loops
});

export async function advanceSimulation(raw: unknown) {
  await requirePermission("simulation:run");
  const { scenario, steps } = AdvanceInput.parse(raw);
  return SCENARIOS[scenario].advance(steps);
}
```

**Implementation Guidance:**
- Map every user choice (sort, view, report, scenario, locale) through a static lookup object.
- Bound numeric inputs (quantity, steps, page) to sensible ranges.
- Never use dynamic `import()` or `fs` paths built from user input.
- Reject unknown values with 400, without echoing them back.

**Success Criteria:**
- [ ] All selectors use enums or lookup maps
- [ ] `steps=1e9` and `qty=-5` are rejected
- [ ] No dynamic imports or file paths are derived from request data

**Status:** Applied

**Implementation (2026-11-12):** Sort, category, scenario and step inputs are mapped through enums and bounded (`src/lib/schemas.ts`, `src/actions/simulation.ts`, `search_products` CASE allowlist, `sim_advance` 1-20 steps, quantity 1-20). There are no dynamic imports or file paths from input.
