# Roadmap — 4-week MVP

Tick items as they're completed (`- [x]`). Each item = one Claude Code task + one commit.
IDs are referenced in commits and prompts (e.g. `feat(input): W1-07 POST /verify`).

## Week 1 — Frontend + API + uploads
- [ ] W1-01 Monorepo scaffold (pnpm workspaces, web, api, shared), root scripts, `.env.example`, `.gitignore`
- [ ] W1-02 docker-compose (postgres, redis, minio + init); media service stub with `/health`
- [ ] W1-03 Config module: Zod env schema, fail-fast
- [ ] W1-04 Prisma schema (docs/DATABASE.md) + init migration + `PrismaService` + `JobsRepository.transition`
- [ ] W1-05 Common: `AppError` + global exception filter (error envelope), nestjs-pino, `mapWithConcurrency`, `SafeFetch` (+ SSRF unit tests)
- [ ] W1-06 Shared package: Zod schemas/types for API request/response, enums
- [ ] W1-07 Input module: `InputDetector` (+ unit tests for all URL forms), POST /api/verify (JSON + multipart), magic-byte sniffing, size limits, throttler
- [ ] W1-08 Storage module (S3 client, put/delete/presign; dual endpoint for media)
- [ ] W1-09 Queue module: queue constants, producers in API; `worker.ts` + `WorkerModule` skeleton; `extract` processor stub that marks job EXTRACTING
- [ ] W1-10 Report module: GET /api/result/:id (in-progress shape), GET /api/health
- [ ] W1-11 Web: layout, fonts, design tokens (`lib/verdict.ts`), Home page (tabs, UrlForm, FileDropzone), api client
- [ ] W1-12 Web: Processing page (polling, stepper, progress, failed state)

**Acceptance:** submit URL or file from UI → job row created → upload in MinIO → processing page polls and shows EXTRACTING.

## Week 2 — Extraction (YouTube, article, video, image)
- [ ] W2-01 Media service: FastAPI app, token auth, error envelope, Dockerfile, pytest setup
- [ ] W2-02 Media `/youtube`: yt-dlp metadata, duration guard, captions (VTT → segments), Whisper fallback
- [ ] W2-03 Media `/transcribe`: download presigned URL, ffprobe guard, FFmpeg → WAV, faster-whisper
- [ ] W2-04 Media `/ocr`: PaddleOCR, confidence filter, reading order
- [ ] W2-05 Nest `MediaClient` (timeouts, 4xx → UnrecoverableError, 5xx → retry)
- [ ] W2-06 `ArticleExtractor`: SafeFetch + jsdom + Readability, date extraction, Cheerio fallback (+ fixture tests with saved HTML)
- [ ] W2-07 `YoutubeExtractor`, `VideoExtractor`, `ImageExtractor` (strategy registry)
- [ ] W2-08 `Normalizer` (+ unit tests: caption dedupe, boilerplate, truncation, chunking with segment ranges)
- [ ] W2-09 `ExtractProcessor`: extract → normalize → save Document → delete upload → status/progress → enqueue `claims`; failure codes
- [ ] W2-10 Processing page shows document title once extracted

**Acceptance:** each of the 4 input types produces a Document with sensible segments; bad inputs fail with the right code.

## Week 3 — Claim extraction + search
- [ ] W3-01 LLM module: `LlmProvider` interface, `GeminiProvider`, `OpenRouterProvider`, JSON parse + Zod + one corrective retry, 429 handling, `FakeLlmProvider` for tests
- [ ] W3-02 Prompt `claim-extraction.v1` (docs/PROMPTS.md) with segment markers
- [ ] W3-03 `ClaimService`: chunk calls (concurrency 2), quote validation, dedupe, ranking, MAX_CLAIMS (+ unit tests)
- [ ] W3-04 `ClaimProcessor`: save claims; zero claims → report; else FlowProducer (parent `build-report`, children `verify-claim`)
- [ ] W3-05 Search: `TavilyClient`, `SearchCache` (Redis), source-domain exclusion
- [ ] W3-06 `trusted-sources.ts` + `EvidenceRanker` (+ unit tests)
- [ ] W3-07 `verify-claim` processor part 1: search → rank → save Evidence (idempotent)

**Acceptance:** an article job ends with ≤ 10 claims, each with ≤ 5 ranked evidence rows in DB.

## Week 4 — Verification + report
- [ ] W4-01 Prompt `claim-verification.v1`; `VerificationService`
- [ ] W4-02 `VerdictGuard` (+ unit tests: unknown labels, missing quotes, no citations → INSUFFICIENT, stance mismatch)
- [ ] W4-03 `verify-claim` part 2: verify → guard → save result → progress; terminal failure → ERROR result, never throw
- [ ] W4-04 `ReportProcessor` + completed result shape (docs/API.md)
- [ ] W4-05 Web Report page: header, summary bar, filter, ClaimCard, EvidenceCard, locator links, empty/failed states
- [ ] W4-06 E2E test with FakeLlm + fake Tavily (docs/TESTING.md)
- [ ] W4-07 Golden-set eval script + run; tune prompts/ranking; record numbers in DECISIONS.md
- [ ] W4-08 Performance pass: per-stage timing logs, tune concurrency to hit < 60 s
- [ ] W4-09 Hardening: SSRF tests, upload limits, rate limit, error messages, README

**Acceptance:** PRD §11 success criteria met.

## Post-MVP backlog (do not start without approval)
Claim timeline for videos · SSE instead of polling · frame OCR for videos · PDFs · accounts/history · browser extension · deepfake detection · multi-language.
