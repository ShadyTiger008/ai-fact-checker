# Veritas AI

AI-powered verification of claims in videos, articles and images — using retrieved evidence, not guesses.

- Product spec: [docs/PRD.md](docs/PRD.md)
- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Local setup: [docs/SETUP.md](docs/SETUP.md)
- Build plan: [docs/ROADMAP.md](docs/ROADMAP.md)
- Building with Claude Code: [docs/CLAUDE_CODE_PLAYBOOK.md](docs/CLAUDE_CODE_PLAYBOOK.md)

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm --filter @veritas/backend prisma migrate dev
pnpm dev   # http://localhost:3000
```

> Verdicts are automated and can be wrong. Always open the cited sources.
