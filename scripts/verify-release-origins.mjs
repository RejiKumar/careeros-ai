/**
 * Release verification gate for the mobile build profiles.
 *
 * Resolves the API origin for every externally distributed build profile in
 * `apps/mobile/eas.json` and proves the deployment behind it is actually
 * serving the versioned API. This is the guard that catches the exact failure
 * this change exists to fix: a release built against a host that returns 404
 * for every route.
 *
 * Behaviour:
 *   1. A profile marked for external distribution whose origin is empty,
 *      relative, loopback or plain http fails here, WITHOUT network traffic —
 *      the check is the same logic the app itself uses at startup.
 *   2. Every externally distributed profile must answer `GET /health` with
 *      status 200 and body `{"status":"ok"}`.
 *   3. The VERSIONED route surface must also be served — a host that answers
 *      `/health` but 404s the `/api/v1/*` contract fails. This is the
 *      uniform-404 regression check.
 *
 * Exit code is non-zero when any profile fails. Run locally with:
 *   node scripts/verify-release-origins.mjs
 * or as a CI job via `.github/workflows/release-gate.yml`.
 */

import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ApiOriginError,
  isExternallyDistributed,
  resolveApiOrigin,
} from "../apps/mobile/src/config/api-origin.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EAS_PATH = path.resolve(__dirname, "../apps/mobile/eas.json");
const REQUEST_TIMEOUT_MS = 15000;

const REMEDIATION =
  'Set "EXPO_PUBLIC_API_URL" in apps/mobile/eas.json to the deployed origin ' +
  "(e.g. https://your-api-host.example.com), ensure the service is live, then re-run this gate.";

/** One resolved build profile with its origin. */
class ResolvedProfile {
  constructor(name, appEnv, origin, distribution, remediation) {
    this.name = name;
    this.appEnv = appEnv;
    this.origin = origin;
    this.distribution = distribution;
    this.remediation = remediation;
  }

  label() {
    return `eas.json:build.${this.name}`;
  }
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadProfiles() {
  if (!(await fileExists(EAS_PATH))) {
    throw new Error(`eas.json not found at ${EAS_PATH}`);
  }
  const eas = JSON.parse(await readFile(EAS_PATH, "utf-8"));
  const profiles = eas?.build ?? {};
  return Object.entries(profiles).map(([name, profile]) => ({ name, profile }));
}

function resolveProfile(name, profile) {
  const env = profile?.env ?? {};
  const distribution = profile.distribution ?? "store";
  const appEnv = env.EXPO_PUBLIC_APP_ENV ?? "dev";

  let origin;
  try {
    origin = resolveApiOrigin(env);
  } catch (error) {
    if (error instanceof ApiOriginError) {
      // Task 8.2: fail without contacting anything, naming the offending profile.
      throw new ResolvedProfile(name, appEnv, null, distribution, error.message);
    }
    throw error;
  }
  return new ResolvedProfile(name, appEnv, origin, distribution, null);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
    });
    const body = await response.text();
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function isHealthOk(response) {
  if (response.status !== 200) {
    return false;
  }
  try {
    return JSON.parse(response.body)?.status === "ok";
  } catch {
    return false;
  }
}

async function probe(profile) {
  const failures = [];
  const healthUrl = `${profile.origin}/health`;
  const versionedUrl = `${profile.origin}/api/v1/health`;

  let health;
  try {
    health = await fetchWithTimeout(healthUrl);
  } catch (error) {
    failures.push(
      `GET ${healthUrl} could not be reached: ${error.name}${
        error.cause ? ` (${error.cause.message})` : ""
      }.`,
    );
  }

  if (health) {
    if (!isHealthOk(health)) {
      failures.push(
        `GET ${healthUrl} → HTTP ${health.status} body ${JSON.stringify(health.body.slice(0, 120))}. ` +
          "Expected 200 with an \"ok\" status.",
      );
    } else {
      let versioned;
      try {
        versioned = await fetchWithTimeout(versionedUrl);
      } catch (error) {
        failures.push(
          `GET ${versionedUrl} could not be reached: ${error.name}.`,
        );
      }
      if (versioned && versioned.status !== 200) {
        failures.push(
          `GET ${versionedUrl} → HTTP ${versioned.status}. The versioned route ` +
            "surface is not served; /health alone is not proof the API is deployed.",
        );
      }
    }
  }

  return failures;
}

async function main() {
  const profiles = await loadProfiles();
  const external = [];
  let shapeFailures = 0;

  for (const { name, profile } of profiles) {
    if (!isExternallyDistributed(profile?.env?.EXPO_PUBLIC_APP_ENV)) {
      console.log(`[skip]   ${name}: not externally distributed, not probed.`);
      continue;
    }

    let resolved;
    try {
      resolved = resolveProfile(name, profile);
    } catch (error) {
      if (error instanceof ResolvedProfile) {
        shapeFailures += 1;
        console.error(`[fail]   ${name}: ${error.remediation}`);
        console.error(`         origin is not usable for external distribution.`);
        continue;
      }
      throw error;
    }

    console.log(`[check]  ${resolved.label()}: resolving ${resolved.origin}`);
    if (resolved.appEnv !== "prod") {
      console.error(
        `         (note: EXPO_PUBLIC_APP_ENV is "${resolved.appEnv}" but the profile ` +
          "was classified as externally distributed by the resolver)",
      );
    }
    external.push(resolved);

    const failures = await probe(resolved);
    for (const failure of failures) {
      shapeFailures += 1;
      console.error(`[fail]   ${resolved.label()} origin ${resolved.origin}: ${failure}`);
      console.error(`         Remediation: ${REMEDIATION}`);
    }
  }

  if (profiles.length === 0) {
    console.error("[fail]   eas.json declares no build profiles.");
    process.exitCode = 1;
    return;
  }
  if (shapeFailures > 0) {
    console.error(`\n[result] ${shapeFailures} profile(s) failed; ${external.length} probed.`);
    process.exitCode = 1;
    return;
  }
  if (external.length === 0) {
    console.error("[fail]   no externally distributed profile was found to verify.");
    process.exitCode = 1;
    return;
  }
  console.log(`\n[result] OK: ${external.map((p) => p.name).join(", ")} reachable and serving /api/v1.`);
}

main().catch((error) => {
  console.error(`[fail]   ${error.message}`);
  process.exitCode = 1;
});