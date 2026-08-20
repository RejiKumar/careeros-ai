## 1. Database migrations

- [x] 1.1 Migration: add nullable `guest_id` + `guest_accounts` table (id, created_at) with RLS enabling guest-scoped access on resume/job/coach/roast rows
- [x] 1.2 Migration: `feedback` table (output_type, output_id, rating, reason, user_id nullable, guest_id nullable, unique per output per identity) with RLS
- [x] 1.3 Migration: `achievements` (definitional seed rows: ATS Warrior, Resume Master, Interview Ready, 7-Day Streak, Perfect Score) + `user_achievements` with RLS
- [x] 1.4 Migration: `roasts`, `interview_sessions`, `interview_questions`, `interview_answers` tables with RLS and indexes
- [x] 1.5 Migration test: allowed/denied RLS cases for guest and owned rows

## 2. Backend: AI provider additions

- [x] 2.1 Add roast/interview JSON schemas + prompts to `app/ai/gemini.py` (mode-constrained, no-abuse rule, schema-validated)
- [x] 2.2 Add `CareerAiProvider` methods `roast_resume` and `generate_interview` + `evaluate_answer` with provider adapter tests (fixtures)
- [x] 2.3 Update `app/ai/provider.py` interface and ensure the OpenAI seam stays untouched

## 3. Backend: feedback module

- [x] 3.1 `feedback` module: router + service (upsert rating, latest-wins, auth or guest identity) with API tests incl. ownership/401
- [x] 3.2 Wire feedback reference ids into coach message, match, assessment, roast and rewrite responses

## 4. Backend: roast module

- [x] 4.1 `roast` module: `POST /roasts` (resume_id, mode), validates parsed resume exists, returns schema-validated roast ending in improvements
- [x] 4.2 Roast API tests: success per mode, missing-resume 404, provider-failure 502

## 5. Backend: wrapped module

- [x] 5.1 `wrapped` module: `GET /wrapped` aggregating latest score, strongest skill, biggest gap, level and achievements (no AI call)
- [x] 5.2 Wrapped API tests: aggregation correctness, ownership, empty-data response

## 6. Backend: interview module

- [x] 6.1 `interviews` module: create session (mode, resume_id?, target_job?, target_skills?), list/get session, question generation
- [x] 6.2 `interviews` module: submit answer → evaluation (relevance, clarity, structure, correctness, completeness) + guidance disclosure flag
- [x] 6.3 Interview API tests: session lifecycle, ownership, generation and evaluation paths

## 7. Backend: achievements

- [x] 7.1 `achievements` logic in missions service: `evaluate_achievements(user)` after mission complete, resume import, health score, job match, interview evaluation
- [x] 7.2 `GET /achievements` endpoint + include earned achievements in `DashboardResponse`
- [x] 7.3 Backfill task: migration-time award from existing rows (imports/scores/matches/streaks)
- [x] 7.4 Achievements tests: award conditions, idempotency, streak logic

## 8. Backend: guest migration

- [x] 8.1 Guest identity dependency in `app/core/auth.py` (accept verified JWT or UUIDv4 `X-Guest-Id` with rate limit)
- [x] 8.2 `POST /auth/migrate-guest` endpoint: ownership flip for guest rows to the authenticated user, idempotent, transactional
- [x] 8.3 Guest + migration API tests: valid/invalid guest id, migration idempotency, ownership paths

## 9. Mobile: guest mode

- [x] 9.1 `AuthProvider` guest status + SecureStore guest id; "Continue as guest" on `/auth`
- [x] 9.2 API client guest branch (`X-Guest-Id` header) for resume/job-match/coach/roast endpoints
- [x] 9.3 Guest banner on dashboard + guest-safe empty/error states; migration UI after sign-in with retry
- [x] 9.4 Component tests for guest flow and migration failure/success

## 10. Mobile: feedback controls

- [x] 10.1 Reusable FeedbackControl component (Helpful / Not helpful + reason picker) 
- [x] 10.2 Wire into score, match result, coach message and roast outputs; API client `submitFeedback`
- [x] 10.3 Component tests: rating, reason skip, change rating

## 11. Mobile: roast screen

- [x] 11.1 `/roast` route + screen (mode picker, output with improvements section, empty state without resume, error/retry)
- [x] 11.2 Roast screen tests

## 12. Mobile: wrapped screen

- [x] 12.1 `/wrapped` route + screen with per-data-point opt-in toggles and generated summary
- [x] 12.2 Share as image (react-native-view-shot + expo-sharing) with text fallback
- [x] 12.3 Wrapped screen tests

## 13. Mobile: interview coach

- [x] 13.1 `/interview` route + session setup (mode, optional job/skills), question list, answer input
- [x] 13.2 Evaluation display with guidance disclosure; API client methods
- [x] 13.3 Interview screen tests

## 14. Mobile: achievements + chat conveniences

- [x] 14.1 Achievements section in profile (earned/unearned with dates); API client `getAchievements`
- [x] 14.2 Coach: suggested prompts, copy (expo-clipboard), regenerate, guidance disclosure
- [x] 14.3 Tests for achievements display and chat conveniences

## 15. Verification & docs

- [x] 15.1 Full test suites: API pytest + mobile jest + tsc + lint + ruff
- [x] 15.2 Update `docs/careeros_ai_specs/milestones.md` progress and README feature matrix
- [x] 15.3 On-device verification over WiFi for guest flow, roast, wrapped, interview and feedback
