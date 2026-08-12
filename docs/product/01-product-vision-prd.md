# CareerOS AI — Product Vision & PRD

**Tagline:** Your AI Career Companion  
**Launch:** Android (Google Play) first; iOS follows from the shared Expo codebase.

## Vision

CareerOS AI helps job seekers understand, improve and act on their career story. It combines resume intelligence, job matching and a grounded AI coach in a motivating daily loop. It must feel premium and trustworthy—not like a generic chatbot or one-time resume checker.

## Problem

Job seekers struggle to judge whether a resume communicates their value, tailor it honestly for individual roles, and maintain momentum between applications. Existing products are fragmented. CareerOS AI starts by joining the decision-making layer.

## Target users

**Primary:** 18–35 early-to-mid career job seekers actively applying or preparing to switch jobs, usually on Android.  
**Secondary:** final-year students and recent graduates building confidence and a first strong resume.  
**Not MVP:** recruiters, enterprises, coaches managing clients, or community workflows.

## MVP promise

**Import or build a resume, assess it, compare it to a job description, and make honest AI-assisted improvements.**

### In scope

- Guest trial; Google and email/password sign-in; guest-to-account work preservation.
- PDF/DOCX resume import, editable extraction review, structured profile and versions.
- Explainable Resume Health: content, clarity, impact, ATS readiness and completeness.
- Job Match from pasted job description: score, evidence, gaps, keywords and prioritized actions.
- Career Coach grounded in user-approved resume/profile and chosen job description.
- Rewrite suggestions for summaries and bullets, with accept/reject review—not silent replacement.
- Daily mission, XP and streaks tied to useful actions.
- System, light and dark themes.
- Free tier, carefully placed AdMob, and Pro entitlement gates.
- Privacy controls, feedback, data export/deletion requests.

### Deferred

Voice/video interviews, job scraping, application autofill, social/community, salary predictions, template marketplace, multi-language and iOS store release.

## Core flow

```text
Onboard → guest/sign in → import/build resume → confirm extracted facts
→ Home → assessment or job match → select an improvement
→ review AI suggestion → accept → new resume version and progress update
```

The first session should reach an assessment within five minutes. Uncertain extraction is always visibly editable, and an inference is never presented as a user fact.

## Navigation

Bottom tabs: **Home · Resume · Match · Coach · Profile**.

- Home: score, active match, daily mission and recent activity.
- Resume: versions, editor, assessment evidence and rewrite review.
- Match: job description input/history, matched strengths, missing skills and actions.
- Coach: scoped chat with visible context and deletion option.
- Profile: account, theme, plan and privacy controls.

## Design direction

Use **Glassmorphism + Aurora** with restraint: translucent layered cards over a low-motion aurora background; accessible solid surface fallbacks; high-contrast text; one dominant action per screen; polished but optional motion. Respect reduced-motion settings and never communicate state with color alone.

## AI principles

- Do not invent experience, employers, credentials, outcomes or metrics.
- Ground output in approved profile/resume/JD context only.
- Make scoring explainable and distinguish evidence from inference.
- Require explicit user acceptance before changing resume content.
- Gemini is active; keep a provider-neutral interface for future OpenAI use.
- Do not use user data for training by product intent; verify provider settings and terms before release.

## Monetisation

**Free:** one active resume, limited AI/assessment/match usage and non-disruptive ads.  
**CareerOS Pro:** more fair-use capacity, multiple versions, deeper reports, advanced rewrite modes and no ads.

Subscription entitlements are server-verified. Pricing, quotas, trials, consent and exact ad locations remain release decisions and must not be hard-coded as assumptions.

## Success measures

| Area | Measure |
| --- | --- |
| Activation | Resume assessment completed in first session |
| Value | At least one accepted improvement within 7 days |
| Retention | Activated-user D7 return rate |
| Quality | Assessment completion and AI failure rate |
| Trust | Extraction correction and suggestion rejection rates |
| Business | Free-to-Pro conversion and renewal |

## Launch acceptance

Closed Android testing is ready when a guest or signed-in user can complete the core flow; all AI changes are reviewable; account upgrade preserves work; Pro gates work in test mode; and loading/error states never expose private data or lose drafts.
