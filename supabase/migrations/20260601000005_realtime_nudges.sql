-- Nudges need realtime so the NudgeButton component can toast on partner pings.
-- Wrapped in a guarded execute so re-applying is safe.

do $$
begin
  begin
    alter publication supabase_realtime add table nudges;
  exception when others then
    null; -- already in publication, or publication missing
  end;
end$$;
