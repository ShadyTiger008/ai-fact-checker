# HTTP API

Base: `http://localhost:4000/api` · JSON · CORS allowed origin = `WEB_ORIGIN`.
All request/response types are exported from `shared` (Zod + inferred TS types).

## Error envelope
```json
{ "error": { "code": "UNSUPPORTED_TYPE", "message": "Only YouTube links, article links, MP4 videos and JPEG/PNG/WebP images are supported." } }
```

| Code | HTTP | When |
|---|---|---|
| `INVALID_INPUT` | 400 | missing/invalid url, both url and file, malformed body |
| `NOT_FOUND` | 404 | unknown job id (also for non-UUID ids) |
| `FILE_TOO_LARGE` | 413 | upload over limit |
| `UNSUPPORTED_TYPE` | 415 | unsupported URL kind or file type |
| `RATE_LIMITED` | 429 | throttler |
| `INTERNAL_ERROR` | 500 | unexpected |

Job-level failure codes (in `GET /result`, not HTTP errors): `EXTRACTION_EMPTY`, `MEDIA_TOO_LONG`, `FILE_TOO_LARGE`, `UNSUPPORTED_TYPE`, `SOURCE_UNREACHABLE`, `INTERNAL_ERROR`.

---
## POST /api/verify
Submit content. Exactly one of `url` or `file`.

**URL** — `Content-Type: application/json`
```json
{ "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
```
**File** — `multipart/form-data`, field `file`.

**202 Accepted**
```json
{ "jobId": "7c1e…-uuid", "status": "QUEUED", "inputType": "YOUTUBE" }
```
Throttle: 10 requests / 60 s / IP.

---
## GET /api/result/:id
Poll until `status` is `COMPLETED` or `FAILED`.

**200 — in progress**
```json
{
  "jobId": "7c1e…",
  "status": "VERIFYING",
  "progress": 54,
  "input": { "type": "ARTICLE", "url": "https://example.com/news/x", "filename": null },
  "document": { "title": "…", "siteName": "…", "publishedAt": "2026-10-02T00:00:00Z", "extractionMethod": "readability" },
  "claimsTotal": 7,
  "claimsDone": 4,
  "report": null,
  "error": null,
  "createdAt": "…"
}
```

**200 — completed**
```json
{
  "jobId": "7c1e…",
  "status": "COMPLETED",
  "progress": 100,
  "input": { "type": "YOUTUBE", "url": "https://www.youtube.com/watch?v=…", "filename": null },
  "document": { "title": "…", "siteName": "YouTube", "publishedAt": null, "durationSec": 412, "extractionMethod": "captions", "truncated": false },
  "report": {
    "summary": { "total": 3, "supported": 1, "misleading": 1, "refuted": 1, "insufficient": 0, "errored": 0 },
    "headline": "1 of 3 claims supported, 1 misleading, 1 refuted",
    "durationMs": 38412,
    "model": "gemini-…",
    "claims": [
      {
        "id": "…",
        "position": 0,
        "text": "India's population surpassed China's in 2023, according to the UN.",
        "quote": "we overtook China last year",
        "locator": { "segmentIndex": 12, "startSec": 95.4 },
        "category": "statistic",
        "verdict": "SUPPORTED",
        "confidence": 0.86,
        "explanation": "UN DESA data [E1] and a Reuters report [E2] state India became the most populous country in 2023.",
        "citations": [
          { "label": "E1", "stance": "supports", "quote": "…" }
        ],
        "evidence": [
          { "label": "E1", "url": "https://…", "title": "…", "domain": "un.org", "trustTier": "HIGH", "publishedAt": "2023-04-24T00:00:00Z", "snippet": "…" }
        ]
      }
    ]
  },
  "error": null
}
```

**200 — failed**
```json
{ "jobId": "…", "status": "FAILED", "progress": 10, "report": null,
  "error": { "code": "EXTRACTION_EMPTY", "message": "We couldn't read enough text from this page. It may be paywalled or rendered with JavaScript." } }
```

**404** `NOT_FOUND`.

Implementation notes: build the response in `ReportService.getResult(id)` with one Prisma query (`include` document, claims → evidence, result) ordered by `position` and `label`. While VERIFYING, `claimsDone` = count of results.

---
## GET /api/health
`200 { "status": "ok", "db": "ok", "redis": "ok", "media": "ok" | "down" }` — media reported but not fatal.

## Media service (internal, not exposed)
Base `MEDIA_SERVICE_URL` (default `http://localhost:8000`). Header `X-Internal-Token: MEDIA_SERVICE_TOKEN`.

| Endpoint | Body | Returns |
|---|---|---|
| `POST /youtube` | `{ url, maxSeconds }` | `{ meta:{title,channel,durationSec,language,uploadDate}, method, segments:[{start,end,text}] }` |
| `POST /transcribe` | `{ mediaUrl, maxSeconds }` | `{ durationSec, language, method:"whisper", segments }` |
| `POST /ocr` | `{ imageUrl }` | `{ method:"ocr", lines:[{text, confidence, box:[x1,y1,x2,y2]}] }` |
| `GET /health` | — | `{ status:"ok", whisperModel, ocr:"ready" }` |

Errors: `{ "error": { "code": "MEDIA_TOO_LONG" | "EXTRACTION_EMPTY" | "SOURCE_UNREACHABLE" | "INTERNAL_ERROR", "message": "…" } }` with 4xx/5xx. Nest `MediaClient` maps 4xx → `UnrecoverableError`, 5xx/timeouts → retryable.
