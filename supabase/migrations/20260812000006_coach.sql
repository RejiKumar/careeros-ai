-- CareerOS AI: coach threads and immutable coach messages.

create table public.coach_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  context jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coach_threads enable row level security;

create policy "coach_threads_select_own" on public.coach_threads
  for select using (auth.uid() = user_id);
create policy "coach_threads_insert_own" on public.coach_threads
  for insert with check (auth.uid() = user_id);
create policy "coach_threads_update_own" on public.coach_threads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "coach_threads_delete_own" on public.coach_threads
  for delete using (auth.uid() = user_id);

create trigger coach_threads_set_updated_at
  before update on public.coach_threads
  for each row execute function public.set_updated_at();

create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.coach_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  request_id text,
  created_at timestamptz not null default now()
);

alter table public.coach_messages enable row level security;

-- Immutable: users insert their own messages and read the thread; the
-- assistant reply is written server-side with the service-role key.
-- Clients may only insert their own messages, and never assistant ones.
create policy "coach_messages_select_own" on public.coach_messages
  for select using (auth.uid() = user_id);
create policy "coach_messages_insert_own" on public.coach_messages
  for insert with check (auth.uid() = user_id and role = 'user');

create index coach_messages_thread_created_idx
  on public.coach_messages (thread_id, created_at);
