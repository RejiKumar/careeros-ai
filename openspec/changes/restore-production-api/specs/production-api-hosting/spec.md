## Purpose

Defines the guarantee that the CareerOS AI backend is reachable, verifiable and
correctly referenced by released mobile builds, so that a production install can
actually use the product's features.

## ADDED Requirements

### Requirement: Production API is publicly reachable over TLS

The system SHALL expose the production API at an origin resolvable via public DNS
and serving HTTPS, without requiring client-side configuration or a VPN, such that
a consumer with only the origin string can reach it.

#### Scenario: External consumer resolves and reaches the origin

- **WHEN** an unauthenticated HTTPS client requests `GET /health` at the published production origin from outside the deployment environment
- **THEN** the response status is 200 and the body reports an `"ok"` status

#### Scenario: Plain HTTP is not advertised

- **WHEN** a consumer requests the production origin over `http://`
- **THEN** the platform redirects to HTTPS or refuses the request, and the API is never served over cleartext

#### Scenario: Application routes are mounted, not only the health probe

- **WHEN** a consumer requests the OpenAPI document or interactive docs at the production origin
- **THEN** the response status is 200 and the document enumerates the versioned API routes

> The last scenario is a deliberate regression guard. A uniform 404 across
> `/health`, `/docs` and `/openapi.json` is the signature of an origin with no
> service bound to it, which is exactly the failure that produced the current
> incident.

### Requirement: Production hosting does not depend on a lapsed trial

The production API SHALL run on a host whose continued availability does not
depend on an unmonitored trial balance silently expiring, and whose loss is
detected before a release ships rather than by users in production.

#### Scenario: Lapsed hosting is caught before release

- **WHEN** the production origin stops serving while a release is prepared
- **THEN** the release gate fails and no build or submission proceeds

#### Scenario: Hosting configuration is reproducible from the repository

- **WHEN** a maintainer needs to recreate the production deployment
- **THEN** the container build definition and the required environment variable names are discoverable in the repository, without relying solely on a provider dashboard

### Requirement: Released mobile builds embed the published production origin

A production mobile build SHALL embed the published production API origin as its
API base URL. No released build SHALL embed an origin that is not published and
verified reachable.

#### Scenario: Production profile embeds the published origin

- **WHEN** a production build profile is resolved
- **THEN** the resulting API base URL equals the published production origin

#### Scenario: No profile ships a placeholder or local origin

- **WHEN** any build profile designated for external distribution is resolved
- **THEN** its API base URL is an absolute HTTPS origin, and is not `localhost`, a loopback address, or an internal-only hostname

### Requirement: Each environment has exactly one documented API origin

The repository SHALL document, for each of `dev`, `qa` and `prod`, the single API
origin that build configuration resolves to, and the documented value SHALL match
the value actually embedded by the build tooling.

#### Scenario: Documented and configured origins agree

- **WHEN** a reviewer compares the origin documented for an environment against the origin embedded by that environment's build profile
- **THEN** the two values are identical

#### Scenario: Variable naming matches what the app reads

- **WHEN** a maintainer copies the environment reference file into a working `.env` and sets the documented API URL variable
- **THEN** the mobile client resolves that value as its API base URL, without requiring a differently named variable

### Requirement: Server secrets are supplied by deployment configuration only

The production API SHALL receive its Supabase service-role key, AI provider key and
push notification credentials from the hosting platform's secret store. No such
value SHALL appear in the repository, in a mobile build, or in build logs.

#### Scenario: Repository contains no server secrets

- **WHEN** the repository is searched for the production service-role key, AI provider key and Firebase credentials
- **THEN** no match is found in any tracked file

#### Scenario: Mobile binary contains no server secrets

- **WHEN** a production build profile's environment is inspected
- **THEN** it contains only public client configuration and no service-role, AI provider or notification credential

### Requirement: Production builds do not permit cleartext traffic

A production mobile build SHALL NOT enable cleartext network traffic. Cleartext
permission SHALL be limited to builds intended for local development against a
loopback API.

#### Scenario: Release manifest disallows cleartext

- **WHEN** the Android manifest is inspected from a production build
- **THEN** the application element does not set `usesCleartextTraffic="true"`

#### Scenario: Development builds retain local API access

- **WHEN** a development build is created to target a loopback API
- **THEN** cleartext traffic to that loopback origin remains permitted
