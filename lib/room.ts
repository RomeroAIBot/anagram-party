import 'server-only';
import { supabaseAdmin } from './supabase/admin';
import { lengthHistogram, scramble } from './scoring';
import type { PublicPuzzle, Tier } from './data';

export type RoomPuzzleRow = {
  id: number;
  word: string;
  definition: string;
  part_of_speech: string | null;
  tier: Tier;
  total: number;
  answers: string[];
  full_anagrams: string[];
};

export type RoomState = {
  puzzle: PublicPuzzle;
  found: string[];
  clearedTotal: number;
  previous: { word: string; definition: string } | null;
};

const COLS = 'id, word, definition, part_of_speech, tier, total, answers, full_anagrams';

// Fills the room's word pool from engine/out/room.json the first time it's needed.
// Safe to run twice: words are unique and duplicates are skipped.
let seeding: Promise<void> | null = null;
async function ensureSeeded() {
  const db = supabaseAdmin();
  const { count } = await db.from('room_puzzles').select('id', { count: 'exact', head: true });
  if (count) return;
  seeding ??= (async () => {
    const pool = (await import('@/engine/out/room.json')).default as any[];
    for (let i = 0; i < pool.length; i += 500) {
      const { error } = await db.from('room_puzzles').upsert(pool.slice(i, i + 500), { onConflict: 'word', ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
  })().finally(() => {
    seeding = null;
  });
  await seeding;
}

export async function getRoomRow(id: number): Promise<RoomPuzzleRow | null> {
  const { data } = await supabaseAdmin().from('room_puzzles').select(COLS).eq('id', id).maybeSingle();
  return (data as RoomPuzzleRow) ?? null;
}

function toPublic(p: RoomPuzzleRow): PublicPuzzle {
  return {
    id: p.id,
    kind: 'room',
    date: null,
    number: null,
    letters: scramble(p.word, p.id * 6151),
    definition: p.definition,
    partOfSpeech: p.part_of_speech,
    tier: p.tier,
    total: p.total,
    sourceLength: p.word.length,
    lengths: lengthHistogram(p.answers),
    fullCount: p.full_anagrams.length,
    minLength: 3,
    live: false,
  };
}

/** Starts a fresh random puzzle for this player, replacing any current one. */
export async function newRoomPuzzle(userId: string): Promise<boolean> {
  await ensureSeeded();
  const { data, error } = await supabaseAdmin().rpc('room_new', { p_user: userId });
  return !error && data?.status === 'ok';
}

/** The player's current room puzzle, starting one if they don't have one yet. */
export async function getRoomState(userId: string): Promise<RoomState | null> {
  const db = supabaseAdmin();
  let { data: play } = await db.from('room_plays').select('puzzle_id, found, cleared_total, previous_puzzle_id').eq('user_id', userId).maybeSingle();
  if (!play) {
    if (!(await newRoomPuzzle(userId))) return null;
    ({ data: play } = await db.from('room_plays').select('puzzle_id, found, cleared_total, previous_puzzle_id').eq('user_id', userId).maybeSingle());
    if (!play) return null;
  }
  const [row, prev] = await Promise.all([getRoomRow(play.puzzle_id), play.previous_puzzle_id ? getRoomRow(play.previous_puzzle_id) : null]);
  if (!row) return null;
  return {
    puzzle: toPublic(row),
    found: play.found ?? [],
    clearedTotal: play.cleared_total ?? 0,
    previous: prev ? { word: prev.word, definition: prev.definition } : null,
  };
}
