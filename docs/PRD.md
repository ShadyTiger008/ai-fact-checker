# Veritas AI — Product Requirements (MVP)

## 1. Name
**Veritas** = truth. The product verifies claims from videos, articles and images using evidence rather than guessing.

## 2. Vision
An AI verification platform that accepts content, extracts its factual claims, searches trusted sources, and produces an evidence-backed report with citations.

## 3. Supported inputs (MVP)
| Input | How it arrives | Text source |
|---|---|---|
| YouTube URL | pasted link (`watch`, `youtu.be`, `shorts`) | captions → fallback Whisper transcription |
| News article URL | pasted link | Readability → fallback Cheerio |
| MP4 video | upload, ≤ 100 MB, ≤ 15 min | Whisper transcription of audio track |
| Image | upload (JPEG/PNG/WebP), ≤ 10 MB | PaddleOCR text |

MVP verifies **text claims inside** the content. It does **not** judge whether an image/video itself is authentic.

## 4. Goals
1. Upload or paste supported content.
2. Extract text.
3. Extract factual (check-worthy) claims.
4. Search trusted sources for each claim.
5. Verify each claim with an LLM using retrieved evidence only.
6. Show a report with verdicts, explanations and citations.

## 5. Non-goals (later)
Browser extension · live-stream verification · deepfake / manipulation detection · social media integrations · PDFs · user accounts / history · frame-level OCR of video · multi-language UI · claim timeline view.

## 6. Users & core story
A reader/researcher/journalist pastes a link or drops a file, waits under a minute, and gets a list of the claims made with a clear verdict and links to the sources that support or refute each one.

## 7. Verdicts
| Verdict | Meaning | Chip |
|---|---|---|
| `SUPPORTED` | Evidence clearly supports the claim | green |
| `MISLEADING` | Partly true, missing context, outdated, or exaggerated | orange |
| `REFUTED` | Evidence clearly contradicts the claim | red |
| `INSUFFICIENT_EVIDENCE` | Retrieved evidence doesn't settle it | neutral gray |
| `ERROR` | Processing of this claim failed | neutral gray, outlined |

Every claim also gets a `confidence` (0–1) and a 1–3 sentence explanation that references evidence labels.

## 8. What counts as a factual claim
Included: statistics/numbers, dates, events that happened, attributed quotes, scientific/medical assertions, statements about laws/policies, records/rankings.
Excluded: opinions, predictions, questions, jokes, rhetorical statements, vague generalities, uncheckable personal experiences.
Max claims per job: `MAX_CLAIMS` (default 10), chosen by check-worthiness.

## 9. Functional requirements
- FR1 Detect input type automatically; reject unsupported input with a clear message.
- FR2 Show live processing stages and progress.
- FR3 Each claim shows: claim text, original quote, location (timestamp or paragraph), verdict chip, confidence, explanation, evidence cards.
- FR4 Each evidence card shows: title, domain, trust tier, published date (if known), snippet, stance (supports/refutes/context), link (new tab).
- FR5 Report header shows source title, type, link, and verdict counts.
- FR6 Result is reachable at a shareable unguessable URL (`/report/:id`).
- FR7 Uploaded files are deleted after extraction (MinIO lifecycle 24 h as backstop).

## 10. Non-functional requirements
- NFR1 End-to-end under **60 s** for: articles, images, YouTube with captions, MP4 ≤ 3 min (CPU). Longer media allowed up to 15 min without SLA.
- NFR2 Stateless API; heavy work in background workers via queue.
- NFR3 Cache identical searches (24 h).
- NFR4 Modular services, each with a single responsibility.
- NFR5 Rate limiting: 10 submissions/min/IP.
- NFR6 Runs on free tiers (Tavily, Gemini/OpenRouter) — respect their rate limits.

## 11. Success criteria
- End-to-end verification under 60 s (per NFR1 scope).
- Every non-insufficient verdict has ≥ 1 working evidence link.
- Swapping LLM or search provider = one provider class + env change.
- Golden set (docs/TESTING.md): ≥ 70 % verdict agreement with human labels; 0 verdicts citing non-existent evidence.

## 12. Disclaimer (shown in UI)
"Automated verification can be wrong. Review the cited sources before relying on a verdict."
