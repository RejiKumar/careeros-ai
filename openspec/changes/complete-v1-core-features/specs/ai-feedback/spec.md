## Purpose

Collects lightweight user feedback on AI outputs so quality can be measured and improved without storing unnecessary sensitive content.

## ADDED Requirements

### Requirement: Feedback controls on AI outputs

Every AI-generated output in the coach, job match, roast and rewrites experiences SHALL offer Helpful and Not helpful actions.

#### Scenario: Rating an AI output as helpful

- **WHEN** a user taps Helpful on an AI output
- **THEN** the rating is stored against that output and the control reflects the choice

#### Scenario: Rating an AI output as not helpful

- **WHEN** a user taps Not helpful on an AI output
- **THEN** the rating is stored and an optional reason prompt is shown

### Requirement: Optional feedback reason

The system SHALL accept an optional reason with choices Incorrect, Too generic, Not relevant, Too long and Other, with a free-text field for Other.

#### Scenario: Submitting a reason

- **WHEN** a user selects a reason and submits
- **THEN** the reason is stored with the rating

#### Scenario: Skipping the reason

- **WHEN** a user submits Not helpful without a reason
- **THEN** the rating is stored without a reason

### Requirement: Feedback privacy

The system SHALL store feedback keyed to the AI output reference without storing resume contents or conversation text.

#### Scenario: Storing feedback without sensitive content

- **WHEN** feedback is persisted
- **THEN** only the output reference, rating, reason and timestamp are stored

### Requirement: One rating per output per user

The system SHALL allow a user to change their rating on an output, keeping only the latest.

#### Scenario: Changing a rating

- **WHEN** a user rates an output Not helpful and then rates it Helpful
- **THEN** the stored rating for that output is Helpful
