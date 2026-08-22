## Purpose

Recognizes user progress with named achievements awarded from existing activity, displayed in the profile.

## ADDED Requirements

### Requirement: Achievement definitions

The system SHALL define achievements for ATS Warrior, Resume Master, Interview Ready, 7-Day Streak and Perfect Score, each with a clear award condition.

#### Scenario: Listing defined achievements

- **WHEN** a user opens the achievements section
- **THEN** all defined achievements are shown with their award conditions

### Requirement: Automatic awarding

The system SHALL award an achievement automatically when its condition is met by existing activity events such as resume imports, health scores, job matches, interviews and streaks.

#### Scenario: Earning the Resume Master achievement

- **WHEN** a user imports and scores their first resume
- **THEN** the relevant achievement is marked as earned and the user is notified in-app

### Requirement: Achievement display

The system SHALL show earned and unearned achievements distinctly with their dates when earned.

#### Scenario: Viewing earned achievements

- **WHEN** a user views the achievements section
- **THEN** earned achievements show their award date and unearned ones show their condition

### Requirement: Streak-based achievements

The system SHALL award streak achievements from mission completion streaks without penalizing users for missed days.

#### Scenario: Earning the 7-Day Streak achievement

- **WHEN** a user completes a mission on seven consecutive days
- **THEN** the 7-Day Streak achievement is awarded
