# CareerOS AI

An Android-first AI Career Companion built with Expo React Native, FastAPI and Supabase. Trustworthy career guidance, premium accessible UX, privacy and maintainability over feature count.

## Repository

This is a pnpm + Turborepo monorepo.

```text
apps/mobile         Expo React Native app (Android first, iOS later from the same codebase)
apps/api            FastAPI trusted API
packages/api-contract   Typed API contracts shared between API and mobile
packages/config     Shared lint/type configuration
packages/design-tokens  Design tokens for the mobile design system
supabase/migrations Database migrations (append-only)
docs                PRD, architecture, ADRs and runbooks
```

## Phase 1 documentation

- `docs/product/01-product-vision-prd.md` — product vision, MVP and monetisation.
- `docs/architecture/02-architecture-overview.md` — Expo, FastAPI, Supabase and AI design.
- `docs/architecture/03-repository-structure.md` — monorepo layout and engineering conventions.
- `AGENTS.md` — contribution rules for coding agents.
- `opencode-master-prompt.md` — build orchestration prompt.

## Prerequisites

- Node.js 20+ (verified on 24.x)
- pnpm 9+ (verified on 11.x)
- Python 3.12+ (verified on 3.14.x)
- Docker + Docker Compose
- Supabase CLI (for migrations and local Supabase)

## Quick start

```bash
pnpm install
pnpm dev        # runs mobile and api dev servers via turbo
```

See `docs/runbooks/branch-promotion-policy.md` for branch and promotion rules, and `docs/runbooks/local-development.md` for the local Docker flow.

## Status

Foundation (Milestone 0) in progress. This repository is not yet connected to a remote or any external service.
