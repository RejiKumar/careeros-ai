# Security Policy for CareerOS AI

## Reporting a vulnerability

Do not open a public issue for security problems. Report privately to the repository maintainers.

## Security commitments

- No provider keys, Supabase service-role keys, purchase secrets or other private credentials in mobile code, Git or logs.
- Mobile binaries receive public configuration only (`EXPO_PUBLIC_*`).
- Every user-owned record carries `user_id` and is protected by Supabase RLS plus backend ownership checks.
- AI inputs are untrusted; prompts delimit untrusted content and prohibit fabrication; model output is validated before persistence or display.
- Resumes, job descriptions and model output are treated as untrusted; uploads are validated for extension, MIME type, size and parsed output.
- AI mutations are always reviewable; explicit user acceptance is required before any resume mutation.

## Scope

The MVP does not yet implement job scraping, social/community features or iOS release operations. Those remain out of scope until explicitly scheduled.

## Disclosures

TBD — publish disclosures here before public launch.
