---
description: Review uncommitted changes against project rules
---
Review `git diff` (staged + unstaged) against CLAUDE.md golden rules and the relevant docs.
Check specifically:
- evidence-only verification and VerdictGuard untouched or strengthened
- untrusted content delimited in prompts; LLM output Zod-validated
- SafeFetch used for every outbound URL fetch
- processors idempotent; correct UnrecoverableError usage; verify-claim never throws at the end
- no hardcoded secrets/model ids; no new libraries outside docs/DECISIONS.md D-012
- types imported from @veritas/shared, not duplicated
- tests cover the change
Report issues as: file:line — problem — fix. Don't modify files unless I ask.
