/**
 * Permission names. The role -> permission map itself lives ONLY in Postgres
 * (app.permissions_for), and the app reads it through my_permissions(), so RLS, RPCs and
 * UI navigation share one source of truth (T17, T338).
 */
export const PERMISSIONS = [
  "backoffice:access",
  "catalog:write",
  "inventory:write",
  "orders:read_all",
  "orders:fulfil",
  "returns:manage",
  "refunds:issue",
  "payments:read_all",
  "customers:read",
  "events:read",
  "users:manage",
  "simulation:run",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type Role = "customer" | "catalog" | "warehouse" | "finance" | "admin";
export const ROLES: Role[] = ["customer", "catalog", "warehouse", "finance", "admin"];

export const ROLE_LABELS: Record<Role, string> = {
  customer: "Customer",
  catalog: "Catalog",
  warehouse: "Inventory & fulfilment",
  finance: "Finance",
  admin: "Administrator",
};
