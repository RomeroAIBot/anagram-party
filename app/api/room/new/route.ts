import { json, rateLimited, clientKey } from '@/lib/api';
import { newRoomPuzzle } from '@/lib/room';
import { currentUser } from '@/lib/supabase/server';

// Starts a new random Puzzle Room puzzle. Progress on the old one is wiped.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return json({ status: 'signed_out' }, 401);
  if (rateLimited('room-new:' + clientKey(req, user.id), 20, 60_000)) return json({ status: 'slow_down' }, 429);
  const ok = await newRoomPuzzle(user.id).catch(() => false);
  return ok ? json({ status: 'ok' }) : json({ status: 'error' }, 500);
}
