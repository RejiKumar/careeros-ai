## Purpose

Provides structured AI interview practice sessions with generated questions and guided answer evaluation.

## ADDED Requirements

### Requirement: Interview sessions

The system SHALL let users create an interview session with a mode (HR, Technical, Behavioral, Manager, Startup or Custom) and optional target job and skills, derived from the resume where available.

#### Scenario: Creating a session

- **WHEN** a user starts an interview session and picks a mode
- **THEN** a session is created with questions generated for that mode

#### Scenario: Creating a session without a resume

- **WHEN** a user starts an interview session without an imported resume
- **THEN** questions are generated from the chosen mode and target skills only

### Requirement: Question generation

The system SHALL generate a set of interview questions per session from the resume, target job and target skills, covering the selected mode.

#### Scenario: Generating questions from a resume

- **WHEN** a session references a resume and target job
- **THEN** questions include resume-specific and role-relevant questions

### Requirement: Answer submission and evaluation

The system SHALL accept an answer per question and produce an evaluation covering relevance, clarity, structure, technical correctness and completeness.

#### Scenario: Evaluating an answer

- **WHEN** a user submits an answer to a question
- **THEN** the evaluation is shown with scores for each evaluation criterion

### Requirement: Guidance disclosure

The system SHALL clearly state that AI interview evaluation is guidance, not a definitive hiring judgment.

#### Scenario: Displaying the guidance note

- **WHEN** an evaluation is shown
- **THEN** the guidance disclosure is displayed with it
