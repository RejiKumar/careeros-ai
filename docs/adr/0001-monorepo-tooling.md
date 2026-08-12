# ADR-0001: Monorepo tooling

- Status: accepted
- Date: 2026-08-12

## Context

CareerOS AI ships an Expo React Native app, a FastAPI API, shared contracts/tokens, Supabase migrations, docs and CI from one repository. We need consistent tooling, caching and verification across workspaces.

## Decision

- **Package manager:** pnpm (workspaces via `pnpm-workspace.yaml`), with `node-linker=hoisted` for Expo compatibility.
- **Task orchestration:** Turborepo with `build`, `lint`, `typecheck`, `test`, `dev` tasks.
- **Mobile:** Expo SDK 57 (Expo Router, strict TypeScript), ESLint via `expo lint`, Prettier, `jest-expo` + Testing Library.
- **API:** FastAPI + pydantic v2 + pydantic-settings; `ruff` for lint/format; `pytest` for tests; `pyproject.toml`-driven.
- **Formatting:** Prettier for TypeScript/Markdown; ruff for Python.
- **Migrations:** append-only SQL under `supabase/migrations`, applied via Supabase CLI.

## Consequences

- One install/verify command surface for CI and contributors.
- Expo requires hoisted node_modules; this is enforced repo-wide via `.npmrc`.
- Python tooling is isolated per workspace (`.venv`) and does not use pnpm.
