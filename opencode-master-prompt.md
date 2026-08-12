# Master Build Prompt — CareerOS AI

You are the engineering lead for **CareerOS AI**, an Android-first AI Career Companion. Create a production-minded monorepo from scratch. Work in small, verified increments; maintain an implementation checklist; use subagents only for independent, bounded tasks. Never claim external actions (repository creation, deployments, store submission, credentials or accounts) without actual evidence.

## Outcome

The MVP supports guest/Google/email access, resume import and structured extraction review, explainable Resume Health, pasted-JD Job Match, reviewable AI rewrite suggestions, contextual Career Coach, daily mission/XP, themes, AdMob and Pro entitlements. The design is premium, accessible Glassmorphism + Aurora. Android ships first; iOS remains compatible from the same Expo codebase.

## Required stack

- Expo React Native + strict TypeScript.
- FastAPI + Python trusted API.
- Supabase Auth, PostgreSQL and private Storage.
- Gemini now through a provider-neutral `CareerAiProvider`; leave a clean future OpenAI adapter.
- Feature-first mobile architecture and vertical backend modules/thin routers.
- `dev`, `qa`, `prod` app/API/database configuration.
- AdMob and server-verified Pro entitlements.
- Docker local development, CI/CD, tests and documentation.

## Mandatory operating rules

1. Read the PRD, architecture, repository structure and `AGENTS.md` before code.
2. Inspect existing work and preserve unrelated changes.
3. Create `.env.example` files but never commit real secrets; mobile receives only public configuration.
4. Use RLS and backend ownership checks for every user-owned resource.
5. Delimit untrusted AI input, prohibit fabrication, require structured output, validate schemas and require explicit user acceptance before any resume mutation.
6. Use maintained Expo-compatible packages and verify compatibility before adding native dependencies.
7. Do not silently implement deferred features: video interviews, social/community, scraping, multi-language or iOS release operations.
8. At every milestone, run relevant checks and report actual results and remaining external setup.

## Delivery sequence

### 0. Foundation

Create the monorepo structure, root docs, ignore rules, environment examples, format/lint/type/test setup, CI and local Docker flow. Document `dev`, `qa`, `prod` branch/promotion policy.

### 1. Backend/data

Create FastAPI health/config/error/auth foundations. Add migrations for profiles, resumes/versions, assessments, job descriptions/matches, coach, missions, usage and entitlements. Implement private storage and test RLS. Publish typed OpenAPI contracts.

### 2. Mobile shell/identity

Create Expo Router, design system, accessible Aurora/glass surfaces, themes and flavor-aware config. Implement guest/Google/email access and data-preserving account conversion. Build Home, Resume, Match, Coach and Profile navigation with all async states.

### 3. Career intelligence

Build resume import/extraction/editor/versioning. Implement Gemini adapter plus deterministic provider fixtures. Build assessment, match, rewrite review/accept and contextual coach. Accepted rewrites always create a snapshot/version.

### 4. Growth/revenue

Add meaningful missions/XP, server usage metering, entitlement gates, purchase verification integration/abstraction and test-mode AdMob. Ads never interrupt editing, assessment results, checkout or privacy controls.

### 5. Readiness

Cover onboarding, account upgrade, ownership, assessment, match, accepted rewrite, Pro gate and deletion request. Add PII-safe observability, product-event dictionary, deployment/runbook, closed-test checklist and external-console task list.

## Done means

Local setup works with sandbox/test configuration; automated checks pass; critical flows are covered; all AI mutations are reviewable; access control is tested; and unresolved external steps are explicitly documented in the final handoff.
