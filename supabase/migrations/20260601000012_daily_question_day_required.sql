-- Validate that daily_question callers always supply a 'day' in initial_state;
-- otherwise game_get_or_create_session silently returned the wrong session.

create or replace function public.game_get_or_create_session(p_game_type text, p_initial_state jsonb)
returns game_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  s game_sessions;
  v_uid uuid := auth.uid();
  v_couple uuid;
  v_today text := (p_initial_state->>'day');
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select couple_id into v_couple from profiles where id = v_uid;
  if v_couple is null then raise exception 'not in a couple'; end if;

  -- daily_question must be called with 'day'; the per-day scoping depends on it.
  if p_game_type = 'daily_question' and v_today is null then
    raise exception 'daily_question requires day in initial_state';
  end if;

  if p_game_type = 'daily_question' then
    select * into s from game_sessions
     where couple_id = v_couple and game_type = p_game_type
       and (state->>'day') = v_today
     order by updated_at desc limit 1
     for update;
  else
    select * into s from game_sessions
     where couple_id = v_couple and game_type = p_game_type
     order by updated_at desc limit 1
     for update;
  end if;

  if s.id is not null then return s; end if;

  insert into game_sessions(couple_id, game_type, state)
  values (v_couple, p_game_type, coalesce(p_initial_state, '{}'::jsonb))
  returning * into s;
  return s;
end;
$$;
