-- Twosome: row-level security.
-- Pattern: every row carries couple_id and must match current_couple_id() to be touched.

alter table couples        enable row level security;
alter table profiles       enable row level security;
alter table messages       enable row level security;
alter table events         enable row level security;
alter table memories       enable row level security;
alter table nudges         enable row level security;
alter table watch_sessions enable row level security;
alter table game_sessions  enable row level security;

-- couples: a user can read only their own couple row.
-- (Inserts/updates happen through the security-definer RPCs in 0002.)
create policy couples_select_own
  on couples for select
  using (id = public.current_couple_id());

-- profiles: read self + partner; write only self.
create policy profiles_select_in_couple
  on profiles for select
  using (
    id = auth.uid()
    or (couple_id is not null and couple_id = public.current_couple_id())
  );

create policy profiles_insert_self
  on profiles for insert
  with check (id = auth.uid());

create policy profiles_update_self
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 6 couple-scoped tables: identical CRUD policies gated by couple_id.
do $$
declare
  t text;
begin
  foreach t in array array['messages','events','memories','nudges','watch_sessions','game_sessions']
  loop
    execute format(
      'create policy %I on %I for select using (couple_id = public.current_couple_id())',
      t || '_select_in_couple', t
    );
    execute format(
      'create policy %I on %I for insert with check (couple_id = public.current_couple_id())',
      t || '_insert_in_couple', t
    );
    execute format(
      'create policy %I on %I for update using (couple_id = public.current_couple_id()) with check (couple_id = public.current_couple_id())',
      t || '_update_in_couple', t
    );
    execute format(
      'create policy %I on %I for delete using (couple_id = public.current_couple_id())',
      t || '_delete_in_couple', t
    );
  end loop;
end$$;
