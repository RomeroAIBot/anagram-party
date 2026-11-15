-- Random 3-letter days and the hint button.

alter table public.puzzles add column if not exists min_length int not null default 4 check (min_length in (3, 4));

-- 3-letter words score 2 points.
create or replace function public.word_points(len int, source_len int)
returns int language sql immutable set search_path = public as $$
  select case
    when len <= 3 then 2
    when len = 4 then 5
    when len = 5 then 10
    when len = 6 then 20
    when len = 7 then 35
    else 50 + (len - 8) * 20
  end + case when len = source_len then 50 else 0 end;
$$;

-- Hint: shows up to 2 words the player hasn't found yet. 3 hints per puzzle.
-- Using a hint on the live daily puzzle marks the run on the leaderboard.
create or replace function public.take_hint(p_user uuid, p_puzzle bigint, p_today date, p_max int default 3)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pz public.puzzles;
  pl public.plays;
  is_today boolean;
  picks text[];
begin
  select * into pz from public.puzzles where id = p_puzzle;
  if not found then return jsonb_build_object('status', 'no_puzzle'); end if;
  is_today := pz.kind = 'daily' and pz.puzzle_date = p_today;
  if not (is_today or exists (select 1 from public.unlocks u where u.user_id = p_user and u.puzzle_id = p_puzzle)) then
    return jsonb_build_object('status', 'closed');
  end if;

  insert into public.plays (user_id, puzzle_id, ranked) values (p_user, p_puzzle, is_today)
  on conflict (user_id, puzzle_id) do nothing;
  select * into pl from public.plays where user_id = p_user and puzzle_id = p_puzzle for update;

  if pl.hints_used >= p_max then
    return jsonb_build_object('status', 'none_left', 'hints_used', pl.hints_used, 'max', p_max);
  end if;

  select array_agg(w) into picks from (
    select a.w from jsonb_array_elements_text(pz.answers) as a(w)
    where not (a.w = any (pl.found))
    order by random() limit 2
  ) s;
  if picks is null then
    return jsonb_build_object('status', 'all_found');
  end if;

  update public.plays set hints_used = hints_used + 1 where id = pl.id returning * into pl;
  return jsonb_build_object('status', 'ok', 'words', to_jsonb(picks), 'hints_used', pl.hints_used, 'max', p_max);
end $$;

revoke all on function public.take_hint(uuid, bigint, date, int) from public, anon, authenticated;
grant execute on function public.take_hint(uuid, bigint, date, int) to service_role;
