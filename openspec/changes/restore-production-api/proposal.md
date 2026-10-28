## Why

The Android build shipped to Google Play (v8) points every request at
`https://careeros-ai-production.up.railway.app`, which now returns **404 on every
path** — `/`, `/health`, `/docs`, `/openapi.json` alike. A uniform 404 on
`/docs` and `/openapi.json` is the platform's "no service bound to this domain"
response, not an application fault: the FastAPI app registers `/health` and
`/docs` unconditionally, so a running service could not produce this. The
Railway service was configured through the dashboard (there is no
`railway.json` in the repository) and its trial allowance lapsed.

The consequence is that the shipped app is non-functional in production: every
data-backed screen and every AI feature fails at the network layer. The project is
at the stage of applying for production, so this must be resolved before the next
submission rather than after it.

A second defect is latent behind the first: `start_notification_scheduler()`
runs APScheduler **inside the API process**. It only fires while a container
happens to stay alive, and `main.py` swallows startup failures. Any host that
scales to zero — which is what every free tier in scope does — silently stops
delivering interview follow-ups and mission-streak nudges with no error signal.
Fixing the URL alone would ship an app with working AI and dead notifications.

## What Changes

- **BREAKING** — Restore the production API service at the origin already
  embedded in shipped builds (`https://careeros-ai-production.up.railway.app`),
  so releases stop pointing at a dead service. Builds produced after this change
  embed a live HTTPS API origin.
- Keep the API on **Railway** using the existing `apps/api/Dockerfile`, reviving
  the suspended service with configuration supplied as platform environment
  variables rather than committed values. (Supersedes the abandoned Cloud Run and
  Oracle Always Free migration — see
  `docs/adr/0002-railway-hosting-and-external-scheduler.md`.)
- Add a **host-independent trigger for scheduled notifications**: an external
  scheduler invokes a secret-protected endpoint on a fixed interval, and the
  in-process APScheduler startup path is removed so reminders behave the same on
  every host and in every environment, not only `prod`/`qa`.
- Require that a target API origin pass a smoke check (`GET /health` returning
  `{"status":"ok"}`) **before** a production build or submit proceeds, so a dead
  or misconfigured endpoint fails the release rather than the user.
- Make the API origin a single documented source of truth: correct the root
  `.env.example` variable name (`PUBLIC_API_URL` → `EXPO_PUBLIC_API_URL`, which
  is what `apps/mobile/src/services/api.ts` actually reads) and align the
  per-environment URLs documented in `apps/mobile/.env.example` with the URLs
  actually shipped in `eas.json`.
- Scope `android:usesCleartextTraffic="true"` to development builds only, so
  production binaries do not permit cleartext HTTP.
- Correct the stale Play submission track in `eas.json`
  (`CareerOS AI_V1.0.0(6)` → the track matching the current version).

## Capabilities

### New Capabilities

- `production-api-hosting`: The API must run on a managed host that is live and
  reachable over TLS, health-verifiable from outside the deployment environment,
  and referenced by exactly one documented origin per environment that the mobile
  production build actually embeds.
- `scheduled-notification-delivery`: Grounded daily reminders (interview
  follow-ups and mission-streak nudges) must be delivered on a fixed cadence
  that is independent of API process lifetime, host scaling behaviour, and
  deployment environment, while remaining idempotent per recipient per day.
- `release-endpoint-verification`: A production build or submission must be
  gated on a passing reachability and health check against the API origin it will
  embed, with a documented remediation when the check fails.

### Modified Capabilities

None. No main specs exist under `openspec/specs/` yet (neither prior change has
been archived), so nothing is being amended.

## Impact

**Mobile**

- `apps/mobile/eas.json` — `production` and `device-test` `EXPO_PUBLIC_API_URL`;
  `submit.production.track`.
- `apps/mobile/plugins/withAdMobManifest.js` — makes cleartext traffic
  environment-conditional.
- `apps/mobile/app.config.ts` — env profile wiring consumed by the above.
- `.env.example`, `apps/mobile/.env.example` — documented origins, variable name.

**Backend**

- `apps/api/app/main.py` — drops the APScheduler startup from `lifespan()`.
- `apps/api/app/modules/notifications/scheduler.py` — becomes an
  invoke-on-demand unit; no longer constructs a `BackgroundScheduler`.
- `apps/api/app/modules/notifications/router.py` — new secret-protected
  trigger endpoint.
- `apps/api/Dockerfile` — unchanged; `apps/api/railway.toml` is the historical
  declarative definition of the Railway service.

**Infrastructure (owner action)**

- Revive the suspended **Railway** service bound to
  `https://careeros-ai-production.up.railway.app` (the origin already embedded in
  shipped builds), keeping the `CAREEROS_*` configuration in Railway variables.
  An external scheduler (Railway cron or any timer) drives the reminder trigger.
  Keeping the same domain means already-shipped builds start working again with
  no mobile change; no Oracle/GCP migration is performed.

**Out of scope (deliberately separate)**

- Wiring `AuthProvider.migrateGuest()` to `ApiClient.migrateGuest()`. Guest-owned
  rows are currently not migrated on account upgrade. This is a data-correctness
  defect independent of hosting and deserves its own change so it is not
  entangled with infrastructure work.
- The mobile architecture drift (only `presentation/` layers exist), the unused
  `@careeros/api-contract` package, and the missing user-selectable theme and
  reduced-motion support identified during review.
