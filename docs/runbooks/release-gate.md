# Release Gate Runbook

A production build or submission is gated on a passing reachability and health
check against the API origin it embeds.

## What it verifies

For every externally distributed build profile in `apps/mobile/eas.json`
(currently `build.production` and `build.device-test`):

1. **Resolve** the origin through the real resolver
   (`apps/mobile/src/config/api-origin.ts`) — imported directly (Node 24 native
   TS) so the gate can never drift from the app.
2. **Shape check:** an empty, relative or loopback origin fails **before**
   anything is contacted, naming the offending profile.
3. **Health:** `GET <origin>/health` must be 200 with `{"status":"ok"}`.
4. **Route surface:** `GET <origin>/api/v1/health` must be 200, confirming the
   versioned surface (not just the probe) is served — a uniform-404 host is
   exactly the failure this gate exists to catch.

On any failure it prints the origin, the profile, the observed status/error and
the remediation step, then exits 1.

## Run it locally

```bash
# repo root
pnpm verify:release-origins
```

### Expected result while the Railway service is down

The gate **fails** — `production` and `device-test` both resolve to
`https://careeros-ai-production.up.railway.app`, which answered 404
`{"status":"error","code":404,"message":"Application not found",...}` on
`/health` while the service was suspended. **This is by design (fail closed):** a
release cannot silently ship a dead origin again. The origin is unchanged; the
gate passes once the Railway service is live again at that same URL.

```text
$ pnpm verify:release-origins
[check]  eas.json:build.production: resolving https://careeros-ai-production.up.railway.app
[fail]   eas.json:build.production origin https://careeros-ai-production.up.railway.app: GET .../health → HTTP 404 ...
         Remediation: Ensure the Railway service behind EXPO_PUBLIC_API_URL is live, then re-run
         this gate (or repoint eas.json if the origin has changed).
[result] 2 profile(s) failed; 2 probed.
```

## CI

`.github/workflows/release-gate.yml` runs the same script on pushes to `main`
and `prod` and via `workflow_dispatch`, on Node 24 with
`--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` (the script imports the TS
resolver without a bundler).

## Remediation when it fails

1. Confirm the origin is up: `curl -i <origin>/health`.
2. If it is a new deploy, record the deployed origin into `eas.json` (both
   profiles), then re-run the gate locally; commit the change together with the
   deploy so CI turns green in the same push.
3. If the origin is genuinely dead, do not build or submit — revive/repair the
   Railway service first.
