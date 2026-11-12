-- Anagram Party schema.
-- Every table has RLS on with no policies: the browser never reads tables directly.
-- All reads and writes go through the Next.js server using the service role key,
-- and guesses are scored by the submit_word function so answers never reach the browser.

create table public.puzzles (
  id bigserial primary key,
  kind text not null default 'daily' check (kind in ('daily', 'bonus')),
  puzzle_date date unique,
  number int unique,
  word text not null,
  definition text not null,
  part_of_speech text,
  tier text not null check (tier in ('easy', 'medium', 'hard')),
  total int not null,
  answers jsonb not null,
  full_anagrams jsonb not null default '[]',
  dictionary_version text not null,
  created_at timestamptz not null default now(),
  check ((kind = 'daily' and puzzle_date is not null and number is not null)
      or (kind = 'bonus' and puzzle_date is null and number is null))
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  tokens int not null default 0 check (tokens >= 0),
  current_streak int not null default 0,
  best_streak int not null default 0,
  last_played date,
  sound_pack text not null default 'balloon',
  created_at timestamptz not null default now()
);

create table public.plays (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  puzzle_id bigint not null references public.puzzles (id) on delete cascade,
  ranked boolean not null default true,
  found text[] not null default '{}',
  words_found int not null default 0,
  points int not null default 0,
  cleared boolean not null default false,
  hints_used int not null default 0,
  started_at timestamptz not null default now(),
  last_found_at timestamptz,
  cleared_at timestamptz,
  played_award boolean not null default false,
  half_award boolean not null default false,
  unique (user_id, puzzle_id)
);
create index plays_board_idx on public.plays (puzzle_id, ranked, words_found desc, last_found_at);

create table public.unlocks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  puzzle_id bigint not null references public.puzzles (id) on delete cascade,
  cost int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, puzzle_id)
);
create index unlocks_puzzle_idx on public.unlocks (puzzle_id);

create table public.token_transactions (
  id bigserial primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null,
  reason text not null,
  puzzle_id bigint references public.puzzles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index token_tx_user_idx on public.token_transactions (user_id, created_at desc);
create index token_tx_puzzle_idx on public.token_transactions (puzzle_id);

create table public.word_flags (
  id bigserial primary key,
  user_id uuid references public.profiles (id) on delete set null,
  puzzle_id bigint references public.puzzles (id) on delete set null,
  word text not null,
  note text,
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);
create index word_flags_user_idx on public.word_flags (user_id);
create index word_flags_puzzle_idx on public.word_flags (puzzle_id);

create table public.suggestions (
  id bigserial primary key,
  user_id uuid references public.profiles (id) on delete set null,
  category text not null default 'idea',
  message text not null check (char_length(message) between 3 and 2000),
  created_at timestamptz not null default now()
);
create index suggestions_user_idx on public.suggestions (user_id);

alter table public.puzzles enable row level security;
alter table public.profiles enable row level security;
alter table public.plays enable row level security;
alter table public.unlocks enable row level security;
alter table public.token_transactions enable row level security;
alter table public.word_flags enable row level security;
alter table public.suggestions enable row level security;

-- New sign-ups get a profile row (username chosen on first visit).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Points for one word.
create or replace function public.word_points(len int, source_len int)
returns int language sql immutable set search_path = public as $$
  select case
    when len <= 4 then 5
    when len = 5 then 10
    when len = 6 then 20
    when len = 7 then 35
    else 50 + (len - 8) * 20
  end + case when len = source_len then 50 else 0 end;
$$;

create or replace function public.grant_tokens(p_user uuid, p_amount int, p_reason text, p_puzzle bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set tokens = tokens + p_amount where id = p_user;
  insert into public.token_transactions (user_id, amount, reason, puzzle_id)
  values (p_user, p_amount, p_reason, p_puzzle);
end $$;

-- Scores one guess atomically. p_today is the current puzzle date (America/New_York, resets 1:00 AM).
create or replace function public.submit_word(p_user uuid, p_puzzle bigint, p_word text, p_today date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pz public.puzzles;
  pl public.plays;
  w text := lower(trim(p_word));
  is_today boolean;
  allowed boolean;
  pts int := 0;
  is_full boolean := false;
  earned int := 0;
  streak_bonus int := 0;
  just_cleared boolean := false;
  prof public.profiles;
begin
  select * into pz from public.puzzles where id = p_puzzle;
  if not found then return jsonb_build_object('status', 'no_puzzle'); end if;

  is_today := pz.kind = 'daily' and pz.puzzle_date = p_today;
  allowed := is_today or exists (select 1 from public.unlocks u where u.user_id = p_user and u.puzzle_id = p_puzzle);
  if not allowed then return jsonb_build_object('status', 'closed'); end if;

  insert into public.plays (user_id, puzzle_id, ranked)
  values (p_user, p_puzzle, is_today)
  on conflict (user_id, puzzle_id) do nothing;

  select * into pl from public.plays where user_id = p_user and puzzle_id = p_puzzle for update;

  if w = any (pl.found) then
    return jsonb_build_object('status', 'repeat', 'word', w);
  end if;
  if not (pz.answers ? w) then
    return jsonb_build_object('status', 'wrong', 'word', w);
  end if;

  is_full := char_length(w) = char_length(pz.word);
  pts := public.word_points(char_length(w), char_length(pz.word));

  update public.plays p set
    found = array_append(p.found, w),
    words_found = p.words_found + 1,
    points = p.points + pts,
    last_found_at = now()
  where p.id = pl.id
  returning p.* into pl;

  if pl.words_found >= pz.total and not pl.cleared then
    update public.plays p set cleared = true, cleared_at = now(), points = p.points + 200
    where p.id = pl.id returning p.* into pl;
    just_cleared := true;
  end if;

  -- Token rewards only for the live daily puzzle.
  if is_today then
    if is_full then
      perform public.grant_tokens(p_user, 10, 'full_anagram', p_puzzle); earned := earned + 10;
    end if;
    if pl.words_found >= 5 and not pl.played_award then
      update public.plays set played_award = true where id = pl.id;
      perform public.grant_tokens(p_user, 25, 'daily_play', p_puzzle); earned := earned + 25;

      select * into prof from public.profiles where id = p_user for update;
      if prof.last_played = p_today - 1 then
        update public.profiles set current_streak = current_streak + 1,
          best_streak = greatest(best_streak, current_streak + 1), last_played = p_today
        where id = p_user returning * into prof;
      elsif prof.last_played is distinct from p_today then
        update public.profiles set current_streak = 1, best_streak = greatest(best_streak, 1), last_played = p_today
        where id = p_user returning * into prof;
      end if;
      if prof.current_streak = 30 then
        perform public.grant_tokens(p_user, 500, 'streak_30', p_puzzle); streak_bonus := 500;
      elsif prof.current_streak > 0 and prof.current_streak % 7 = 0 then
        perform public.grant_tokens(p_user, 100, 'streak_7', p_puzzle); streak_bonus := 100;
      end if;
      earned := earned + streak_bonus;
    end if;
    if pl.words_found * 2 >= pz.total and not pl.half_award then
      update public.plays set half_award = true where id = pl.id;
      perform public.grant_tokens(p_user, 15, 'half_found', p_puzzle); earned := earned + 15;
    end if;
    if just_cleared then
      perform public.grant_tokens(p_user, 50, 'cleared', p_puzzle); earned := earned + 50;
    end if;
  end if;

  return jsonb_build_object(
    'status', 'correct', 'word', w, 'points', pts, 'full', is_full,
    'words_found', pl.words_found, 'total', pz.total, 'score', pl.points,
    'cleared', pl.cleared, 'tokens_earned', earned, 'streak_bonus', streak_bonus
  );
end $$;

-- Spend tokens to unlock an archive day or a random bonus puzzle.
create or replace function public.unlock_puzzle(p_user uuid, p_puzzle bigint, p_cost int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare bal int;
begin
  if exists (select 1 from public.unlocks where user_id = p_user and puzzle_id = p_puzzle) then
    return jsonb_build_object('status', 'already', 'puzzle_id', p_puzzle);
  end if;
  select tokens into bal from public.profiles where id = p_user for update;
  if bal is null or bal < p_cost then
    return jsonb_build_object('status', 'insufficient', 'tokens', coalesce(bal, 0));
  end if;
  update public.profiles set tokens = tokens - p_cost where id = p_user;
  insert into public.unlocks (user_id, puzzle_id, cost) values (p_user, p_puzzle, p_cost);
  insert into public.token_transactions (user_id, amount, reason, puzzle_id) values (p_user, -p_cost, 'unlock', p_puzzle);
  return jsonb_build_object('status', 'ok', 'puzzle_id', p_puzzle, 'tokens', bal - p_cost);
end $$;

create or replace function public.random_bonus_for(p_user uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select p.id from public.puzzles p
  where p.kind = 'bonus'
    and not exists (select 1 from public.unlocks u where u.user_id = p_user and u.puzzle_id = p.id)
  order by random() limit 1;
$$;

-- Only the server (service role) may call these.
revoke all on function public.submit_word(uuid, bigint, text, date) from public, anon, authenticated;
revoke all on function public.unlock_puzzle(uuid, bigint, int) from public, anon, authenticated;
revoke all on function public.grant_tokens(uuid, int, text, bigint) from public, anon, authenticated;
revoke all on function public.random_bonus_for(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.submit_word(uuid, bigint, text, date) to service_role;
grant execute on function public.unlock_puzzle(uuid, bigint, int) to service_role;
grant execute on function public.random_bonus_for(uuid) to service_role;
