# Processing Pipeline

Order: **detect → extract → normalize → extract claims → search → rank → verify → report → save/cleanup**.
Limits come from env (defaults shown). Error codes are listed in docs/API.md.

---
## 1. Detect input type (`input/input-detector.ts`, runs in API)
URL submissions (`{ url }`):
- Must be `http`/`https`, ≤ 2048 chars.
- YouTube if host ∈ {`youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`} and a video ID is found in `watch?v=`, `youtu.be/<id>`, `/shorts/<id>`, `/embed/<id>`. ID = `[A-Za-z0-9_-]{11}`. Store canonical `https://www.youtube.com/watch?v=<id>`.
- Everything else → `ARTICLE` (content-type is verified later during fetch; non-HTML → `UNSUPPORTED_TYPE`).
- Reject `youtube.com/playlist`, `/live/`, channel URLs → `UNSUPPORTED_TYPE`.

File uploads (multipart `file`):
- Sniff magic bytes (don't trust extension or client MIME). `video/mp4` → `VIDEO` (≤ `MAX_VIDEO_MB`=100). `image/jpeg|png|webp` → `IMAGE` (≤ `MAX_IMAGE_MB`=10). Else `UNSUPPORTED_TYPE`.
- Store at `uploads/<jobId>/<uuid>.<ext>` in S3/MinIO. Save key on Job.

Then: create Job (`QUEUED`), enqueue `extract` with `{ jobId }`, return 202.

## 2. Extract (`extractor/`, worker)
Strategy pattern: `interface Extractor { supports(t: InputType): boolean; extract(job): Promise<ExtractedContent> }`

```ts
type ExtractedContent = {
  title?: string; author?: string; siteName?: string; publishedAt?: string; language?: string;
  durationSec?: number;
  method: 'readability' | 'cheerio' | 'captions' | 'whisper' | 'ocr';
  segments: { text: string; start?: number; end?: number }[];  // timestamps in seconds for media
};
```

### 2a. YouTube → media `POST /youtube`
1. `yt-dlp --skip-download --dump-json` → title, channel, duration, upload_date, language.
2. If `duration > MAX_MEDIA_SECONDS` (900) → `MEDIA_TOO_LONG`.
3. Subtitles: manual first, then auto; prefer `en`, else video language. Parse VTT → segments.
4. No subtitles → download `bestaudio`, FFmpeg → 16 kHz mono WAV → faster-whisper → segments.
5. Return `{ meta, method: 'captions'|'whisper', segments }`.
Notes: keep yt-dlp updated; YouTube may bot-block server IPs — support optional `YTDLP_COOKIES_FILE`.

### 2b. Article (Nest, `ArticleExtractor`)
1. `SafeFetch(url, { timeout: 8s, maxBytes: 5MB, headers: browser-like UA })`. Non-HTML content-type → `UNSUPPORTED_TYPE`.
2. jsdom (`url` set for relative links) → `new Readability(doc).parse()` → title, byline, siteName, textContent.
3. Published date: `article:published_time`, `og:*`, JSON-LD `datePublished` (Cheerio).
4. If Readability text < 300 chars → Cheerio fallback: join `<article> p` or all `<p>` with ≥ 40 chars.
5. Still < 300 chars → `EXTRACTION_EMPTY` (likely paywalled/JS-rendered).
6. Segments = paragraphs.

### 2c. MP4 → media `POST /transcribe`
Worker creates presigned GET (5 min) → media downloads → `ffprobe` duration check → FFmpeg audio → faster-whisper → segments. No audio stream → `EXTRACTION_EMPTY`.

### 2d. Image → media `POST /ocr`
Presigned GET → PaddleOCR → lines with confidence. Keep confidence ≥ 0.6, sort top-to-bottom then left-to-right, join. < 20 chars → `EXTRACTION_EMPTY`. Segments = lines grouped into blocks.

## 3. Normalize (`extractor/normalizer.ts`, pure function — unit tested)
1. Unicode NFKC; strip zero-width chars; collapse whitespace.
2. Captions: drop rolling duplicates (auto-captions repeat the previous line), remove `[Music]`, `[Applause]`, `>>`.
3. Drop boilerplate lines (cookie banners, "Subscribe", "Read more", share prompts) via a small regex list.
4. Truncate to `MAX_TEXT_CHARS` (60 000); set `truncated = true`.
5. Chunk for claim extraction: ~1 500 words with 100-word overlap; each chunk keeps its segment index range (and start/end seconds).
Save `Document` (raw + normalized + segments). Status → `EXTRACTING_CLAIMS`.

## 4. Extract claims (`claim/`, worker)
1. For each chunk (concurrency 2): LLM call with **CLAIM_EXTRACTION** prompt (docs/PROMPTS.md) → Zod-validated `{ claims: [...] }`.
2. Each claim: `text` (self-contained; pronouns resolved; includes who/what/when), `quote` (verbatim span from chunk), `segmentIndex`, `category`, `checkworthiness` 0–1, `searchQueries` (1–2).
3. Validate `quote`: must appear in the chunk (case/whitespace-insensitive). If not, keep the claim but null the quote.
4. Merge chunks → dedupe: lowercase, strip punctuation, token Jaccard ≥ 0.8 → keep higher checkworthiness.
5. Sort by checkworthiness desc; keep top `MAX_CLAIMS` (10); drop below 0.3.
6. Locator: `{ segmentIndex, startSec? }` from the segment.
7. Save Claims. Zero claims → status `REPORTING`, enqueue `build-report` directly.
8. Else create flow: parent `build-report` + one `verify-claim` child per claim. Status → `VERIFYING`.

## 5. Search (`search/`, inside `verify-claim`)
1. Queries = claim `searchQueries` (max 2). Fallback: claim text truncated to 300 chars.
2. Cache: Redis key `search:v1:<sha256(lowercase(trim(query)))>`, TTL `SEARCH_CACHE_TTL_SEC` (86 400).
3. Tavily `POST https://api.tavily.com/search` with `search_depth: "basic"`, `max_results: 8`, `include_answer: false`, `exclude_domains: [sourceDomain, ...BLOCKLIST]`. Topic `news` if claim category is `event`, else `general`.
4. Never use Tavily's generated answer as evidence — only result URLs + content.

## 6. Rank evidence (`search/evidence-ranker.ts`, pure function)
- Merge results across queries; dedupe by normalized URL (strip query/fragment/`www`).
- `trustWeight` from `trusted-sources.ts`: HIGH 1.0, MEDIUM 0.7, UNKNOWN 0.4, LOW 0.2; blocklisted removed.
- `recency`: 1.0 if < 1 year old, 0.6 if < 5 years, 0.3 otherwise/unknown.
- `rankScore = 0.5·tavilyScore + 0.35·trustWeight + 0.15·recency`.
- Max 2 results per domain; keep top `EVIDENCE_PER_CLAIM` (5); label `E1…E5` in rank order.
- Save Evidence rows.

`trusted-sources.ts` (starter — extend as needed):
- HIGH: fact-checkers (snopes.com, factcheck.org, politifact.com, fullfact.org, altnews.in, boomlive.in, factly.in), wires (reuters.com, apnews.com, afp.com), `*.gov`, `*.gov.in`, `*.nic.in`, `pib.gov.in`, who.int, un.org, worldbank.org, nature.com, science.org, nih.gov, cdc.gov, nasa.gov.
- MEDIUM: bbc.com, theguardian.com, nytimes.com, washingtonpost.com, aljazeera.com, thehindu.com, indianexpress.com, hindustantimes.com, ndtv.com, economist.com, bloomberg.com, wikipedia.org, britannica.com.
- LOW / BLOCKLIST: content farms, known satire (theonion.com → blocklist), user-generated platforms (medium.com, quora.com, reddit.com → LOW).

## 7. Verify (`verification/`, inside `verify-claim`)
1. No evidence → result `INSUFFICIENT_EVIDENCE`, confidence 0, explanation "No relevant sources found." (no LLM call).
2. Else LLM with **CLAIM_VERIFICATION** prompt: claim + evidence list (`E1: title | domain | date | snippet`).
3. Zod-validate. Then **VerdictGuard**:
   - Drop citations whose label isn't in the evidence list.
   - Drop citation quotes not found (fuzzy, whitespace/case-insensitive) in that evidence's snippet; keep the citation without the quote.
   - If verdict ∈ {SUPPORTED, REFUTED, MISLEADING} and no valid citations remain → `INSUFFICIENT_EVIDENCE`, confidence ≤ 0.3.
   - If SUPPORTED but every citation stance is `refutes` (or vice versa) → `MISLEADING` and log a warning.
   - Clamp confidence to [0, 1].
4. Save VerificationResult (model, promptVersion, latencyMs). Update job progress.
5. Terminal failure → save `ERROR` result and **return normally** (parent must still run).

## 8. Report (`report/`, `build-report`)
Deterministic, no LLM:
```ts
{ summary: { total, supported, misleading, refuted, insufficient, errored },
  headline: string,       // e.g. "3 of 7 claims supported, 2 refuted, 2 unverified"
  durationMs: number, model: string, promptVersions: {...} }
```
Save to `job.report`; status `COMPLETED`; `completedAt`. GET /result assembles document + claims + evidence + results with this summary.

## 9. Cleanup
After extraction succeeds or fails terminally: delete the upload object. MinIO bucket lifecycle rule deletes `uploads/` after 1 day as a backstop.
