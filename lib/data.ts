import 'server-only';
import { supabaseAdmin } from './supabase/admin';
import { lengthHistogram, scramble } from './scoring';
import { currentPuzzleDate } from './time';

export type Tier = 'easy' | 'medium' | 'hard';

type PuzzleRow = {
  id: number;
  kind: 'daily' | 'bonus';
  puzzle_date: string | null;
  number: number | null;
  word: string;
  definition: string;
  part_of_speech: string | null;
  tier: Tier;
  total: number;
  answers: string[];
  full_anagrams: string[];
  min_length: number;
};

/** What the browser is allowed to see. Never includes the source word or answers. */
export type PublicPuzzle = {
  id: number;
  kind: 'daily' | 'bonus';
  date: string | null;
  number: number | null;
  letters: string[];
  definition: string;
  partOfSpeech: string | null;
  tier: Tier;
  total: number;
  sourceLength: number;
  lengths: Record<number, number>;
  fullCount: number;
  minLength: number;
  live: boolean;
};

export type PlayState = {
  found: string[];
  points: number;
  cleared: boolean;
  hints_used: number;
};

export type Profile = {
  id: string;
  username: string | null;
  tokens: number;
  current_streak: number;
  best_streak: number;
  last_played: string | null;
};

function toPublic(p: PuzzleRow, today: string): PublicPuzzle {
  return {
    id: p.id,
    kind: p.kind,
    date: p.puzzle_date,
    number: p.number,
    letters: scramble(p.word, p.id * 7919),
    definition: p.definition,
    partOfSpeech: p.part_of_speech,
    tier: p.tier,
    total: p.total,
    sourceLength: p.word.length,
    lengths: lengthHistogram(p.answers),
    fullCount: p.full_anagrams.length,
    minLength: p.min_length ?? 4,
    live: p.kind === 'daily' && p.puzzle_date === today,
  };
}

// Local demo mode (AP_DEMO=1): reads generated puzzles from disk, no database. Never set in production.
async function demoRows(): Promise<PuzzleRow[]> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const list = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'engine/out/puzzles.json'), 'utf8'));
  return list.map((p: any, i: number) => ({ min_length: 4, ...p, id: i + 1, kind: 'daily' }));
}
const DEMO = process.env.AP_DEMO === '1';

export async function getPuzzleRow(id: number): Promise<PuzzleRow | null> {
  if (DEMO) return (await demoRows()).find((p) => p.id === id) ?? null;
  const { data } = await supabaseAdmin().from('puzzles').select('*').eq('id', id).maybeSingle();
  return (data as PuzzleRow) ?? null;
}

export async function getTodayPuzzle(): Promise<PublicPuzzle | null> {
  const today = currentPuzzleDate();
  if (DEMO) {
    const row = (await demoRows()).find((p) => p.puzzle_date === today);
    return row ? toPublic(row, today) : null;
  }
  const { data } = await supabaseAdmin().from('puzzles').select('*').eq('kind', 'daily').eq('puzzle_date', today).maybeSingle();
  return data ? toPublic(data as PuzzleRow, today) : null;
}

export async function getPublicPuzzle(id: number): Promise<PublicPuzzle | null> {
  const row = await getPuzzleRow(id);
  return row ? toPublic(row, currentPuzzleDate()) : null;
}

export async function getPuzzleByDate(date: string): Promise<PuzzleRow | null> {
  const { data } = await supabaseAdmin().from('puzzles').select('*').eq('kind', 'daily').eq('puzzle_date', date).maybeSingle();
  return (data as PuzzleRow) ?? null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabaseAdmin()
    .from('profiles')
    .select('id, username, tokens, current_streak, best_streak, last_played')
    .eq('id', userId)
    .maybeSingle();
  return (data as Profile) ?? null;
}

export async function getPlay(userId: string, puzzleId: number): Promise<PlayState | null> {
  const { data } = await supabaseAdmin()
    .from('plays')
    .select('found, points, cleared, hints_used')
    .eq('user_id', userId)
    .eq('puzzle_id', puzzleId)
    .maybeSingle();
  return (data as PlayState) ?? null;
}

export async function hasUnlock(userId: string, puzzleId: number): Promise<boolean> {
  const { data } = await supabaseAdmin().from('unlocks').select('puzzle_id').eq('user_id', userId).eq('puzzle_id', puzzleId).maybeSingle();
  return !!data;
}

export type BoardRow = {
  rank: number;
  username: string;
  words: number;
  points: number;
  cleared: boolean;
  hints: number;
  reachedAt: string | null;
  clearedAt: string | null;
};

export async function getLeaderboard(puzzleId: number, limit = 100): Promise<BoardRow[]> {
  const { data } = await supabaseAdmin()
    .from('plays')
    .select('words_found, points, cleared, hints_used, last_found_at, cleared_at, profiles!inner(username)')
    .eq('puzzle_id', puzzleId)
    .eq('ranked', true)
    .gt('words_found', 0)
    .not('profiles.username', 'is', null)
    .order('words_found', { ascending: false })
    .order('last_found_at', { ascending: true })
    .limit(limit);
  return (data ?? []).map((r: any, i: number) => ({
    rank: i + 1,
    username: r.profiles.username,
    words: r.words_found,
    points: r.points,
    cleared: r.cleared,
    hints: r.hints_used,
    reachedAt: r.last_found_at,
    clearedAt: r.cleared_at,
  }));
}

export type RecapWord = { word: string; finders: number; pct: number; full: boolean };

/** Full answer list with how many ranked players found each word. Past puzzles only. */
export async function getRecap(puzzle: PuzzleRow) {
  const { data } = await supabaseAdmin().from('plays').select('found').eq('puzzle_id', puzzle.id).eq('ranked', true).gt('words_found', 0);
  const players = data?.length ?? 0;
  const tally = new Map<string, number>();
  for (const r of data ?? []) for (const w of r.found as string[]) tally.set(w, (tally.get(w) || 0) + 1);
  const words: RecapWord[] = puzzle.answers.map((w) => {
    const n = tally.get(w) || 0;
    return { word: w, finders: n, pct: players ? Math.round((n / players) * 100) : 0, full: w.length === puzzle.word.length };
  });
  const foundByAnyone = words.filter((w) => w.finders > 0);
  const rarest = foundByAnyone.length ? foundByAnyone.reduce((a, b) => (b.finders < a.finders || (b.finders === a.finders && b.word.length > a.word.length) ? b : a)) : null;
  return { players, words, rarest };
}
