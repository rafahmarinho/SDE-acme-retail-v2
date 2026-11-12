---
name: t36-escape-untrusted-output
description: Prevent stored and reflected XSS in product content, search results, reviews, profile fields and error messages by relying on React contextual escaping and sanitizing any rich HTML.
---

# T36: Escape untrusted data in HTML, HTML attributes, CSS, and JavaScript

**Category:** CODE_FIX
**SD Elements:** [T36](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T36/)
**Priority:** 8

**Spec Context:**
> "Crie páginas de ... catálogo, produto ... além do painel de produtos" ... "busca no cabeçalho" ... "mensagens de erro"
> Source: specs/PRD.md, lines 11, 19-25

**What the spec implies (naive approach):**
Catalog staff enter rich product descriptions that are rendered with `dangerouslySetInnerHTML`. Search pages echo "Results for <q>" by building HTML, and error toasts render raw server messages.

**Secure Implementation Pattern:**
```tsx
// render plain text: React escapes automatically
<h1>Results for “{query}”</h1>

// rich product descriptions: store Markdown, sanitize on render
import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";

export function ProductDescription({ md }: { md: string }) {
  const html = DOMPurify.sanitize(marked.parse(md, { async: false }) as string, {
    ALLOWED_TAGS: ["p", "ul", "ol", "li", "strong", "em", "a", "h3", "h4"],
    ALLOWED_ATTR: ["href"],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
```

**Implementation Guidance:**
- Default to JSX text interpolation. Ban `dangerouslySetInnerHTML` with an ESLint rule (`react/no-danger`), except in the sanitized component above.
- Never put user data into `href`/`src` without checking that the scheme is `https:` (blocks `javascript:` URLs).
- Never inject user data into `<script>`, inline `style` strings or `eval`.
- Show generic error messages to users and log details server-side.
- Add a strict Content-Security-Policy (see T66) as defense in depth.

**Success Criteria:**
- [ ] `dangerouslySetInnerHTML` appears only in sanitized components
- [ ] A product description containing `<img src=x onerror=alert(1)>` renders inert
- [ ] Searching for `<script>alert(1)</script>` shows it as escaped text

**Status:** Applied

**Implementation (2026-11-12):** All user data is rendered as JSX text. Product descriptions are plain text (no HTML path, so no sanitizer is needed). `eslint.config.mjs` enforces `react/no-danger`, image URLs come only from `productImageUrl()`, errors are generic (`src/lib/errors.ts`), and a nonce CSP is set in `src/proxy.ts`.
