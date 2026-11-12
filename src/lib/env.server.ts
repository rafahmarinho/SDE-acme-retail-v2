/**
 * Server-only environment (T76, T2599, T156). Validated lazily on first use so `next build`
 * doesn't need production secrets. Importing this from a client component fails the build.
 */
import "server-only";
import { z } from "zod";
import { isSecureOrLoopback } from "./env";

const optionalSecret = (re: RegExp, msg: string) =>
  z.union([z.literal(""), z.string().regex(re, msg)]).optional().transform((v) => (v ? v : undefined));

const ServerEnv = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  APP_BASE_URL: z.string().url().refine(isSecureOrLoopback, "APP_BASE_URL must use HTTPS"),
  PAYMENT_PROVIDER: z.enum(["simulated", "stripe"]).default("simulated"),
  // "modo de teste": live Stripe keys are rejected outright
  STRIPE_SECRET_KEY: optionalSecret(/^sk_test_[A-Za-z0-9]+$/, "Only Stripe TEST secret keys (sk_test_...) are allowed"),
  STRIPE_WEBHOOK_SECRET: optionalSecret(/^whsec_[A-Za-z0-9]+$/, "Invalid Stripe webhook secret"),
  ENABLE_SIMULATION: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  CRON_SECRET: z.union([z.literal(""), z.string().min(32)]).optional().transform((v) => (v ? v : undefined)),
  CORS_ALLOWED_ORIGINS: z.string().optional().default(""),
});

export type ServerEnv = z.infer<typeof ServerEnv>;
let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error("TLS certificate validation must not be disabled (NODE_TLS_REJECT_UNAUTHORIZED=0)");
  }
  const env = ServerEnv.parse(process.env);
  if (env.PAYMENT_PROVIDER === "stripe" && !env.STRIPE_SECRET_KEY) {
    throw new Error("PAYMENT_PROVIDER=stripe requires STRIPE_SECRET_KEY (test mode)");
  }
  cached = env;
  return env;
}
