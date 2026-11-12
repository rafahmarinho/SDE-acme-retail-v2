---
name: t1144-prevent-ssti
description: Prevent server-side template injection in transactional emails, order receipts and reports by using React components or logic-less templates with data-only interpolation.
---

# T1144: Prevent Server-Side Template Injection (SSTI)

**Category:** CODE_FIX
**SD Elements:** [T1144](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-retail-v2/acme-retail-v2/tasks/phase/development/35-T1144/)
**Priority:** 8

**Spec Context:**
> "Use inglês como idioma padrão em todas as telas, mensagens, relatórios e dados de exemplo." ... "recuperação de senha"
> Source: specs/PRD.md, lines 3, 11

**What the spec implies (naive approach):**
Admins can edit email/receipt templates in the back-office, and the server renders them with a template engine (Handlebars/EJS/lodash `template`) compiled from database strings that mix in customer-controlled fields.

**Secure Implementation Pattern:**
```tsx
// src/emails/OrderConfirmation.tsx - templates are code, data is props
export function OrderConfirmation({ name, orderNumber, items }: Props) {
  return (
    <Html><Body>
      <Text>Hi {name},</Text>
      <Text>Thanks for your order #{orderNumber}.</Text>
      {items.map((i) => <Text key={i.sku}>{i.qty} × {i.name}</Text>)}
    </Body></Html>
  );
}
// render: await render(<OrderConfirmation {...dto} />)  (react-email, auto-escaped)
```

**Implementation Guidance:**
- Keep templates in source control as React (react-email) components. Never compile templates from DB or user strings.
- If admins need editable copy, store plain text with fixed placeholders (`{{orderNumber}}`) replaced by a simple string map, with no expressions or helpers.
- Never pass user input to `eval`, `new Function`, `lodash.template` or `vm`.
- Keep Supabase Auth email templates (recovery) in `supabase/templates/` and use only Supabase's documented variables.

**Success Criteria:**
- [ ] No template engine compiles runtime strings
- [ ] A customer name of `{{7*7}}` / `<%= 7*7 %>` renders literally
- [ ] Email templates are version-controlled

**Status:** Pending
