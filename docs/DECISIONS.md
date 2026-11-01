# Decision Log (ADR-lite)

Append new entries at the bottom. Format: `## D-NNN Title (YYYY-MM-DD)` · Context · Decision · Consequences.

## D-001 Monorepo with pnpm workspaces
Decision: `apps/web`, `apps/api`, `packages/shared`, `services/media`. No Turborepo for MVP.
Consequence: shared Zod types used by both apps without publishing.

## D-002 API and worker in one Nest codebase, two entrypoints
Decision: `main.ts` (HTTP) and `worker.ts` (processors only). Same modules, different root modules.
Consequence: shared code, independent scaling and deploys.

## D-003 Python media service for yt-dlp/FFmpeg/Whisper/PaddleOCR
Decision: FastAPI sidecar over HTTP instead of child processes in Node.
Consequence: Node image stays light; media scales separately; one more service to run.

## D-004 Prisma ORM
Decision: Prisma for schema + migrations + typed client.

## D-005 BullMQ stage queues + FlowProducer fan-out
Decision: queues `extract`, `claims`, `verify`, `report`; per-claim child jobs; children never fail the parent.

## D-006 faster-whisper instead of openai-whisper
Decision: CTranslate2-based faster-whisper with int8 on CPU; captions preferred for YouTube.
Consequence: meets 60 s target for short media; long media has no SLA.

## D-007 Verdict set
Decision: SUPPORTED / MISLEADING / REFUTED / INSUFFICIENT_EVIDENCE (+ ERROR internal). Colors green/orange/red/gray.

## D-008 Evidence-only verification with VerdictGuard
Decision: code-level enforcement that verdicts cite existing evidence; LLM knowledge never counts.

## D-009 Deterministic report summary
Decision: no LLM call for the report; counts + template headline. Saves latency and free-tier quota.

## D-010 Polling over SSE/WebSockets
Decision: GET /result every 1.5 s for MVP. SSE later.

## D-011 Providers behind interfaces
Decision: `LlmProvider` (Gemini | OpenRouter), `SearchClient` (Tavily), `MediaClient`, `StorageService`. Model ids from env only.

## D-012 Allowed libraries
API: @nestjs/*, bullmq, ioredis, @prisma/client, zod, nestjs-pino, @aws-sdk/client-s3 + presigner, @mozilla/readability, jsdom, cheerio, @google/genai, file-type@16.
Web: next, react, tailwindcss, @tanstack/react-query, zod.
Media: fastapi, uvicorn, httpx, pydantic, yt-dlp, faster-whisper, paddleocr, paddlepaddle, webvtt-py.
Anything else → ask first and log here.
