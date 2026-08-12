# Branch and Promotion Policy

## Environments

| Branch | Environment | Purpose                                          |
| ------ | ----------- | ------------------------------------------------ |
| `dev`  | dev         | Integration of completed work; daily development |
| `qa`   | qa          | Release-candidate verification before production |
| `prod` | prod        | Live user-facing release                         |

Each environment owns isolated Supabase project, API deployment, secrets, AdMob and purchase configuration. Configuration is flavor-aware (`dev`, `qa`, `prod`) in both the mobile app and the API.

## Workflow

1. All branches originate from `dev`: `feat/`, `fix/`, `chore/`, `docs/`.
2. Open a PR to `dev`. The PR must pass CI (format, lint, type check, unit and API tests, contract checks) and satisfy the `AGENTS.md` "Before merge" checklist.
3. After merge to `dev`, verified builds are promoted to `qa` via PR from `dev`.
4. `qa` validation passes → PR from `qa` to `prod` → release build.
5. Hotfixes branch from `prod`, merge back to `prod`, then to `qa` and `dev`.

## Rules

- `dev`, `qa` and `prod` are protected; direct pushes are not allowed.
- Database migrations are append-only once shared; never edit an applied migration.
- Breaking API contract changes require a migration/compatibility plan and a mobile-impact review before promotion.
- No real secrets may ever be committed. `.env.example` files are the only environment files committed.
- Promotion to `prod` requires evidence: passing CI, completed acceptance flows, and an explicit handoff note.

## Definitions of done per environment

- **dev**: CI green; unit and API tests pass; ownership/RLS tests for changed tables.
- **qa**: full acceptance coverage of onboarding, account upgrade, assessment, match, accepted rewrite, Pro gate and deletion request against `qa` configuration; closed-test readiness reviewed.
- **prod**: closed testing checklist satisfied; external-console tasks (Supabase, AdMob, purchases) completed and documented.
