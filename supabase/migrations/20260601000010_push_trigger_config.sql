-- Hardcode the push endpoint + shared secret into the trigger function.
-- (We couldn't ALTER DATABASE SET via the API because that needs superuser.)
-- Rotate by re-running this migration with new values + redeploying the
-- send-push function with a new PUSH_SHARED_SECRET.

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
  v_secret    constant text := 'GCT93oYZ1jDMzBbx4XihqgUKnlmNSv58EH0pyFwcAdkeVu7P';
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
                when 'goodnight' then '🌙'
                when 'okay'      then '🤍'
                else                  '♥'
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
                  'kind',    v_kind,
                  'url',     '/otter/'
               )
  );
  return new;
end;
$$;
