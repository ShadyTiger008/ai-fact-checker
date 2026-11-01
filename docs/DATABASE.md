# Database (PostgreSQL + Prisma)

Schema file: `apps/api/prisma/schema.prisma`. Table names match the PRD: `jobs`, `documents`, `claims`, `evidence`, `verification_results`.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum InputType {
  YOUTUBE
  ARTICLE
  VIDEO
  IMAGE
}

enum JobStatus {
  QUEUED
  EXTRACTING
  EXTRACTING_CLAIMS
  VERIFYING
  REPORTING
  COMPLETED
  FAILED
}

enum Verdict {
  SUPPORTED
  REFUTED
  MISLEADING
  INSUFFICIENT_EVIDENCE
  ERROR
}

enum TrustTier {
  HIGH
  MEDIUM
  UNKNOWN
  LOW
}

model Job {
  id               String     @id @default(uuid()) @db.Uuid
  inputType        InputType  @map("input_type")
  sourceUrl        String?    @map("source_url")
  uploadKey        String?    @map("upload_key")
  originalFilename String?    @map("original_filename")
  status           JobStatus  @default(QUEUED)
  progress         Int        @default(0)
  errorCode        String?    @map("error_code")
  errorMessage     String?    @map("error_message")
  report           Json?
  startedAt        DateTime?  @map("started_at")
  completedAt      DateTime?  @map("completed_at")
  createdAt        DateTime   @default(now()) @map("created_at")
  updatedAt        DateTime   @updatedAt @map("updated_at")

  document Document?
  claims   Claim[]

  @@index([status, createdAt])
  @@map("jobs")
}

model Document {
  id               String    @id @default(uuid()) @db.Uuid
  jobId            String    @unique @map("job_id") @db.Uuid
  title            String?
  author           String?
  siteName         String?   @map("site_name")
  publishedAt      DateTime? @map("published_at")
  language         String?
  durationSec      Int?      @map("duration_sec")
  extractionMethod String    @map("extraction_method") // readability|cheerio|captions|whisper|ocr
  rawText          String    @map("raw_text")
  normalizedText   String    @map("normalized_text")
  segments         Json      // [{ index, text, start?, end? }]
  charCount        Int       @map("char_count")
  truncated        Boolean   @default(false)
  createdAt        DateTime  @default(now()) @map("created_at")

  job Job @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@map("documents")
}

model Claim {
  id              String   @id @default(uuid()) @db.Uuid
  jobId           String   @map("job_id") @db.Uuid
  position        Int      // display order, 0-based
  text            String
  quote           String?
  locator         Json?    // { segmentIndex, startSec? }
  category        String
  checkworthiness Float
  searchQueries   String[] @map("search_queries")
  createdAt       DateTime @default(now()) @map("created_at")

  job      Job                 @relation(fields: [jobId], references: [id], onDelete: Cascade)
  evidence Evidence[]
  result   VerificationResult?

  @@unique([jobId, position])
  @@index([jobId])
  @@map("claims")
}

model Evidence {
  id          String    @id @default(uuid()) @db.Uuid
  claimId     String    @map("claim_id") @db.Uuid
  label       String    // E1..E5
  url         String
  domain      String
  title       String
  snippet     String
  publishedAt DateTime? @map("published_at")
  searchScore Float     @map("search_score")
  trustTier   TrustTier @map("trust_tier")
  rankScore   Float     @map("rank_score")
  createdAt   DateTime  @default(now()) @map("created_at")

  claim Claim @relation(fields: [claimId], references: [id], onDelete: Cascade)

  @@unique([claimId, label])
  @@index([claimId])
  @@map("evidence")
}

model VerificationResult {
  id            String   @id @default(uuid()) @db.Uuid
  claimId       String   @unique @map("claim_id") @db.Uuid
  verdict       Verdict
  confidence    Float
  explanation   String
  citations     Json     // [{ evidenceId, label, stance, quote }]
  model         String?
  promptVersion String?  @map("prompt_version")
  latencyMs     Int?     @map("latency_ms")
  errorMessage  String?  @map("error_message")
  createdAt     DateTime @default(now()) @map("created_at")

  claim Claim @relation(fields: [claimId], references: [id], onDelete: Cascade)

  @@map("verification_results")
}
```

## Rules
- Migrations: `pnpm --filter @veritas/api prisma migrate dev --name <change>`. Never edit an applied migration.
- Idempotency: workers may retry. Use `upsert` / delete-then-insert inside a transaction for a claim's evidence and result; `createMany` claims only if none exist for the job.
- Job status updates go through `JobsRepository.transition(jobId, from[], to)` which uses `updateMany where status in from` — prevents a late retry from moving a COMPLETED job backwards.
- Retention (later): cron deleting jobs older than 30 days (cascades).
