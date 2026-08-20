-- CareerOS AI: add resume_id to job descriptions for match re-runs.
alter table public.job_descriptions
  add column resume_id uuid references public.resumes(id) on delete set null;

create index idx_job_descriptions_resume_id on public.job_descriptions(resume_id);
