# API route handlers (placeholder)

The web app and the API are both deployed on Vercel (specs/PRD.md). Route handlers
live under `src/app/api/**/route.ts`. Every handler must validate its input with zod,
check authorization on the server, and return explicit response DTOs. See
`skills/api-security/` and `skills/access-control/`.
