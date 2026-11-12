import { json } from '@/lib/api';
import { getProfile, getPuzzleByDate } from '@/lib/data';
import { COSTS } from '@/lib/scoring';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';
import { currentPuzzleDate } from '@/lib/time';

// Spend Party Tokens on an archive day or a random bonus round.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return json({ status: 'signin' }, 401);
  const profile = await getProfile(user.id);
  if (!profile?.username) return json({ status: 'username' }, 400);
  const body = await req.json().catch(() => null);
  const db = supabaseAdmin();

  let puzzleId: number | null = null;
  let cost: number;
  if (body?.type === 'archive') {
    const date = String(body?.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date >= currentPuzzleDate()) return json({ status: 'invalid' }, 400);
    const p = await getPuzzleByDate(date);
    if (!p) return json({ status: 'no_puzzle' }, 404);
    puzzleId = p.id;
    cost = COSTS.archive;
  } else if (body?.type === 'bonus') {
    const { data } = await db.rpc('random_bonus_for', { p_user: user.id });
    if (!data) return json({ status: 'none_left' }, 404);
    puzzleId = Number(data);
    cost = COSTS.bonus;
  } else {
    return json({ status: 'invalid' }, 400);
  }

  const { data, error } = await db.rpc('unlock_puzzle', { p_user: user.id, p_puzzle: puzzleId, p_cost: cost });
  if (error) return json({ status: 'error' }, 500);
  return json(data);
}
