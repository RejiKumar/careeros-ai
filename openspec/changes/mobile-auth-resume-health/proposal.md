## Why

The mobile app is a static shell: the intro card promises a reviewable resume health score, but every backend feature endpoint requires a signed-in Supabase user, and the app has no auth, no API client, and no file import. Users cannot reach any real functionality from their device.

## What Changes

- Add a Sign in / Create account screen backed by Supabase Auth (email + password), with session persistence via secure storage and an auth gate on app launch.
- Add a typed API client (fetch + Bearer JWT, base URL from `EXPO_PUBLIC_API_URL`) with explicit loading, error, retry and offline states.
- Wire the Resume Health screen to real backend calls: document picker (PDF/DOCX/TXT, ≤10 MB), `POST /resumes/import`, and `POST /resumes/{id}/assessments`.
- Show the parsed resume and the AI health score (dimensions, strengths, gaps with suggestions, evidence) as reviewable output.
- Replace the placeholder "Import is coming next" notice with the real import flow.
- Add the missing dependencies: `@supabase/supabase-js`, `expo-secure-store`, `expo-document-picker`.

## Capabilities

### New Capabilities

- `mobile-auth`: Email/password sign in and account creation against Supabase Auth, session persistence and restore on launch, and app-level routing gated on session state.
- `resume-import`: Document picking with extension/size validation, authenticated multipart upload to the API, and reviewable display of the parsed resume with explicit loading/error/empty states.
- `resume-health-score`: Triggering and displaying the AI health assessment (per-dimension scores 0-100, strengths, gaps with suggestions, evidence), clearly presented as reviewable AI output.

### Modified Capabilities

<!-- No existing specs yet; none modified. -->

## Impact

- **Mobile app**: new routes (`/auth`, updated `/resume`), `src/services/api.ts`, `src/features/auth/*`, `src/features/resume/*`, theme re-use from `@careeros/design-tokens`, tests for all new UI.
- **Dependencies**: `@supabase/supabase-js`, `expo-secure-store`, `expo-document-picker` (two are native — requires an Android rebuild of the installed app).
- **Configuration**: `apps/mobile/.env` recreated from `.env.example` with `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public values only; never service-role keys).
- **Backend**: no API changes; existing `POST /resumes/import` and `POST /resumes/{id}/assessments` are used as-is.
- **Device workflow**: install via `adb`, API reachable through `adb reverse tcp:8000 tcp:8000`.
