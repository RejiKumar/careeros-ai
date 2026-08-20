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
openspec/changes    OpenSpec change proposals (requirements, design, tasks)
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

## Mobile app

### Screens

| Route | Screen | Purpose |
| --- | --- | --- |
| `/` (Home tab) | Dashboard | Career overview: resume score, XP/level, match score, streak, missions, quick actions |
| `/auth` | Auth | Email/password sign in, sign up, Google OAuth, and continue as guest |
| `/resume` | Resume Health | Import a resume (PDF/DOCX/TXT), review parsed content, view AI health score |
| `/job-match` | Job Match | Paste a job description, run compatibility analysis against resume |
| `/coach` | AI Career Coach | Context-aware chat with suggested prompts, copy, regenerate, guidance disclosure |
| `/profile` | Profile | Account info, plan usage, achievements, password reset, sign out, delete account |
| `/missions` | Missions | Daily/weekly missions with XP rewards |
| `/rewrites` | Rewrites | AI improvement suggestions with accept -> new version |
| `/roast` | Resume Roast | 5 roast modes (Friendly Mentor, Professional HR, Brutal HR, Funny Roast, Robot Recruiter) |
| `/wrapped` | Resume Wrapped | Shareable career summary with per-data-point opt-in toggles |
| `/interview` | Interview Coach | Practice sessions (HR/Technical/Behavioral/Manager/Startup/Custom) with 5-dimension evaluation |

### Feature capabilities

- **Guest mode** — Use the app without an account; guest data persists in SecureStore and migrates to an account on sign-in.
- **Mobile auth** — email/password sign in/account creation and Google OAuth (system browser, PKCE, code exchange), session persisted in secure storage, automatic restore on launch, sign out, and session-expiry handling (API 401 returns to the auth screen).
- **Resume import** — system document picker restricted to PDF/DOCX/TXT, local size validation (10 MB limit), authenticated multipart upload to `POST /resumes/import`, and reviewable display of the parsed resume with explicit loading/error/retry/empty states.
- **Resume health score** — triggers `POST /resumes/{id}/assessments` and renders the overall and per-dimension scores (0-100), strengths, gaps with suggestions, and evidence. AI output is always labeled reviewable and never presented as fact.
- **Job match** — paste a job description, run AI compatibility analysis, view matched/missing skills, strengths, and actionable recommendations.
- **AI career coach** — chat with context from resume and job descriptions, suggested prompts, copy messages, regenerate replies, guidance disclosure that AI output is not verified career advice.
- **Rewrites** — AI-generated improvement suggestions for resume sections; accept to create a new resume version.
- **Resume roast** — 5 entertaining roast modes that always end with actionable improvements; no abusive or discriminatory content.
- **Resume Wrapped** — shareable career summary with opt-in data points (score, skills, achievements); share as image or text fallback.
- **Interview coach** — create practice sessions by mode (HR, Technical, Behavioral, Manager, Startup, Custom), submit answers, receive 5-dimension evaluation (relevance, clarity, structure, technical correctness, completeness) with guidance disclosure.
- **Feedback** — Helpful/Not helpful on every AI output with optional reason; latest-wins, one per output per user.
- **Gamification** — XP, levels, daily missions, streaks, and 5 achievements (ATS Warrior, Resume Master, Interview Ready, 7-Day Streak, Perfect Score).
- **Achievements** — displayed in profile with earned dates and unearned conditions.
- **Design system** — Aurora background, glass components, gradient buttons, score rings, icon chips, screen headers, light/dark/system theme, accessible contrast.
- **Localization** — all user-facing strings extracted to `src/i18n/en.ts` with a `t()` translation hook. Ready for additional languages.

### Mobile development

```bash
cd apps/mobile
npx tsc --noEmit        # typecheck
npx expo lint           # lint
npx jest                # component/unit tests
```

### Backend development

```bash
cd apps/api
.\.venv\Scripts\python.exe -m pytest          # run all tests
.\.venv\Scripts\python.exe -m ruff check app tests   # lint
```

Android split APK (arm64-v8a, release, debug-signed for sideloading):

```bash
cd apps/mobile/android
gradlew.bat :app:assembleRelease
# output: app/build/outputs/apk/release/app-arm64-v8a-release.apk
adb install -r app/build/outputs/apk/release/app-arm64-v8a-release.apk
adb reverse tcp:8000 tcp:8000   # device -> local API on this PC
```

> Note: `android/` is generated by `expo prebuild`; the ABI splits block in `app/build.gradle` must be re-applied after a prebuild. The release build embeds `EXPO_PUBLIC_*` values from `apps/mobile/.env` (public values only — never service-role keys).

### Mobile configuration

`apps/mobile/.env` (gitignored) is recreated from `.env.example`:

- `EXPO_PUBLIC_API_URL` — API base URL (e.g. `http://localhost:8000` with `adb reverse`)
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` — public Supabase config (anon key only)
- `EXPO_PUBLIC_ADMOB_*` — AdMob app IDs and ad unit IDs (see `.env.example` for test IDs)

### Google sign-in setup (Supabase dashboard)

For "Continue with Google" to work, the Supabase project must have the Google provider enabled:

1. Supabase dashboard -> Authentication -> Providers -> Google: enable and set the OAuth client ID/secret (from Google Cloud Console).
2. Add the app's redirect URL to the provider's **Redirect URLs** (and `Site URL`): `careerosdev://` (the app scheme from `app.config.ts`; exact URL is `careerosdev://` for standalone builds).
3. The OAuth flow is PKCE-based (`expo-auth-session` + `expo-web-browser`); no client secret is embedded in the app.

## Requirements & milestones

All functional requirements live in OpenSpec changes under `openspec/changes/` (each contains `proposal.md`, `specs/`, `design.md`, `tasks.md`). Specs are synced to `openspec/specs/` when a change is archived.

| Milestone | Status | Change |
| --- | --- | --- |
| M0 — Foundation | Complete | repo, design tokens, API + Supabase schema, contracts |
| M1 — Auth, resume import & health score | Complete | `openspec/changes/mobile-auth-resume-health` |
| M2 — Rewrites, coach, job match | Complete (backend + mobile) | `openspec/changes/complete-v1-core-features` |
| M3 — Roast, wrapped, interview, achievements, guest, feedback | Complete (backend + mobile) | `openspec/changes/complete-v1-core-features` |

## Test coverage

| Area | Tests | Status |
| --- | --- | --- |
| Backend API (pytest) | 192 | All passing |
| Mobile component/unit (jest) | 40 | All passing |
| TypeScript (tsc --noEmit) | — | Clean |
| Lint (expo lint + ruff) | — | Clean |

## Status

V1 core features are fully implemented across backend and mobile: guest mode, auth, resume import/health, job match, AI coach with conveniences, rewrites, roast, wrapped, interview, feedback, achievements, and gamification. Localization system in place with all strings extracted. Modern UI redesign complete (Aurora background, gradient buttons, score rings, icon chips). Backend has 192 passing tests; mobile has 40 passing tests.

## Pending items for production

| Item | Priority | Notes |
| --- | --- | --- |
| AdMob integration | High | Environment placeholders exist; SDK not installed. Install `react-native-google-mobile-ads`, configure banner/interstitial ads |
| Gemini rate limit handling | High | Added exponential backoff for 429s; free tier quota (20 req/day) is a billing concern |
| EAS Build setup | High | Required for Play Store submission (`eas build`, `eas submit`) |
| App signing (Play Store) | High | Generate upload key, configure Google Play App Signing |
| Play Store listing | High | Store description, screenshots, feature graphic, content rating |
| Privacy policy & ToS | High | Required for Play Store compliance |
| Skeletons & haptics | Medium | Design system completeness (M3 scope) |
| Streaming AI responses | Medium | Non-streaming works; streaming for real-time coach/interview |
| Firebase Analytics + Crashlytics | Medium | Error monitoring, user behavior tracking |
| FCM push notifications | Medium | Career reminders, mission reminders |
| CI/CD (GitHub Actions) | Medium | Automated testing, build, deployment pipeline |
| Additional languages | Low | i18n infrastructure ready; add `hi.ts`, `ml.ts`, etc. |

## Play Store preparation steps

1. **EAS account**: Sign up at [expo.dev](https://expo.dev), create a project, link to this repo
2. **App signing**: Generate an upload key (`keytool -genkeypair`), configure in `eas.json` or Google Play Console
3. **EAS Build**: Run `eas build --platform android --profile production` to create an AAB (Android App Bundle)
4. **Store listing**: Write description, add screenshots (phone + tablet), upload feature graphic (1024x500)
5. **Content rating**: Complete the IARC questionnaire in Play Console
6. **Privacy policy**: Host a privacy policy URL (required for data collection apps)
7. **Data safety**: Declare data collection practices in Play Console
8. **Internal testing**: Upload AAB to internal testing track, test on real devices
9. **Closed testing**: Expand to beta testers
10. **Production**: Submit for review, then promote to production track
