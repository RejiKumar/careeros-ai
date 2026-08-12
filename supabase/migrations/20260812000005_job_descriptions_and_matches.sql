-- CareerOS AI: pasted job descriptions and immutable job matches.

create table public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  company text,
  raw_text text not null,
  normalized_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_descriptions enable row level security;

create policy "job_descriptions_select_own" on public.job_descriptions
  for select using (auth.uid() = user_id);
create policy "job_descriptions_insert_own" on public.job_descriptions
  for insert with check (auth.uid() = user_id);
create policy "job_descriptions_update_own" on public.job_descriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "job_descriptions_delete_own" on public.job_descriptions
  for delete using (auth.uid() = user_id);

create trigger job_descriptions_set_updated_at
  before update on public.job_descriptions
  for each row execute function public.set_updated_at();

create table public.job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_description_id uuid not null references public.job_descriptions(id) on delete cascade,
  resume_version_id uuid references public.resume_versions(id),
  request_id text,
  model_version text not null,
  score integer not null check (score between 0 and 100),
  matched_skills jsonb not null default '[]',
  missing_skills jsonb not null default '[]',
  strengths jsonb not null default '[]',
  actions jsonb not null default '[]',
  evidence jsonb,
  created_at timestamptz not null default now()
);

alter table public.job_matches enable row level security;

create policy "job_matches_select_own" on public.job_matches
  for select using (auth.uid() = user_id);
create policy "job_matches_insert_own" on public.job_matches
  for insert with check (auth.uid() = user_id);
