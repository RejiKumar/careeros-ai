# Notifications Scheduler Runbook

Grounded daily reminders (interview follow-ups and mission-streak nudges) are
delivered on a fixed cadence independent of API process lifetime, host scaling
and environment.

## Trigger endpoint

`POST /internal/notifications/run-due`

- **Mounted outside `/api/v1`** (see `apps/api/app/main.py`) so it is
  unambiguously not part of the public contract. Under `/api/v1` it does not
  exist (404 is not an error and is asserted by contract tests).
- **No public actor.** Execution is server-side only; it runs the reminder query
  as the service role and returns counts, never contact details.
- **Request auth:** header `X-Scheduler-Secret` must match the configured
  `CAREEROS_SCHEDULER_SECRET`, compared in constant time
  (`secrets.compare_digest`). Unauthorized / mismatched / missing header →
  `401`. Bearer-style tokens and every other auth path are rejected.
- **Configuration missing:** when `CAREEROS_SCHEDULER_SECRET` is unset the
  endpoint answers `503 {"detail":"scheduler_not_configured"}` — fail closed,
  so a host with no secret can never be silently driven.
- **Response (`ReminderRunResponse`):**
  `{"reminders_processed": <int>, "pushes_delivered": <int>}`. Explicitly no
  recipient/entity data (data-safety rule: never log tokens, raw resumes, full
  prompts or emails).
- **Idempotent:** reminders are selected with a pinned clock so re-runs within
  a cadence deliver at most once per recipient per day; the count is the
  scheduler's only side effect to observe.
- **Delivery:** FCM push via Firebase. When Firebase is not configured
  (`CAREEROS_FIREBASE_CREDENTIALS_JSON` absent) `pushes_delivered` is 0 while
  `reminders_processed` still counts — configure Firebase (change task 5.1)
  before relying on delivery.

## Scheduler invocation

Any periodic invoker works; the endpoint is host-agnostic. On Railway, use a
Railway cron job, or run an external timer (systemd timer / `crontab`) that
calls the public origin:

```bash
curl -fsS -X POST \
  -H "X-Scheduler-Secret: ${CAREEROS_SCHEDULER_SECRET}" \
  https://careeros-ai-production.up.railway.app/internal/notifications/run-due
```

```cron
0 * * * * curl -fsS -X POST -H "X-Scheduler-Secret: $CAREEROS_SCHEDULER_SECRET" \
  https://careeros-ai-production.up.railway.app/internal/notifications/run-due
```

One job is sufficient: `run_due()` evaluates both reminder types in a single
pass. Failures must leave an observable signal (Railway logs / systemd journal),
not only an in-process log line.

## Local testing

```bash
# .venv active in apps/api
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  http://localhost:8000/internal/notifications/run-due          # 401 (no secret header)
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  -H "X-Scheduler-Secret: wrong" \
  http://localhost:8000/internal/notifications/run-due          # 401
# with CAREEROS_SCHEDULER_SECRET exported to a value, echoing that value's header:
curl -s -H "X-Scheduler-Secret: $CAREEROS_SCHEDULER_SECRET" \
  -X POST http://localhost:8000/internal/notifications/run-due  # 200 counts
```
