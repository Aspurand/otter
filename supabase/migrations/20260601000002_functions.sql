-- Twosome: helpers + onboarding RPCs + 2-person cap trigger.

-- Who am I, and which couple am I in? Used by RLS policies in 0003.
-- security definer so it bypasses profiles RLS (would otherwise recurse).
create or replace function public.current_couple_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select couple_id from profiles where id = auth.uid();
$$;

-- 6-char invite code, uppercase, no ambiguous chars (no 0/O/1/I).
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  attempts  int := 0;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from couples where invite_code = candidate);
    attempts := attempts + 1;
    if attempts > 12 then
      raise exception 'could not allocate invite code';
    end if;
  end loop;
  return candidate;
end;
$$;

-- When a new auth.users row appears, create the matching profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name',
             new.raw_user_meta_data->>'full_name',
             split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Create a couple and attach the caller as the first profile.
create or replace function public.create_couple()
returns table (couple_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_existing uuid;
  v_code     text;
  v_id       uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;

  select p.couple_id into v_existing from profiles p where p.id = v_uid;
  if v_existing is not null then raise exception 'already in a couple'; end if;

  v_code := generate_invite_code();
  insert into couples(invite_code) values (v_code) returning id into v_id;
  update profiles set couple_id = v_id where id = v_uid;
  return query select v_id, v_code;
end;
$$;

-- Join an existing couple by invite code. Enforces the 2-person cap.
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

  select id into v_couple from couples where invite_code = upper(trim(p_code));
  if v_couple is null then raise exception 'invalid invite code'; end if;

  select count(*) into v_count from profiles where couple_id = v_couple;
  if v_count >= 2 then raise exception 'this couple is already full'; end if;

  update profiles set couple_id = v_couple where id = v_uid;
  return v_couple;
end;
$$;

-- Defense in depth: cap the 3rd profile at the table level, even if the RPC is bypassed.
create or replace function public.enforce_couple_cap()
returns trigger
language plpgsql
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

drop trigger if exists couple_cap_check on profiles;
create trigger couple_cap_check
  before insert or update of couple_id on profiles
  for each row execute function public.enforce_couple_cap();

grant execute on function public.create_couple()         to authenticated;
grant execute on function public.join_couple(text)       to authenticated;
grant execute on function public.current_couple_id()     to authenticated, anon;
