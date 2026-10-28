# ADR-0002: Keep the API on Railway with an external reminder scheduler

- Status: accepted (2026-10-13). The hosting **stays on Railway** (revive the
  existing service); the previously explored Cloud Run and Oracle Cloud migrations
  were abandoned by the owner.
- Date: 2026-10-07
- Updated: 2026-10-13 (hosting reverted to Railway; migration docs withdrawn)
- Related: restore-production-api change (`openspec/changes/restore-production-api/`),
  `docs/runbooks/notifications-scheduler.md`, `docs/runbooks/release-gate.md`.

## Context

The Android build shipped to Google Play (v8) embeds
`https://careeros-ai-production.up.railway.app`. That origin returned **404 on every
path** because the Railway service's trial allowance had lapsed and no service was
bound to the domain. The owner has decided to **revive the Railway service** rather
than migrate to another host, so the production origin remains this URL and the
mobile build needs no change.

A second latent defect: `start_notification_scheduler()` ran APScheduler inside the
API process. It only fires while a container stays alive, and any host that scales
to zero silently stops delivering interview follow-ups and mission-streak nudges
with no error signal.

## Decision 1 — Keep the API on Railway (revive the existing service)

Continue hosting the existing `apps/api/Dockerfile` on the Railway service bound to
`https://careeros-ai-production.up.railway.app`. Reviving the service (or upgrading
the plan) is an owner action; no code or image change is required.

Rationale:

- The shipped build already embeds this URL, so staying on Railway needs **no mobile
  change, no new DNS and no new certificate**.
- Railway is a **managed** platform (TLS, deploys, logs); the alternatives evaluated
  were either self-managed (bare VM) or required re-architecture, and the owner
  judged that operational cost not worth paying for this workload.
- The original outage was a **lapsed trial**, not a platform limitation, and the
  release gate (Decision 4) now makes a dead origin impossible to ship again.

Consequences:

- Keep the **same domain** if the service is re-created or the plan changed, so
  already-shipped builds keep working; otherwise repoint `eas.json` and rebuild.
- Railway **variables/secrets** hold the `CAREEROS_*` configuration (see
  `apps/api/.env.example`). Secrets never enter the repository or a mobile build.
- There is no committed deploy definition; the service is configured in the Railway
  dashboard. The Dockerfile is the reproducible build input.

## Decision 2 — Move reminder invocation to an external scheduler behind a secret-guarded endpoint

Expose `POST /internal/notifications/run-due` (outside the `/api/v1` public prefix)
that takes no public actor, requires the `X-Scheduler-Secret` header validated with
constant-time comparison, and returns contact counts only — never who/what/when. A
scheduler invokes it on a fixed cadence; the mechanism is host-agnostic (a Railway
cron, a host `crontab`, or any external scheduler reaches the same endpoint). The
in-process APScheduler startup path is removed from the `lifespan()` hook, so
reminders behave identically on every host and environment.

Consequences:

- The chosen scheduler must provide a periodic invocation, or the endpoint must be
  invoked by an external timer. See `docs/runbooks/notifications-scheduler.md`.
- Not introducing a queue or message bus (no need; single job, idempotent).

## Decision 3 — Do not port to Cloudflare Workers (chosen against, deliberately)

Workers is the only option in scope that is cardless-free and not time-limited, and
its Cron Triggers would model the scheduler natively — a genuinely better fit on
both counts. It is rejected on **implementation cost, not merit**: `uvicorn[standard]`
(`httptools`/`uvloop`), `firebase-admin` (`grpcio`) and the Supabase SDK
(`realtime` → `websockets`) carry native or socket dependencies that do not run
under the Workers Python runtime, so the port is a rewrite, not a hosting change.
Revisit this decision only if circumstances change.

## Consequences

- The release gate is **fail-closed**: an externally distributed build profile must
  resolve to a verified HTTPS origin (`GET /health` → 200 `{"status":"ok"}` and the
  versioned `/api/v1` surface served) or CI fails before a build or submit.
- The API origin becomes a single documented source of truth per environment;
  `.env.example` and `apps/mobile/.env.example` record the mechanism, because EAS
  build profiles embed the shipped origin.
