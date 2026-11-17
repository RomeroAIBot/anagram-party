import { json, rateLimited, clientKey } from '@/lib/api';
import { getRoomRow } from '@/lib/room';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';

// Same hints as the daily puzzle: 3 answers, at least one not found yet.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return json({ status: 'signed_out' }, 401);
  const body = await req.json().catch(() => null);
  const puzzleId = Number(body?.puzzleId);
  if (!puzzleId) return json({ status: 'invalid' }, 400);
  if (rateLimited('hint:' + clientKey(req, user.id), 12, 60_000)) return json({ status: 'slow_down' }, 429);

  const { data: play } = await supabaseAdmin().from('room_plays').select('puzzle_id, found').eq('user_id', user.id).maybeSingle();
  if (!play || play.puzzle_id !== puzzleId) return json({ status: 'closed' }, 403);
  const puzzle = await getRoomRow(puzzleId);
  if (!puzzle) return json({ status: 'no_puzzle' }, 404);

  const found = new Set<string>(play.found ?? []);
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
