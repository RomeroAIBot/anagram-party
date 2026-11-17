import { json, rateLimited, clientKey } from '@/lib/api';
import { getProfile, getPuzzleRow } from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';
import { currentPuzzleDate } from '@/lib/time';

// Returns 3 answers: at least one the player hasn't found, and the rest can be words
// they already found, to keep them guessing. No limit per puzzle; the browser waits
// out the display time plus 5 seconds between hints, and this rate limit backs that up.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const puzzleId = Number(body?.puzzleId);
  if (!puzzleId) return json({ status: 'invalid' }, 400);

  const user = await currentUser();
  if (rateLimited('hint:' + clientKey(req, user?.id), 12, 60_000)) return json({ status: 'slow_down' }, 429);

  const today = currentPuzzleDate();
  const profile = user ? await getProfile(user.id) : null;

  if (user && profile?.username) {
    const { data, error } = await supabaseAdmin().rpc('take_hint', { p_user: user.id, p_puzzle: puzzleId, p_today: today, p_max: 0 });
    if (error) return json({ status: 'error' }, 500);
    return json(data);
  }

  const puzzle = await getPuzzleRow(puzzleId);
  if (!puzzle) return json({ status: 'no_puzzle' }, 404);
  if (!(puzzle.kind === 'daily' && puzzle.puzzle_date === today)) return json({ status: 'closed' }, 403);
  const found = new Set<string>(Array.isArray(body?.found) ? body.found.slice(0, 500) : []);
  const shuffle = <T,>(a: T[]) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const left = shuffle(puzzle.answers.filter((w) => !found.has(w)));
  if (!left.length) return json({ status: 'all_found' });
  const first = left[0];
  const rest = shuffle(puzzle.answers.filter((w) => w !== first)).slice(0, 2);
  return json({ status: 'ok', words: shuffle([first, ...rest]), guest: true });
}
