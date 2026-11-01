# Building Veritas AI with Claude Code

## 0. One-time setup
```bash
mkdir veritas-ai && cd veritas-ai && git init
# copy CLAUDE.md, README.md, docs/, .claude/, and the nested CLAUDE.md files into place
git add . && git commit -m "docs: project specification"
claude
```
Don't run `/init` — CLAUDE.md already exists (running it would overwrite/merge).

How the memory files load:
- `CLAUDE.md` (root) loads every session.
- `apps/api/CLAUDE.md`, `apps/web/CLAUDE.md`, `services/media/CLAUDE.md` load when Claude works in those folders.
- `docs/*.md` are read on demand (CLAUDE.md tells Claude which one to read).

## 1. Working loop (every task)
1. `/clear` (fresh context per ROADMAP item).
2. Run `/next-task` (or `/next-task W2-06` for a specific item).
3. Use **plan mode** (Shift+Tab) — review the plan and file list before approving.
4. Let it implement + test. Then `/review`.
5. Commit: `git commit -am "feat(scope): Wx-yy …"`.
6. Every ~5 tasks, check `git diff` on docs to ensure decisions are logged.

Tips: `/compact` if a task runs long · `#` to add a quick rule to memory · keep each task ≤ 1 ROADMAP item · if Claude proposes a library not in D-012, say no or log it.

## 2. Ready-to-paste prompts

### Kickoff (first session)
```
Read CLAUDE.md, docs/PRD.md, docs/ARCHITECTURE.md and docs/ROADMAP.md.
Summarize the architecture back to me in 10 bullets and list any contradictions or gaps
you see across the docs. Don't write code yet.
```

### W1-01 + W1-02 scaffold
```
Do ROADMAP items W1-01 and W1-02 using docs/SETUP.md exactly (package names, scripts,
docker-compose, .env.example). The media service is only a FastAPI stub with GET /health for now.
Verify: pnpm install works, docker compose up -d is healthy, pnpm typecheck passes.
Tick the items in ROADMAP.md.
```

### Backend foundation (W1-03 → W1-06)
```
Do W1-03 to W1-06. Follow docs/DATABASE.md for the Prisma schema verbatim and docs/API.md
for the error envelope. SafeFetch must pass the SSRF cases in docs/TESTING.md.
Write unit tests for env schema, SafeFetch and mapWithConcurrency. Run all checks.
```

### Input + storage + queue + result (W1-07 → W1-10)
```
Do W1-07 to W1-10 per docs/PIPELINE.md §1, docs/API.md and docs/ARCHITECTURE.md §2–3.
API process registers queue producers only; processors live only in WorkerModule (worker.ts).
Add InputDetector unit tests for every URL form in docs/TESTING.md.
Show me curl commands to test POST /api/verify (url + file) and GET /api/result/:id.
```

### Web week 1 (W1-11, W1-12)
```
Do W1-11 and W1-12 per docs/FRONTEND.md. Use types/schemas from @veritas/shared.
Design: minimal, document-focused, Inter + Source Serif 4, zinc neutrals, verdict tokens in
src/lib/verdict.ts. Polling with TanStack Query, stop on terminal status.
```

### Media service (W2-01 → W2-04)
```
Work in services/media. Do W2-01 to W2-04 per docs/API.md "Media service" and
docs/PIPELINE.md §2. First check the installed paddleocr version and use its correct API.
Mock yt-dlp/whisper/OCR in pytest. Captions preferred over Whisper for YouTube.
```

### Extraction in Nest (W2-05 → W2-10)
```
Do W2-05 to W2-10 per docs/PIPELINE.md §2–3 and §9. Extractors use a strategy registry.
Normalizer is a pure function with unit tests. ArticleExtractor tests use saved HTML fixtures
in apps/api/test/fixtures/articles (create 3: normal news, paywall stub, JS-only shell).
Non-retryable failures throw UnrecoverableError with the job failure codes from docs/API.md.
```

### LLM + claims (W3-01 → W3-04)
```
Do W3-01 to W3-04 per docs/PROMPTS.md and docs/PIPELINE.md §4. Prompts are versioned
constants. Implement FakeLlmProvider for tests. The claim processor creates a BullMQ flow:
parent build-report, one verify-claim child per claim. Zero claims → straight to report.
```

### Search (W3-05 → W3-07)
```
Do W3-05 to W3-07 per docs/PIPELINE.md §5–6. Tavily via native fetch, Redis cache key
search:v1:<sha256>, exclude the source domain. EvidenceRanker is pure with unit tests.
Evidence writes must be idempotent under retries.
```

### Verification + report (W4-01 → W4-04)
```
Do W4-01 to W4-04 per docs/PROMPTS.md §2 and docs/PIPELINE.md §7–8.
VerdictGuard is pure and fully unit tested (all cases in PIPELINE §7).
verify-claim must never throw after its final attempt: save an ERROR result and resolve.
Report is deterministic, no LLM.
```

### Report UI (W4-05)
```
Do W4-05 per docs/FRONTEND.md "Report". Render [E1]-style references in explanations as
anchor links to evidence cards. YouTube locators link to &t=<sec>s. Include empty and failed states.
```

### Tests, eval, perf (W4-06 → W4-09)
```
Do W4-06: E2E test per docs/TESTING.md using fakes (no network).
Then W4-07: write scripts/eval.ts and the golden.json format; I'll supply the real items.
Then W4-08: add per-stage timing logs (jobId, stage, ms) and report where the 60 s budget goes.
```

### Debugging prompt
```
Job <id> is stuck in <STATUS>. Check worker logs for that jobId, the BullMQ job state in Redis,
and the DB row. Explain the root cause before changing code. Propose the smallest fix.
```

### Doc-drift check (run weekly)
```
Compare the code against docs/ARCHITECTURE.md, docs/API.md and docs/DATABASE.md.
List every mismatch. Don't change code — tell me which side should change.
```
