## Context

See `proposal.md` — _Why_ for motivation. What follows is only the current state
and constraints that shape the technical approach.

**What already works and must be reused.** The API is a conventional stateless
FastAPI service: all durable state lives in Supabase (Postgres + Storage + Auth),
there is no local disk requirement, no Redis, and no cross-request in-memory
state that matters. `apps/api/Dockerfile` already produces a correct production
image — `python:3.12-slim`, non-root `app` user, `EXPOSE 8000`, and a `CMD` that
honours `${PORT:-8000}`. Any container host that honours `$PORT` can run it with no
image changes.

**What is missing.** The deployment definition was never committed. There is no
`railway.json`, no `wrangler.toml`, no `fly.toml`, no `render.yaml` — only the
Dockerfile. The service was created through a provider dashboard, which is why its
loss produced an outage that the repository could not even describe, let alone
reproduce or detect.

**What makes notifications fragile.** `start_notification_scheduler()`
(`apps/api/app/modules/notifications/scheduler.py:142-169`) constructs an
`APScheduler.BackgroundScheduler` _inside the API process_ on a 60-minute interval,
and returns `None` unless `settings.environment` is literally `"prod"` or `"qa"`
(line 148). `main.py:50-53` wraps the call in a bare `try/except` that only calls
`logger.exception`. Two consequences:

1. On any host that scales to zero, the scheduler thread exists only while a
   container is serving a request, so reminders are never evaluated.
2. In any other environment the scheduler silently does not run, and the only
   signal is a log line — which on a platform with ephemeral logs is lost.

Note also that the existing `NotificationScheduler.run_due()` is already a clean
invoke-on-demand unit: it iterates preferences, honours stored opt-ins, applies
`notification_logs` for per-day de-duplication, and degrades to a counted no-op
when FCM is unconfigured (`scheduler.py:44-67`). The _evaluation logic_ needs no
change. Only its _invocation_ is wrong.

**Constraints carried in from review.**

- Play's current target-API gate is API 36. `node_modules/react-native/gradle/libs.versions.toml`
  resolves `targetSdk = "36"`, `compileSdk = "36"`, `minSdk = "24"`, so the Android
  side already clears it.
- All four legal URLs (`/privacy`, `/terms`, `/support`, `/delete-account`) resolve
  HTTP 200 against `careerosai.app`, satisfying Play's account-deletion and
  privacy-policy requirements.
- `apps/mobile/.env.example` documents an environment architecture of
  `PROD → https://api.careeros.ai`, while `eas.json` actually ships
  `https://careeros-ai-production.up.railway.app`. The documentation and the
  build configuration disagree, and `careeros.ai` is a different registrable
  domain from the live `careerosai.app`.
- The root `.env.example` documents the mobile API URL as `PUBLIC_API_URL`, but
  `apps/mobile/src/services/api.ts:54` reads `process.env.EXPO_PUBLIC_API_URL`.
- `apps/api/.env` already contains a populated `CAREEROS_SUPABASE_SERVICE_ROLE_KEY`,
  `CAREEROS_GEMINI_API_KEY` and `CAREEROS_SUPABASE_DB_PASSWORD` (all untracked), so
  the values needed to seed a new deployment exist locally.

## Goals / Non-Goals

**Goals:**

- A production API that is live, TLS-terminated, publicly resolvable, and
  reproducible from repository contents alone.
- Reminder delivery that is correct on any host, in any environment, and
  independently of instance lifetime.
- A release gate that makes a dead or misconfigured origin impossible to ship,
  because a published Android build cannot be rolled back at the URL.
- A managed host whose loss cannot silently reach users: the same origin stays
  live, and any future lapse fails the release gate before a build ships.
- No new Python runtime dependency, and no change to how the AI provider seam
  (`CareerAiProvider`) is reached.

**Non-Goals:**

- Not re-architecting the API. No module, router, schema or repository changes
  beyond the addition of one trigger endpoint and the removal of the in-process
  scheduler startup.
- Not introducing a hosted cache, queue, or background-job service. Adding one
  would cost money and add an operational dependency for a workload of one job
  per hour.
- Not porting the API to an edge runtime (see Decision 3).
- Not touching the guest-migration defect, the mobile layering drift, the unused
  `@careeros/api-contract` package, or the missing theme / reduced-motion support.
  These are separate changes.

## Decisions

### Decision 1 — Keep hosting on Railway (revive the existing service)

**Chosen.** Continue running the existing `apps/api/Dockerfile` on the Railway
service bound to `https://careeros-ai-production.up.railway.app`, reviving the
suspended service. Configuration and secrets stay in Railway variables; nothing
is baked into the image or the repository. (Supersedes the earlier Cloud Run and
Oracle Always Free plans; see
`docs/adr/0002-railway-hosting-and-external-scheduler.md`.)

**Rationale.** The origin is already embedded in shipped Android builds, so
continuing on Railway needs **no mobile change, no new DNS and no new
certificate**, and the outage was a lapsed trial rather than a platform
limitation. Railway is a managed platform (TLS, deploys, logs), and the owner
judged the operational cost of a self-managed bare VM (OS patching, firewalling,
TLS renewal, arm64 build target) not worth paying for this workload. The release
gate (Decision 4) makes a future lapse fail a release instead of reaching users.

**Alternatives considered.**

| Option                    | Why not                                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oracle Cloud Always Free  | $0 and always-on, but a self-managed bare VM (OS patching, firewalling, TLS renewal, arm64 target) and capacity not guaranteed; the owner chose not to take on that operational cost. |
| Google Cloud Run          | $0 inside the free tier, but requires a billing-enabled project/card — the "paid Google Cloud backend" the owner ruled out.                                                           |
| Render free               | Sleeps after 15 minutes idle, giving 30–60s cold starts on the _first_ request of every session, and needs the scheduler fix regardless.                                              |
| Koyeb free                | 512MB is tight alongside `pypdf`, `python-docx`, `firebase-admin` and the Gemini adapter; also scales to zero.                                                                        |
| AWS Lambda + Function URL | $0–0.05/mo serverless, but a re-architecture (Lambda Web Adapter + ECR + Function URL; API Gateway unusable at 29 s), a card, a 6-month Free→Paid upgrade deadline, and cold starts.  |
| Fly.io                    | Free tier closed to new organisations.                                                                                                                                                |
| Cloudflare Workers        | Cardless and generous, but requires a real port — see Decision 3.                                                                                                                     |

### Decision 2 — Move reminder invocation to an external scheduler behind a secret-guarded endpoint

**Chosen.** Expose `POST /internal/notifications/run-due`, outside the `/api/v1`
prefix so it is unambiguously not part of the public contract. It takes no actor
dependency, authenticates via an `X-Scheduler-Secret` header compared with
`secrets.compare_digest`, and returns only aggregate counts. Delete the
`BackgroundScheduler` construction and the environment allow-list from
`scheduler.py`, and drop the `lifespan()` scheduler block from `main.py`.

An external scheduler (a Railway cron job, or any timer) invokes it hourly. The
trigger secret lives in the platform's environment variables and is passed as a
custom header.

**Rationale.** This makes delivery a property of the _deployment_, not of the
_process_, which is what makes it correct on every host. It also fixes two latent
defects for free: the `prod`/`qa` string allow-list disappears, and the
`logger.exception` swallow in `main.py:50-53` goes away with the thing it was
wrapping.

**Why a shared secret rather than host/network ACLs.** The API is public (the
mobile client reaches it unauthenticated for its public routes), so an
IP/host-level guard cannot discriminate a single internal route without also
gating the public surface. Verifying a platform-specific OIDC token would add a
JWT verification dependency the project does not have. A shared secret is
acceptable precisely because the operation is idempotent and returns only
counts: the worst case of a leaked secret is redundant reminder evaluations, which
per-day de-duplication already absorbs. Recorded so it can be revisited if the
endpoint ever returns anything more sensitive.

**One job is sufficient.** `run_due()` already evaluates both reminder types in a
single pass, so the production design needs exactly one scheduled invocation.

**Alternative considered.** Keep the in-process scheduler and additionally run an
external trigger. Rejected — two invocations of an idempotent job is strictly more
complex than one, and it preserves the `prod`/`qa` gate.

### Decision 3 — Do not port to Cloudflare Workers

**Chosen against, deliberately.** Workers is the only option in scope that is
cardless-free _and_ not time-limited, and its Cron Triggers would model the
scheduler natively — a genuinely better fit on both counts. It is rejected on
implementation cost, not merit.

`app/ai/gemini.py` and the FastAPI core port conceptually, but three declared
dependencies have no CPython wheels and do not run under Pyodide:

| Dependency              | Blocker                         |
| ----------------------- | ------------------------------- |
| `uvicorn[standard]`     | `httptools`, `uvloop` — native  |
| `firebase-admin`        | `grpcio` — native               |
| `supabase` (Python SDK) | pulls `realtime` → `websockets` |

`pypdf`, `python-docx`, `httpx`, `fastapi` and `pydantic` are pure-Python and fine.

The port would mean rewriting `app/integrations/supabase/*` and
`app/integrations/firebase/*` against raw `httpx`, discarding the SDKs' type
safety, and re-testing the whole ownership/RLS surface. That is a second project,
not a hosting change. Recorded here so that "the free tier is better" does not
later read as "we should have chosen it".

### Decision 4 — Make the mobile build fail closed on an unverified origin

**Chosen.** Resolve the API base URL for a build profile in one place, then add a
GitHub Actions step that, for any externally distributed profile, (a) rejects an
empty, relative or loopback origin, (b) requires `GET /health` → 200 with `"ok"`,
and (c) requires the versioned route surface to be served — confirming that an
unauthenticated request to a protected route returns an authentication error rather
than a routing error, which proves the route is mounted and guarded rather than
merely that a probe is alive.

**Rationale.** A published Android binary cannot have its baked-in URL corrected.
There is no rollback for the mobile side of this change; the only place to catch a
dead origin is before the build. Checking more than `/health` matters because an
origin can answer a liveness probe while failing to serve the API the app actually
calls — which is precisely the failure mode of the current uniform 404.

The new `apps/mobile/src/config/api-origin.ts` is also the natural home for
eventually replacing the hand-maintained `src/services/contract.ts` DTOs with the
generated `@careeros/api-contract` types, but that replacement is **out of scope
here** — the generated package currently contains 2 of ~60 routes.

### Decision 5 — Scope cleartext traffic by environment

**Chosen.** Have `withAdMobManifest.js` set `android:usesCleartextTraffic="true"`
only when the resolved environment is not `prod`, and have the plugin stop writing
the attribute otherwise, so production manifests carry no explicit opt-in and
inherit the platform default.

**Rationale.** `usesCleartextTraffic="true"` is currently written into the
committed manifest at line 21 _and_ set unconditionally by the plugin for both
environments. Local development genuinely needs it against a loopback API over
`adb reverse`, so removing it outright is not an option — but production has no
reason to permit cleartext at all.

## Risks / Trade-offs

- **Railway's own plan carries cost.** The allowance that lapsed was metered;
  keeping the service up may require a paid Railway plan. → The owner accepted
  this explicitly ("Railway is enough") rather than migrating hosts. The release
  gate makes a future lapse fail a release instead of reaching users.
- **Scale-to-zero / cold starts.** → The failure mode that matters is process
  lifetime, which Decision 2 (external scheduler) already removes; reminders no
  longer depend on the container staying warm.
- **Secrets live in Railway variables, not a cloud secret manager.** → The values
  stay out of the repository and out of mobile builds; the task list confirms no
  secret enters git or a build profile.
- **A single shared secret guards the trigger endpoint.** Rotating it requires
  updating the platform variables and both consumer points, with a brief window
  where one side is updated before the other will silently stop reminders. →
  Rotate in the order scheduler-then-endpoint, and confirm a run succeeds
  afterwards.
- **The `X-Scheduler-Secret` header must not appear in application logs.** →
  Included as an explicit task; the existing logging configuration is the place to
  enforce it.
- **Supabase region is `ap-northeast-1` (AWS Tokyo).** The Railway service region
  was chosen in the dashboard; a large mismatch would add latency and egress. →
  Confirm the Railway service region is reasonably close to `ap-northeast-1` when
  reviving the service.

## Migration Plan

**Deploy order.** Confirm the Railway service is healthy from outside first;
only then is a production build or submit allowed. This ordering guarantees that
no interval exists in which a build could embed an unverified origin.

1. Revive the Railway service bound to
   `https://careeros-ai-production.up.railway.app` and confirm its region is
   reasonably close to Supabase `ap-northeast-1`.
2. Configure Railway variables (the `CAREEROS_*` set from `app/core/config.py`;
   `CAREEROS_FIREBASE_CREDENTIALS_JSON` holds the Firebase admin key JSON).
3. Add the trigger endpoint, remove the in-process scheduler, run the backend test
   suite, and commit. (Done — see tasks §2/§3.)
4. Deploy the image and confirm `GET /health` returns 200 `"ok"` from outside, and
   that the versioned route surface is served.
5. Add the external scheduler (Railway cron or a timer) that POSTs to the trigger
   endpoint hourly with the secret header.
6. Invoke the endpoint once manually; confirm it authenticates, returns counts,
   and that a second run the same day sends nothing.
7. Correct the `.env.example` variable name and the documented per-environment URLs
   (done). The shipped origin is unchanged, so `eas.json` needs no repoint.
8. Run the CI verification gate against the live origin.
9. Build the production bundle, then submit.

**Rollback.** The mobile change is **not** reversible once published — a shipped
binary keeps its baked-in origin — which is why step 8 must pass before step 9.
If verification fails, halt the submission rather than publishing.

## Open Questions

None that block implementation. The host is decided (Railway retained) and the
earlier Cloud Run / Oracle Always Free migration is abandoned.

Items to read or confirm during execution — none change the specs, the chosen
approach, or the task breakdown:

- **Railway service region** — chosen historically in the dashboard; confirm it is
  reasonably close to Supabase `ap-northeast-1` (AWS Tokyo) when reviving the
  service.
- **Railway plan/allowance** — the suspended service is revived on an owner-chosen
  Railway plan; the release gate (Decision 4) guards against a future lapse.
