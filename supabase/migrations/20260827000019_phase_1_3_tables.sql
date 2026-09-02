-- CareerOS AI: Phase 1-3 tables — job search, applications, company deep dive,
-- skills gap, resume tailor, career paths and notifications.
-- API is the only gateway: repositories use the service-role client and enforce
-- ownership (user_id/guest_id) in FastAPI. RLS policies protect authenticated REST.

-- 1. Saved jobs: user bookmarks from search results.
create table if not exists public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id uuid references public.guest_accounts(id) on delete cascade,
  job_id text not null,
  job_title text not null,
  company text not null,
  source text not null,
  url text not null,
  match_score float,
  saved_at timestamptz not null default now(),
  constraint saved_jobs_owner_check check (user_id is not null or guest_id is not null)
);

alter table public.saved_jobs enable row level security;

create policy "saved_jobs_select_own" on public.saved_jobs
  for select using (auth.uid() = user_id);
create policy "saved_jobs_insert_own" on public.saved_jobs
  for insert with check (auth.uid() = user_id);
create policy "saved_jobs_update_own" on public.saved_jobs
  for update using (auth.uid() = user_id);
create policy "saved_jobs_delete_own" on public.saved_jobs
  for delete using (auth.uid() = user_id);

create index if not exists idx_saved_jobs_user on public.saved_jobs(user_id);
create index if not exists idx_saved_jobs_guest on public.saved_jobs(guest_id);

-- 2. Job alert preferences: one optional row per actor.
create table if not exists public.job_alert_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id uuid references public.guest_accounts(id) on delete cascade,
  query text not null,
  location text,
  min_match_score float not null default 0,
  frequency text not null default 'daily'
    check (frequency in ('daily', 'weekly', 'instant')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint job_alert_preferences_owner_check check (user_id is not null or guest_id is not null)
);

alter table public.job_alert_preferences enable row level security;

create policy "job_alert_preferences_select_own" on public.job_alert_preferences
  for select using (auth.uid() = user_id);
create policy "job_alert_preferences_insert_own" on public.job_alert_preferences
  for insert with check (auth.uid() = user_id);
create policy "job_alert_preferences_update_own" on public.job_alert_preferences
  for update using (auth.uid() = user_id);
create policy "job_alert_preferences_delete_own" on public.job_alert_preferences
  for delete using (auth.uid() = user_id);

create index if not exists idx_job_alert_prefs_user on public.job_alert_preferences(user_id);
create index if not exists idx_job_alert_prefs_guest on public.job_alert_preferences(guest_id);

-- 3. Application tracker.
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id uuid references public.guest_accounts(id) on delete cascade,
  job_id text,
  job_title text not null,
  company text not null,
  status text not null check (status in ('applied', 'interviewing', 'offered', 'rejected')),
  notes text,
  url text,
  applied_at text,
  interview_date text,
  follow_up_date text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_owner_check check (user_id is not null or guest_id is not null)
);

alter table public.applications enable row level security;

create policy "applications_select_own" on public.applications
  for select using (auth.uid() = user_id);
create policy "applications_insert_own" on public.applications
  for insert with check (auth.uid() = user_id);
create policy "applications_update_own" on public.applications
  for update using (auth.uid() = user_id);
create policy "applications_delete_own" on public.applications
  for delete using (auth.uid() = user_id);

create index if not exists idx_applications_user on public.applications(user_id);
create index if not exists idx_applications_guest on public.applications(guest_id);
create index if not exists idx_applications_status on public.applications(status);

-- 4. Career paths: AI-generated, reviewable path documents.
create table if not exists public.career_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id uuid references public.guest_accounts(id) on delete cascade,
  target_role text not null,
  path_data text not null,
  created_at timestamptz not null default now(),
  constraint career_paths_owner_check check (user_id is not null or guest_id is not null)
);

alter table public.career_paths enable row level security;

create policy "career_paths_select_own" on public.career_paths
  for select using (auth.uid() = user_id);
create policy "career_paths_insert_own" on public.career_paths
  for insert with check (auth.uid() = user_id);
create policy "career_paths_update_own" on public.career_paths
  for update using (auth.uid() = user_id);
create policy "career_paths_delete_own" on public.career_paths
  for delete using (auth.uid() = user_id);

create index if not exists idx_career_paths_user on public.career_paths(user_id);
create index if not exists idx_career_paths_guest on public.career_paths(guest_id);

-- 5. Company catalog (aggregated public data; searchable but not owned).
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  tech_stack jsonb not null default '[]',
  team_size integer,
  industry text,
  description text,
  culture_signals jsonb not null default '[]',
  funding_stage text,
  growth_indicator text,
  recent_job_count integer,
  logo_url text,
  created_at timestamptz not null default now()
);

alter table public.companies enable row level security;

create policy "companies_select_anon" on public.companies
  for select using (true);

create index if not exists idx_companies_name on public.companies(name);
create index if not exists idx_companies_location on public.companies(location);

-- 6. Saved companies: user/guest bookmarks with optional notes.
create table if not exists public.saved_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id uuid references public.guest_accounts(id) on delete cascade,
  company_name text not null,
  notes text,
  saved_at timestamptz not null default now(),
  constraint saved_companies_owner_check check (user_id is not null or guest_id is not null)
);

alter table public.saved_companies enable row level security;

create policy "saved_companies_select_own" on public.saved_companies
  for select using (auth.uid() = user_id);
create policy "saved_companies_insert_own" on public.saved_companies
  for insert with check (auth.uid() = user_id);
create policy "saved_companies_update_own" on public.saved_companies
  for update using (auth.uid() = user_id);
create policy "saved_companies_delete_own" on public.saved_companies
  for delete using (auth.uid() = user_id);

create index if not exists idx_saved_companies_user on public.saved_companies(user_id);
create index if not exists idx_saved_companies_guest on public.saved_companies(guest_id);

-- 7. Resume tailor history: reviewable before-accept AI rewrites.
create table if not exists public.resume_tailor_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id uuid references public.guest_accounts(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  job_description_id uuid not null references public.job_descriptions(id) on delete cascade,
  original_version_id uuid not null references public.resume_versions(id) on delete cascade,
  tailored_version_id uuid references public.resume_versions(id) on delete set null,
  tailored_content jsonb not null default '{}',
  diffs jsonb not null default '[]',
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  constraint resume_tailor_history_owner_check check (user_id is not null or guest_id is not null)
);

alter table public.resume_tailor_history enable row level security;

create policy "resume_tailor_history_select_own" on public.resume_tailor_history
  for select using (auth.uid() = user_id);
create policy "resume_tailor_history_insert_own" on public.resume_tailor_history
  for insert with check (auth.uid() = user_id);
create policy "resume_tailor_history_update_own" on public.resume_tailor_history
  for update using (auth.uid() = user_id);
create policy "resume_tailor_history_delete_own" on public.resume_tailor_history
  for delete using (auth.uid() = user_id);

create index if not exists idx_resume_tailor_user on public.resume_tailor_history(user_id);
create index if not exists idx_resume_tailor_guest on public.resume_tailor_history(guest_id);
create index if not exists idx_resume_tailor_resume on public.resume_tailor_history(resume_id);

-- 8. Skills gap analyses.
create table if not exists public.skill_gap_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id uuid references public.guest_accounts(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  job_description_id uuid not null references public.job_descriptions(id) on delete cascade,
  matched_skills jsonb not null default '[]',
  partial_skills jsonb not null default '[]',
  missing_skills jsonb not null default '[]',
  overall_match float not null default 0,
  created_at timestamptz not null default now(),
  constraint skill_gap_analyses_owner_check check (user_id is not null or guest_id is not null)
);

alter table public.skill_gap_analyses enable row level security;

create policy "skill_gap_analyses_select_own" on public.skill_gap_analyses
  for select using (auth.uid() = user_id);
create policy "skill_gap_analyses_insert_own" on public.skill_gap_analyses
  for insert with check (auth.uid() = user_id);
create policy "skill_gap_analyses_update_own" on public.skill_gap_analyses
  for update using (auth.uid() = user_id);
create policy "skill_gap_analyses_delete_own" on public.skill_gap_analyses
  for delete using (auth.uid() = user_id);

create index if not exists idx_skill_gap_user on public.skill_gap_analyses(user_id);
create index if not exists idx_skill_gap_guest on public.skill_gap_analyses(guest_id);

-- 9. FCM device tokens for push notifications.
create table if not exists public.fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id uuid references public.guest_accounts(id) on delete cascade,
  token text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  constraint fcm_tokens_owner_check check (user_id is not null or guest_id is not null)
);

alter table public.fcm_tokens enable row level security;

create policy "fcm_tokens_select_own" on public.fcm_tokens
  for select using (auth.uid() = user_id);
create policy "fcm_tokens_insert_own" on public.fcm_tokens
  for insert with check (auth.uid() = user_id);
create policy "fcm_tokens_update_own" on public.fcm_tokens
  for update using (auth.uid() = user_id);
create policy "fcm_tokens_delete_own" on public.fcm_tokens
  for delete using (auth.uid() = user_id);

create index if not exists idx_fcm_tokens_user on public.fcm_tokens(user_id);
create index if not exists idx_fcm_tokens_guest on public.fcm_tokens(guest_id);

-- 10. Notification preferences: one optional row per actor.
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id uuid references public.guest_accounts(id) on delete cascade,
  job_alerts boolean not null default true,
  mission_reminders boolean not null default true,
  career_tips boolean not null default true,
  frequency text not null default 'daily'
    check (frequency in ('daily', 'weekly', 'instant')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_owner_check check (user_id is not null or guest_id is not null)
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_select_own" on public.notification_preferences
  for select using (auth.uid() = user_id);
create policy "notification_preferences_insert_own" on public.notification_preferences
  for insert with check (auth.uid() = user_id);
create policy "notification_preferences_update_own" on public.notification_preferences
  for update using (auth.uid() = user_id);
create policy "notification_preferences_delete_own" on public.notification_preferences
  for delete using (auth.uid() = user_id);

create index if not exists idx_notification_prefs_user on public.notification_preferences(user_id);
create index if not exists idx_notification_prefs_guest on public.notification_preferences(guest_id);

-- 11. Notification logs delivered to actors.
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id uuid references public.guest_accounts(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null,
  sent_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notification_logs_owner_check check (user_id is not null or guest_id is not null)
);

alter table public.notification_logs enable row level security;

create policy "notification_logs_select_own" on public.notification_logs
  for select using (auth.uid() = user_id);
create policy "notification_logs_insert_own" on public.notification_logs
  for insert with check (auth.uid() = user_id);
create policy "notification_logs_update_own" on public.notification_logs
  for update using (auth.uid() = user_id);
create policy "notification_logs_delete_own" on public.notification_logs
  for delete using (auth.uid() = user_id);

create index if not exists idx_notification_logs_user on public.notification_logs(user_id);
create index if not exists idx_notification_logs_guest on public.notification_logs(guest_id);

-- 12. Market pulse read-only aggregates: skill demand snapshots.
create table if not exists public.skill_demands (
  id uuid primary key default gen_random_uuid(),
  skill text not null,
  location text,
  period text,
  demand_score float not null default 0,
  change_percent float not null default 0,
  job_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.skill_demands enable row level security;

create policy "skill_demands_select_anon" on public.skill_demands
  for select using (true);

create index if not exists idx_skill_demands_location on public.skill_demands(location);
create index if not exists idx_skill_demands_period on public.skill_demands(period);

-- 13. Market pulse read-only aggregates: salary data snapshots.
create table if not exists public.salary_data (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  location text not null,
  min_salary float,
  max_salary float,
  median_salary float,
  experience_level text,
  created_at timestamptz not null default now()
);

alter table public.salary_data enable row level security;

create policy "salary_data_select_anon" on public.salary_data
  for select using (true);

create index if not exists idx_salary_data_role on public.salary_data(role);
create index if not exists idx_salary_data_location on public.salary_data(location);

-- 14. Market pulse read-only aggregates: top hiring companies.
create table if not exists public.company_data (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  job_count integer not null default 0,
  tech_stack jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.company_data enable row level security;

create policy "company_data_select_anon" on public.company_data
  for select using (true);

create index if not exists idx_company_data_location on public.company_data(location);