---
name: t374-offload-http-request-handling
description: Offload HTTP request buffering and DoS protection to the Vercel platform (Edge Network, Firewall/WAF, Attack Challenge Mode) rather than application code.
---

# Task T374: Offload HTTP request handling to dedicated modules (NON-CODE)

**Category:** INFRA
**SD Elements:** [T374](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T374/)
**Priority:** 7

**Guidance:** Offload parts of request handling to the OS or platform, and use server modules such as a firewall, QoS or security modules to mitigate resource-exhaustion DoS.

**Why Not Code-Fixable:**
- Searched specs: specs/PRD.md lines 17-19 ("com Supabase e Vercel") and 47-49 ("publicar a versão web e a API na Vercel").
- Found: the application runs as Vercel serverless/edge functions behind the Vercel Edge Network.
- Missing: the app doesn't control sockets, request buffering or a web-server process (no NGINX/Apache). Those are owned by the Vercel platform.
- Conclusion: INFRA. In-app limits are covered by T35, T536 and T1362.

**Recommended Action:** The platform owner enables the Vercel Firewall with managed rulesets, configures rate-limit rules for `/api/*` and the auth routes, keeps Attack Challenge Mode ready for incidents, and turns on Supabase's built-in Auth rate limits.

**Status:** Documented
