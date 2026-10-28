/**
 * Single source of truth for the API base URL of a build profile.
 *
 * Every profile in `eas.json` sets `EXPO_PUBLIC_API_URL` by hand, and those
 * values previously drifted until a release build shipped pointing at a dead
 * host. Resolving the origin in one place means a misconfigured profile fails
 * here, loudly, instead of surfacing as a dashboard that never loads.
 *
 * Validation is regex-based rather than `URL`-based on purpose: Hermes ships a
 * partial `URL` implementation, and this module runs during app startup on the
 * device where it must behave identically on every platform.
 */

/** Environment values a build profile may provide. */
export interface ApiOriginEnv {
  EXPO_PUBLIC_API_URL?: string | undefined;
  EXPO_PUBLIC_APP_ENV?: string | undefined;
}

export const DEFAULT_APP_ENV = "dev";

/** App env whose builds are distributed to people outside the team. */
const EXTERNAL_APP_ENV = "prod";

/** scheme://host[:port][/path] with no query, fragment or trailing whitespace. */
const ABSOLUTE_HTTP_URL = /^(https?):\/\/([^/?#]+)(\/[^?#]*)?$/i;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "[::1]"]);

/** Thrown when a profile's configured origin cannot be used. */
export class ApiOriginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiOriginError";
  }
}

/** True when the build is destined for external distribution. */
export function isExternallyDistributed(appEnv: string | undefined): boolean {
  return (appEnv ?? DEFAULT_APP_ENV).trim().toLowerCase() === EXTERNAL_APP_ENV;
}

function isLoopbackHost(host: string): boolean {
  const lowered = host.toLowerCase();
  if (LOOPBACK_HOSTS.has(lowered)) {
    return true;
  }
  // Any address in 127.0.0.0/8 is loopback, not just 127.0.0.1.
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(lowered);
}

/**
 * Resolve and validate the API origin for a build profile.
 *
 * For a profile marked for external distribution this rejects an empty,
 * relative, non-HTTPS or loopback origin. For local profiles it is permissive,
 * because `http://localhost:8000` reached through `adb reverse` is the intended
 * development setup.
 *
 * @returns the origin with any trailing slashes removed, or `""` when unset for
 * a non-external profile (preserving the previous permissive default).
 * @throws {ApiOriginError} when the configured value is unusable for the profile.
 */
export function resolveApiOrigin(env: ApiOriginEnv): string {
  const external = isExternallyDistributed(env.EXPO_PUBLIC_APP_ENV);
  const raw = (env.EXPO_PUBLIC_API_URL ?? "").trim();

  if (raw === "") {
    if (external) {
      throw new ApiOriginError(
        "EXPO_PUBLIC_API_URL is not set. This profile is built for external " +
          "distribution and must point at the deployed API.",
      );
    }
    return "";
  }

  const match = ABSOLUTE_HTTP_URL.exec(raw);
  if (!match) {
    throw new ApiOriginError(
      `EXPO_PUBLIC_API_URL must be an absolute http(s) URL, received "${raw}".`,
    );
  }

  const [, schemeRaw = "", authority = "", path = ""] = match;
  const scheme = schemeRaw.toLowerCase();

  // Credentials in a URL are a phishing and log-leak vector; never allow them.
  if (authority.includes("@")) {
    throw new ApiOriginError("EXPO_PUBLIC_API_URL must not embed credentials.");
  }

  const hostPart = authority.startsWith("[")
    ? authority.slice(0, authority.indexOf("]") + 1)
    : (authority.split(":")[0] ?? "");
  const port = authority.startsWith("[")
    ? authority.slice(authority.indexOf("]") + 1)
    : authority.split(":")[1];

  if (hostPart === "") {
    throw new ApiOriginError(`EXPO_PUBLIC_API_URL has no host: "${raw}".`);
  }

  // Loopback is only rejected for external builds. A local profile relies on it:
  // `adb reverse tcp:8000 tcp:8000` makes the host's API reachable at
  // localhost on the device.
  if (external && isLoopbackHost(hostPart)) {
    throw new ApiOriginError(
      `EXPO_PUBLIC_API_URL points at loopback host "${hostPart}". This profile is ` +
        "built for external distribution, so a device-local address is unreachable.",
    );
  }

  if (external && scheme !== "https") {
    throw new ApiOriginError(
      `EXPO_PUBLIC_API_URL must use https for external distribution, received "${scheme}".`,
    );
  }

  const normalizedHost = hostPart.toLowerCase();
  const authorityOut = port ? `${normalizedHost}:${port}` : normalizedHost;
  return `${scheme}://${authorityOut}${path}`.replace(/\/+$/, "");
}

/** Convenience wrapper reading the current process environment. */
export function currentApiOrigin(): string {
  return resolveApiOrigin({
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  });
}
