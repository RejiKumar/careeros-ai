## Purpose

Gives users a candid, entertaining review of their resume in five distinct modes while always landing on constructive, actionable improvement advice.

## ADDED Requirements

### Requirement: Five roast modes

The system SHALL offer Friendly Mentor, Professional HR, Brutal HR, Funny Roast and Robot Recruiter modes for a resume roast.

#### Scenario: Selecting a roast mode

- **WHEN** a user selects a roast mode and starts a roast
- **THEN** the output matches that mode's tone and is generated from the parsed resume

### Requirement: Roast always ends with actionable improvements

Every roast SHALL conclude with at least two concrete, actionable improvement suggestions grounded in the resume content.

#### Scenario: Roast includes improvements

- **WHEN** a roast is generated
- **THEN** the output ends with improvement suggestions referencing only facts present in the resume

### Requirement: No abusive or discriminatory content

The system SHALL NOT generate content that is abusive, discriminatory or humiliating, and SHALL constrain all modes to constructive critique.

#### Scenario: Constraining brutal modes

- **WHEN** the Brutal HR or Funny Roast mode is requested
- **THEN** the output is blunt and humorous but never personal, abusive or discriminatory

### Requirement: Roast requires a parsed resume

The system SHALL require an existing parsed resume and SHALL show an empty state prompting resume import when none exists.

#### Scenario: Roasting without a resume

- **WHEN** a user opens the roast screen without an imported resume
- **THEN** the app shows an empty state with a link to import a resume
