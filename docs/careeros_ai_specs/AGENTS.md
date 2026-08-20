# CareerOS AI — OpenCode Agent Instructions

## Mission

Build CareerOS AI as a production-quality mobile product.

The goal is not to generate a demo. The goal is to create a maintainable, secure, performant application suitable for Google Play production and later iOS release.

Read `spec.md` before making architectural or product decisions.

---

## Operating Model

You are an engineering organization, not a single coding agent.

Use specialized subagents when useful:

- Product Agent
- Architecture Agent
- React Native Agent
- Backend Agent
- Database Agent
- AI Agent
- UI/UX Agent
- Motion Agent
- QA Agent
- Security Agent
- DevOps Agent
- Documentation Agent
- Integration Agent

The orchestrator must coordinate them.

Do not ask multiple agents to independently design the same contract.

---

## Required Workflow

For every substantial task:

1. Read `spec.md`.
2. Inspect existing implementation.
3. Identify dependencies.
4. Create a plan.
5. Delegate independent work to subagents.
6. Implement.
7. Run tests.
8. Run lint.
9. Run type checks.
10. Validate affected flows.
11. Review security implications.
12. Update documentation.
13. Report exactly what changed.

---

## No Fake Implementations

Never create:

- fake API responses
- fake authentication
- fake subscription success
- hard-coded AI responses
- fake analytics
- placeholder production logic

Mocks are allowed only in tests.

If a real external service is not configured, provide a clean adapter boundary and a documented configuration error rather than pretending it works.

---

## Architecture Rules

Mobile:

- React Native
- Expo
- TypeScript
- Expo Router
- feature-first Clean Architecture

Backend:

- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- PostgreSQL
- Redis

AI:

```text
AIProvider
 ├── GeminiProvider
 └── OpenAIProvider
```

Business logic must depend on interfaces.

---

## Mobile Rules

Use:

- TanStack Query for server state.
- Zustand for local/global client state where appropriate.
- React Hook Form + Zod for forms.
- Reanimated for motion.
- FlashList for large lists.
- Secure storage for credentials/tokens.

Avoid unnecessary dependencies.

Before adding a package:

1. Check whether an existing dependency already solves the problem.
2. Check compatibility with current Expo SDK.
3. Check maintenance/activity.
4. Check bundle/performance impact.
5. Prefer platform capabilities when practical.

---

## UI Rules

Design direction:

**Glassmorphism + Aurora**

Themes:

- System default
- Light
- Dark

Every feature must include:

- loading
- success
- empty
- error
- retry
- disabled
- offline-aware behavior where relevant

Use consistent design tokens.

Do not hard-code random colors or spacing in individual components.

---

## Animation Rules

Animations should be:

- purposeful
- fast
- subtle
- interruptible
- performant

Use animation for:

- navigation
- score changes
- loading
- success
- interaction feedback
- meaningful achievements

Avoid animation that blocks user actions.

Respect reduced-motion settings.

---

## Backend Rules

Every endpoint must have:

- validation
- authentication requirements
- authorization
- structured errors
- request ID
- logging
- tests

Do not trust client-provided ownership IDs.

Always derive ownership from authenticated identity.

---

## Database Rules

Use migrations.

Never modify production schema manually.

All schema changes require:

- migration
- tests
- backward compatibility consideration

Use indexes intentionally.

Use RLS where Supabase is directly accessed.

---

## AI Rules

AI output must be structured.

Prefer schema-constrained responses.

Validate model output before returning it to the client.

AI must never:

- invent user experience
- invent qualifications
- encourage lying on resumes
- claim official ATS scores
- guarantee employment
- expose private user data

AI prompts belong in version-controlled prompt modules, not scattered throughout the codebase.

---

## Security Rules

Never commit:

- API keys
- Supabase service-role keys
- Google credentials
- signing credentials
- billing secrets
- production tokens

Use environment configuration.

Validate uploads.

Limit file size.

Validate MIME type and extension.

Apply rate limits.

Log safely.

Never log complete resumes or sensitive AI conversations.

---

## Git Rules

Branches:

```text
dev
qa
prod
```

Feature:

```text
feature/<description>
```

Hotfix:

```text
hotfix/<description>
```

Do not commit directly to `prod`.

Do not rewrite shared branch history unless explicitly instructed.

Keep commits focused.

---

## Testing Rules

Do not finish a feature without tests appropriate to its risk.

Critical flows require integration/E2E coverage.

At minimum verify:

- authentication
- guest migration
- resume upload
- resume analysis
- job matching
- AI chat
- subscription entitlement
- account deletion

---

## Performance Rules

Avoid:

- unnecessary rerenders
- huge lists without virtualization
- blocking the UI
- unnecessary network requests
- repeated AI calls
- unbounded polling
- large images without optimization

AI processing must be asynchronous for expensive operations.

---

## Error Handling

User-facing messages must be understandable.

Do not expose:

- stack traces
- SQL errors
- internal provider errors
- secrets

Use stable machine-readable error codes.

---

## Documentation Rules

Update documentation whenever:

- architecture changes
- API changes
- environment changes
- database changes
- feature behavior changes
- deployment changes

Do not allow docs to become stale.

---

## Definition of Done

A feature is done only when:

- code works
- architecture is correct
- UI is polished
- states are handled
- tests pass
- lint passes
- type checks pass
- security reviewed
- performance considered
- docs updated

No TODO placeholders for required functionality.

---

## Autonomous Execution

When the user asks for implementation, proceed through the repository autonomously.

Do not repeatedly ask for permission for routine engineering decisions.

Ask only when a decision materially changes:

- product behavior
- cost
- security
- architecture
- external account ownership
- irreversible production state

---

## External Services

If credentials are missing:

1. Create the integration code.
2. Create `.env.example`.
3. Document the required variables.
4. Add startup/configuration validation.
5. Do not fabricate credentials.

---

## Release Discipline

Never treat a local successful build as proof of production readiness.

Before release:

- test release build
- verify environment
- verify analytics
- verify crash reporting
- verify authentication
- verify AI limits
- verify subscriptions
- verify data deletion
- verify privacy disclosures
- verify Play Store requirements
