-- Scheduled love-note delivery: a pg_cron job flips nudges.delivered from false to
-- true once deliver_at has passed. The realtime UPDATE event then fires and the
-- receiver's NudgeButton surfaces the note. Idempotent: unschedule then re-schedule.

create extension if not exists pg_cron with schema extensions;

do $$
begin
  perform cron.unschedule('deliver-nudges');
exception when others then
  null; -- not scheduled yet, that's fine
end$$;

select cron.schedule(
  'deliver-nudges',
  '* * * * *', -- every minute
  $$update public.nudges
       set delivered = true
     where delivered = false
       and deliver_at <= now()$$
);
