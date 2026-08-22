## Purpose

Lets users explore the core product without an account and keep their work when they later sign up.

## ADDED Requirements

### Requirement: Guest session without an account

The system SHALL allow users to open the app and use resume import, health score, job match, roast and missions without signing in, backed by a local anonymous session.

#### Scenario: Opening the app as a guest

- **WHEN** a user opens the app without an account
- **THEN** the app starts in guest mode and shows the dashboard with guest-appropriate copy

#### Scenario: Importing a resume as a guest

- **WHEN** a signed-out user imports a resume
- **THEN** the import succeeds and the parsed resume and health score are shown

### Requirement: Guest data is preserved until migration

The system SHALL keep guest work available while the guest session exists and SHALL NOT discard it on app restart.

#### Scenario: Restarting the app as a guest

- **WHEN** a guest with imported data closes and reopens the app
- **THEN** the guest session and its data are restored

### Requirement: Guest-to-account migration

When a guest signs in or creates an account, the system SHALL transfer the guest's resumes, scores, matches, roast outputs and missions to the account, idempotently and without data loss.

#### Scenario: Signing in after guest usage

- **WHEN** a guest with existing data completes email/password sign-in
- **THEN** the guest data appears under the account and the guest session is cleared

#### Scenario: Migration is idempotent

- **WHEN** a migration runs twice for the same guest and account
- **THEN** no duplicate records are created and the account data is unchanged on the second run

### Requirement: Migration failure is reversible

The system SHALL surface migration failure without deleting guest data so the user can retry.

#### Scenario: Migration fails

- **WHEN** migration cannot complete (e.g., network failure)
- **THEN** the user sees an error with a retry action and the guest data remains intact
