-- CareerOS AI: reviewable AI rewrite suggestion batches.

create table public.rewrite_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_version_id uuid not null references public.resume_versions(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  suggestions jsonb not null default '[]',
  accepted_version_id uuid references public.resume_versions(id),
  request_id text,
  model_version text not null,
  created_at timestamptz not null default now()
);

alter table public.rewrite_suggestions enable row level security;

-- Immutable except for server-side status transitions via the service-role key.
create policy "rewrite_suggestions_select_own" on public.rewrite_suggestions
  for select using (auth.uid() = user_id);
create policy "rewrite_suggestions_insert_own" on public.rewrite_suggestions
  for insert with check (auth.uid() = user_id);
