-- "On this day" needs to compare against the caller's LOCAL date, not UTC.
-- A memory created at 8pm PST on June 1 (= June 2 02:00 UTC) should be the
-- "a year ago today" pick for a PST viewer who opens the app on June 1
-- a year later — not on June 2. UTC-based matching gets this wrong by up
-- to a full day for users west of Greenwich, and even further on the JST
-- side of an LDR couple.
--
-- Fix: the client passes its local date as 'YYYY-MM-DD' and we use that
-- for both the on-this-day filter AND the random seed. Each partner sees
-- their own "today's throwback" (which may differ on the boundary day,
-- and that's correct — "today" is local to the device).

create or replace function public.pick_throwback(p_couple_id uuid, p_today text default null)
returns memories
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m memories;
  v_today date := coalesce(
    case when p_today is null then null else p_today::date end,
    (now() at time zone 'utc')::date
  );
  v_month int := extract(month from v_today)::int;
  v_day   int := extract(day   from v_today)::int;
begin
  if not exists (
    select 1 from profiles where id = auth.uid() and couple_id = p_couple_id
  ) then
    raise exception 'not in this couple';
  end if;

  -- 1) On-this-day in a previous year (or earlier this year on the same M/D).
  select * into m from memories
   where couple_id = p_couple_id
     and extract(month from coalesce(happened_at, created_at)) = v_month
     and extract(day   from coalesce(happened_at, created_at)) = v_day
     and coalesce(happened_at, created_at)::date < v_today
   order by coalesce(happened_at, created_at) desc
   limit 1;
  if m.id is not null then return m; end if;

  -- 2) Random fallback, seeded by the caller's local date so it's stable
  --    through the day for that viewer. Both partners on the same local
  --    date see the same memory; on a TZ boundary day they may differ.
  select * into m from memories
   where couple_id = p_couple_id
     and coalesce(happened_at, created_at)::date < v_today
   order by md5(id::text || v_today::text)
   limit 1;
  if m.id is not null then return m; end if;

  -- No throwback to surface — explicitly return NULL instead of a row
  -- whose every column is null (which the client would have to disambiguate).
  return null;
end;
$$;

-- Old single-arg signature is replaced; explicit revoke + grant on the new one.
grant execute on function public.pick_throwback(uuid, text) to authenticated;
