-- Activity status (separate from the 4-state status) + per-user partner nickname.
--
-- activity holds a short stable key (e.g. 'gaming', 'movie') matching the
-- catalog in src/lib/activities.js. activity_at is when it was set.
-- Client treats it as expired/null if older than 2h — no pg_cron needed.
--
-- partner_nickname is YOUR view of your partner (not their display_name).
-- Each side independently sets their own; same column on their row holds
-- their nickname for you.

alter table profiles
  add column if not exists activity text,
  add column if not exists activity_at timestamptz,
  add column if not exists partner_nickname text;

-- Optional sanity: keep activity short and within the known set of keys.
-- We don't hard-constrain to the catalog (so adding new ones doesn't require
-- a migration), but a length cap stops absurd values from sneaking in.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_activity_len'
  ) then
    execute 'alter table profiles add constraint profiles_activity_len
             check (activity is null or char_length(activity) between 1 and 40)';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_nickname_len'
  ) then
    execute 'alter table profiles add constraint profiles_nickname_len
             check (partner_nickname is null or char_length(partner_nickname) between 1 and 40)';
  end if;
end$$;
