-- Atomic JSONB key writer for game state. Without this, two clients submitting
-- answers near-simultaneously could read-modify-write past each other.
-- Used by both daily_question and wyr games.

create or replace function public.game_set_state_key(
  p_session uuid,
  p_key text[],
  p_value jsonb
)
returns game_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  s game_sessions;
  v_uid uuid := auth.uid();
  v_couple uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select couple_id into v_couple from profiles where id = v_uid;
  if v_couple is null then raise exception 'not in a couple'; end if;

  update game_sessions
     set state = jsonb_set(coalesce(state, '{}'::jsonb), p_key, p_value, true),
         updated_at = now()
   where id = p_session
     and couple_id = v_couple
  returning * into s;

  if s is null then raise exception 'game session not found'; end if;
  return s;
end;
$$;

grant execute on function public.game_set_state_key(uuid, text[], jsonb) to authenticated;
