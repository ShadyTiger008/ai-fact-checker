---
description: Implement the next unchecked ROADMAP item (or the one given)
---
Target: $ARGUMENTS (if empty, use the first unchecked item in docs/ROADMAP.md).

1. Read CLAUDE.md rules and the docs relevant to this item.
2. Give a short plan: what you'll build, files to create/modify, tests to add. Wait for my approval.
3. Implement the smallest complete slice. Add/update tests.
4. Run `pnpm typecheck && pnpm lint && pnpm test` (and `uv run pytest` for services/media). Fix failures.
5. Tick the item in docs/ROADMAP.md. Log any deviation from the docs in docs/DECISIONS.md.
6. Output a 3–5 line summary and a Conventional Commit message.
