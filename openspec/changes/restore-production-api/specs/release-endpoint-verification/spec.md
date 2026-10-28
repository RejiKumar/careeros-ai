## Purpose

Defines the release gate that verifies the API origin a production mobile build
will embed is actually reachable and healthy, so a dead or misconfigured backend
is caught by the release process rather than by users.

## ADDED Requirements

### Requirement: Production releases are gated on an endpoint reachability check

No production mobile build and no production submission SHALL proceed until the
API origin it will embed has been verified reachable and reporting a healthy
status from outside the deployment environment.

#### Scenario: Dead origin blocks the release

- **WHEN** the verification check runs against an origin that returns a non-success status, including the uniform 404 that indicates no service is bound
- **THEN** the release halts, no build or submission is produced, and the failure is reported

#### Scenario: Healthy origin allows the release

- **WHEN** the verification check runs against an origin that returns HTTP 200 from `GET /health` with an `"ok"` status
- **THEN** the release proceeds

### Requirement: The check verifies the origin that will actually be embedded

The verification SHALL target the resolved API base URL of the build profile being
released. It SHALL NOT validate a different or hardcoded origin than the one the
produced binary will carry.

#### Scenario: Profile-specific target

- **WHEN** the production and device-test profiles resolve to different origins
- **THEN** each profile's check targets that profile's own resolved origin

#### Scenario: Unresolvable configuration

- **WHEN** a build profile resolves to an empty, relative, or loopback API base URL and is designated for external distribution
- **THEN** the check fails without contacting any origin, and reports which profile was invalid

### Requirement: Verification failures are actionable

A failing check SHALL report the origin that failed, the status or error observed,
the build profile affected, and the documented remediation, so that a maintainer
can resolve it without reading source code.

#### Scenario: Diagnostics are sufficient to remediate

- **WHEN** the check fails
- **THEN** the output names the origin, the profile, the observed failure, and the remediation step to take

### Requirement: The check verifies more than the health probe

A passing check SHALL confirm that the origin serves the versioned application
routes and not merely a liveness response, because an origin can answer `/health`
while failing to serve the API the app actually calls.

#### Scenario: Probe answers but application routes do not

- **WHEN** the origin returns HTTP 200 for the health probe but returns a non-success status for the versioned API surface
- **THEN** the check fails and reports that the application routes are unavailable

#### Scenario: Authenticated route is confirmed served

- **WHEN** the check runs against a healthy origin
- **THEN** it confirms that the versioned route surface is served and that an unauthenticated request to a protected route yields an authentication error rather than a routing error, proving the route is mounted and guarded