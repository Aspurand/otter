-- Extend nudges.kind to support the daily "I'm okay" / goodnight ritual that
-- the new design introduces on the home screen.

alter table nudges drop constraint if exists nudges_kind_check;
alter table nudges add constraint nudges_kind_check
  check (kind in ('thinking_of_you', 'love_note', 'okay', 'goodnight'));
