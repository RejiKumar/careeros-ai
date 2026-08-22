## Purpose

Lets the user pick a resume document from their device, validate it locally, upload it to the CareerOS API with their session token, and review the AI-parsed result before it becomes their resume content.

## ADDED Requirements

### Requirement: Document selection

The app SHALL open the system document picker restricted to PDF, DOCX and TXT files and SHALL reject selections outside that set with an explicit message.

#### Scenario: Pick a supported file

- **WHEN** the user picks a PDF, DOCX or TXT file
- **THEN** the file is accepted for the next validation step

#### Scenario: Pick an unsupported file

- **WHEN** the user picks a file with an unsupported extension
- **THEN** the app shows an inline error and does not upload the file

#### Scenario: Cancel the picker

- **WHEN** the user cancels the document picker
- **THEN** the app remains on the resume screen without an error

### Requirement: Local file validation

The app SHALL validate file size against the API limit (10 MB) before upload and SHALL report oversized files without calling the backend.

#### Scenario: Oversized file

- **WHEN** the selected file exceeds 10 MB
- **THEN** the app shows an explicit size error and does not upload

### Requirement: Authenticated upload and parse

The app SHALL upload the selected file to `POST /resumes/import` with the user's bearer token and SHALL show a loading state while parsing is in progress.

#### Scenario: Successful import

- **WHEN** the upload succeeds and the API returns the parsed resume
- **THEN** the app displays the parsed contact, summary, skills, experience and education for review

#### Scenario: Upload failure

- **WHEN** the upload or parsing fails
- **THEN** the app shows an explicit error state with a retry action that re-uploads the same file

#### Scenario: Session expired during upload

- **WHEN** the API rejects the request due to an invalid session
- **THEN** the app returns the user to the auth screen

### Requirement: Reviewable parsed output

The app SHALL present parsed resume content as AI-derived and reviewable, never as automatically applied user content.

#### Scenario: Parsed result shown with review notice

- **WHEN** the parsed resume is displayed
- **THEN** it is labeled as reviewable AI extraction and no AI output is treated as final user content
