-- CareerOS AI: resume health assessments (immutable).

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_version_id uuid not null references public.resume_versions(id) on delete cascade,
  request_id text,
  model_version text not null,
  prompt_version text,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed')),
  scores jsonb,
  evidence jsonb,
  gaps jsonb,
  created_at timestamptz not null default now()
);

alter table public.assessments enable row level security;

-- Immutable: users can insert pending assessments and read completed ones.
-- Status updates are applied server-side with the service-role key.
create policy "assessments_select_own" on public.assessments
  for select using (auth.uid() = user_id);
create policy "assessments_insert_own" on public.assessments
  for insert with check (auth.uid() = user_id);
