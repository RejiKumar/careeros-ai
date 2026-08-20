-- CareerOS AI: guest identity, AI feedback, achievements, roast and interview coach.

-- Guest identity: local anonymous sessions with API-mediated access.
create table if not exists public.guest_accounts (
  id uuid primary key,
  created_at timestamptz not null default now()
);

alter table public.guest_accounts enable row level security;

-- Guest rows are only reachable through the API (service-role), never via REST.
create policy "guest_accounts_no_public_access" on public.guest_accounts
  for all using (false) with check (false);

-- Existing user-owned tables gain an optional guest owner.
alter table public.resumes
  add column if not exists guest_id uuid references public.guest_accounts(id) on delete cascade;
alter table public.job_descriptions
  add column if not exists guest_id uuid references public.guest_accounts(id) on delete cascade;
alter table public.coach_threads
  add column if not exists guest_id uuid references public.guest_accounts(id) on delete cascade;

create index if not exists idx_resumes_guest_id on public.resumes(guest_id);
create index if not exists idx_job_descriptions_guest_id on public.job_descriptions(guest_id);
create index if not exists idx_coach_threads_guest_id on public.coach_threads(guest_id);

-- AI feedback: reference-keyed ratings without sensitive content.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  output_type text not null check (output_type in ('assessment', 'job_match', 'coach_message', 'roast', 'rewrite')),
  output_id text not null,
  rating text not null check (rating in ('helpful', 'not_helpful')),
  reason text check (reason in ('incorrect', 'too_generic', 'not_relevant', 'too_long', 'other') or reason is null),
  reason_detail text,
  user_id uuid references auth.users(id) on delete cascade,
  guest_id uuid references public.guest_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (output_type, output_id, user_id),
  unique (output_type, output_id, guest_id)
);

alter table public.feedback enable row level security;

create policy "feedback_select_own" on public.feedback
  for select using (auth.uid() = user_id);
create policy "feedback_insert_own" on public.feedback
  for insert with check (auth.uid() = user_id);
create policy "feedback_update_own" on public.feedback
  for update using (auth.uid() = user_id);

-- Achievements: definitional rows and per-user earned rows.
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  description text not null,
  condition text not null
);

insert into public.achievements (key, title, description, condition) values
  ('ats_warrior', 'ATS Warrior', 'Score 80 or higher on a resume health assessment.', 'assessment_score_gte_80'),
  ('resume_master', 'Resume Master', 'Import and score your first resume.', 'first_assessment'),
  ('interview_ready', 'Interview Ready', 'Complete your first interview practice session.', 'first_interview'),
  ('streak_7', '7-Day Streak', 'Complete a mission on seven consecutive days.', 'streak_days_gte_7'),
  ('perfect_score', 'Perfect Score', 'Reach an overall health score of 95 or higher.', 'assessment_score_gte_95')
on conflict (key) do nothing;

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);

alter table public.user_achievements enable row level security;

create policy "user_achievements_select_own" on public.user_achievements
  for select using (auth.uid() = user_id);
create policy "user_achievements_insert_own" on public.user_achievements
  for insert with check (auth.uid() = user_id);

create index if not exists idx_user_achievements_user on public.user_achievements(user_id);

-- Roast outputs (reviewable AI content, like assessments).
create table if not exists public.roasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id uuid references public.guest_accounts(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  mode text not null,
  request_id text,
  model_version text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.roasts enable row level security;

create policy "roasts_select_own" on public.roasts
  for select using (auth.uid() = user_id);
create policy "roasts_insert_own" on public.roasts
  for insert with check (auth.uid() = user_id);

create index if not exists idx_roasts_user on public.roasts(user_id);
create index if not exists idx_roasts_guest on public.roasts(guest_id);

-- Interview coach sessions, questions and answers.
create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id uuid references public.guest_accounts(id) on delete cascade,
  resume_id uuid references public.resumes(id) on delete set null,
  mode text not null check (mode in ('hr', 'technical', 'behavioral', 'manager', 'startup', 'custom')),
  target_job text,
  target_skills jsonb not null default '[]',
  status text not null default 'active' check (status in ('active', 'completed')),
  request_id text,
  model_version text not null,
  created_at timestamptz not null default now()
);

alter table public.interview_sessions enable row level security;

create policy "interview_sessions_select_own" on public.interview_sessions
  for select using (auth.uid() = user_id);
create policy "interview_sessions_insert_own" on public.interview_sessions
  for insert with check (auth.uid() = user_id);

create index if not exists idx_interview_sessions_user on public.interview_sessions(user_id);
create index if not exists idx_interview_sessions_guest on public.interview_sessions(guest_id);

create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade,
  question text not null,
  created_at timestamptz not null default now()
);

alter table public.interview_questions enable row level security;

create policy "interview_questions_select_own" on public.interview_questions
  for select using (
    exists (select 1 from public.interview_sessions s where s.id = session_id and s.user_id = auth.uid())
  );
create policy "interview_questions_insert_own" on public.interview_questions
  for insert with check (
    exists (select 1 from public.interview_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

create index if not exists idx_interview_questions_session on public.interview_questions(session_id);

create table if not exists public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.interview_questions(id) on delete cascade,
  content text not null,
  evaluation jsonb not null default '{}',
  request_id text,
  model_version text not null,
  created_at timestamptz not null default now()
);

alter table public.interview_answers enable row level security;

create policy "interview_answers_select_own" on public.interview_answers
  for select using (
    exists (
      select 1 from public.interview_questions q
      join public.interview_sessions s on s.id = q.session_id
      where q.id = question_id and s.user_id = auth.uid()
    )
  );
create policy "interview_answers_insert_own" on public.interview_answers
  for insert with check (
    exists (
      select 1 from public.interview_questions q
      join public.interview_sessions s on s.id = q.session_id
      where q.id = question_id and s.user_id = auth.uid()
    )
  );

create index if not exists idx_interview_answers_question on public.interview_answers(question_id);
