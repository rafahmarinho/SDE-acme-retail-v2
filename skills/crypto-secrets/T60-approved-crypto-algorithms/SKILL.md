---
name: t60-approved-crypto-algorithms
description: Use approved algorithms and key lengths (HMAC-SHA-256, AES-256-GCM, Ed25519/ES256) with unique keys per purpose for tokens, signed links and any app-level encryption.
---

# T60: Use correct and approved cryptographic algorithms, parameters, and key lengths

**Category:** CODE_FIX
**SD Elements:** [T60](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/requirements/35-T60/)
**Priority:** 8

**Spec Context:**
> "Entregue o código completo, configuração do banco, dados iniciais, exemplos de variáveis de ambiente" ... "rastreamento e devoluções"
> Source: specs/PRD.md, lines 25, 45-47

**What the spec implies (naive approach):**
A single `APP_SECRET` is reused for tracking links, CSRF tokens and cookie signing. MD5 or SHA-1 is used "for IDs". AES-CBC is used with a static IV.

**Secure Implementation Pattern:**
```ts
// src/lib/keys.ts - one key per purpose, >= 256-bit random
export const KEYS = {
  csrf:        mustB64(process.env.CSRF_SECRET, 32),
  linkSigning: mustB64(process.env.LINK_SIGNING_SECRET, 32),
  fieldEnc:    mustB64(process.env.FIELD_ENCRYPTION_KEY, 32), // only if field encryption is used
};

// AES-256-GCM with a random 96-bit IV per message
export async function encrypt(plain: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", KEYS.fieldEnc, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  return { iv, ct };
}
```

**Implementation Guidance:**
- Allowed: HMAC-SHA-256/512, AES-256-GCM, SHA-256+, Ed25519/ES256 signatures. Forbidden: MD5, SHA-1, DES/3DES, RC4, ECB, static IVs.
- Use a separate secret for each purpose. Validate the key length at startup.
- Store keys only in Vercel encrypted environment variables. Document rotation (key ID prefix in tokens).

**Success Criteria:**
- [ ] No MD5/SHA-1/ECB/CBC usage (grep / semgrep rule)
- [ ] Each secret is ≥ 32 random bytes and single-purpose
- [ ] Encryption uses a random IV per operation

**Status:** Applied

**Implementation (2026-11-12):** HMAC-SHA-256 pseudonyms use a purpose-labelled 256-bit HKDF key (`src/lib/request.ts`). Tokens are 192 bits, and signatures use Stripe HMAC / Supabase JWT. There is no MD5, SHA-1, ECB or static IV. Field encryption isn't needed because no card data or secrets are stored.
