## Purpose

Makes coach conversations more usable with suggested prompts, message copy and regenerate, while clearly disclosing that AI output is guidance.

## ADDED Requirements

### Requirement: Suggested prompts

The coach screen SHALL offer suggested prompts the user can tap to start or continue a conversation.

#### Scenario: Using a suggested prompt

- **WHEN** a user taps a suggested prompt
- **THEN** the prompt is sent as the user's message and the coach replies

### Requirement: Copy message

The user SHALL be able to copy an AI coach message to the clipboard.

#### Scenario: Copying a coach message

- **WHEN** a user taps copy on a coach message
- **THEN** the message content is placed on the clipboard

### Requirement: Regenerate last reply

The user SHALL be able to regenerate the last coach reply to the same user message.

#### Scenario: Regenerating a reply

- **WHEN** a user taps regenerate on the latest coach message
- **THEN** the coach produces a new reply to the same user message and replaces the old one

### Requirement: AI guidance disclosure

The coach experience SHALL display a persistent disclosure that AI answers are guidance, not verified career advice.

#### Scenario: Displaying the disclosure

- **WHEN** a user opens a coach conversation
- **THEN** the guidance disclosure is visible in the conversation
