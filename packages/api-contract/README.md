# @careeros/api-contract

Typed API contracts shared between the FastAPI backend and the Expo mobile app.

## Status

Milestone 0 scaffold. Real contracts arrive in Milestone 1 when the FastAPI OpenAPI document is published and generated into `src/generated/`. Generation is expected to be `openapi-typescript` (or an equivalent) driven by a script in `scripts/`.

## Convention

- Contracts are generated, append-only and versioned.
- Breaking contract changes require a migration/compatibility plan and a mobile-impact review.
- Mobile consumes the generated types only; the API must never depend on this package.
