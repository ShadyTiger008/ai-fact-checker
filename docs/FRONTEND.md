# Frontend (Next.js App Router)

`frontend` · TypeScript strict · Tailwind · TanStack Query · no global state library.

## Routes
| Route | Purpose |
|---|---|
| `/` | Home — paste link or upload file |
| `/processing/[id]` | Polls status; shows stage stepper + progress; on `COMPLETED` → `router.replace('/report/[id]')`; on `FAILED` shows error + "Try another" |
| `/report/[id]` | Verification report (server component fetches result; if not completed, redirect to `/processing/[id]`) |

## Home
- Tabs: **Paste link** | **Upload file**.
- Link input: client-side check for http(s); hint text "YouTube or news article link".
- Upload: drag-and-drop zone + file picker; accept `video/mp4,image/jpeg,image/png,image/webp`; show size limits (MP4 100 MB, image 10 MB) and reject client-side before upload.
- Submit → `POST /api/verify` (`fetch`; multipart via `FormData`; upload progress not required for MVP) → navigate to `/processing/{jobId}`.
- Show API error message inline (from error envelope).
- Below the fold: 3-step explainer (Extract → Search → Verify) and the disclaimer.

## Processing
- `useQuery` on `GET /api/result/:id` with `refetchInterval: 1500`, stop when status is terminal.
- Stepper: Queued → Extracting text → Finding claims → Checking sources (x/N) → Building report.
- Show document title once available. Progress bar from `progress`.
- Elapsed timer (helps validate the 60 s target).

## Report
Layout: single centered column, max-width ~760 px (document feel).
1. **Header**: source type icon, title, site/channel, published date, original link (new tab), processed-in time.
2. **Summary bar**: `headline` + counts as chips (Supported / Misleading / Refuted / Unverified).
3. **Filter row**: chips to filter claims by verdict.
4. **Claim cards** (in `position` order):
   - Verdict chip + confidence (e.g. "86 % confidence").
   - Claim text (serif, larger).
   - Original quote (muted, italic) with locator: YouTube → link `…&t={floor(startSec)}s`; video → `mm:ss`; article → "Paragraph n"; image → "Text in image".
   - Explanation; render `[E1]` as anchor links to the evidence cards.
   - Evidence cards (collapsed to top 2, "Show all n sources"): title (link), domain, trust tier badge, date, snippet with cited quote highlighted, stance tag (Supports / Refutes / Context).
5. Footer disclaimer.

Empty state (0 claims): "No check-worthy factual claims were found in this content."
Failed state: message per error code + "Try another".

## Design system
- Minimal, document-focused, typography-first. Neutral (Tailwind `zinc`) surfaces; color only for status.
- Fonts via `next/font`: Inter (UI), Source Serif 4 (claim text, titles).
- Status tokens (define once in `lib/verdict.ts` and reuse):

| Verdict | Label | Classes |
|---|---|---|
| SUPPORTED | Supported | `bg-green-50 text-green-800 ring-green-600/20` |
| MISLEADING | Misleading | `bg-orange-50 text-orange-800 ring-orange-600/20` |
| REFUTED | Refuted | `bg-red-50 text-red-800 ring-red-600/20` |
| INSUFFICIENT_EVIDENCE | Unverified | `bg-zinc-100 text-zinc-700 ring-zinc-500/20` |
| ERROR | Couldn't check | `bg-white text-zinc-600 ring-zinc-300 border-dashed` |

- Chips always include text (never color-only). Dark mode via `dark:` variants.
- Spacing scale 4/8; cards `rounded-xl border border-zinc-200`; no heavy shadows.

## Components (`src/components`)
`InputTabs`, `UrlForm`, `FileDropzone`, `StageStepper`, `ProgressBar`, `ReportHeader`, `SummaryBar`, `VerdictChip`, `VerdictFilter`, `ClaimCard`, `EvidenceCard`, `TrustBadge`, `StanceTag`, `Disclaimer`, `ErrorState`.

## Data layer
- `src/lib/api.ts`: `submitUrl`, `submitFile`, `getResult` — typed with `@veritas/shared`; parse responses with the shared Zod schemas.
- `NEXT_PUBLIC_API_URL` env.
- No secrets in the web app. The web app never calls Tavily/LLM directly.

## Later (not MVP)
Claim timeline view for videos, share button with OG image, history.
