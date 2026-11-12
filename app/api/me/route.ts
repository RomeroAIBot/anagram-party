import { json } from '@/lib/api';
import { getPlay, getProfile } from '@/lib/data';
import { currentUser } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return json({ signedIn: false });
  const profile = await getProfile(user.id);
  const puzzleId = Number(new URL(req.url).searchParams.get('puzzle'));
  const play = puzzleId && profile?.username ? await getPlay(user.id, puzzleId) : null;
  return json({ signedIn: true, profile, play });
}
