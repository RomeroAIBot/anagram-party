import { json, rateLimited, clientKey } from '@/lib/api';
import { fitsLetters } from '@/lib/scoring';
import { getRoomRow } from '@/lib/room';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';

// Puzzle Room guesses. Signed-in only; saved per player, nothing ranked.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return json({ status: 'signed_out' }, 401);
  const body = await req.json().catch(() => null);
  const puzzleId = Number(body?.puzzleId);
  const word = String(body?.word ?? '').toLowerCase().trim();
  if (!puzzleId || !/^[a-z]{1,15}$/.test(word)) return json({ status: 'invalid' }, 400);
  if (rateLimited(clientKey(req, user.id))) return json({ status: 'slow_down' }, 429);

  const puzzle = await getRoomRow(puzzleId);
  if (!puzzle) return json({ status: 'no_puzzle' }, 404);
  if (word.length < 3) return json({ status: 'short', word, min: 3 });
  if (!fitsLetters(word, puzzle.word)) return json({ status: 'letters', word });

  const { data, error } = await supabaseAdmin().rpc('room_submit', { p_user: user.id, p_puzzle: puzzleId, p_word: word });
  if (error) return json({ status: 'error' }, 500);
  return json({ ...data, saved: true });
}
