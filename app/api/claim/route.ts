import { json } from '@/lib/api';
import { getProfile } from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';
import { currentPuzzleDate } from '@/lib/time';

// Moves words a guest found today into their account after they sign in.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return json({ status: 'signin' }, 401);
  const profile = await getProfile(user.id);
  if (!profile?.username) return json({ status: 'username' }, 400);
  const body = await req.json().catch(() => null);
  const puzzleId = Number(body?.puzzleId);
  const words: string[] = Array.isArray(body?.words) ? body.words.slice(0, 150) : [];
  let added = 0;
  for (const w of words) {
    if (typeof w !== 'string' || !/^[a-z]{3,15}$/.test(w)) continue;
    const { data } = await supabaseAdmin().rpc('submit_word', { p_user: user.id, p_puzzle: puzzleId, p_word: w, p_today: currentPuzzleDate() });
    if (data?.status === 'correct') added++;
  }
  return json({ status: 'ok', added });
}
