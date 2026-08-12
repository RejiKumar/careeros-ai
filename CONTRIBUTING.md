# Contributing to CareerOS AI

## Getting started

1. Read the PRD, architecture and repository-structure documents in `docs/`.
2. Read `AGENTS.md` — the agent working agreement applies to every change.
3. Create a short-lived branch from `dev`: `feat/`, `fix/`, `chore/` or `docs/`.
4. Make focused changes; do not reformat unrelated files.

## Branch and promotion policy

Work is merged to `dev`, promoted through `qa` and released from `prod`. Details and gates are in `docs/runbooks/branch-promotion-policy.md`.

## Verification before merge

| Change                 | Required minimum                                   |
| ---------------------- | -------------------------------------------------- |
| Mobile UI/hook         | component/unit test and lint/type check            |
| Backend use case/route | unit plus API/integration test                     |
| Migration/RLS          | migration test plus allowed/denied ownership cases |
| AI parser              | schema and adapter fixture tests                   |
| Auth/purchase work     | success, invalid/expired and ownership paths       |

Run the repository-documented commands only and report actual results. Never claim a build, deployment, remote repository, store submission or account action without evidence.

## Commands

```bash
pnpm install       # install workspace dependencies
pnpm lint          # lint all workspaces
pnpm typecheck     # type-check all workspaces
pnpm test          # run all workspace tests
pnpm format:check  # prettier check
```

API checks run with `ruff` and `pytest` inside `apps/api` (see `apps/api/README.md`).

## Data safety

Never log tokens, raw resumes, full prompts, email addresses or payment payloads. Never commit real secrets or user content. Update `.env.example` when public configuration changes.

## Merging

- Scope must match an accepted requirement.
- Tests/checks pass.
- Accessibility and error states exist.
- API changes have a contract/mobile impact review.
- No private data entered the change.
- Relevant docs/ADRs are updated.
