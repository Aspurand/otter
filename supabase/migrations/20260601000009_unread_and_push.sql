-- 1) Persistent unread state for nudges so missed notifications survive lock/close.
alter table nudges add column if not exists read_at timestamptz;
create index if not exists nudges_unread_idx
  on nudges(couple_id, sender_id)
  where read_at is null and delivered = true;

-- 2) Web Push subscriptions per user device (one user can have many devices).
create extension if not exists pg_net with schema extensions;

create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;

create policy push_subs_select_own
  on push_subscriptions for select
  using (user_id = auth.uid());

create policy push_subs_insert_own
  on push_subscriptions for insert
  with check (user_id = auth.uid());

create policy push_subs_delete_own
  on push_subscriptions for delete
  using (user_id = auth.uid());

create policy push_subs_update_own
  on push_subscriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3) Trigger function: when a nudge becomes deliverable, call the send-push
--    Edge Function asynchronously via pg_net.
--
--    The function URL + a shared secret are loaded from GUCs that the user must
--    set with `alter database postgres set app.push_endpoint = '...';`
--    Idempotent: fails silently if those settings are unset (push just won't fire).

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
  v_url       text;
  v_secret    text;
begin
  -- Only fire when the nudge is actually deliverable.
  if new.delivered is not true then
    return new;
  end if;

  -- Find the other partner in this couple.
  select id into v_recipient
    from profiles
   where couple_id = new.couple_id
     and id <> new.sender_id
   limit 1;
  if v_recipient is null then
    return new;
  end if;

  -- Read endpoint + shared secret from server settings. If unset, skip silently.
  v_url    := current_setting('app.push_endpoint', true);
  v_secret := current_setting('app.push_secret',   true);
  if v_url is null or v_url = '' then
    return new;
  end if;

  v_title := case v_kind
               when 'love_note'       then 'a love note arrived'
               when 'goodnight'       then 'goodnight'
               when 'okay'            then 'they checked in'
               else                        'thinking of you'
             end;
  if v_body is null or v_body = '' then
    v_body := case v_kind
                when 'love_note'       then 'tap to read'
                when 'goodnight'       then '🌙'
                when 'okay'            then '🤍'
                else                        '♥'
              end;
  end if;

  -- Fire-and-forget HTTP POST.
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                  'Content-Type', 'application/json',
                  'x-push-secret', coalesce(v_secret, '')
               ),
    body    := jsonb_build_object(
                  'user_id', v_recipient,
                  'title',   v_title,
                  'body',    v_body,
                  'kind',    v_kind,
                  'url',     '/otter/'
               )
  );
  return new;
end;
$$;

drop trigger if exists trg_nudge_push_insert on nudges;
create trigger trg_nudge_push_insert
  after insert on nudges
  for each row
  execute function notify_partner_on_nudge();

drop trigger if exists trg_nudge_push_update on nudges;
create trigger trg_nudge_push_update
  after update of delivered on nudges
  for each row
  when (new.delivered = true and old.delivered = false)
  execute function notify_partner_on_nudge();
