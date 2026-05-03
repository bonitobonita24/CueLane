# Phase 4 Part 5 — apps/web (Next.js full scaffold)
# Fresh session. Read STATE.md first.
TASK: Generate the Next.js web application scaffold (Part 5 of 8).
- Read .cline/STATE.md first. Confirm LAST_DONE shows Part 4 complete.
- Read inputs.yml + PRODUCT.md (modules, workflows, roles). Read DECISIONS_LOG.md.
- Create scaffold/part-5 branch.
- FIRST: Initialize shadcn/ui before generating any component:
  npx shadcn@latest init (inside apps/web/)
  npx shadcn@latest add button card dialog input label select textarea toast sonner
  Additional: chart, data-table, form, sidebar (per PRODUCT.md requirements)
- Generate:
  tsconfig.json, src/env.ts (typed env vars with Zod)
  src/app/ — App Router layout, pages for every module
  src/app/api/trpc/[trpc]/route.ts — tRPC API handler
  src/server/trpc/ — routers for every entity/module
  src/server/auth/ — Auth.js v5 config
  src/middleware.ts — tenant resolution + auth guard
  src/components/ — page-level components per module
  next.config.ts — security headers (V18), output: standalone
  src/server/lib/rate-limit.ts — tiered rate limiter (V18)
  src/server/lib/sanitize.ts — DOMPurify XSS sanitizer (V18)
  Dockerfile + .dockerignore (if docker.publish: true)
- Run: pnpm lint + pnpm typecheck. Fix all errors.
- Rewrite STATE.md. Commit. Squash-merge. Delete branch.
- Output: "Part 5 complete. Open phase4-part6.md in a NEW Claude Code session."
STOP HERE.
