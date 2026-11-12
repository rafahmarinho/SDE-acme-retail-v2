---
name: t35-fine-tune-http-server-settings
description: Limit request body size, header size and execution time for Next.js route handlers and Server Actions on Vercel, and alert on violations.
---

# T35: Fine-tune HTTP server settings

**Category:** CODE_FIX
**SD Elements:** [T35](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T35/)
**Priority:** 9

**Spec Context:**
> "publicar a versão web e a API na Vercel" ... "Supabase para ... arquivos" ... "Use pagamento simulado com opções de aprovação, recusa, autenticação e timeout"
> Source: specs/PRD.md, lines 5-7, 29-31, 47-49

**What the spec implies (naive approach):**
Default limits everywhere. Upload endpoints accept arbitrarily large bodies, and the "timeout" payment scenario is implemented by holding the request open indefinitely.

**Secure Implementation Pattern:**
```ts
// next.config.ts
export default {
  experimental: { serverActions: { bodySizeLimit: "1mb", allowedOrigins: [new URL(process.env.APP_BASE_URL!).host] } },
} satisfies NextConfig;

// src/app/api/checkout/route.ts
export const maxDuration = 10;               // seconds (Vercel function limit)
export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 32 * 1024) return new Response("Payload Too Large", { status: 413 });
  const body = await req.json();
  // ...
}

// simulated "timeout" scenario: return a pending status, never block the request
await Promise.race([provider.authorize(input), sleep(8000).then(() => ({ status: "timeout" as const }))]);
```

**Implementation Guidance:**
- Set per-route `maxDuration` and payload caps (JSON: 32 KB; uploads go directly to Supabase Storage with signed upload URLs, not through functions).
- Model the payment "timeout" outcome as a stored state and poll or use Realtime. Never hang the request.
- Log 413/408 events and alert admins on spikes (T2602).
- Platform-level limits (header size, connection timeouts) are managed by Vercel (see T374).

**Success Criteria:**
- [ ] Server Action body limit is configured
- [ ] Every route handler has `maxDuration` and a size check
- [ ] The timeout scenario completes in under 10 s with a "timeout" status

**Status:** Applied

**Implementation (2026-11-12):** `next.config.ts` sets the Server Action body limit (2 MB) and allowed origins. Route handlers set `maxDuration = 10`, and the webhook is capped at 256 KB. The payment timeout is a stored `timed_out` state (`pay_order`), so the request never hangs.
