# Production Release on Free Tiers

How CareerOS AI runs in production at (near) zero cost, and the one-time console
steps to stand it up. Written 2026-11-18 after the Railway API at
`careeros-ai-production.up.railway.app` stopped serving (Railway returns
`x-railway-fallback: true`, i.e. no deployed service), leaving the released
v8 build without a backend.

## Stack

| Concern | Service | Cost | Limits to watch |
| --- | --- | --- | --- |
| API (FastAPI) | Google Cloud Run, request-based billing, scale to zero | Free within always-free quota | ~2M req/month, 180k vCPU-s, 360k GiB-s; cold start ~2-5 s |
| Container images | Artifact Registry | Free up to 0.5 GB | Keep a cleanup policy (step 2) |
| Server secrets | Secret Manager | Free up to 6 active secret versions (~$0.06/month each beyond) | 7 used; destroy old versions when rotating |
| Job search | JSearch (RapidAPI, real-time Google for Jobs) with Adzuna India fallback | Free plans | JSearch free cap is ~100-200 req/month; on quota errors the API uses Adzuna for 6 h |
| AI usage limits | Per-owner rolling 24 h counter in `ai_usage_events` | Supabase Free | Guests 3 / signed-in 20 AI actions a day (`CAREEROS_AI_DAILY_LIMIT_GUEST` / `_USER`, 0 = off, Pro unlimited). Apply the `ai_usage_events` migration first; until then the API fails open (no limit) and logs a warning |
| Market Pulse | Adzuna statistics (postings per skill in the last 30 days, hiring leaderboard; no growth % or salary ranges, which the source cannot support honestly) | Adzuna free plan | Needs the Adzuna secrets; cached 6 h per location. Without them `/market-pulse` returns 503 `market_data_unavailable` (never sample data) |
| Company Deep Dive | Built from live job postings via the job search provider | JSearch/Adzuna quota | Profiles list only what postings show (name, location, open-posting count, technologies, links); cached 1 h per search |
| Reminder cron | Cloud Scheduler | Free for 3 jobs per billing account | 1 job used |
| Database/Auth/Storage | Supabase Free | Free | 500 MB DB, 1 GB storage, 50k MAU; no automatic backups; pauses after 7 days of no activity |
| AI | Gemini API **paid tier** | Pay-as-you-go (small) | Paid tier is required: on the free tier Google may use resumes/chats to improve products |
| Push | Firebase Cloud Messaging | Free | — |
| Legal site | Cloudflare (careerosai.app) | Free (domain renewal only) | — |
| Mobile builds | EAS Free | Free | Monthly build quota, low-priority queue |
| Ads | AdMob | Revenue | — |
| Store | Google Play | One-time $25 (already paid) | — |

Verify current always-free limits and eligible regions on
<https://cloud.google.com/run/pricing> and <https://cloud.google.com/free> before
choosing a region; free quotas apply only in certain US regions.

## Region choice

Every API request makes several Supabase round trips, so the API should sit
near the Supabase project. Check the Supabase region in Dashboard -> Project
Settings -> General.

- Supabase in a US region: use `us-central1` (free tier + Cloud Run domain mapping).
- Supabase elsewhere (e.g. Mumbai): `us-central1` still works but adds latency per
  DB call. Moving Supabase is a larger migration; decide deliberately.

The examples below use `REGION=us-central1`.

## One-time GCP setup

Run in Cloud Shell (or locally with `gcloud`). Replace placeholders.

```bash
PROJECT_ID=careeros-prod          # pick a globally unique id
REGION=us-central1
GH_REPO=RejiKumar/careeros-ai

# 1. Project + billing (billing account needs a card; usage stays within free quota)
gcloud projects create "$PROJECT_ID"
gcloud billing projects link "$PROJECT_ID" --billing-account=XXXXXX-XXXXXX-XXXXXX
gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com cloudscheduler.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com

# 2. Image repository, keeping only the 2 newest images (stays under 0.5 GB)
gcloud artifacts repositories create careeros --repository-format=docker --location="$REGION"
cat > /tmp/cleanup.json <<'EOF'
[{"name":"keep-2","action":{"type":"Keep"},"mostRecentVersions":{"keepCount":2}},
 {"name":"delete-rest","action":{"type":"Delete"},"condition":{"tagState":"any"}}]
EOF
gcloud artifacts repositories set-cleanup-policies careeros --location="$REGION" --policy=/tmp/cleanup.json

# 3. Secrets (server only, never in Git). Paste values via stdin, not argv.
for s in supabase-service-role-key gemini-api-key cron-secret firebase-credentials-json adzuna-app-id adzuna-app-key jsearch-api-key; do
  gcloud secrets create "$s" --replication-policy=automatic
done
openssl rand -hex 32 | tr -d '\n' | gcloud secrets versions add cron-secret --data-file=-
gcloud secrets versions add supabase-service-role-key --data-file=-   # paste, then Ctrl-D
gcloud secrets versions add gemini-api-key --data-file=-              # key from a BILLING-ENABLED project
gcloud secrets versions add firebase-credentials-json --data-file=path/to/service-account.json
gcloud secrets versions add adzuna-app-id --data-file=-
gcloud secrets versions add adzuna-app-key --data-file=-
# No Adzuna account? Remove the two adzuna entries from --set-secrets in
# .github/workflows/api-deploy-cloud-run.yml; job search then shows labelled sample results.

# 4. Runtime identity for the service, allowed to read secrets
gcloud iam service-accounts create careeros-api-runtime
RUNTIME_SA="careeros-api-runtime@$PROJECT_ID.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$RUNTIME_SA" \
  --role=roles/secretmanager.secretAccessor

# 5. Deployer identity + keyless GitHub auth (Workload Identity Federation)
gcloud iam service-accounts create github-deployer
DEPLOY_SA="github-deployer@$PROJECT_ID.iam.gserviceaccount.com"
for role in roles/run.admin roles/artifactregistry.writer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$DEPLOY_SA" --role="$role"
done
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$DEPLOY_SA" --role=roles/iam.serviceAccountUser
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
gcloud iam workload-identity-pools create github --location=global
gcloud iam workload-identity-pools providers create-oidc github \
  --location=global --workload-identity-pool=github \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository \
  --attribute-condition="assertion.repository=='$GH_REPO'"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$GH_REPO"
echo "GCP_WIF_PROVIDER=projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github"
echo "GCP_DEPLOY_SA=$DEPLOY_SA"
```

The deploy workflow runs the service as `GCP_RUNTIME_SA` (step 4), the only
identity allowed to read the secrets.

## GitHub configuration

Settings -> Environments -> create `production` (optionally require a reviewer).
Settings -> Secrets and variables -> Actions -> **Variables** (none are secret):

| Variable | Value |
| --- | --- |
| `GCP_PROJECT_ID` | project id |
| `GCP_REGION` | e.g. `us-central1` |
| `GCP_WIF_PROVIDER` | printed by step 5 |
| `GCP_DEPLOY_SA` | printed by step 5 |
| `GCP_RUNTIME_SA` | `careeros-api-runtime@<project>.iam.gserviceaccount.com` |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | publishable/anon key (public) |
| `GEMINI_MODEL` | canonical model id |
| `ADZUNA_COUNTRY` | optional, default `in` |
| `JSEARCH_COUNTRY` | optional, default `in` |

Then run **Actions -> API Deploy (Cloud Run) -> Run workflow** (it also runs on
pushes to `prod` touching `apps/api`). The job summary prints the service URL.

## Custom domain: api.careerosai.app

The app binary uses `https://api.careerosai.app`, so the backend host can change
again without shipping a new app version.

```bash
gcloud beta run domain-mappings create --service=careeros-api \
  --domain=api.careerosai.app --region="$REGION"
```

First verify `careerosai.app` ownership in Google Search Console if prompted.
In Cloudflare DNS add `api` CNAME `ghs.googlehosted.com` with proxy **off**
(grey cloud). Certificate issuance takes 15-60 minutes. Domain mapping is only
available in some regions; if yours is unsupported, front the `run.app` URL with
a free Cloudflare Worker that proxies requests to it.

Check: `curl https://api.careerosai.app/health` returns `{"status":"ok"}`.

## Reminder cron

Notification reminders no longer rely on an in-process timer (Cloud Run throttles
CPU between requests and scales to zero). Cloud Scheduler calls the API hourly:

```bash
gcloud scheduler jobs create http careeros-reminders --location="$REGION" \
  --schedule="0 * * * *" --http-method=POST \
  --uri="https://api.careerosai.app/api/v1/jobs/notification-reminders" \
  --headers="X-Cron-Secret=$(gcloud secrets versions access latest --secret=cron-secret)"
gcloud scheduler jobs run careeros-reminders --location="$REGION"   # smoke test, expect 200
```

The hourly call also keeps Supabase from pausing for inactivity.

## Gemini paid tier

1. In Google AI Studio, open the API key's project and enable billing (Cloud
   Billing account attached).
2. Create a budget with alerts (Billing -> Budgets & alerts), e.g. $5/month with
   50/90/100% email alerts. Budgets alert; they do not cap spend.
3. Store that key in the `gemini-api-key` secret.
4. Revoke any free-tier keys that previously received user resumes.

Until per-user AI quotas are enforced (see "Open blockers"), the budget alert and
`--max-instances 2` are the only spend guards.

## Supabase

- Authentication -> URL Configuration: keep `careerosai://**` in Redirect URLs.
- All migrations in `supabase/migrations` applied (`supabase db push`).
- Free tier has no automatic backups: schedule a periodic `supabase db dump`
  to private storage you control.

## Mobile release (v1.0.1, versionCode 16)

Play never accepts a reused versionCode. versionCode 9 ("1.0.0") was found
installed from the Play Store on a test device, so 9 is consumed; 10 may already have been uploaded, so 11 is used.

1. Confirm `https://api.careerosai.app/health` is healthy.
2. Build: Actions -> **EAS Android Build (Production AAB)**, or locally
   `cd apps/mobile && npx eas-cli build --platform android --profile production`.
3. Install the matching `device-test` APK on a real device and run the acceptance
   flow: guest start -> resume import -> health score -> job match -> coach ->
   sign up (email + Google) -> guest data migrated -> delete account.
4. Upload the `.aab` to the closed testing track; promote to production once
   Play Console grants production access (new personal accounts need 12+ testers
   opted in for 14 days of closed testing).
5. Play Console Data safety: declare resume/personal info collection, processing
   by Google (Gemini, Firebase, AdMob) and Supabase, encryption in transit, and
   the deletion URL `https://careerosai.app/delete-account`.

## Open blockers before wide release

- **AI quotas are not enforced.** `BillingService.check_quota` exists but no route
  calls it. The existing model counts lifetime usage (not per day), covers only
  assess/match/rewrite/coach, ignores guests, and its message says "Upgrade to
  Pro" although no purchase flow exists. Needs a decision on daily limits per
  feature for guests and users, a migration to widen `usage_events`, and mobile
  handling of `quota_exceeded`.
- **No mobile CI job.** `ci.yml` runs only the API; mobile lint/typecheck/jest
  run locally only.
- `apps/api/railway.toml` and `nixpacks.toml` are obsolete once Cloud Run is live.
