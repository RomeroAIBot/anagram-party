-- Puzzle Room: casual, unranked puzzles for signed-in players. 3-letter words count.
-- Its own word pool (engine/room.mjs) so the daily and bonus words are never spoiled.

create table if not exists public.room_puzzles (
  id bigserial primary key,
  word text not null unique,
  definition text not null,
  part_of_speech text,
  tier text not null check (tier in ('easy', 'medium', 'hard')),
  total int not null,
  answers jsonb not null,
  full_anagrams jsonb not null default '[]',
  dictionary_version text not null,
  created_at timestamptz not null default now()
);

-- One current room puzzle per player. Starting a new one wipes the found list.
create table if not exists public.room_plays (
  user_id uuid primary key references auth.users (id) on delete cascade,
  puzzle_id bigint not null references public.room_puzzles (id),
  found text[] not null default '{}',
  previous_puzzle_id bigint references public.room_puzzles (id),
  cleared_total int not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.room_puzzles enable row level security;
alter table public.room_plays enable row level security;

-- Pick a random room puzzle (not the current one) and start it fresh.
create or replace function public.room_new(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cur bigint;
  n bigint;
  pick bigint;
begin
  select puzzle_id into cur from public.room_plays where user_id = p_user;
  select count(*) into n from public.room_puzzles;
  if n = 0 then return jsonb_build_object('status', 'empty'); end if;
  select id into pick from public.room_puzzles
  where id is distinct from cur
  offset floor(random() * greatest(n - 1, 1)) limit 1;
  if pick is null then select id into pick from public.room_puzzles limit 1; end if;

  insert into public.room_plays (user_id, puzzle_id, found, previous_puzzle_id, started_at, updated_at)
  values (p_user, pick, '{}', null, now(), now())
  on conflict (user_id) do update
    set previous_puzzle_id = public.room_plays.puzzle_id,
        puzzle_id = excluded.puzzle_id,
        found = '{}',
        started_at = now(),
        updated_at = now();
  return jsonb_build_object('status', 'ok', 'puzzle_id', pick);
end $$;

-- Check and save a guess on the player's current room puzzle.
create or replace function public.room_submit(p_user uuid, p_puzzle bigint, p_word text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pl public.room_plays;
  pz public.room_puzzles;
  w text := lower(p_word);
  is_full boolean;
  cleared boolean;
begin
  select * into pl from public.room_plays where user_id = p_user for update;
  if not found or pl.puzzle_id <> p_puzzle then
    return jsonb_build_object('status', 'stale');
  end if;
  select * into pz from public.room_puzzles where id = p_puzzle;
  if w = any (pl.found) then
    return jsonb_build_object('status', 'repeat', 'word', w);
  end if;
  if not (pz.answers ? w) then
    return jsonb_build_object('status', 'wrong', 'word', w);
  end if;

  is_full := length(w) = length(pz.word);
  cleared := cardinality(pl.found) + 1 >= pz.total;
  update public.room_plays rp
     set found = array_append(rp.found, w),
         cleared_total = rp.cleared_total + (case when cleared then 1 else 0 end),
         updated_at = now()
   where rp.user_id = p_user;
  return jsonb_build_object('status', 'correct', 'word', w, 'full', is_full,
    'points', public.word_points(length(w), length(pz.word)), 'cleared', cleared);
end $$;

revoke all on function public.room_new(uuid) from public, anon, authenticated;
revoke all on function public.room_submit(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.room_new(uuid) to service_role;
grant execute on function public.room_submit(uuid, bigint, text) to service_role;
