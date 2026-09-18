-- CareerOS AI: enable RLS on the definitions table `achievements`.
-- Writes happen server-side via the FastAPI service-role client and are
-- seeded by migrations. End users only need read access to reference rows.

alter table public.achievements enable row level security;

create policy "achievements_select_authenticated" on public.achievements
  for select to authenticated
  using (true);