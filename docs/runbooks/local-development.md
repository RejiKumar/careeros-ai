# Local Development Runbook

## Prerequisites

- Node.js 20+, pnpm 9+
- Python 3.12+, pip
- Docker + Docker Compose
- Supabase CLI (for local Supabase and migrations)

## Install

```bash
pnpm install
```

## API (FastAPI)

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Health check: `GET http://localhost:8000/health` and OpenAPI docs at `http://localhost:8000/docs`.

Checks:

```bash
ruff check .
ruff format --check .
pytest
```

Integration tests (`apps/api/tests/test_rls.py`) hit the live Supabase project
and require the `CAREEROS_SUPABASE_*` values in `apps/api/.env`; they skip when
unset. Run all tests with `pytest -q`.

## Database migrations and RLS

Migrations live in `supabase/migrations/` and are append-only. Apply them to a
Supabase project with the Supabase CLI (binary at `tools/supabase/supabase.exe`,
gitignored). The connection URL must come from `apps/api/.env`, never from a
hardcoded value:

```powershell
# PowerShell: build the URL from apps/api/.env (password not echoed)
$envContent = Get-Content apps/api/.env
$pw = (($envContent | Where-Object { $_ -match '^CAREEROS_SUPABASE_DB_PASSWORD=' }) -split '=', 2)[1].Trim()
$url = "postgresql://postgres:$([Uri]::EscapeDataString($pw))@db.<project-ref>.supabase.co:5432/postgres"
& tools\supabase\supabase.exe db push --db-url $url
```

Every table enables row-level security; user data is scoped with
`auth.uid() = user_id` policies, server-written tables (usage, entitlements,
immutable records) expose no client write policy, and resume files live in a
private `resumes` bucket under `<user_id>/` folders.

## API contract generation

The FastAPI OpenAPI schema is compiled into TypeScript types in
`packages/api-contract/src/generated/api.ts`. Regenerate after API changes:

```bash
pnpm contract:generate
```

## Monorepo checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

## Mobile (Expo)

```bash
cd apps/mobile
pnpm start
```

Checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Docker flow

```bash
docker compose up --build          # starts api (+ local postgres for development)
docker compose down
```

The API image build is documented in `apps/api/Dockerfile`. Real Supabase projects are not part of the local Docker flow; use the Supabase CLI for local Supabase and migrations:

```bash
supabase start
supabase db reset
```

## Environment setup

Copy example files and fill real values only in non-committed `.env` files:

- `apps/api/.env` ← `apps/api/.env.example`
- `apps/mobile/.env` ← `apps/mobile/.env.example`

Never commit real secrets. Mobile receives public configuration only.
