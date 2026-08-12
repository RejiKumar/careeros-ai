# CareerOS AI — Agent Working Agreement

## Mission

Build an Android-first AI Career Companion with Expo React Native, FastAPI and Supabase. Prioritize trustworthy career guidance, premium accessible UX, privacy and maintainability over feature count.

## Product rules

- Never fabricate facts in a resume, assessment, rewrite or coach reply.
- AI output is reviewable before becoming user content.
- Never include provider keys, Supabase service-role keys, purchase secrets or other private credentials in mobile code, Git or logs.
- Enforce user ownership in FastAPI and Supabase RLS.
- Preserve guest work when upgrading an account where supported.
- Support system/light/dark theme, accessible contrast and reduced motion.

## Architecture rules

- Strict TypeScript and typed public API contracts; avoid `any` and untyped boundary JSON.
- Mobile routes compose screens; feature application/domain layers hold business logic.
- FastAPI routers stay thin; services own use cases, repositories persistence, integrations provider SDK code.
- Gemini must remain behind `CareerAiProvider`; do not leak provider types into domain code. Keep an OpenAI adapter seam.
- Make loading, empty, error, retry and offline/draft states explicit.
- Reuse design-system tokens/primitives. Aurora/glass effects are enhancement, never the sole readable surface.
- Make focused changes; do not reformat unrelated files.

## Verification

| Change | Required minimum |
| --- | --- |
| Mobile UI/hook | component/unit test and lint/type check |
| Backend use case/route | unit plus API/integration test |
| Migration/RLS | migration test plus allowed/denied ownership cases |
| AI parser | schema and adapter fixture tests |
| Auth/purchase work | success, invalid/expired and ownership paths |

Run repository-documented commands only and report actual results. Never claim a build, deployment, remote repository, store submission or account action without evidence.

## Data safety

Never log tokens, raw resumes, full prompts, email addresses or payment payloads. Validate extension, MIME type, size and parsed output for uploads. Treat resumes, job descriptions and model output as untrusted. Update `.env.example` when public configuration changes, and raise privacy/billing/policy ambiguity instead of guessing.

## Before merge

Confirm scope matches an accepted requirement; tests/checks pass; accessibility and error states exist; API changes have a contract/mobile impact review; no private data entered the change; and relevant docs/ADRs are updated.
