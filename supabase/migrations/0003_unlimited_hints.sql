-- Hints: no limit per puzzle, 3 words per hint, and the 3 can include words the
-- player already found (to keep them guessing). At least one is always unfound.
-- p_max <= 0 means no limit.
create or replace function public.take_hint(p_user uuid, p_puzzle bigint, p_today date, p_max int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pz public.puzzles;
  pl public.plays;
  is_today boolean;
  first_pick text;
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

  if p_max > 0 and pl.hints_used >= p_max then
    return jsonb_build_object('status', 'none_left', 'hints_used', pl.hints_used, 'max', p_max);
  end if;

  select a.w into first_pick from jsonb_array_elements_text(pz.answers) as a(w)
  where not (a.w = any (pl.found)) order by random() limit 1;
  if first_pick is null then
    return jsonb_build_object('status', 'all_found');
  end if;

  select array_agg(w order by random()) into picks from (
    select first_pick as w
    union all
    (select a.w from jsonb_array_elements_text(pz.answers) as a(w)
     where a.w <> first_pick order by random() limit 2)
  ) s;

  update public.plays set hints_used = hints_used + 1 where id = pl.id returning * into pl;
  return jsonb_build_object('status', 'ok', 'words', to_jsonb(picks), 'hints_used', pl.hints_used);
end $$;

revoke all on function public.take_hint(uuid, bigint, date, int) from public, anon, authenticated;
grant execute on function public.take_hint(uuid, bigint, date, int) to service_role;
