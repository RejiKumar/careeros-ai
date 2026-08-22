## Context

See proposal.md — Why. Current state: mobile app has a themed shell (Home, Resume journey placeholder) with no networking, no auth, no file picking. The backend is live on `localhost:8000` with existing, tested `POST /resumes/import` (multipart `file` field, ≤10 MB) and `POST /resumes/{id}/assessments` endpoints; both require a Supabase JWT (`Authorization: Bearer`). Supabase URL + anon key exist in `apps/api/.env` and are public-safe.

## Goals / Non-Goals

**Goals:**

- Add `@supabase/supabase-js` email/password auth with secure session persistence and a route-level auth gate.
- Add a typed API client with Bearer auth and explicit state handling.
- Wire the Resume screen to pick, validate, upload and review a resume, then request and display the health score.
- Keep the design token / theme system, accessibility and test conventions already established in the app.

**Non-Goals:**

- No backend changes (endpoints consumed as-is).
- No social/SSO sign-in, no password reset flow, no guest mode (backend requires a user everywhere).
- No resume editing/rewrites/job-match/coach UI in this change.
- No icon/splash assets (separate change).

## Decisions

**D1: Supabase Auth via `@supabase/supabase-js` (JS-only client).**
The API only verifies JWTs; it has no login endpoint (`/auth/me` is the only auth route). Sign in/up must happen through Supabase Auth directly from the app. Alternatives considered: calling Supabase's REST endpoints manually (rejected — reimplements signing, session handling, expiry refresh). The anon key is public by design; RLS on the backend tables protects data. Persistence uses `expo-secure-store` (native module) rather than AsyncStorage because it stores the JWT.

**D2: Session flow.**
A small `AuthProvider` (React context) restores the session from secure storage on launch (one async restore call, explicit loading state at the root to avoid a flash of the wrong screen). API 401 responses clear the session and redirect to `/auth`. Sign out clears secure storage. Store only the Supabase session JSON; never log tokens.

**D3: Typed API client with explicit states.**
`src/services/api.ts` exposes `apiRequest` helpers and typed response parsers mirroring the API contract (`ResumeImportResponse`, `AssessmentResponse`, parsed `ResumeContent` types re-declared locally in TypeScript — the `@careeros/api-contract` package is for the API side; the mobile app maps its own DTOs). Every screen uses an explicit `status: "idle" | "loading" | "success" | "error"` state machine so empty/error/retry states are first-class (AGENTS.md requirement).

**D4: Import flow.**
`expo-document-picker` with `type: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"]`, then local checks: extension allow-list + `size ≤ 10 MB`. Upload via `FormData` with `{ uri, name, type }` (React Native multipart) to `POST /resumes/import`. Parsed result renders as reviewable cards. On failure: inline error + "Try again" re-uploading the same file.

**D5: Assessment flow.**
After a successful import, the Resume screen shows a "Get my health score" action calling `POST /resumes/{resume_id}/assessments`. The score view renders overall + per-dimension scores, strengths, gaps (with suggestion text), evidence, and a reviewability notice. Empty sections render as explicit empty states.

**D6: Device connectivity.**
The installed app is a release APK; the JS bundle is embedded at build time, so every code change needs `gradlew :app:assembleRelease` + reinstall. The device reaches the API through `adb reverse tcp:8000 tcp:8000`, so `EXPO_PUBLIC_API_URL=http://localhost:8000` works unchanged. Alternatives considered: LAN IP binding (rejected — requires firewall + API rebind; adb reverse is USB-only and safer).

## Risks / Trade-offs

- **Native dependency additions** (`expo-secure-store`, `expo-document-picker`) require a full native rebuild (~30 min) and reinstall; the old APK keeps working meanwhile. → Mitigation: bundle all feature work before the single rebuild.
- **`EXPO_PUBLIC_*` values are baked into the release bundle** — pointing at localhost means the APK only works with adb reverse active. → Mitigation: acceptable for dev; document that prod builds must set the real API URL.
- **Session expiry mid-flow** can happen while uploading (large files). → Mitigation: 401 handler clears session and routes to `/auth`; re-sign-in then retry.
- **AI latency** for parsing/scoring can be several seconds on mobile networks. → Mitigation: explicit loading states with non-blocking UI and copy explaining reviewable output.
- **Supabase anon key in the bundle** is public-safe, but any abuse would still hit RLS. → Mitigation: no service-role key ever enters mobile code or `.env`; RLS is enforced server-side.

## Migration Plan

1. Add dependencies (`supabase-js` + `expo install expo-secure-store expo-document-picker`).
2. Recreate `apps/mobile/.env` from `.env.example` with public values from `apps/api/.env`.
3. Implement auth (provider, `/auth` screen, gate), API client, import flow, score flow, tests.
4. Run typecheck, lint, jest.
5. Rebuild APK, install on device, `adb reverse`, verify end-to-end with the test account.

## Open Questions

None — remaining unknowns (exact copy text, spacing of score cards) are cosmetic and can be settled during implementation without changing specs.
