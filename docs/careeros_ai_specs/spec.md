# CareerOS AI — Product & Engineering Specification

## 1. Product Identity

**Working name:** CareerOS AI  
**Meaning:** Career Operating System  
**Tagline:** Your AI Career Companion

The product must not be positioned as a simple resume checker. The long-term product is an AI-powered career companion that helps users understand, improve, and manage their career journey.

### Primary launch goal

Release a polished Android application on Google Play first, while maintaining one React Native/Expo codebase that is iOS-ready.

### Core V1 promise

A user can enter as a guest, upload a resume, receive an AI-estimated resume/ATS compatibility analysis, improve weak sections, compare the resume against a job description, and ask an AI career assistant for contextual advice.

---

# 2. Product Principles

1. **Useful before clever.**
2. **Premium visual quality.**
3. **Fast perceived performance.**
4. **AI must produce structured, actionable results.**
5. **Never claim an unofficial score is an employer's real ATS score.**
6. **Guest users must be able to experience the core product before signing up.**
7. **Privacy is a product feature.**
8. **Every important operation has loading, success, empty, error, retry and offline-aware states.**
9. **No hard-coded production data.**
10. **Architecture must allow future AI providers without rewriting business logic.**
11. **Animations enhance comprehension; they must never obstruct usability.**
12. **Accessibility and reduced-motion preferences must be respected.**

---

# 3. Target Users

### Primary

- Students
- Fresh graduates
- Developers
- IT professionals
- Job switchers
- Experienced professionals
- People applying to multiple roles

### Secondary

- Career coaches
- Placement cells
- Bootcamp students
- Recruiters using the app as a candidate-preparation tool

---

# 4. V1 Feature Set

## Authentication

- Guest mode
- Email/password
- Google authentication
- Logout
- Password reset
- Account deletion
- Guest-to-account migration

## Resume

- PDF upload
- Secure storage
- Text extraction
- Resume normalization
- AI analysis
- Score breakdown
- Improvement recommendations
- Section rewriting
- Resume versions

## Job Match

- Paste job description
- Analyze resume against JD
- AI estimated compatibility
- Matched skills
- Missing skills
- Suggested improvements

## AI Career Chat

- Context-aware chatbot
- Resume context
- Job context
- Career context
- Conversation history
- Streaming responses
- Feedback
- Suggested prompts
- Copy/regenerate

## Fun / Engagement

- Resume Roast
- XP
- Levels
- Achievements
- Daily missions
- Resume Wrapped

## Interview Coach

V1 foundation; advanced voice mode may be V1.1.

- AI interview sessions
- HR questions
- Technical questions
- Behavioral questions
- Resume-specific questions
- Answer evaluation

## Monetization

- AdMob
- Pro subscription
- Free usage limits
- Rewarded unlocks where appropriate

---

# 5. Future Features — Competitive Differentiation Roadmap

The app must go beyond what ChatGPT or generic AI tools can offer. The competitive moat is: real-time job data, persistent tracking, push notifications, and platform integrations that a chatbot cannot replicate.

## Phase 1 — Core Differentiators (implement first)

### Live Job Search

Aggregate real-time job postings from multiple platforms:

- **Technopark** (Kerala tech hub jobs)
- **Naukri.com** (India's largest job board)
- **LinkedIn Jobs** (professional network)
- **Indeed** (global aggregator)
- **Monster India**

Backend performs search aggregation, deduplication, and relevance scoring. Results are cached with TTL for performance. The mobile app displays unified search results with platform source badges.

### Push Job Alerts (Firebase Cloud Messaging)

- Background job matcher runs periodically (e.g., every 6 hours)
- Compares user resume skills against new job postings
- Sends push notification when match score exceeds threshold (e.g., >80%)
- Notification includes: job title, company, match score, platform source
- Deep link opens the job detail screen in the app
- Users can configure alert frequency and minimum match threshold

### Skills Gap Radar

- User selects a specific job posting from search results
- System extracts required skills from the job description
- Compares against user's resume skills
- Visual radar chart shows: matched skills, partially matched, missing skills
- Each missing skill shows learning resources (courses, certifications)
- Persists gap analyses for tracking progress over time

### Auto-Tailor Resume

- One-tap action: "Tailor my resume for this job"
- AI rewrites summary to emphasize relevant experience
- Reorders skills section to match job requirements
- Adjusts bullet points to use job-specific keywords
- Preserves factual accuracy — never fabricates experience
- Creates a new resume version (not overwriting original)
- User reviews diff before accepting

## Phase 2 — Engagement & Retention

### Application Tracker

- Track applications: Applied → Interview → Offer → Rejected
- Link applications to specific job postings
- Add notes, interview dates, follow-up reminders
- Dashboard shows application pipeline (Kanban view)
- Analytics: acceptance rate, response time, top sources

### Market Pulse Dashboard

- Real-time skill demand trends (e.g., "Python demand: ↑23% this quarter in Kerala")
- Average salary ranges by role and location
- Top hiring companies in the user's area
- Emerging skills in the user's industry
- Historical trend charts (3-month, 6-month, 1-year)

### Skill Trend Forecast

- AI-powered analysis of job posting patterns
- "Django rising, PHP declining in Technopark"
- Recommended skills to learn based on market trajectory
- Personalized learning path suggestions

### Company Deep Dive

- Company tech stack (from job postings + public data)
- Company culture signals (Glassdoor-style insights)
- Team size, funding stage, growth trajectory
- Recent job postings (is the company actively hiring?)
- Employee skill distribution

### Referral Finder

- LinkedIn integration to find connections at target companies
- "3 people in your network work at [Company]"
- Suggested introduction messages
- Track referral requests and outcomes

## Phase 3 — Premium Features

### AI Interview Simulator (Enhanced)

- Role-specific questions generated from real job postings
- Mock interview with voice input and AI evaluation
- Company-specific interview preparation
- Behavioral question STAR method coaching
- Technical coding challenge simulation

### Salary Negotiator

- Market-based salary data for the user's role and location
- Experience-adjusted salary range
- Negotiation script generation
- "Based on your experience and this role, ask for ₹X–Y"
- Benefits comparison (salary vs equity vs perks)

### Career Path Mapper

- Visual career progression: "Junior → Senior → Lead → CTO"
- Skill requirements at each career stage
- Timeline estimates based on current skills
- Gap analysis for next career step
- Recommended actions to advance

Future features must not complicate V1 architecture unnecessarily.

---

# 6. Technology Stack

## Mobile

- React Native
- Expo SDK
- TypeScript
- Expo Router
- Zustand
- TanStack Query
- React Hook Form
- Zod
- NativeWind
- Reanimated
- Gesture Handler
- FlashList
- Lottie where useful
- Skia only where it provides clear visual value
- Secure storage

## Backend

- Python
- FastAPI
- SQLAlchemy
- Alembic
- Pydantic
- PostgreSQL
- Redis
- Background task infrastructure

## Platform

- Supabase Postgres
- Supabase Auth
- Supabase Storage where appropriate
- Firebase Analytics
- Firebase Crashlytics
- Firebase Cloud Messaging
- Google AdMob
- Google Play Billing
- EAS Build/Submit

## AI

Initial provider:

- Gemini

Provider abstraction:

- GeminiProvider
- OpenAIProvider

Business logic must depend on `AIProvider`, never directly on Gemini SDK calls.

---

# 7. Environment Strategy

Environments:

- DEV
- QA
- PROD

Git branches:

- `dev`
- `qa`
- `prod`

Feature branches:

`feature/<short-description>`

Hotfix branches:

`hotfix/<short-description>`

Production secrets must never be present in development builds.

---

# 8. Architecture

Use feature-first Clean Architecture.

```text
mobile/
  src/
    app/
    core/
    shared/
    features/
      auth/
      home/
      resume/
      job-match/
      chatbot/
      interview/
      career/
      gamification/
      subscription/
      profile/
```

Feature structure:

```text
feature/
  data/
    datasources/
    models/
    repositories/
  domain/
    entities/
    repositories/
    usecases/
  presentation/
    screens/
    components/
    hooks/
    state/
```

Backend:

```text
backend/
  app/
    api/
    core/
    models/
    schemas/
    repositories/
    services/
    providers/
    workers/
    security/
    utils/
```

---

# 9. Design System

## Visual language

Primary style:

**Glassmorphism + Aurora**

Characteristics:

- dark premium default
- soft aurora gradients
- translucent glass cards
- subtle borders
- depth
- soft shadows
- restrained glow
- large readable typography
- rounded surfaces
- fluid transitions

Themes:

- System — default
- Light
- Dark

## Required components

- AuroraBackground
- GlassCard
- GlassButton
- PrimaryButton
- SecondaryButton
- ScoreCard
- AnimatedScore
- ProgressRing
- Badge
- Chip
- Skeleton
- Shimmer
- EmptyState
- ErrorState
- BottomSheet
- AIMessage
- ChatInput
- StatCard
- ResumeSectionCard
- RecommendationCard
- JobMatchCard
- MissionCard

---

# 10. Motion Specification

Motion must communicate state.

Use:

- fade
- slide
- scale
- progress animation
- shimmer
- spring interaction
- subtle parallax
- score counting
- success celebration
- confetti only for meaningful achievements

Avoid:

- continuous expensive animations
- excessive bouncing
- long transitions
- animation that delays actions

Respect reduced-motion accessibility preferences.

---

# 11. Home Experience

The home screen should immediately communicate value.

Example structure:

```text
Good morning 👋

Career Level
17
████████░░

Resume Score
91

Interview Readiness
82%

Active Applications
12

Today's Mission
Improve your summary
+25 XP

[ Review Resume ]
[ Job Match ]
[ Ask AI ]
[ Practice Interview ]
```

The actual design must be polished and responsive rather than copied literally from this example.

---

# 12. Resume Processing

Flow:

```text
Upload
  ↓
Validate
  ↓
Secure storage
  ↓
Extract text
  ↓
Normalize
  ↓
Analyze
  ↓
Persist structured result
  ↓
Display
```

Do not keep expensive processing inside a long synchronous HTTP request.

Use background processing where appropriate.

---

# 13. Resume Data Model

Normalized representation should include:

```json
{
  "name": "",
  "contact": {},
  "summary": "",
  "experience": [],
  "education": [],
  "skills": [],
  "projects": [],
  "certifications": [],
  "links": []
}
```

Original uploaded file and normalized representation must both be retained according to the user's data-retention settings.

---

# 14. AI Resume Analysis

Return structured JSON.

Required score dimensions:

- overall
- ATS compatibility
- grammar
- readability
- structure
- skills
- experience
- impact
- keyword coverage

Each recommendation:

```json
{
  "category": "impact",
  "severity": "high",
  "problem": "",
  "original": "",
  "suggestion": "",
  "reason": ""
}
```

AI output must be schema validated before reaching the mobile client.

If malformed:

1. Attempt controlled repair.
2. Retry within a strict limit.
3. Return a graceful error if still invalid.

---

# 15. ATS Language

Use:

**AI Estimated ATS Compatibility**

Do not state:

- official ATS score
- guaranteed recruiter ranking
- guaranteed interview
- guaranteed job placement

The app should explain that different employers use different systems and configurations.

---

# 16. Job Match

Input:

- resume
- job description

Output:

- compatibility percentage
- matched skills
- missing skills
- relevant experience
- keyword opportunities
- recommended resume changes

The system must distinguish:

- skills actually present
- skills inferred with low confidence
- skills absent

Never instruct users to falsely claim experience.

---

# 17. AI Career Chat

The chatbot is a career-specific assistant.

Context may include:

- selected resume
- resume analysis
- job description
- job match
- career goal
- interview history
- user preferences

Never expose unrelated private records.

Chat supports:

- streaming
- markdown
- suggested prompts
- copy
- regenerate
- feedback
- conversation history

The AI must not fabricate experience or qualifications.

---

# 18. AI Provider Architecture

```text
AIProvider
   ├── GeminiProvider
   └── OpenAIProvider
```

Interface should support:

- chat
- structured generation
- resume analysis
- job matching
- interview evaluation

Configuration selects provider by environment.

Example:

```text
DEV  -> Gemini
QA   -> Gemini
PROD -> Gemini initially
```

OpenAI implementation remains available behind the abstraction.

---

# 19. AI Cost Controls

Implement:

- per-user limits
- request limits
- token/output limits
- timeout
- retries
- exponential backoff
- caching where safe
- model routing
- usage records
- abuse detection
- rate limiting

Never allow an unbounded AI loop.

---

# 20. AI Feedback

Every AI experience should support:

```text
Helpful
Not Helpful
```

Optional reason:

- Incorrect
- Too generic
- Not relevant
- Too long
- Other

Feedback must be stored without unnecessarily storing sensitive content.

---

# 21. Resume Roast

Modes:

- Friendly Mentor
- Professional HR
- Brutal HR
- Funny Roast
- Robot Recruiter

The roast must always end with actionable improvements.

Do not generate abusive, discriminatory or humiliating content.

---

# 22. Gamification

XP examples:

- resume review
- improvement accepted
- job match
- interview practice
- daily mission

Levels:

```text
Career Explorer
Job Seeker
Rising Professional
Career Builder
Expert
Leader
Career Legend
```

Achievements:

- ATS Warrior
- Resume Master
- Interview Ready
- 7-Day Streak
- Perfect Score

Gamification must never make users feel punished for missing a day.

---

# 23. Resume Wrapped

Generate a shareable visual summary:

- resume score
- improvement score
- strongest skill
- biggest opportunity
- career level
- achievements

No sensitive information should be shared by default.

The user must explicitly choose what is included.

---

# 24. Interview Coach

Modes:

- HR
- Technical
- Behavioral
- Manager
- Startup
- Custom

Questions can be generated from:

- resume
- target job
- target skills

Evaluation:

- relevance
- clarity
- structure
- technical correctness
- completeness

The app must show that AI evaluation is guidance, not a definitive hiring judgment.

---

# 25. Authentication

Guest:

- local session
- server guest identity where required

Registered:

- email
- Google

Guest migration:

```text
Guest data
  ↓
Login
  ↓
Account identity
  ↓
Secure merge
  ↓
Guest data becomes account data
```

Migration must be transactional and idempotent.

---

# 26. Database

Core entities:

```text
users
profiles
guest_accounts
resumes
resume_versions
resume_analysis
resume_sections
job_descriptions
job_matches
chat_sessions
chat_messages
interview_sessions
interview_questions
interview_answers
career_goals
career_roadmaps
missions
user_missions
achievements
user_achievements
feedback
subscriptions
usage_records
notifications
```

Use indexes for:

- user ownership
- timestamps
- active status
- foreign keys
- lookup-heavy fields

Use Row Level Security where Supabase is used directly.

---

# 27. API

Base:

`/api/v1`

Major resources:

```text
/auth
/users
/resumes
/resumes/{id}/analysis
/job-descriptions
/job-matches
/chat
/interviews
/career
/gamification
/subscriptions
/feedback
/notifications
```

All APIs must have:

- validation
- authentication
- authorization
- predictable error schema
- request IDs
- logging
- pagination where appropriate

---

# 28. Error Contract

Use a consistent API error structure:

```json
{
  "code": "RESUME_ANALYSIS_FAILED",
  "message": "We could not analyze the resume right now.",
  "request_id": "..."
}
```

Do not expose stack traces to clients.

---

# 29. Security

Required:

- HTTPS
- secure token storage
- RLS
- authorization checks
- upload validation
- file-size limits
- MIME validation
- rate limiting
- secrets management
- audit logging
- account deletion
- data deletion
- secure AI requests

Resume content must never be used as an authorization source.

---

# 30. Privacy

Users must be able to:

- view their data
- delete resumes
- delete chats
- delete account

Provide:

- Privacy Policy
- Terms of Service
- Data Safety disclosure
- Support contact

The product must clearly explain how AI processing is used.

---

# 31. Notifications

Examples:

```text
🎯 Your resume has an improvement waiting.
🔥 You're on a career streak.
🎤 Ready for today's interview challenge?
📈 Your resume score improved.
```

Notifications must be opt-in where required and configurable.

---

# 32. Monetization

Free:

- limited AI usage
- limited resume analyses
- limited interview sessions
- ads

Pro:

- higher/unlimited fair-use limits
- advanced analysis
- advanced job matching
- more AI usage
- advanced interview features
- premium templates
- no ads

All monetization must respect platform policies.

---

# 33. AdMob

Do not interrupt:

- onboarding
- resume upload
- analysis result
- payment flow
- active interview

Use ads primarily in non-critical surfaces.

Rewarded ads may provide clearly described optional benefits.

---

# 34. Subscription

Architecture must support:

- purchase
- restore
- entitlement
- renewal
- expiration
- cancellation
- server verification
- platform-specific billing

Android first; iOS ready.

---

# 35. Analytics

Track product behavior, not unnecessary resume contents.

Events:

```text
app_opened
guest_started
signup_completed
resume_uploaded
resume_analysis_started
resume_analysis_completed
job_match_started
job_match_completed
chat_started
interview_started
roast_used
wrapped_generated
subscription_started
subscription_cancelled
```

---

# 36. Performance

Targets:

- fast startup
- smooth navigation
- efficient list rendering
- optimized image handling
- API caching
- request cancellation
- no unnecessary rerenders
- no blocking AI processing
- skeleton loading
- pagination

Monitor:

- crash-free users
- API latency
- AI latency
- screen render performance
- memory
- network errors

---

# 37. Testing

## Mobile

- unit
- component
- integration
- navigation
- E2E

## Backend

- unit
- API
- repository
- authentication
- authorization
- AI provider mocks
- database integration

## Critical E2E

```text
Install
↓
Guest
↓
Upload resume
↓
Analyze
↓
View score
↓
Improve section
↓
Chat
↓
Job match
↓
Login
↓
Verify data migration
```

---

# 38. CI/CD

Every PR:

```text
Lint
↓
Type check
↓
Unit tests
↓
Integration tests
↓
Build verification
↓
Security checks
```

Branches:

```text
feature/*
   ↓
dev
   ↓
qa
   ↓
prod
```

EAS profiles:

- development
- preview
- production

---

# 39. Docker

Backend development should run with:

- FastAPI
- PostgreSQL-compatible local database where required
- Redis
- worker

Production database remains Supabase.

---

# 40. Release Milestones

## M0 — Foundation

Product docs, architecture, repo, environments.

## M1 — Mobile Foundation

Expo, navigation, state, networking, themes.

## M2 — Design System

Aurora, glass components, animation system.

## M3 — Authentication

Guest, email, Google.

## M4 — Home

Career dashboard.

## M5 — Resume

Upload, processing, analysis.

## M6 — Job Match

JD comparison and compatibility.

## M7 — AI Chat

Career assistant.

## M8 — AI Feedback

Feedback and quality loop.

## M9 — Gamification

XP, levels, achievements.

## M10 — Fun Features

Roast, Wrapped, missions.

## M11 — Interview

AI interview coach.

## M12 — Monetization

AdMob and subscriptions.

## M13 — Analytics

Analytics, crash reporting, funnels.

## M14 — QA

Automated tests, device testing, performance.

## M15 — Release

Play Store internal → closed → production.

## M16 — Post Launch

Measure, fix, optimize, then expand.

---

# 41. V1 Scope

Do not launch with everything.

### Must ship (V1)

- Authentication
- Guest
- Resume upload
- Resume analysis
- ATS compatibility estimate
- Job matching
- AI career chat
- Resume improvements
- Roast
- Dashboard
- XP
- Themes
- Ads
- Pro subscription
- Analytics
- Crash reporting

### V1.1 — Core Differentiators

- Live Job Search (Technopark, Naukri, LinkedIn, Indeed, Monster)
- Push Job Alerts (Firebase Cloud Messaging)
- Skills Gap Radar
- Auto-Tailor Resume
- Interview Coach
- Daily missions
- Wrapped
- Resume versions

### V1.2 — Engagement & Retention

- Application Tracker (Kanban view)
- Market Pulse Dashboard
- Skill Trend Forecast
- Company Deep Dive
- Referral Finder

### V1.3 — Premium Features

- Enhanced AI Interview Simulator
- Salary Negotiator
- Career Path Mapper

### V2

- iOS production launch
- Voice interview
- Community features
- AI job application agent
- Additional AI providers

---

# 42. Definition of Done

A feature is complete only when:

- implementation exists
- architecture is correct
- UI is polished
- loading state exists
- empty state exists
- error state exists
- retry works
- analytics are added where appropriate
- tests exist
- lint passes
- type checking passes
- documentation is updated
- accessibility is considered
- performance is acceptable
- security is reviewed

No feature is considered complete because a screen merely renders.

---

# 43. OpenCode Rule

OpenCode is the implementation engine.

ChatGPT is the product/architecture orchestrator.

OpenCode must:

1. Read `AGENTS.md`.
2. Read `spec.md`.
3. Inspect the current repository before modifying it.
4. Plan before large changes.
5. Use subagents for independent work.
6. Never duplicate architecture.
7. Never invent API contracts.
8. Never use fake production implementations.
9. Test every completed feature.
10. Update documentation.
11. Report blockers instead of silently making unsafe assumptions.
