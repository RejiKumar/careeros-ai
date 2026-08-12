# CareerOS AI API

FastAPI trusted API for CareerOS AI. Owns business rules, AI orchestration, usage limits and entitlement verification. Supabase owns identity, PostgreSQL, storage and row-level policy.

## Layout

```text
app/
  core/            configuration, errors, logging
  modules/         thin routers + services (profiles, resumes, assessments, ...)
  integrations/    Supabase, Gemini, stores (future OpenAI)
  ai/              provider-neutral CareerAiProvider + adapters
  main.py          application factory
tests/
```

## Develop

```bash
python -m venv .venv
.venv\Scripts\activate            # Windows; source .venv/bin/activate on POSIX
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Docs: http://localhost:8000/docs · Health: http://localhost:8000/health

## Checks

```bash
ruff check .
ruff format --check .
pytest
```

## Configuration

Copy `.env.example` to `.env` and fill real values locally. Only public configuration and `.env.example` are committed. Service-role and AI provider keys are server-only.

## Docker

```bash
docker build -t careeros-api .
docker run --rm -p 8000:8000 careeros-api
```
