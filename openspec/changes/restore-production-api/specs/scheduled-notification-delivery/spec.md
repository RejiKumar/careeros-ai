## Purpose

Defines how the product's daily grounded reminders — interview and follow-up
nudges, and mission-streak prompts — are delivered reliably regardless of whether
the API process happens to be running continuously.

## ADDED Requirements

### Requirement: Reminder delivery is independent of API process lifetime

The system SHALL deliver scheduled reminders on a fixed cadence that does not
depend on any particular API process remaining alive between requests. Reminders
SHALL be delivered even when the serving host scales to zero between invocations
or replaces instances.

#### Scenario: Host scales to zero between intervals

- **WHEN** the serving host releases all capacity after handling a request and remains idle until the next scheduled interval
- **THEN** reminders due in that interval are still evaluated and delivered

#### Scenario: Instance is replaced mid-interval

- **WHEN** the platform terminates and replaces the serving instance after a request but before the next scheduled interval
- **THEN** at least one scheduled evaluation occurs within that interval

#### Scenario: Multiple instances exist

- **WHEN** the host runs more than one serving instance concurrently
- **THEN** reminder delivery continues to satisfy the per-recipient per-day idempotency requirement

### Requirement: Scheduling is not gated on environment name

The system SHALL evaluate due reminders in every deployment environment where
notification delivery is configured, and SHALL NOT depend on an environment
identifier string matching a hardcoded allow-list in order to run. Environments
that lack notification credentials SHALL skip delivery and say so, rather than
silently appearing healthy.

#### Scenario: Non-production environment with credentials configured

- **WHEN** the API runs in an environment other than production or QA with notification credentials present
- **THEN** due reminders are evaluated and delivered on the same cadence as production

#### Scenario: Environment without notification credentials

- **WHEN** the API runs in an environment lacking notification credentials
- **THEN** due reminders are evaluated and counted, no push is attempted, and the reason is recorded in logs

### Requirement: Reminder delivery is externally invocable through an authenticated endpoint

The system SHALL expose an endpoint that evaluates and delivers all due reminders
in a single pass, for use by an external scheduler. The endpoint SHALL reject
callers that do not present valid service credentials, and SHALL NOT be reachable
with end-user tokens or guest identifiers.

#### Scenario: Valid service credential is accepted

- **WHEN** an authorized scheduler calls the reminder endpoint with valid service credentials
- **THEN** due reminders are evaluated and the response reports the counts of candidates and deliveries per reminder type

#### Scenario: Missing or invalid credential is rejected

- **WHEN** the reminder endpoint is called with no credential, an invalid credential, an expired end-user access token, or only a guest identifier
- **THEN** the request is rejected with an authentication error and no reminder is evaluated or delivered

#### Scenario: End-user enumeration is not exposed

- **WHEN** the reminder endpoint response is inspected
- **THEN** it reports aggregate counts only and discloses no user email address, resume content, application detail or token

### Requirement: Reminders are idempotent per recipient per day

The system SHALL deliver at most one reminder of each type to each recipient on
any given calendar day, even if the scheduled evaluation runs more than once, and
SHALL record the delivery so that repeat runs can be suppressed.

#### Scenario: Evaluation runs twice in one day

- **WHEN** the reminder evaluation runs more than once on the same calendar day for the same recipient
- **THEN** the recipient receives at most one reminder of each type for that day

#### Scenario: Evaluation runs again the following day

- **WHEN** the reminder evaluation runs on a later calendar day for a recipient who has not already received that reminder type that day
- **THEN** the reminder is delivered and recorded

### Requirement: Reminder content is grounded and respects recipient preferences

Reminder text SHALL be derived only from the recipient's own stored data — for
example a scheduled interview date or an incomplete mission — and SHALL NOT
assert facts that are absent from that data. Recipients whose stored preferences
disable a reminder type SHALL NOT receive it.

#### Scenario: Upcoming date exists

- **WHEN** a recipient has an application whose stored interview or follow-up date equals today and has that reminder type enabled
- **THEN** a reminder is delivered referencing that stored date

#### Scenario: No qualifying data

- **WHEN** a recipient has no application due today and no active missions
- **THEN** no reminder of any type is delivered

#### Scenario: Preference disabled

- **WHEN** a recipient has disabled the reminder type in stored preferences
- **THEN** no reminder of that type is delivered regardless of their data

### Requirement: Scheduler failures are observable

The system SHALL make a failed or missed reminder run detectable by an operator
through a signal that survives the process that failed, rather than only a log
line emitted by that process. Startup and per-run errors SHALL NOT be reduced to a
bare "continuing without it" condition.

#### Scenario: Scheduled run fails

- **WHEN** a reminder evaluation raises an unexpected error
- **THEN** the failure is recorded such that a subsequent operator check or the next scheduled run can observe it

#### Scenario: Scheduler could not start

- **WHEN** reminder scheduling cannot be initialised in a given environment
- **THEN** the condition is reported at an error level naming the environment and the missing prerequisite, rather than only as an informational log