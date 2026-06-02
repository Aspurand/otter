-- Push partner when a new memory or calendar event lands. Same pg_net → edge
-- function path that nudges use. Uses the same shared secret hardcoded in 0011
-- (rotate-by-redeploy if you ever change it).

create or replace function public.notify_partner_on_memory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_url    constant text := 'https://rgqrbfgwhzoxavmheckj.supabase.co/functions/v1/send-push';
  v_secret constant text := 'qyHBKx9UTkhuxE5wukp69FxCpahAs25zn52eC5PVaTqIB7rkk6kaSXRjKfHIuGpG';
  v_body   text;
begin
  select id into v_recipient
    from profiles
   where couple_id = new.couple_id
     and id <> new.created_by
   limit 1;
  if v_recipient is null then return new; end if;

  v_body := case new.kind
              when 'photo' then 'they saved a photo for you two'
              when 'voice' then 'they saved a voice note'
              when 'note'  then 'they wrote something down'
              else 'they added a memory'
            end;
  if new.caption is not null and length(new.caption) > 0 then
    v_body := v_body || ' — "' || left(new.caption, 60) || '"';
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body    := jsonb_build_object(
                 'user_id', v_recipient,
                 'title',   'new memory ✨',
                 'body',    v_body,
                 'kind',    'memory',
                 'url',     '/otter/'
               )
  );
  return new;
end;
$$;

drop trigger if exists trg_memory_push on memories;
create trigger trg_memory_push
  after insert on memories
  for each row execute function notify_partner_on_memory();


create or replace function public.notify_partner_on_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_url    constant text := 'https://rgqrbfgwhzoxavmheckj.supabase.co/functions/v1/send-push';
  v_secret constant text := 'qyHBKx9UTkhuxE5wukp69FxCpahAs25zn52eC5PVaTqIB7rkk6kaSXRjKfHIuGpG';
  v_title  text;
begin
  select id into v_recipient
    from profiles
   where couple_id = new.couple_id
     and id <> new.created_by
   limit 1;
  if v_recipient is null then return new; end if;

  v_title := case
               when new.is_reunion then 'reunion scheduled ✈️'
               else 'new plan together'
             end;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body    := jsonb_build_object(
                 'user_id', v_recipient,
                 'title',   v_title,
                 'body',    new.title,
                 'kind',    'event',
                 'url',     '/otter/'
               )
  );
  return new;
end;
$$;

drop trigger if exists trg_event_push on events;
create trigger trg_event_push
  after insert on events
  for each row execute function notify_partner_on_event();
