# CareerOS AI — Play Store Readiness Checklist

Generated: 2026-08-20

---

## DONE — Implemented & Tested

- [x] Email/password auth (sign in, sign up, sign out, session persistence, token refresh)
- [x] Google OAuth sign-in (PKCE, system browser)
- [x] Guest mode (browse without account, guest-to-account migration)
- [x] Dashboard (resume score, XP, level, streak, missions, quick actions)
- [x] Resume upload (PDF/DOCX/TXT, 10MB limit, parsed content extraction)
- [x] Resume health score (multi-dimension AI assessment)
- [x] Job Match (create JD, AI match scoring, list, delete, re-run)
- [x] AI Career Coach (threads, messages, resume context, suggested prompts, copy, regenerate)
- [x] Resume Rewrites (AI suggestions, accept → new version)
- [x] Resume Roast (5 modes: Gentle, Brutal, Coach, Interviewer, Recruiter)
- [x] Career Wrapped (shareable summary, ViewShot capture, system share)
- [x] Mock Interview (6 modes, 5-dimension evaluation, per-question feedback)
- [x] Daily Missions (task list, XP rewards, streak tracking)
- [x] Achievements (5 types: first upload, first match, streak, level-up, high score)
- [x] Profile (account info, plan display, password reset, account deletion)
- [x] Feedback (helpful/not helpful with reasons)
- [x] Voice-to-text input (Coach, Interview, JobMatch — graceful fallback in Expo Go)
- [x] i18n infrastructure (en.ts, ready for translation)
- [x] Theme system (light/dark, design tokens, WCAG AA contrast)
- [x] Guest ownership (RLS for all tables, guest→account data migration)
- [x] 18 Supabase migrations with RLS on every user-owned table
- [x] 196 backend tests (pytest), 59 mobile tests (jest)
- [x] CI pipeline (lint, typecheck, test for mobile + API)
- [x] Android build workflow (split APK + AAB via GitHub Actions)
- [x] API billing module (router, service, repository, schema — now registered)
- [x] Docker setup (API + PostgreSQL)
- [x] Monorepo with shared packages (design-tokens, api-contract, config)

---

## CRITICAL — Must Fix Before Submission

### 1. App Signing
- [ ] Generate upload key (`keytool -genkeypair`)
- [ ] Configure EAS credentials (`eas credentials`)
- [ ] Enable Google Play App Signing
- [ ] Set `build.gradle` signing config for release builds

### 2. Privacy Policy & Terms
- [ ] Write Privacy Policy (what data is collected, how it's used, Supabase/Gemini subprocessors)
- [ ] Write Terms of Service
- [ ] Host both at publicly accessible URLs (GitHub Pages or Vercel)
- [ ] Add links in app (Profile screen) and Play Store listing

### 3. Billing / Monetization
- [ ] Install `react-native-iap` or `expo-in-app-purchases`
- [ ] Implement subscription purchase flow (monthly/yearly Pro plan)
- [ ] Implement purchase verification (server-side receipt validation)
- [ ] Implement restore purchases
- [ ] Wire `check_quota` into AI feature endpoints (assessments, coach, rewrites, roast, interview)
- [ ] Add quota limits display in Profile screen

### 4. Play Store Listing
- [ ] Write app description (short + full)
- [ ] Capture screenshots (phone + tablet, min 2, max 8)
- [ ] Create feature graphic (1024×500)
- [ ] Complete IARC content rating questionnaire
- [ ] Complete Data Safety declaration
- [ ] Set support email and privacy policy URL

---

## HIGH — Should Have Before Launch

### 5. Analytics & Crash Reporting
- [ ] Install Firebase (`@react-native-firebase/app`)
- [ ] Configure Firebase Analytics (product events: app_opened, resume_uploaded, coach_message_sent, etc.)
- [ ] Configure Firebase Crashlytics
- [ ] Add `google-services.json` to project (gitignored)

### 6. AdMob
- [ ] Install `react-native-google-mobile-ads`
- [ ] Configure ad unit IDs (test + production)
- [ ] Add banner ads (dashboard, mission complete screen)
- [ ] Add interstitial ads (between feature transitions, frequency-capped)
- [ ] Add rewarded ads (extra coach messages, extra interview questions)

### 7. Rate Limiting
- [ ] Add FastAPI rate limiting middleware (per-user, per-endpoint)
- [ ] Enforce free-tier AI request limits server-side

---

## MEDIUM — Can Ship Without, Add Post-Launch

### 8. Push Notifications
- [ ] Install `expo-notifications`
- [ ] Configure FCM
- [ ] Mission reminders, streak reminders, weekly career tips

### 9. Offline Support
- [ ] Add data caching layer (AsyncStorage or MMKV)
- [ ] Cache last resume, dashboard data, coach threads
- [ ] Show offline indicator, queue writes

### 10. Onboarding
- [ ] First-run tutorial/walkthrough
- [ ] Profile setup wizard (name, target role, experience level)

### 11. Performance
- [ ] Replace ScrollView lists with FlashList for large datasets
- [ ] Add skeleton/shimmer loading states
- [ ] Convert sync Gemini calls to async (fastapi async def routes)

### 12. Testing
- [ ] E2E tests (Detox or Maestro)
- [ ] Integration tests for critical flows
- [ ] Add billing API tests

---

## Post-Launch

- [ ] iOS build and App Store submission
- [ ] Multi-language support (complete i18n)
- [ ] Streaming AI responses
- [ ] Share features (social media deep links)
- [ ] A/B testing framework
- [ ] User feedback analytics dashboard

---

## Current Version: 0.1.0 (versionCode 1)
## Readiness Estimate: ~60% of V1 code, ~30% of Play Store requirements
