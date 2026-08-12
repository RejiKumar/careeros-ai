# CareerOS AI — Repository Structure

```text
careeros-ai/
├── apps/
│   ├── mobile/
│   │   ├── app/                         # Expo Router routes only
│   │   ├── src/
│   │   │   ├── features/                # auth, onboarding, home, resume,
│   │   │   │                              # job-match, coach, billing, profile
│   │   │   ├── components/
│   │   │   ├── design-system/
│   │   │   ├── services/
│   │   │   └── lib/
│   │   ├── assets/
│   │   ├── app.config.ts
│   │   ├── eas.json
│   │   └── .env.example
│   └── api/
│       ├── app/
│       │   ├── core/
│       │   ├── modules/                 # profiles, resumes, assessments,
│       │   │                              # job_matching, coach, billing, usage
│       │   ├── integrations/            # Supabase, Gemini, stores, OpenAI future
│       │   ├── ai/
│       │   └── main.py
│       ├── tests/
│       ├── pyproject.toml
│       ├── Dockerfile
│       └── .env.example
├── packages/api-contract/
├── packages/config/
├── packages/design-tokens/
├── supabase/migrations/
├── docs/{adr,product,runbooks}/
├── scripts/
├── .github/workflows/
├── AGENTS.md
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── docker-compose.yml
├── pnpm-workspace.yaml
└── turbo.json
```

## Conventions

- Keep each feature’s UI, mapping, domain logic and tests together; avoid generic utility dumping grounds.
- Use `kebab-case` for TypeScript directories/files/endpoints and `snake_case` for Python modules.
- Version API contracts; breaking changes require a migration/compatibility plan.
- Route files compose feature screens; they do not contain business logic.
- Database migrations are append-only after any shared deployment.
- Never commit raw resumes, user content, credentials or production screenshots.

## Branching

Protect `dev`, `qa` and `prod`. Use short-lived `feat/`, `fix/`, `chore/` and `docs/` branches from `dev`, then promote tested work through `qa` to `prod`.
