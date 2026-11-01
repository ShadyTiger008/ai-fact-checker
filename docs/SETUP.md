# Local Setup & Scaffolding

## Prerequisites
Node 22 LTS · pnpm 9+ (`corepack enable`) · Docker + Compose · Python 3.11 + `uv` (only to run media service outside Docker) · Git.

API keys (free tiers): **Tavily** (tavily.com) and **Gemini** (Google AI Studio) or **OpenRouter**.

## 1. Scaffold (one-time, Week 1 Day 1)
```bash
mkdir veritas-ai && cd veritas-ai && git init
pnpm init
printf "packages:\n  - 'frontend'\n  - 'backend'\n  - 'shared'\n" > pnpm-workspace.yaml

# frontend
pnpm dlx create-next-app@latest frontend --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --skip-install
# backend
pnpm dlx @nestjs/cli new backend --directory backend --package-manager pnpm --skip-git --skip-install --strict
# shared + media service
mkdir -p shared/src media-service/app
```
Set package names: `frontend` → `@veritas/frontend`, `backend` → `@veritas/backend`, `shared` → `@veritas/shared` (compiled to `shared/dist` — `pnpm build:shared`, run automatically by root `dev`/`typecheck`/`test`, see D-014; both apps add `"@veritas/shared": "workspace:*"`).

Root `package.json` scripts:
```json
{
  "scripts": {
    "dev": "pnpm -r --parallel --filter @veritas/frontend --filter @veritas/backend run dev:all",
    "typecheck": "pnpm -r run typecheck",
    "lint": "pnpm -r run lint",
    "test": "pnpm -r run test"
  }
}
```
In `backend`: `dev` (nest start --watch), `dev:worker` (nest start --watch --entryFile worker), `dev:all` (concurrently both), `typecheck` (tsc --noEmit). In `frontend`: `dev:all` = `next dev -p 3000`.

### API dependencies
```bash
pnpm --filter @veritas/backend add @nestjs/config @nestjs/bullmq bullmq ioredis @prisma/client zod \
  @nestjs/throttler nestjs-pino pino-http @aws-sdk/client-s3 @aws-sdk/s3-request-presigner \
  @mozilla/readability jsdom cheerio @google/genai file-type@16 @nestjs/platform-express
pnpm --filter @veritas/backend add -D prisma @types/jsdom @types/multer concurrently
pnpm --filter @veritas/backend exec prisma init
```
Gotchas:
- Nest 12 generates an ESM project (`nodenext`, relative imports end in `.js`). Still use `file-type@16` and the in-repo `mapWithConcurrency` util instead of p-limit, as decided (D-014).
- Pin `prisma` and `@prisma/client` to the same stable version; npm's `latest` tag for `prisma` can be a release candidate.
- Tavily and OpenRouter are called with native `fetch` (Node 22) — no SDK.

### Web dependencies
```bash
pnpm --filter @veritas/frontend add @tanstack/react-query zod @veritas/shared@workspace:*
```

## 2. Environment — `.env.example` (copy to `.env`)
```dotenv
# --- API / Worker ---
NODE_ENV=development
PORT=4000
WEB_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://veritas:veritas@localhost:5432/veritas?schema=public
REDIS_URL=redis://localhost:6379

S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=veritas
S3_SECRET_KEY=veritas-secret
S3_BUCKET=veritas
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_ENDPOINT_FOR_MEDIA=http://minio:9000   # endpoint the media container uses for presigned URLs

MEDIA_SERVICE_URL=http://localhost:8000
MEDIA_SERVICE_TOKEN=change-me

LLM_PROVIDER=gemini            # gemini | openrouter
LLM_MODEL=                     # e.g. a current Gemini Flash model id, or an OpenRouter :free model id
GEMINI_API_KEY=
OPENROUTER_API_KEY=
LLM_TIMEOUT_MS=15000

TAVILY_API_KEY=
SEARCH_CACHE_TTL_SEC=86400

MAX_CLAIMS=10
EVIDENCE_PER_CLAIM=5
MAX_TEXT_CHARS=60000
MAX_MEDIA_SECONDS=900
MAX_VIDEO_MB=100
MAX_IMAGE_MB=10
VERIFY_CONCURRENCY=4
THROTTLE_LIMIT=10
THROTTLE_TTL_SEC=60

# --- Web ---
NEXT_PUBLIC_API_URL=http://localhost:4000/api

# --- Media service ---
WHISPER_MODEL=base             # tiny | base | small (CPU: base is the speed/quality sweet spot)
WHISPER_COMPUTE_TYPE=int8
YTDLP_COOKIES_FILE=            # optional, if YouTube bot-checks your IP
```
Validate all API env vars with a Zod schema in `config/env.schema.ts`; app must fail fast on missing required keys. `LLM_MODEL` is required — pick a currently available free model at setup time.

## 3. docker-compose.yml
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment: { POSTGRES_USER: veritas, POSTGRES_PASSWORD: veritas, POSTGRES_DB: veritas }
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U veritas"], interval: 5s, retries: 10 }

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: ["redis-server", "--maxmemory-policy", "noeviction"]   # required by BullMQ

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment: { MINIO_ROOT_USER: veritas, MINIO_ROOT_PASSWORD: veritas-secret }
    ports: ["9000:9000", "9001:9001"]
    volumes: [miniodata:/data]

  minio-init:
    image: minio/mc:latest
    depends_on: [minio]
    entrypoint: >
      /bin/sh -c "sleep 3;
      mc alias set local http://minio:9000 veritas veritas-secret;
      mc mb -p local/veritas;
      mc ilm rule add --expire-days 1 --prefix uploads/ local/veritas || true"

  media:
    build: ./media-service
    env_file: .env
    environment:
      MEDIA_SERVICE_TOKEN: ${MEDIA_SERVICE_TOKEN}
    ports: ["8000:8000"]
    volumes: [modelcache:/root/.cache]
    extra_hosts: ["host.docker.internal:host-gateway"]

volumes: { pgdata: {}, miniodata: {}, modelcache: {} }
```
Presigned URLs: the worker signs with `S3_ENDPOINT=http://localhost:9000`, which the media container can't reach. Set `S3_PUBLIC_ENDPOINT_FOR_MEDIA=http://minio:9000` and sign media URLs with a second S3 client using that endpoint (or run everything in compose).

## 4. Docker images (one per deployable folder)
Each deployable folder has its own `Dockerfile` and is built, versioned and deployed independently (D-013).

| Image | Dockerfile | Build context | Runs |
|---|---|---|---|
| `veritas-frontend` | `frontend/Dockerfile` | repo root (needs `shared/`) | `node server.js` (Next standalone), port 3000 |
| `veritas-backend` | `backend/Dockerfile` | repo root (needs `shared/`) | API: `node dist/main.js` (port 4000) · Worker: `node dist/worker.js` — same image, two deployments |
| `veritas-media` | `media-service/Dockerfile` | `media-service/` | `uvicorn app.main:app`, port 8000 |

```bash
docker build -f frontend/Dockerfile -t veritas-frontend --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api .
docker build -f backend/Dockerfile  -t veritas-backend .
docker build -t veritas-media media-service
```

### 4a. Frontend and backend images (requirements)
- Multi-stage on `node:22-alpine` with `corepack enable`. The build stage copies only `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `shared/` and the app's own folder, then runs `pnpm install --frozen-lockfile --filter <app>...` (the trailing `...` includes `@veritas/shared`).
- `shared` must be consumable at runtime: give it a `build` script emitting CommonJS + `.d.ts` to `shared/dist` for the backend; the frontend uses `transpilePackages: ['@veritas/shared']`.
- **Frontend:** `output: 'standalone'` in `next.config`; `NEXT_PUBLIC_API_URL` is inlined at build time → pass it as a build arg; runtime stage copies `.next/standalone`, `.next/static`, `public`.
- **Backend:** `prisma generate` + `nest build` in the build stage; runtime stage contains production deps only (`pnpm deploy --prod`), `dist/`, `prisma/`. Migrations run as a separate one-off command (`prisma migrate deploy`), never on container start.
- Run as a non-root user; add a root `.dockerignore` (`node_modules`, `.next`, `dist`, `.env*`, `.git`, `media-service`, `docs`) and `media-service/.dockerignore`.
- No secrets baked into images; all config comes from env at runtime (Golden rule 7).

### 4b. Media service Dockerfile (`media-service/Dockerfile`)
```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pyproject.toml uv.lock* ./
RUN pip install --no-cache-dir uv && uv pip install --system -r pyproject.toml
COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```
`pyproject.toml` deps: `fastapi`, `uvicorn[standard]`, `httpx`, `pydantic`, `yt-dlp`, `faster-whisper`, `paddleocr`, `paddlepaddle` (CPU), `webvtt-py`, `pytest`.
Pin exact versions once it works. **PaddleOCR 2.x and 3.x have different Python APIs** — check the installed version's docs before writing `ocr.py`. Update `yt-dlp` regularly; YouTube changes break old versions.

## 5. Run
```bash
cp .env.example .env            # fill keys + LLM_MODEL
docker compose up -d --build
pnpm install
pnpm --filter @veritas/backend prisma migrate dev --name init
pnpm dev                        # web :3000, api :4000, worker
curl localhost:4000/api/health
```
MinIO console: http://localhost:9001 (veritas / veritas-secret).

## 6. Troubleshooting
| Symptom | Fix |
|---|---|
| Jobs stay QUEUED | worker not running (`dev:worker`) or wrong `REDIS_URL` |
| BullMQ eviction warning | Redis must use `noeviction` |
| `ERR_REQUIRE_ESM` | an ESM-only package in the Nest app — use CJS version |
| YouTube "Sign in to confirm you're not a bot" | update yt-dlp; set `YTDLP_COOKIES_FILE` |
| Whisper slow | `WHISPER_MODEL=base`, `int8`; captions path avoids Whisper entirely |
| LLM 429 | lower `VERIFY_CONCURRENCY`; switch provider/model |
| First OCR/Whisper call slow | models download on first use → persisted in `modelcache` volume |
