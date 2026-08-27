# CareerOS AI — Milestone Execution Plan

## Milestone 0 — Foundation

- [x] Product specification
- [x] AGENTS.md
- [x] OpenCode orchestration prompt
- [x] Repository structure
- [x] Environment strategy
- [x] Git strategy

## Milestone 1 — Mobile Foundation

- [x] Expo project
- [x] TypeScript
- [x] Expo Router
- [x] State management
- [x] Query layer
- [x] Environment configuration
- [x] Error boundary

## Milestone 2 — Backend Foundation

- [x] FastAPI
- [x] Pydantic
- [x] Supabase (replaces SQLAlchemy/Alembic/PostgreSQL/Redis)
- [x] Health endpoint
- [x] Structured errors
- [x] Request IDs

## Milestone 3 — Design System

- [x] Aurora background
- [x] Glass components
- [x] Typography
- [x] Spacing
- [x] Light theme
- [x] Dark theme
- [x] System theme
- [x] Animation primitives
- [ ] Skeletons
- [ ] Haptics

## Milestone 4 — Authentication

- [x] Guest
- [x] Email
- [x] Google
- [x] Session persistence
- [x] Password reset
- [x] Logout
- [x] Account deletion
- [x] Guest migration

## Milestone 5 — Home

- [x] Career dashboard
- [x] Resume score
- [x] Career level
- [ ] Interview readiness (see Milestone 11)
- [x] Missions
- [x] Quick actions

## Milestone 6 — Resume

- [x] PDF upload
- [x] File validation
- [x] Secure storage
- [x] Text extraction
- [x] Normalization
- [x] Analysis status
- [x] Analysis results

## Milestone 7 — ATS / Job Match

- [x] JD input
- [x] Compatibility estimate
- [x] Matched skills
- [x] Missing skills
- [x] Recommendations

## Milestone 8 — AI Career Chat

- [x] Chat sessions
- [ ] Streaming (non-streaming works)
- [x] Resume context
- [x] Job context
- [x] Suggested prompts
- [x] Feedback

## Milestone 9 — AI Improvements

- [x] Rewrite section
- [x] Accept suggestion
- [ ] Regenerate
- [x] Copy
- [x] Versioning

## Milestone 10 — Fun / Engagement

- [x] Roast (5 modes)
- [x] XP
- [x] Levels
- [x] Achievements (5 types)
- [x] Daily missions
- [x] Wrapped

## Milestone 11 — Interview

- [x] Session
- [x] Question generation
- [x] Answer submission
- [x] Evaluation (5 dimensions)
- [x] Feedback
- [ ] Interview score (evaluation scores serve this purpose)

## Milestone 12 — Monetization

- [ ] AdMob
- [ ] Free limits
- [ ] Pro entitlement
- [ ] Subscription purchase
- [ ] Restore
- [ ] Server verification

## Milestone 13 — Analytics

- [ ] Firebase Analytics
- [ ] Crashlytics
- [ ] Product funnels
- [ ] AI usage tracking
- [ ] Error monitoring

## Milestone 14 — Notifications

- [ ] FCM
- [ ] Permission flow
- [ ] Preferences
- [ ] Career reminders
- [ ] Mission reminders

## Milestone 15 — Testing

- [x] Unit (mobile: 40 tests, API: 192 tests)
- [x] Component (mobile component tests)
- [x] API (backend API tests)
- [ ] Integration
- [ ] E2E
- [ ] Regression

## Milestone 16 — CI/CD

- [ ] GitHub Actions
- [ ] dev
- [ ] qa
- [ ] prod
- [ ] EAS development
- [ ] EAS preview
- [ ] EAS production
- [ ] Docker

## Milestone 17 — Performance

- [ ] Startup profiling
- [ ] Render profiling
- [ ] Memory checks
- [ ] API latency
- [ ] AI latency
- [ ] Image optimization
- [ ] List optimization

## Milestone 18 — Security / Privacy

- [x] Upload security (MIME/size validation)
- [x] Rate limiting (guest rate limit)
- [x] RLS (Supabase row-level security)
- [x] Authorization audit (ownership tests)
- [x] Account deletion
- [ ] Secret scan
- [ ] Privacy policy
- [ ] Terms

## Milestone 19 — Play Store

- [ ] Application ID
- [ ] Icon
- [ ] Splash
- [ ] Screenshots
- [ ] Feature graphic
- [ ] Data safety
- [ ] Content rating
- [ ] Internal testing
- [ ] Closed testing
- [ ] Production release

## Milestone 20 — Post Launch

- [ ] Crash analysis
- [ ] Funnel analysis
- [ ] Retention analysis
- [ ] AI quality analysis
- [ ] User feedback
- [ ] Performance optimization
- [ ] V1.1 planning

---

# V1.1 — Core Differentiators

## Milestone 21 — Live Job Search

- [ ] Backend: Job aggregator service (Technopark, Naukri, LinkedIn, Indeed, Monster)
- [ ] Backend: Search API with deduplication and relevance scoring
- [ ] Backend: Result caching with TTL
- [ ] Mobile: Job search screen with platform filters
- [ ] Mobile: Job detail screen
- [ ] Mobile: Saved jobs list
- [ ] Mobile: Search history

## Milestone 22 — Push Job Alerts (FCM)

- [ ] Backend: FCM integration (Firebase Admin SDK)
- [ ] Backend: Background job matcher (periodic scan)
- [ ] Backend: Match threshold configuration
- [ ] Backend: Notification delivery pipeline
- [ ] Mobile: FCM token registration
- [ ] Mobile: Permission flow (opt-in)
- [ ] Mobile: Notification preferences screen
- [ ] Mobile: Deep link handling (notification → job detail)
- [ ] Mobile: Alert frequency settings

## Milestone 23 — Skills Gap Radar

- [ ] Backend: Skill extraction from job descriptions (AI)
- [ ] Backend: Gap analysis engine (resume vs JD)
- [ ] Backend: Learning resource recommendations
- [ ] Mobile: Radar chart visualization
- [ ] Mobile: Gap analysis detail screen
- [ ] Mobile: Progress tracking over time
- [ ] Mobile: Learning resource links

## Milestone 24 — Auto-Tailor Resume

- [ ] Backend: Resume tailoring AI (summary rewrite, skill reordering, keyword injection)
- [ ] Backend: Diff generation (before/after)
- [ ] Backend: Version management (create new version, don't overwrite)
- [ ] Mobile: One-tap "Tailor for this job" button
- [ ] Mobile: Diff review screen
- [ ] Mobile: Accept/reject tailored version
- [ ] Mobile: Version history

---

# V1.2 — Engagement & Retention

## Milestone 25 — Application Tracker

- [ ] Backend: Application CRUD (status, notes, dates)
- [ ] Backend: Application pipeline analytics
- [ ] Mobile: Kanban board view (Applied → Interview → Offer → Rejected)
- [ ] Mobile: Application detail screen
- [ ] Mobile: Add/edit notes
- [ ] Mobile: Follow-up reminders
- [ ] Mobile: Application analytics dashboard

## Milestone 26 — Market Pulse Dashboard

- [ ] Backend: Skill demand trend aggregation
- [ ] Backend: Salary data aggregation
- [ ] Backend: Top hiring companies API
- [ ] Mobile: Market Pulse screen with trend charts
- [ ] Mobile: Skill demand cards
- [ ] Mobile: Salary range displays
- [ ] Mobile: Top companies list

## Milestone 27 — Skill Trend Forecast

- [ ] Backend: AI-powered trend analysis
- [ ] Backend: Emerging skills detection
- [ ] Mobile: Trend visualization (3-month, 6-month, 1-year)
- [ ] Mobile: Recommended skills to learn
- [ ] Mobile: Personalized learning path

## Milestone 28 — Company Deep Dive

- [ ] Backend: Company data aggregation (tech stack, culture, size)
- [ ] Backend: Company search API
- [ ] Mobile: Company profile screen
- [ ] Mobile: Tech stack display
- [ ] Mobile: Recent job postings
- [ ] Mobile: Employee skill distribution

## Milestone 29 — Referral Finder

- [ ] Backend: LinkedIn integration (API or scraping)
- [ ] Backend: Connection matching
- [ ] Mobile: Referral suggestions screen
- [ ] Mobile: Introduction message templates
- [ ] Mobile: Referral tracking

---

# V1.3 — Premium Features

## Milestone 30 — Enhanced AI Interview Simulator

- [ ] Backend: Role-specific question generation from real job postings
- [ ] Backend: Voice input processing
- [ ] Backend: STAR method evaluation
- [ ] Mobile: Voice interview mode
- [ ] Mobile: Company-specific prep
- [ ] Mobile: Technical coding challenges
- [ ] Mobile: Interview score tracking

## Milestone 31 — Salary Negotiator

- [ ] Backend: Salary data aggregation
- [ ] Backend: Experience-adjusted range calculation
- [ ] Backend: Negotiation script generation
- [ ] Mobile: Salary range display
- [ ] Mobile: Negotiation script screen
- [ ] Mobile: Benefits comparison

## Milestone 32 — Career Path Mapper

- [ ] Backend: Career progression AI
- [ ] Backend: Skill requirement mapping
- [ ] Backend: Timeline estimation
- [ ] Mobile: Career path visualization (tree/timeline)
- [ ] Mobile: Stage-by-stage skill requirements
- [ ] Mobile: Gap analysis for next step
- [ ] Mobile: Recommended actions
