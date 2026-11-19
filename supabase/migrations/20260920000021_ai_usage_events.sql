-- CareerOS AI: daily AI usage metering for users and guests.
--
-- One row per successful AI action. The API counts rows in a rolling 24-hour
-- window per owner to enforce the daily limit. Written and read only by the
-- API with the service-role key: RLS is enabled with no policies, so the REST
-- API (anon / authenticated roles) can neither read nor write it.
create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_id uuid references public.guest_accounts(id) on delete cascade,
  feature text not null,
  created_at timestamptz not null default now(),
  constraint ai_usage_events_exactly_one_owner
    check ((user_id is not null) <> (guest_id is not null))
);

alter table public.ai_usage_events enable row level security;

create index if not exists idx_ai_usage_events_user_created
  on public.ai_usage_events (user_id, created_at desc)
  where user_id is not null;

create index if not exists idx_ai_usage_events_guest_created
  on public.ai_usage_events (guest_id, created_at desc)
  where guest_id is not null;
