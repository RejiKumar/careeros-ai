## Purpose

Authenticates the user with Supabase Auth (email/password and Google OAuth) and keeps the session across app launches so every authenticated feature can call the API with a bearer token.

## ADDED Requirements

### Requirement: Sign in and account creation
The app SHALL provide email/password sign in and account creation. Errors SHALL be shown inline with explicit retry, and validation SHALL reject empty or malformed input without calling the backend.

#### Scenario: Successful sign in
- **WHEN** the user enters a valid email and password and submits the sign-in form
- **THEN** the app stores the session securely and navigates to the home screen

#### Scenario: Invalid credentials
- **WHEN** the user submits an email or password that Supabase rejects
- **THEN** the app shows an inline error message and keeps the user on the auth screen

#### Scenario: Empty fields
- **WHEN** the user submits the form with empty email or password
- **THEN** the app shows a validation message and does not call the auth service

#### Scenario: Create account
- **WHEN** the user submits the account creation form with a new email and password
- **THEN** the app creates the account, stores the session securely, and navigates to the home screen

### Requirement: Google sign in
The app SHALL offer Google sign in through the system browser, SHALL complete the OAuth flow on return to the app, and SHALL store the resulting session exactly like email/password sessions.

#### Scenario: Google sign in succeeds
- **WHEN** the user taps "Continue with Google" and completes the Google account consent in the browser
- **THEN** the app stores the session securely and navigates to the home screen

#### Scenario: Google sign in cancelled
- **WHEN** the user cancels the Google consent screen
- **THEN** the app returns to the auth screen without an error or a session

#### Scenario: Google sign in fails
- **WHEN** the OAuth exchange fails (invalid or expired code)
- **THEN** the app shows an inline error and stays on the auth screen

### Requirement: Session persistence and restore
The app SHALL persist the authenticated session in secure storage and SHALL restore it automatically on launch.

#### Scenario: App launch with stored session
- **WHEN** the app launches and a valid session exists in secure storage
- **THEN** the app starts on the home screen without asking for credentials

#### Scenario: App launch without a session
- **WHEN** the app launches and no session exists
- **THEN** the app shows the auth screen

#### Scenario: Sign out
- **WHEN** the user signs out
- **THEN** the app clears the stored session and returns to the auth screen

### Requirement: Session error handling
The app SHALL treat an invalid or expired session as signed out and return the user to the auth screen with an explanatory message.

#### Scenario: Expired or invalid session
- **WHEN** an API call fails with an authentication error
- **THEN** the app clears the session and shows the auth screen

#### Scenario: Auth service unavailable
- **WHEN** Supabase Auth cannot be reached during sign in
- **THEN** the app shows an explicit error state with a retry action
