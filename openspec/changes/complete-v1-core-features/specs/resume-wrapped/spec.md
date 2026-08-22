## Purpose

Produces a shareable, upbeat summary of a user's career progress with explicit opt-in for every data point included.

## ADDED Requirements

### Requirement: Wrapped summary generation

The system SHALL generate a visual career summary from the user's latest resume score, improvement activity, strongest skill, biggest opportunity, career level and achievements.

#### Scenario: Generating a wrapped summary

- **WHEN** a user generates their Resume Wrapped
- **THEN** the summary shows score, strongest skill, biggest opportunity, level and achievements

### Requirement: Explicit inclusion opt-in

The system SHALL default every data point to excluded and SHALL only include data the user explicitly selects.

#### Scenario: Selecting what to include

- **WHEN** a user toggles individual data points before generating
- **THEN** only the selected data points appear in the wrapped output

### Requirement: No sensitive data by default

The system SHALL NOT include resume content, contact details or employer names unless the user explicitly opts in.

#### Scenario: Sharing without sensitive data

- **WHEN** a user shares a wrapped summary with default selections
- **THEN** the shareable output contains no contact details or raw resume text

### Requirement: Shareable output

The system SHALL allow the generated wrapped summary to be shared as an image through the system share sheet.

#### Scenario: Sharing the wrapped image

- **WHEN** a user taps Share on a generated wrapped summary
- **THEN** the system share sheet opens with the wrapped image
