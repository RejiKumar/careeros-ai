-- CareerOS AI: backfill achievements from existing activity (idempotent).

insert into public.user_achievements (user_id, achievement_id)
select distinct a.user_id, ac.id
from public.assessments a
join public.achievements ac on ac.key = 'resume_master'
where a.status = 'completed'
on conflict (user_id, achievement_id) do nothing;

insert into public.user_achievements (user_id, achievement_id)
select distinct a.user_id, ac.id
from public.assessments a
join public.achievements ac on ac.key = 'ats_warrior'
where a.status = 'completed'
  and (
    select avg((s ->> 'score')::int)
    from jsonb_array_elements(a.scores) s
    where jsonb_typeof(s -> 'score') = 'number'
  ) >= 80
on conflict (user_id, achievement_id) do nothing;

insert into public.user_achievements (user_id, achievement_id)
select distinct a.user_id, ac.id
from public.assessments a
join public.achievements ac on ac.key = 'perfect_score'
where a.status = 'completed'
  and (
    select avg((s ->> 'score')::int)
    from jsonb_array_elements(a.scores) s
    where jsonb_typeof(s -> 'score') = 'number'
  ) >= 95
on conflict (user_id, achievement_id) do nothing;

insert into public.user_achievements (user_id, achievement_id)
select distinct s.user_id, ac.id
from public.interview_sessions s
join public.achievements ac on ac.key = 'interview_ready'
where s.user_id is not null
on conflict (user_id, achievement_id) do nothing;
