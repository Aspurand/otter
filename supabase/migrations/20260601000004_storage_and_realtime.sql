-- Twosome: private storage buckets + realtime publication.
-- Convention: objects live at <couple_id>/<file>; first path segment gates access.

insert into storage.buckets (id, name, public) values
  ('chat-media','chat-media', false),
  ('memories',  'memories',   false),
  ('avatars',   'avatars',    false)
on conflict (id) do nothing;

create policy couple_media_read
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('chat-media','memories','avatars')
    and (storage.foldername(name))[1] = public.current_couple_id()::text
  );

create policy couple_media_write
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('chat-media','memories','avatars')
    and (storage.foldername(name))[1] = public.current_couple_id()::text
  );

create policy couple_media_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('chat-media','memories','avatars')
    and (storage.foldername(name))[1] = public.current_couple_id()::text
  );

create policy couple_media_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('chat-media','memories','avatars')
    and (storage.foldername(name))[1] = public.current_couple_id()::text
  );

-- Realtime: chat + sync tables on the default supabase_realtime publication.
do $$
declare
  t text;
begin
  foreach t in array array['messages','watch_sessions','game_sessions']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when others then
      -- Already in publication, or publication missing — safe to skip.
      null;
    end;
  end loop;
end$$;
