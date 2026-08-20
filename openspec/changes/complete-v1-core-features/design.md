## Context

The mobile app (Expo + expo-router, typed API client in `src/services/api.ts`) now covers auth, resume health, job match, coach chat, missions and profile against a FastAPI backend whose modules live under `apps/api/app/modules/`. The AI layer is already provider-agnostic (`CareerAiProvider` with `GeminiProvider`, seeded for an `OpenAIProvider`). Gamification exists as missions/XP/levels (`missions` module + `DashboardResponse`). See proposal.md — Why for motivation.

This change adds seven capabilities: guest mode, AI feedback, resume roast, resume wrapped, interview coach, achievements, and chat conveniences.

## Goals / Non-Goals

**Goals:**
- Add guest identity without weakening the existing Supabase JWT path (all guest endpoints must still be authorization-checked).
- Reuse `CareerAiProvider` for roast, wrapped and interview generation — no provider-specific code outside integrations.
- Reuse the missions/XP event machinery for achievements instead of a parallel gamification stack.
- Keep all new features reviewable-AI-first and privacy-preserving (no resume text in feedback or wrapped defaults).

**Non-Goals:**
- Streaming chat (SSE) — deferred; the coach API remains request/response this iteration.
- AdMob, subscriptions purchase flow, analytics SDKs and notifications — require external accounts (AdMob/Firebase/Play Billing) and stay behind documented adapter boundaries.
- Voice interview, career roadmap, application tracker (spec V1.2).

## Decisions

### 1. Guest identity: local session + server guest id (client-generated)
Guests get a `guest_id` (UUID) persisted in SecureStore alongside a `guest` flag. The mobile API client sends `X-Guest-Id` for guest-scoped calls; server endpoints that support guests accept either a verified JWT (authenticated) or a valid `guest_id` (verified format + rate-limited). Migration: `POST /auth/migrate-guest` with the `guest_id` + fresh JWT transfers ownership of guest-owned rows to the user id, idempotently (`ON CONFLICT DO NOTHING` / per-row ownership flip), then the client clears the guest id.

Rationale: server-issued guest identities would require an anonymous-auth flow on Supabase; client-generated UUIDs with server-side validation are simpler and sufficient because guest data is local-first and low-value. Alternative (Supabase anonymous sign-ins) rejected: adds provider coupling and a second identity lifecycle for little benefit.

### 2. Feedback: one table, reference-keyed
`feedback` table: `id, user_id (nullable for guests), output_type, output_id, rating ('helpful'|'not_helpful'), reason (nullable), created_at, updated_at`, unique on `(user_id, guest_id, output_type, output_id)` — upsert keeps one rating per output. `output_id` references the AI artifact (assessment id, match id, message id, roast id, rewrite batch id); no content stored. Feedback endpoints under `POST /feedback`.

Rationale: storing content would violate the spec's privacy rule; references are sufficient for quality analysis. Unique constraint gives the "latest rating wins" behavior for free.

### 3. Roast, wrapped, interview: new modules over CareerAiProvider
Three new FastAPI modules (`roast`, `wrapped`, `interviews`) following the existing thin-router/service pattern:
- `roast`: `POST /roasts` with `{resume_id, mode}` → schema-validated `RoastContent {title, sections[], improvements[]}` (JSON-schema constrained via the provider's `responseSchema` machinery, mirroring `_assessment_json_schema`).
- `wrapped`: `GET /wrapped?resume_id=` — pure aggregation of existing data (latest score, top skill from parsed resume, biggest gap, level, achievements) with an optional share image; no AI generation needed beyond data selection (avoids per-user AI cost). Shareable image via `react-native-view-shot` + `expo-sharing`.
- `interviews`: `POST /interviews/sessions` (mode, resume_id?, target_job?, target_skills?) → question generation; `POST /interviews/sessions/{id}/answers` → schema-validated evaluation per answer (relevance/clarity/structure/correctness/completeness). Provider output validated before return, mirroring coach.

Rationale: aggregation-only wrapped keeps cost near zero; the spec only requires the summary from existing data. Alternative (AI-generated wrapped prose) rejected: unnecessary cost and variance for a data-display feature.

### 4. Achievements: declarative rules in the missions service
Achievements live in a new `achievements` table (definitional rows seeded by migration) + `user_achievements` (earned rows). The missions service gains an `evaluate_achievements(user)` step invoked after mission completion, resume import, health score, job match and interview evaluation — each event type maps to achievement keys (e.g., first health score → `resume-master`; 7-day streak from `user_missions` history → `streak-7`). `DashboardResponse` and a new `GET /achievements` expose earned/unearned with dates.

Rationale: achievements are a read-mostly feature; computing them on event write (not on read) keeps reads cheap and avoids a background worker this iteration. Alternative (cron/worker evaluation) rejected as over-engineering for the scale.

### 5. Guest mode in the app: auth state machine
`AuthProvider` gains a `guest` status alongside `signedOut`/`signedIn`. `RootNavigator` redirects: no identity → `/auth` (sign in or Continue as guest); guest → dashboard (guest banner). Resume/job-match/coach screens already key on `session?.access_token` — they gain a parallel guest branch passing `X-Guest-Id`. Migration UI on `/auth` after sign-in: if a guest id exists, call `POST /auth/migrate-guest` and show a progress/error state (data intact on failure).

### 6. Chat conveniences: client-side only
Suggested prompts (static, local), copy (`expo-clipboard`), regenerate (re-send the last user message via the existing `POST /threads/{id}/messages`, replacing the last assistant message optimistically), guidance disclosure (persistent notice in the thread header). No backend changes required.

## Risks / Trade-offs

- [Guest endpoints can be abused via forged `X-Guest-Id`] → guest ids are UUIDv4-only (rejected otherwise), rate-limited, and never reference another user's data; migration requires a valid JWT, so guest data can only move to the authenticating user.
- [Achievements computed on event write can miss historical events] → migration backfills `user_achievements` from existing rows (imports/scores/matches/streaks); future events evaluate incrementally.
- [Roast tone drift into abusive content] → system prompts constrain all modes with explicit no-abuse rules (mirrors existing prompt discipline) plus schema-validated output; abusive modes are blunt-but-constructive by prompt contract.
- [Wrapped share image rendering] → view-shot of a fixed-layout card is deterministic; failure path falls back to sharing the summary text.
- [Migration (guest→account) partial failure mid-way] → per-resource ownership flip with retry-safe upserts; the client keeps the guest id until the endpoint confirms completion.

## Migration Plan

1. Supabase migrations (additive, deploy first): `guest_accounts`, `feedback`, `achievements`, `user_achievements`, `interview_sessions`, `interview_questions`, `interview_answers`, `roasts`, `wrapped_shares` (if persisted), ownership columns on existing tables (`owner_user_id` stays; `guest_id` nullable column added where guest access is allowed).
2. Backend modules in order: feedback → roast → interviews → wrapped → achievements → guest migration endpoint.
3. Mobile in order: auth guest state → guest API branch → new screens (roast, wrapped, interview, achievements in profile) → chat conveniences → feedback controls on existing output cards.
4. Rollback: server modules are additive routes; mobile flags gate new screens behind the guest/feedback capabilities; no breaking changes to existing endpoints.

## Open Questions

- Whether wrapped summaries should be persisted server-side (for history) or generated on demand — deferred; on-demand satisfies the spec.
- Roast share/copy behavior beyond viewing — deferred to implementation without spec impact.
