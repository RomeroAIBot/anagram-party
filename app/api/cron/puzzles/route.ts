import { timingSafeEqual } from 'node:crypto';
import { json } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { addDays, currentPuzzleDate } from '@/lib/time';
import daily from '@/engine/out/puzzles.json';
import bonus from '@/engine/out/bonus.json';

// Loads generated puzzles into the database. Runs daily from Vercel Cron, so any
// new batch committed to engine/out is picked up automatically. Existing rows are
// never changed: puzzles already scheduled or played stay exactly as they were.

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : new URL(req.url).searchParams.get('key') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);
  const db = supabaseAdmin();

  const rows = (daily as any[]).map((p) => ({
    kind: 'daily',
    puzzle_date: p.puzzle_date,
    number: p.number,
    word: p.word,
    definition: p.definition,
    part_of_speech: p.part_of_speech,
    tier: p.tier,
    min_length: p.min_length ?? 4,
    total: p.total,
    answers: p.answers,
    full_anagrams: p.full_anagrams,
    dictionary_version: p.dictionary_version,
  }));
  let dailyInserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const { data, error } = await db.from('puzzles').upsert(rows.slice(i, i + 100), { onConflict: 'puzzle_date', ignoreDuplicates: true }).select('id');
    if (error) return json({ error: error.message, step: 'daily', at: i }, 500);
    dailyInserted += data?.length ?? 0;
  }

  let bonusInserted = 0;
  const { count } = await db.from('puzzles').select('id', { count: 'exact', head: true }).eq('kind', 'bonus');
  if (!count) {
    const brows = (bonus as any[]).map((p) => ({ ...p, kind: 'bonus' }));
    for (let i = 0; i < brows.length; i += 100) {
      const { data, error } = await db.from('puzzles').insert(brows.slice(i, i + 100)).select('id');
      if (error) return json({ error: error.message, step: 'bonus', at: i }, 500);
      bonusInserted += data?.length ?? 0;
    }
  }

  // Warn when the schedule is running low so a new batch gets generated in time.
  const { data: last } = await db.from('puzzles').select('puzzle_date').eq('kind', 'daily').order('puzzle_date', { ascending: false }).limit(1).maybeSingle();
  const lastDate = last?.puzzle_date ?? null;
  const runningLow = !lastDate || lastDate < addDays(currentPuzzleDate(), 45);

  return json({ ok: true, dailyInserted, bonusInserted, lastScheduledDate: lastDate, runningLow });
}
