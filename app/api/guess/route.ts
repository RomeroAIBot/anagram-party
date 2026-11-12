import { json, rateLimited, clientKey } from '@/lib/api';
import { getPuzzleRow, getProfile } from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';
import { fitsLetters, wordPoints } from '@/lib/scoring';
import { currentPuzzleDate } from '@/lib/time';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const puzzleId = Number(body?.puzzleId);
  const word = String(body?.word ?? '').toLowerCase().trim();
  if (!puzzleId || !/^[a-z]{1,15}$/.test(word)) return json({ status: 'invalid' }, 400);

  const user = await currentUser();
  if (rateLimited(clientKey(req, user?.id))) return json({ status: 'slow_down' }, 429);

  const puzzle = await getPuzzleRow(puzzleId);
  if (!puzzle) return json({ status: 'no_puzzle' }, 404);
  if (word.length < 4) return json({ status: 'short', word });
  if (!fitsLetters(word, puzzle.word)) return json({ status: 'letters', word });

  const today = currentPuzzleDate();
  const profile = user ? await getProfile(user.id) : null;

  // Signed in with a username: the database scores and saves the guess.
  if (user && profile?.username) {
    const { data, error } = await supabaseAdmin().rpc('submit_word', {
      p_user: user.id,
      p_puzzle: puzzleId,
      p_word: word,
      p_today: today,
    });
    if (error) return json({ status: 'error' }, 500);
    return json({ ...data, saved: true });
  }

  // Guest: check only. Progress lives in the browser until they sign in.
  const live = puzzle.kind === 'daily' && puzzle.puzzle_date === today;
  if (!live) return json({ status: 'closed' }, 403);
  if (!puzzle.answers.includes(word)) return json({ status: 'wrong', word });
  const full = word.length === puzzle.word.length;
  return json({ status: 'correct', word, full, points: wordPoints(word.length, puzzle.word.length), saved: false });
}
