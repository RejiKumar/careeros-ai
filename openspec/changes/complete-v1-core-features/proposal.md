## Why

The app now covers auth, resume health, job match, coach chat, missions and profile, but the remaining V1 spec surface — guest mode, AI feedback, roast, wrapped, interview coach, achievements and chat conveniences — is still missing. These are the differentiators that make the product a career companion rather than a resume checker, and most of them require no new external services.

## What Changes

- **Guest mode**: local anonymous session so users can explore the app before signing up, with a secure, idempotent guest-to-account migration when they authenticate.
- **AI feedback**: Helpful / Not helpful controls (with an optional reason) on AI outputs, persisted server-side and wired into the coach, match, roast and rewrites experiences.
- **Resume Roast**: five roast modes (Friendly Mentor, Professional HR, Brutal HR, Funny Roast, Robot Recruiter), always ending with actionable improvements, never abusive content.
- **Resume Wrapped**: a shareable visual summary (score, strongest skill, biggest opportunity, level, achievements) with explicit user opt-in per data point.
- **Interview Coach**: AI interview sessions with HR, technical, behavioral, resume-specific and custom question modes, answer submission and evaluation (relevance, clarity, structure, correctness, completeness), clearly labeled as guidance.
- **Achievements**: gamification achievements (ATS Warrior, Resume Master, Interview Ready, 7-Day Streak, Perfect Score) awarded from existing event sources, shown in profile.
- **Chat experience**: suggested prompts, message copy, regenerate, and explicit user-facing disclosure that AI output is guidance.
- **Backend additions**: new modules for feedback, roast, wrapped and interviews; achievements logic on top of the existing missions/XP service; guest identity support in auth.

## Capabilities

### New Capabilities
- `guest-mode`: anonymous local session, protected-route access without an account, and transactional guest-to-account migration.
- `ai-feedback`: Helpful/Not helpful ratings with optional reason, stored per AI output without unnecessary sensitive content, surfaced in the coach, match, roast and rewrites experiences.
- `resume-roast`: five-mode resume critique that stays constructive and always ends with actionable improvements.
- `resume-wrapped`: opt-in shareable career summary built from score, skill and achievement data.
- `interview-coach`: session-based AI interview practice with question generation, answer submission and guided evaluation.
- `gamification-achievements`: achievement definitions, award rules from existing events (score, imports, matches, streaks) and user-facing achievement display.
- `chat-experience`: suggested prompts, copy, regenerate and AI-guidance disclosure for coach conversations.

### Modified Capabilities
<!-- No existing specs yet; none modified. -->

## Impact

- **Mobile**: new routes (`/roast`, `/wrapped`, `/interview`, achievements section in profile, feedback controls on AI output cards), new API client methods, guest session storage, tests for all new UI.
- **Backend**: new modules `roast`, `wrapped`, `interviews`, `feedback`; guest identity handling in `auth`; achievement rules in `missions`; migration for `feedback`, `guest_accounts`, `achievements`, `user_achievements`, `interview_sessions`, `interview_questions`, `interview_answers`.
- **Contracts**: `packages/api-contract` and mobile `services/contract.ts` gain the new typed responses; OpenAI adapter seam stays untouched (all new AI features go through `CareerAiProvider`).
- **Configuration**: no new external credentials required; roast/wrapped/interview reuse the Gemini provider.
- **Docs**: `docs/careeros_ai_specs/milestones.md` progress updated; README feature matrix updated.
