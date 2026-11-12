// ESLint flat config: Next.js rules + security guard rails derived from the SD Elements recipes.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const securityRules = {
  // T36 / T37 - no raw HTML sinks
  "react/no-danger": "error",
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
  "no-restricted-syntax": [
    "error",
    { selector: "MemberExpression[property.name=/^(innerHTML|outerHTML)$/]", message: "Use JSX / textContent instead of innerHTML (T37)." },
    { selector: "CallExpression[callee.object.name='document'][callee.property.name=/^write(ln)?$/]", message: "document.write is forbidden (T37)." },
    { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: "insertAdjacentHTML is forbidden (T37)." },
    // T151 - security-relevant randomness must use crypto; simulation randomness lives in SQL
    { selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']", message: "Use crypto.randomUUID()/getRandomValues (T151)." },
    // T2139 - explicit column lists only
    { selector: "CallExpression[callee.property.name='select'][arguments.0.value='*']", message: "Select explicit columns, never '*' (T2139)." },
  ],
  // T19 - the service-role client is confined to a few audited modules
  "no-restricted-imports": [
    "error",
    { paths: [{ name: "@/db/admin", message: "Service-role client: only rate-limit, audit, payments and cron may use it (T19)." }] },
  ],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: securityRules },
  {
    files: ["src/services/rate-limit.ts", "src/services/audit.ts", "src/services/payments.ts", "src/app/api/cron/advance/route.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([".next/**", "out/**", "node_modules/**", "next-env.d.ts", "src/db/database.types.ts", "supabase/**", "skills/**"]),
]);
