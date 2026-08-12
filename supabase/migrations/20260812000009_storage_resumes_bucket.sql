-- CareerOS AI: private resumes storage bucket with per-user folder access.

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- Objects are stored as <user_id>/<file_name>. Policies are scoped to the
-- bucket and to the object's first path segment matching the caller's uid.
create policy "resumes_select_own_folder" on storage.objects
  for select using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "resumes_insert_own_folder" on storage.objects
  for insert with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "resumes_update_own_folder" on storage.objects
  for update using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "resumes_delete_own_folder" on storage.objects
  for delete using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
