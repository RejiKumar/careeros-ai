## Purpose

Triggers and displays the AI resume health assessment (per-dimension scores, strengths, gaps with suggestions and evidence) as reviewable output, fulfilling the home screen's Resume Health promise.

## ADDED Requirements

### Requirement: Health score generation

The app SHALL trigger an assessment for the imported resume via `POST /resumes/{id}/assessments` and SHALL show a loading state while the AI is scoring.

#### Scenario: Assessment requested

- **WHEN** the user taps "Get my health score" on an imported resume
- **THEN** the app requests the assessment and shows a loading state

#### Scenario: Assessment failure

- **WHEN** the assessment request fails
- **THEN** the app shows an explicit error state with a retry action

### Requirement: Score presentation

The app SHALL present the overall score, per-dimension scores (0-100), strengths, gaps with suggestions, and evidence in an accessible, readable layout.

#### Scenario: Scores displayed

- **WHEN** the assessment completes
- **THEN** the user can read the overall score, each dimension score with explanation, strengths, gaps with actionable suggestions, and the evidence the AI used

#### Scenario: Missing score sections

- **WHEN** the assessment returns no strengths, gaps or evidence
- **THEN** the app shows the empty sections as explicit empty states rather than hiding them

### Requirement: Reviewability and honesty

The app SHALL label the health score as AI-derived and SHALL never present a low score as a statement about the user's actual skill.

#### Scenario: Review notice shown

- **WHEN** the assessment result is displayed
- **THEN** it is labeled as reviewable AI output and score explanations reflect only evidence present in the resume
