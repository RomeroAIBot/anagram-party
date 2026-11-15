import { json, rateLimited, clientKey } from '@/lib/api';
import { getProfile, getPuzzleRow } from '@/lib/data';
import { MAX_HINTS } from '@/lib/scoring';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';
import { currentPuzzleDate } from '@/lib/time';

// Returns up to 2 words the player hasn't found. Signed-in players are limited and
// tracked in the database; guests are limited in their browser (they aren't ranked).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const puzzleId = Number(body?.puzzleId);
  if (!puzzleId) return json({ status: 'invalid' }, 400);

  const user = await currentUser();
  if (rateLimited('hint:' + clientKey(req, user?.id), 6, 60_000)) return json({ status: 'slow_down' }, 429);

  const today = currentPuzzleDate();
  const profile = user ? await getProfile(user.id) : null;

  if (user && profile?.username) {
    const { data, error } = await supabaseAdmin().rpc('take_hint', { p_user: user.id, p_puzzle: puzzleId, p_today: today, p_max: MAX_HINTS });
    if (error) return json({ status: 'error' }, 500);
    return json(data);
  }

  const puzzle = await getPuzzleRow(puzzleId);
  if (!puzzle) return json({ status: 'no_puzzle' }, 404);
  if (!(puzzle.kind === 'daily' && puzzle.puzzle_date === today)) return json({ status: 'closed' }, 403);
  const found = new Set<string>(Array.isArray(body?.found) ? body.found.slice(0, 200) : []);
  const left = puzzle.answers.filter((w) => !found.has(w));
  if (!left.length) return json({ status: 'all_found' });
  for (let i = left.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [left[i], left[j]] = [left[j], left[i]];
  }
  return json({ status: 'ok', words: left.slice(0, 2), max: MAX_HINTS, guest: true });
}
