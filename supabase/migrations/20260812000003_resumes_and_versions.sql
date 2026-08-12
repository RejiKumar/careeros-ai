-- CareerOS AI: resumes and immutable resume versions.

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'My Resume',
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'archived')),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.resumes enable row level security;

create policy "resumes_select_own" on public.resumes
  for select using (auth.uid() = user_id);
create policy "resumes_insert_own" on public.resumes
  for insert with check (auth.uid() = user_id);
create policy "resumes_update_own" on public.resumes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "resumes_delete_own" on public.resumes
  for delete using (auth.uid() = user_id);

create trigger resumes_set_updated_at
  before update on public.resumes
  for each row execute function public.set_updated_at();

create table public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version >= 1),
  structured_data jsonb not null,
  source text not null check (source in ('import', 'edit', 'rewrite', 'ai_suggestion')),
  source_request_id text,
  created_at timestamptz not null default now(),
  unique (resume_id, version)
);

alter table public.resume_versions enable row level security;

-- Versions are immutable: select + insert only (accepted rewrites always create a new version).
create policy "resume_versions_select_own" on public.resume_versions
  for select using (auth.uid() = user_id);
create policy "resume_versions_insert_own" on public.resume_versions
  for insert with check (auth.uid() = user_id);

alter table public.resumes
  add constraint resumes_current_version_fk
  foreign key (current_version_id) references public.resume_versions(id);
