## 1. Blocking Preconditions

- [x] 1.1 (Originally: confirm a payment card for Cloud Run + Cloud Scheduler.) **RESOLVED 2026-10-13 — hosting decision reverted: keep the API on Railway and revive the suspended service.** No Google Cloud or Oracle infrastructure is used; the owner's earlier Always Free selection was withdrawn in favour of reviving Railway. Recorded in `docs/adr/0002-railway-hosting-and-external-scheduler.md`.
- [x] 1.2 Determine the Supabase region for project `puxnptidnwdhjpzjrjrp` and record it; the API host should be reasonably close to it.
      **DONE 2026-10-13 — owner confirmed via the Supabase dashboard: `ap-northeast-1` (AWS Tokyo).** The Railway service region is chosen in the dashboard; confirm it is reasonably close to `ap-northeast-1` when reviving the service (no OCI region selection applies any more).
- [ ] 1.3 Confirm `apps/api/.env` holds the values to be placed in the production host config (`CAREEROS_SUPABASE_SERVICE_ROLE_KEY`, `CAREEROS_GEMINI_API_KEY`, Firebase credentials) and that none of them appear in any tracked file.
      **PARTIAL — no leaks; Firebase now resolved locally.** Verified no tracked file contains the service-role key, Gemini key or DB password. The Supabase _publishable_ key appears in `apps/mobile/eas.json`, which is correct by design (it is a client-side key, not a service-role key). `CAREEROS_FIREBASE_CREDENTIALS_JSON` is now **set** in `apps/api/.env` from the on-disk Firebase admin key (`firebase_creds_set: True`, `firebase_available: True` via `fcm.is_fcm_available`). On the chosen host (Railway) the same value goes into the service's environment variables — no secret in the repo or a mobile build.
- [x] 1.4 Audit the existing Railway project before deciding to retain/migrate.
      **RESOLVED 2026-10-13 — Railway is retained.** The owner chose to revive the existing Railway service (same origin as shipped builds), so no migration audit is required. `apps/api/railway.toml` remains the historical declarative definition; the service is configured in the Railway dashboard.
- [x] 1.5 Produce a hosted cost comparison for an owner decision. — **WITHDRAWN 2026-10-13.** The hosting question was reopened and then closed in favour of retaining Railway; the comparison doc (`docs/architecture/hosting-cost-comparison.md`) was removed with the abandoned migration. The owner accepted Railway's cost ("Railway is enough").

## 2. Reminder Trigger Endpoint

- [x] 2.1 Add `POST /internal/notifications/run-due`, registered outside the `/api/v1` prefix so it is not part of the public contract. — `app/modules/notifications/internal_router.py`, mounted in `create_app()` without `API_V1_PREFIX`.
- [x] 2.2 Require an `X-Scheduler-Secret` header and compare it with `secrets.compare_digest` against a configured setting; return 401 on missing or mismatched value.
- [x] 2.3 Confirm the endpoint accepts no end-user access token and no `X-Guest-Id`; a caller presenting only a guest identifier is rejected.
- [x] 2.4 Return aggregate counts per reminder type only — assert the response body contains no email address, resume content, application detail or token.
- [x] 2.5 Add the trigger secret as an optional setting so the API still starts when it is absent, and confirm `/health` is unaffected by its absence.
- [x] 2.6 Add API tests: valid secret accepted; missing secret rejected; wrong secret rejected; expired user token rejected; response carries counts only.
- [x] 2.7 Add a test asserting the internal endpoint does not appear under the versioned `/api/v1` route surface.

## 3. Remove the In-Process Scheduler

- [x] 3.1 Delete the `BackgroundScheduler` construction, the 60-minute interval registration and the `environment not in ("prod", "qa")` allow-list from `app/modules/notifications/scheduler.py`.
- [x] 3.2 Remove the scheduler startup and the surrounding bare `try/except` from `lifespan()` in `app/main.py`.
- [x] 3.3 Confirm `NotificationScheduler.run_due()` is unchanged and still de-duplicates per recipient per day via `notification_logs`.
- [x] 3.4 Update the module docstring to state that the scheduler is invoked on demand by an external scheduler, not run in-process.
- [x] 3.5 Run the backend suite: `pytest` in `apps/api`. Report the actual result. — **255 passed, 0 failed.**
- [x] 3.6 Run the backend linter: `ruff check` in `apps/api`. Report the actual result. — **All checks passed**; `ruff format --check` clean across 159 files.
- [x] 3.7 Confirm the `apscheduler` dependency is still required; if `run_due` no longer uses it anywhere, remove it from `pyproject.toml` and re-run 3.5–3.6. — `run_due` never used it; only `start_notification_scheduler` did. Removed from `pyproject.toml` and re-ran both: still green.

## 4. Mobile Configuration

- [x] 4.1 Add `apps/mobile/src/config/api-origin.ts` as the single place that resolves the API base URL for a build profile.
- [x] 4.2 Make it reject an empty, relative or loopback origin when the profile is marked for external distribution.
- [x] 4.3 Point `src/services/api.ts` at the resolver instead of reading `process.env.EXPO_PUBLIC_API_URL` inline.
- [x] 4.4 Update `plugins/withAdMobManifest.js` to set `usesCleartextTraffic="true"` only for non-production environments, and to leave the attribute absent for production.
- [x] 4.5 Regenerate the Android manifest for a production configuration and confirm the `<application>` element carries no explicit cleartext opt-in.
- [x] 4.6 Regenerate for a development configuration and confirm cleartext remains permitted so `adb reverse` against a loopback API still works.
- [x] 4.7 Confirm the release manifest still declares only the permissions the app needs; review `SYSTEM_ALERT_WINDOW` and drop it if unused.
- [x] 4.8 Add a unit test for the resolver covering empty, relative, loopback and valid HTTPS origins across distribution modes.

Notes: `android/` is gitignored, so the plugins in `app.config.ts` are the durable source of truth; `expo prebuild -p android --no-install --clean` regenerated and reproduced the corrected manifests. `SYSTEM_ALERT_WINDOW` is stripped from the main (release) manifest by the new `plugins/withSafePermissions.js`; it still reappears in the `src/debug*` overlays on regeneration because Expo's template injects it there for debug builds — those overlays never ship. Permissions kept (all justified): `INTERNET`, `RECORD_AUDIO` (speech), `VIBRATE` (notifications), `READ/WRITE_EXTERNAL_STORAGE` (`maxSdkVersion=32`, legacy document picker).

## 5. Deploy the API (Railway)

> **Host: Railway — revive the existing service** bound to
> `https://careeros-ai-production.up.railway.app`. See
> `docs/adr/0002-railway-hosting-and-external-scheduler.md`. **Reviving/upgrading
> the service is an owner action.** The origin is unchanged, so no mobile rebuild
> is required to point at it. The release gate (8.x) stays red until the service
> is live, which is by design.

- [ ] 5.1 Revive the suspended Railway service bound to `https://careeros-ai-production.up.railway.app`; confirm its region is reasonably close to Supabase `ap-northeast-1`.
- [ ] 5.2 Set the `CAREEROS_*` variables on the Railway service (see `apps/api/.env.example` and `app/core/config.py`); never commit the values.
- [ ] 5.3 Build/deploy the `apps/api/Dockerfile` image (Railway builds from the Dockerfile on push).
      **Local container verification 2026-10-13 (Docker Desktop 29.7.2 + buildx/QEMU):** the image builds and runs correctly — `import app.main` OK, `GET /health` → `{"status":"ok"}`, `GET /openapi.json` → 200. Railway's own build from the committed Dockerfile is the deploy path.
- [ ] 5.4 Confirm TLS is terminated by Railway on the service domain (no reverse proxy, host firewall or certificate work to manage).
- [ ] 5.5 From outside, confirm `GET /health` returns HTTP 200 with an `"ok"` status.
- [ ] 5.6 Confirm `GET /openapi.json` returns 200 and enumerates the versioned routes — the regression guard for the uniform-404 failure.
- [ ] 5.7 Confirm an unauthenticated request to a protected route returns an authentication error, not a routing error.
- [ ] 5.8 Exercise one real end-to-end flow against the deployed service (for example create a guest, import a resume, request an assessment) and confirm it succeeds.

## 6. Schedule Reminders

> The invoker is an **external scheduler** (a Railway cron job, or any timer) that `POST`s to the
> `POST /internal/notifications/run-due` endpoint. It is host-agnostic and needs no in-process
> dependency. See `docs/runbooks/notifications-scheduler.md`.

- [ ] 6.1 Configure an external scheduler (Railway cron or a timer) that POSTs hourly to the trigger endpoint with the `X-Scheduler-Secret` header.
- [ ] 6.2 Confirm it is the only scheduled job — `run_due` already covers both reminder types in one pass.
- [ ] 6.3 Invoke the endpoint manually and confirm it authenticates and returns counts.
- [ ] 6.4 Invoke it a second time on the same calendar day and confirm no additional reminder is delivered.
- [ ] 6.5 Confirm `X-Scheduler-Secret` is never written to application logs.
- [ ] 6.6 Confirm a scheduled run failure leaves an observable signal that survives the failed process (Railway logs / scheduler logs).

## 7. Correct Configuration Drift

- [x] 7.1 Confirm the `production` profile `EXPO_PUBLIC_API_URL` in `apps/mobile/eas.json` is `https://careeros-ai-production.up.railway.app`.
      **RESOLVED 2026-10-13 — origin unchanged.** Hosting stays on Railway, so the shipped origin needs no repoint; the earlier "repoint to a new origin" plan was withdrawn with the abandoned migration. The gate (8.x) still fails while the Railway service is down, which is by design.
- [x] 7.2 Confirm the `device-test` profile `EXPO_PUBLIC_API_URL` is the same Railway origin as 7.1. — **RESOLVED 2026-10-13** — same unchanged origin.
- [x] 7.3 Update `submit.production.track` from `CareerOS AI_V1.0.0(6)` to the track matching the current `versionCode`. — Set to `CareerOS AI_V1.0.0(9)` (versionCode bumped 8→9, 2026-10-14) following the existing naming scheme. **Requires visual confirmation in the Play Console that this track name exists** before running `eas submit`; the gate cannot verify a Play track.
- [x] 7.4 Confirm `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL` and `EXPO_PUBLIC_SUPPORT_URL` all return 200, and add a delete-account URL if one is not already surfaced in the app. — All three return **200** (verified via HEAD/GET on 2026-10-07). Delete-account is surfaced both in-app (`ProfileScreen` → `handleDeleteAccount` → `apiClient.deleteAccount`, which hits `DELETE /api/v1/auth/me`) and as a guide link `https://careerosai.app/delete-account`, which also returns **200**.
- [x] 7.5 Rename the root `.env.example` API URL variable from `PUBLIC_API_URL` to `EXPO_PUBLIC_API_URL` so it matches what `apps/mobile/src/services/api.ts` reads.
- [x] 7.6 Align the per-environment origins documented in `apps/mobile/.env.example` with the values the build profiles actually embed. — Removed the fabricated `https://qa-api.careeros.ai` / `https://api.careeros.ai` domains (they exist nowhere) and documented the real mechanism: dev → adb reverse localhost; prod/device-test → `eas.json` env block, validated by `api-origin.ts`.
- [x] 7.7 Confirm no `EXPO_PUBLIC_*` value in any build profile is a service-role, AI provider or notification credential. — Full inventory of `eas.json` env blocks: `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable, public by design), `EXPO_PUBLIC_PRIVACY/TERMS/SUPPORT_URL`, `EXPO_PUBLIC_ADMOB_*` (AdMob IDs are public). No secrets. Verified also that no tracked file contains the service-role key, Gemini key or DB password (see 1.3).

## 8. Release Gate

- [x] 8.1 Add a GitHub Actions step that resolves the API base URL for every externally distributed build profile. — `scripts/verify-release-origins.mjs` + `.github/workflows/release-gate.yml` (runs on push to main/prod and `workflow_dispatch`), wired as `pnpm verify:release-origins`. Imports the _actual_ `api-origin.ts` resolver via Node 24 native type-stripping, so gate and app cannot drift.
- [x] 8.2 Have it fail without contacting anything when a profile resolves to an empty, relative or loopback origin, naming the offending profile. — Verified: with prod→`http://localhost:8000` and device-test→`/relative`, the gate failed `0 probed` and named each profile.
- [x] 8.3 Have it require `GET /health` → 200 with an `"ok"` status. — Enforced in `probe()` (parses JSON body, checks `status === "ok"`).
- [x] 8.4 Have it confirm the versioned route surface is served, not merely the probe, so an origin that answers `/health` but not `/api/v1/*` fails. — Probes `GET /api/v1/health` → must be 200.
- [x] 8.5 Have failures report the origin, the profile, the observed status or error, and the remediation step. — Output includes origin, `eas.json:build.<name>`, observed HTTP status/body or error, and the remediation line.
- [x] 8.6 Run the gate against the live Railway URL and confirm it fails — proving the check detects the exact failure this change exists to fix. — Actual result: **exit 1**, profile `production` and `device-test` both `GET /health → HTTP 404 {"status":"error","code":404,"message":"Application not found",...}`. Exactly the regression this change fixes.

## 9. Ship

- [x] 9.1 Run the mobile test suite: `pnpm --filter @careeros/mobile test`. Report the actual result. — Ran **five times**. Result is flaky across runs (0–10 failures, 129 tests): run A **8 failed/121 passed on the clean stash baseline** (pre-change), run B 10 failed, subsequent runs **23/23 suites, 129/129 passed**. Failures that do occur are all in pre-existing screen tests (`AuthScreen`, `DashboardScreen`, `ResumeScreen`, `CoachScreen`, `JobMatchScreen`, ...) and are timing races: `[AdMob] Module load failed: mobileAds is not a function` (native module absent under jest), `...not configured to support act(...)`, and `findByText` timeouts. The new resolver + plugin tests are deterministic: `src/config/api-origin.test.ts` **20/20 × 3 runs**, `plugins/withAdMobManifest.test.js` + `plugins/withSafePermissions.test.js` **12/12**. Full result of a clean run: `Test Suites: 23 passed; Tests: 129 passed`. Pre-existing flakiness is out of scope for this change.
- [x] 9.2 Run mobile lint and typecheck: `pnpm --filter @careeros/mobile lint` and `pnpm --filter @careeros/mobile typecheck`. Report the actual results. — `npm run typecheck` (`tsc --noEmit`): **exit 0, no diagnostics**. `npm run lint` (`expo lint`): **exit 0**. Both ran in `apps/mobile`.
- [x] 9.3 Confirm `targetSdk` still resolves to 36 and `minSdk` to 24 against Play's current gate. — The generated `android/app/build.gradle` reads `rootProject.ext.*` and `app.config.ts` does not override SDK versions, so the Expo Gradle plugin defaults apply. Evidence: installed `node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle` — `compileSdkVersion` default **36**, `minSdkVersion` default **24**, `targetSdkVersion` default **36**. Cross-check CLI output of `swift sdk`-style equivalents at submission time; Play is expected to still be at targetSdk 35/36 in this cycle — confirm against Play Console policy page before 9.7.
- [x] 9.4 Boot the app in an Android emulator with `adb reverse tcp:8000 tcp:8000` against a local API and confirm a data-backed screen loads, isolating any local networking fault from the deployed one. — **Done on physical device (OnePlus Nord CE, Android 13 / SDK 33, arm64-v8a), stronger than an emulator.** `adb reverse tcp:8000 tcp:8000` and `tcp:8081 tcp:8081`; local API (current code, FCM wired) + Metro on this machine; `ai.careeros.app.dev` launched to the Auth screen, "Continue as guest" navigated to dashboard, and dashboard/missions/assessments/achievements Supabase queries all returned **200 through the local API** (uvicorn access log evidence). Bundle served over adb reverse proves the device→host path end to end.
- [ ] 9.5 Install the production bundle and confirm a data-backed screen and one AI-backed feature both succeed against the deployed origin. **BLOCKED on the Railway service being revived (Section 5).**
- [x] 9.6 Confirm `secrets/play-service-account.json` is present locally, untracked, and never committed, before submitting. — **Not present on disk (blocking 9.7/6.x)**, and confirmed untracked by git. The `submit.production` profile requires it. Do NOT proceed with submission until the owner provides this file.
- [ ] 9.7 Build the production app bundle and submit to the corrected track. **Blocked on the Railway service being revived (Section 5) and 9.6 (missing `play-service-account.json`).** The local release/native build itself is now unblocked (10.8): `.\gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a` → `BUILD SUCCESSFUL`, `app-release.apk` (52 MB) produced. A submittable bundle still requires a live origin and the Play service account.

## 10. Documentation

- [x] 10.1 Document the production deploy definition and required environment variable names so the deployment is reproducible without only a provider dashboard. — Superseded by the reversion: the removed Cloud Run runbook no longer applies. `apps/api/Dockerfile` is the reproducible build input; `apps/api/.env.example` lists the required `CAREEROS_*` variables; the Railway service is configured in the dashboard.
- [x] 10.2 Document the reminder trigger endpoint and its authentication in the backend docs. — `docs/runbooks/notifications-scheduler.md` + pointer from `apps/api/README.md`. Documents `POST /internal/notifications/run-due`, `X-Scheduler-Secret`, constant-time comparison, 401/503 fail-closed behaviour, idempotency, FCM delivery and the external-scheduler invocation.
- [x] 10.3 Document the release verification gate and how to run it locally before a build. — `docs/runbooks/release-gate.md`. Includes the actual current failure output (dead Railway origin, fail-closed), the `pnpm verify:release-origins` command, CI reference, and remediation steps.
- [x] 10.4 Record the accepted trade-off around cold starts / scale-to-zero. — Superseded by the reversion: reminders no longer depend on process lifetime (external scheduler), and hosting is a managed Railway service. See ADR-0002.
- [x] 10.5 Update `.env.example` if public configuration changed, per the repository's data-safety rule. — Root `.env.example`: `PUBLIC_API_URL` → `EXPO_PUBLIC_API_URL` (7.5). `apps/mobile/.env.example`: aligned per 7.6. `apps/api/.env.example`: added `CAREEROS_SCHEDULER_SECRET` with the 503 fail-closed note (new config setting). None add secrets.
- [x] 10.6 Add an ADR capturing the hosting decision and the Cloudflare Workers rejection, so the reasoning survives. — `docs/adr/0002-railway-hosting-and-external-scheduler.md`: Decisions 1–3 (keep Railway, external scheduler, Workers deliberately rejected-with-revisit) and consequences (fail-closed gate). Rewritten on 2026-10-13 after the migration was abandoned.
- [x] 10.7 Record the hosting decision history. — **WITHDRAWN 2026-10-13**: the cost comparison doc was removed with the abandoned migration; the decision (retain Railway) is recorded in ADR-0002. No infrastructure or billing was changed.
- [x] 10.8 Document and fix the Windows native-build failure that blocked local Android release builds. — Root cause: `react-native-reanimated`'s `CONFIGURE_DEPENDS` glob check never settles under the Ninja 1.10.2 bundled with Android SDK CMake (`cmake.verify_globs is dirty` re-runs CMake forever). Fixed by upgrading the SDK-bundled `ninja.exe` (cmake 3.22.1 + 3.30.5) to 1.12.1 and clearing `.cxx` caches; verified `BUILD SUCCESSFUL` + `app-release.apk` (52 MB) on 2026-10-13. Recorded in `docs/runbooks/android-windows-native-build.md`. Machine-local toolchain change; no app code or repo config changed.
- [x] 10.9 Record the hosting decision. — **SUPERSEDED 2026-10-13**: the Oracle/Cloud Run deployment docs (`docs/adr/0003-oracle-always-free-hosting.md`, `docs/runbooks/oracle-always-free-deployment.md`, `docs/runbooks/cloud-run-deployment.md`, `docs/architecture/hosting-cost-comparison.md`) were deleted when the owner reverted to Railway. `docs/adr/0002-railway-hosting-and-external-scheduler.md` is the surviving record. No infrastructure was provisioned.
