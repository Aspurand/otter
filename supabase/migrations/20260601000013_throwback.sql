-- Throwback ("remember this?") feature for the Us tab.
-- Adds a per-user "last seen throwback id" so the bottom-tab badge clears when the
-- user actually opens the throwback, and an RPC that picks today's memory:
--   1) On-this-day match (same month + day from a previous year) if any exist
--   2) Otherwise a random pick, seeded by today's UTC date so both partners see
--      the same memory all day (and a new one tomorrow).

alter table profiles
  add column if not exists last_seen_throwback_id uuid;

create or replace function public.pick_throwback(p_couple_id uuid)
returns memories
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m memories;
  v_today date := (now() at time zone 'utc')::date;
  v_month int := extract(month from v_today);
  v_day   int := extract(day   from v_today);
begin
  -- Caller must be in the couple. RLS would normally enforce this on SELECT
  -- but we're security-definer; gate manually.
  if not exists (
    select 1 from profiles where id = auth.uid() and couple_id = p_couple_id
  ) then
    raise exception 'not in this couple';
  end if;

  -- 1) On-this-day from a previous year (or earlier this year, just not today).
  select * into m from memories
   where couple_id = p_couple_id
     and extract(month from coalesce(happened_at, created_at)) = v_month
     and extract(day   from coalesce(happened_at, created_at)) = v_day
     and coalesce(happened_at, created_at)::date < v_today
   order by coalesce(happened_at, created_at) desc
   limit 1;
  if m.id is not null then return m; end if;

  -- 2) Random fallback, seeded by today's date so it's stable through the day
  --    and shared across both partners.
  select * into m from memories
   where couple_id = p_couple_id
     and coalesce(happened_at, created_at)::date < v_today
   order by md5(id::text || v_today::text)
   limit 1;
  return m;
end;
$$;

grant execute on function public.pick_throwback(uuid) to authenticated;
