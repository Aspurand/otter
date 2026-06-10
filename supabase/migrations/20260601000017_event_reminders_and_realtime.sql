-- Shared-calendar upgrade:
--   1) events joins the realtime publication so both phones see new/edited
--      plans live (the Calendar page subscribes to postgres_changes).
--   2) a pg_cron reminder pushes BOTH partners when a plan is <24h away —
--      the "so the other doesn't forget" half of the feature. Same pg_net →
--      send-push edge-function path (and shared secret) as 0011/0015.

-- 1 ────────── realtime ──────────
do $$
begin
  execute 'alter publication supabase_realtime add table events';
exception when others then
  null; -- already in publication
end$$;

-- 2 ────────── day-before reminder ──────────
alter table events add column if not exists reminded_at timestamptz;

create or replace function public.send_event_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec  record;
  prof record;
  v_url    constant text := 'https://rgqrbfgwhzoxavmheckj.supabase.co/functions/v1/send-push';
  v_secret constant text := 'qyHBKx9UTkhuxE5wukp69FxCpahAs25zn52eC5PVaTqIB7rkk6kaSXRjKfHIuGpG';
  v_title text;
  v_body  text;
begin
  for rec in
    select * from events
     where reminded_at is null
       and starts_at >  now()
       and starts_at <= now() + interval '24 hours'
       -- the insert trigger (0015) already pinged the partner; don't double-ping
       -- plans made less than an hour ago.
       and created_at <= now() - interval '1 hour'
  loop
    -- Mark first: if a push fails we'd rather skip one reminder than spam on
    -- every cron tick.
    update events set reminded_at = now() where id = rec.id;

    v_title := case when rec.is_reunion then 'reunion tomorrow ✈️' else 'coming up 💛' end;

    for prof in
      select id, timezone from profiles where couple_id = rec.couple_id
    loop
      v_body := rec.title || ' · ' ||
                lower(trim(to_char(rec.starts_at at time zone coalesce(prof.timezone, 'UTC'), 'Dy HH12:MI am')));
      perform net.http_post(
        url     := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
        body    := jsonb_build_object(
                     'user_id', prof.id,
                     'title',   v_title,
                     'body',    v_body,
                     'kind',    'event',
                     'url',     '/otter/'
                   )
      );
    end loop;
  end loop;
end;
$$;

do $$
begin
  perform cron.unschedule('event-reminders');
exception when others then
  null; -- not scheduled yet, that's fine
end$$;

select cron.schedule(
  'event-reminders',
  '*/15 * * * *',
  $$select public.send_event_reminders()$$
);
