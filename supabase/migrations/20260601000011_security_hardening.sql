-- Security hardening: rotate push secret, lock immutable cols, tighten storage,
-- atomic game-session create, and a serializable join_couple cap check.

-- 1) Rotate push secret + refresh trigger function with the new value.
create or replace function public.notify_partner_on_nudge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_kind      text := new.kind;
  v_body      text := new.body;
  v_title     text;
  v_url       constant text := 'https://rgqrbfgwhzoxavmheckj.supabase.co/functions/v1/send-push';
  v_secret    constant text := 'qyHBKx9UTkhuxE5wukp69FxCpahAs25zn52eC5PVaTqIB7rkk6kaSXRjKfHIuGpG';
begin
  if new.delivered is not true then return new; end if;

  select id into v_recipient
    from profiles
   where couple_id = new.couple_id
     and id <> new.sender_id
   limit 1;
  if v_recipient is null then return new; end if;

  v_title := case v_kind
               when 'love_note' then 'a love note arrived'
               when 'goodnight' then 'goodnight'
               when 'okay'      then 'they checked in'
               else                  'thinking of you'
             end;
  if v_body is null or v_body = '' then
    v_body := case v_kind
                when 'love_note' then 'tap to read'
                when 'goodnight' then 'tucked in'
                when 'okay'      then 'all is well'
                else                  'they sent a heart'
              end;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                  'Content-Type', 'application/json',
                  'x-push-secret', v_secret
               ),
    body    := jsonb_build_object(
                  'user_id', v_recipient,
                  'title',   v_title,
                  'body',    v_body,
                  'kind',    v_kind
               )
  );
  return new;
end;
$$;

-- 2) Lock in join_couple to prevent the 2-person cap race.
create or replace function public.join_couple(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_existing uuid;
  v_couple   uuid;
  v_count    int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select p.couple_id into v_existing from profiles p where p.id = v_uid;
  if v_existing is not null then raise exception 'already in a couple'; end if;

  -- FOR UPDATE locks the couple row so concurrent joins serialize on the cap check.
  select id into v_couple from couples where invite_code = upper(trim(p_code)) for update;
  if v_couple is null then raise exception 'invalid invite code'; end if;

  select count(*) into v_count from profiles where couple_id = v_couple;
  if v_count >= 2 then raise exception 'this couple is already full'; end if;

  update profiles set couple_id = v_couple where id = v_uid;
  return v_couple;
end;
$$;

-- 3) Tighten UPDATE policies on messages + nudges so sender can mutate body,
--    partner can only set read_at. Immutable identity cols are locked by triggers.

drop policy if exists messages_update_in_couple on messages;
create policy messages_update_sender
  on messages for update
  using  (couple_id = public.current_couple_id() and sender_id = auth.uid())
  with check (couple_id = public.current_couple_id() and sender_id = auth.uid());
create policy messages_update_partner_read
  on messages for update
  using  (couple_id = public.current_couple_id() and sender_id <> auth.uid())
  with check (couple_id = public.current_couple_id() and sender_id <> auth.uid());

create or replace function lock_message_fields() returns trigger
language plpgsql as $$
begin
  if new.couple_id   <> old.couple_id   then raise exception 'couple_id is immutable'; end if;
  if new.sender_id   <> old.sender_id   then raise exception 'sender_id is immutable'; end if;
  if new.created_at  <> old.created_at  then raise exception 'created_at is immutable'; end if;
  -- For partner updates (not the sender), only read_at may change.
  if old.sender_id <> auth.uid() then
    if coalesce(new.body, '')      is distinct from coalesce(old.body, '')      then raise exception 'partner may only set read_at on messages'; end if;
    if coalesce(new.kind, '')      is distinct from coalesce(old.kind, '')      then raise exception 'partner may only set read_at on messages'; end if;
    if coalesce(new.media_url, '') is distinct from coalesce(old.media_url, '') then raise exception 'partner may only set read_at on messages'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists messages_lock on messages;
create trigger messages_lock
  before update on messages
  for each row execute function lock_message_fields();

drop policy if exists nudges_update_in_couple on nudges;
create policy nudges_update_sender
  on nudges for update
  using  (couple_id = public.current_couple_id() and sender_id = auth.uid())
  with check (couple_id = public.current_couple_id() and sender_id = auth.uid());
create policy nudges_update_partner_read
  on nudges for update
  using  (couple_id = public.current_couple_id() and sender_id <> auth.uid())
  with check (couple_id = public.current_couple_id() and sender_id <> auth.uid());

create or replace function lock_nudge_fields() returns trigger
language plpgsql as $$
begin
  if new.couple_id  <> old.couple_id  then raise exception 'couple_id is immutable'; end if;
  if new.sender_id  <> old.sender_id  then raise exception 'sender_id is immutable'; end if;
  if new.created_at <> old.created_at then raise exception 'created_at is immutable'; end if;
  if old.sender_id <> auth.uid() then
    if coalesce(new.kind, '') is distinct from coalesce(old.kind, '') then raise exception 'partner may only set read_at on nudges'; end if;
    if coalesce(new.body, '') is distinct from coalesce(old.body, '') then raise exception 'partner may only set read_at on nudges'; end if;
    if new.deliver_at is distinct from old.deliver_at                 then raise exception 'partner may only set read_at on nudges'; end if;
    if new.delivered  is distinct from old.delivered                  then raise exception 'partner may only set read_at on nudges'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists nudges_lock on nudges;
create trigger nudges_lock
  before update on nudges
  for each row execute function lock_nudge_fields();

-- events / memories: keep current "any couple member can edit" but lock identity cols.
create or replace function lock_event_fields() returns trigger language plpgsql as $$
begin
  if new.couple_id   <> old.couple_id   then raise exception 'couple_id is immutable'; end if;
  if new.created_by  <> old.created_by  then raise exception 'created_by is immutable'; end if;
  if new.created_at  <> old.created_at  then raise exception 'created_at is immutable'; end if;
  return new;
end;
$$;
drop trigger if exists events_lock on events;
create trigger events_lock before update on events for each row execute function lock_event_fields();

create or replace function lock_memory_fields() returns trigger language plpgsql as $$
begin
  if new.couple_id   <> old.couple_id   then raise exception 'couple_id is immutable'; end if;
  if new.created_by  <> old.created_by  then raise exception 'created_by is immutable'; end if;
  if new.created_at  <> old.created_at  then raise exception 'created_at is immutable'; end if;
  return new;
end;
$$;
drop trigger if exists memories_lock on memories;
create trigger memories_lock before update on memories for each row execute function lock_memory_fields();

-- 4) watch_sessions content_url validation + state size cap on game_sessions.
--    Use DO blocks because `add constraint if not exists` is not standard.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'watch_url_https') then
    execute 'alter table watch_sessions add constraint watch_url_https check (content_url ~* ''^https?://[^\s]+\.(mp4|webm|mov|m4v|ogv)([?#].*)?$'')';
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'game_state_size') then
    execute 'alter table game_sessions add constraint game_state_size check (octet_length(state::text) < 65536)';
  end if;
end$$;

-- 5) Storage bucket caps (size + allowed types).
update storage.buckets
   set file_size_limit = 25 * 1024 * 1024,
       allowed_mime_types = array[
         'image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif',
         'audio/mpeg','audio/mp4','audio/aac','audio/webm','audio/ogg','audio/wav'
       ]
 where id in ('memories', 'chat-media', 'avatars');

-- 6) Belt-and-braces: harden enforce_couple_cap as security definer too.
create or replace function public.enforce_couple_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if new.couple_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.couple_id is not distinct from old.couple_id then return new; end if;
  select count(*) into v_count from profiles where couple_id = new.couple_id and id <> new.id;
  if v_count >= 2 then raise exception 'couple % is already full', new.couple_id; end if;
  return new;
end;
$$;

-- 7) Atomic get-or-create for game_sessions to avoid duplicate-row race.
create or replace function public.game_get_or_create_session(p_game_type text, p_initial_state jsonb)
returns game_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  s game_sessions;
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_today text := (p_initial_state->>'day');
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select couple_id into v_couple from profiles where id = v_uid;
  if v_couple is null then raise exception 'not in a couple'; end if;

  -- daily_question: per-day session. Others (wyr): singleton per couple.
  if p_game_type = 'daily_question' and v_today is not null then
    select * into s from game_sessions
     where couple_id = v_couple and game_type = p_game_type
       and (state->>'day') = v_today
     order by updated_at desc limit 1
     for update;
  else
    select * into s from game_sessions
     where couple_id = v_couple and game_type = p_game_type
     order by updated_at desc limit 1
     for update;
  end if;

  if s.id is not null then return s; end if;

  insert into game_sessions(couple_id, game_type, state)
  values (v_couple, p_game_type, coalesce(p_initial_state, '{}'::jsonb))
  returning * into s;
  return s;
end;
$$;
grant execute on function public.game_get_or_create_session(text, jsonb) to authenticated;

-- 8) Trim grants we don't need.
revoke execute on function public.current_couple_id() from anon;
