# Phase 4 Part 4 — packages/ui + packages/jobs + packages/storage
# Fresh session. Read STATE.md first.
TASK: Generate UI package, job queue package, and storage package (Part 4 of 8).
- Read .cline/STATE.md first. Confirm LAST_DONE shows Part 3 complete.
- Read inputs.yml (apps, jobs, storage sections). Read .cline/memory/lessons.md.
- Create scaffold/part-4 branch.
- Generate:
  packages/ui/ — shadcn/ui + Tailwind + Radix UI components (web)
  packages/jobs/ — Valkey (MIT Redis fork) + BullMQ typed queues, workers, DLQ (jobs.enabled: true)
  packages/storage/ — Typed MinIO/S3 wrapper (storage.enabled: true)
- Run: pnpm typecheck for this Part. Fix all errors.
- Rewrite STATE.md. Commit. Squash-merge. Delete branch.
- Output: "Part 4 complete. Open phase4-part5.md in a NEW Claude Code session."
STOP HERE.
