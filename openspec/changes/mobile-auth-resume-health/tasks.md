## 1. Setup & Dependencies

- [x] 1.1 Add `@supabase/supabase-js` and install `expo-secure-store` + `expo-document-picker` via `npx expo install` in `apps/mobile`
- [x] 1.2 Recreate `apps/mobile/.env` from `.env.example` with `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public values from `apps/api/.env`, never service-role)
- [x] 1.3 Add local TypeScript DTOs for the API contract (`ResumeImportResponse`, `ResumeContent`, `AssessmentResponse`, auth error shapes)

## 2. Auth Capability

- [x] 2.1 Implement Supabase client factory (`src/services/supabase.ts`) reading `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY`
- [x] 2.2 Implement session storage adapter over `expo-secure-store` (save/load/clear, no token logging)
- [x] 2.3 Implement `AuthProvider` (context): restore session on launch with explicit root loading state, signIn/signUp/signOut actions, sign-out on API 401
- [x] 2.4 Implement `/auth` screen (`app/auth.tsx` + `src/features/auth/presentation/AuthScreen.tsx`): email/password forms with validation, inline errors, loading and retry states
- [x] 2.5 Add route-level auth gate in `app/_layout.tsx` (no session → `/auth`, restored session → home)
- [x] 2.6 Add tests for `AuthScreen` and `AuthProvider` (sign in success/invalid/empty, restore, sign out)

## 3. Resume Import Capability

- [x] 3.1 Implement typed API client (`src/services/api.ts`): base URL from env, `Authorization: Bearer`, JSON + multipart helpers, 401 handling hook
- [x] 3.2 Wire document picking into the Resume screen: `expo-document-picker` restricted to PDF/DOCX/TXT, cancel handling
- [x] 3.3 Implement local validation (extension allow-list, size ≤ 10 MB) with inline error states
- [x] 3.4 Implement upload+parse flow: `FormData` multipart to `POST /resumes/import` with loading state
- [x] 3.5 Render parsed resume as reviewable cards (contact, summary, skills, experience, education) with explicit empty/error/retry states
- [x] 3.6 Add tests for validation and the import flow state machine (success, failure, oversize, unsupported type, cancelled picker)

## 4. Health Score Capability

- [x] 4.1 Implement assessment trigger: `POST /resumes/{id}/assessments` with loading state on the Resume screen
- [x] 4.2 Render the score view: overall + per-dimension scores, strengths, gaps with suggestions, evidence, reviewability notice, explicit empty states
- [x] 4.3 Add tests for score rendering (full result, missing sections, failure + retry)

## 5. Google Sign In

- [x] 5.1 Install `expo-auth-session`, `expo-web-browser`, `expo-crypto` and register the OAuth redirect scheme
- [x] 5.2 Implement `googleSignIn` in `AuthProvider` (OAuth session URL via `signInWithOAuth`, browser session, `exchangeCodeForSession`, secure storage)
- [x] 5.3 Add "Continue with Google" button to `AuthScreen` with loading/error/cancel handling
- [x] 5.4 Add tests for the Google button flow and update auth tests

## 6. Verification & Device Install

- [x] 6.1 Run typecheck, expo lint and jest for `apps/mobile`; all green
- [x] 6.2 Run `gradlew :app:assembleRelease` and install the split APK on the personal device
- [ ] 6.3 Set up `adb reverse tcp:8000 tcp:8000` and verify end-to-end with the test account: sign in, import a PDF, view parsed resume, get health score
