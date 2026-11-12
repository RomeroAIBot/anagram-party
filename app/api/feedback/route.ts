import { json, rateLimited, clientKey } from '@/lib/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';

// Suggestions and "this word should count" flags.
export async function POST(req: Request) {
  const user = await currentUser();
  if (rateLimited('fb:' + clientKey(req, user?.id), 5, 60_000)) return json({ error: 'Please wait a minute and try again.' }, 429);
  const body = await req.json().catch(() => null);
  const db = supabaseAdmin();

  if (body?.kind === 'flag') {
    const word = String(body?.word ?? '').toLowerCase().trim();
    if (!/^[a-z]{4,15}$/.test(word)) return json({ error: 'Enter a word of 4 or more letters.' }, 400);
    await db.from('word_flags').insert({ user_id: user?.id ?? null, puzzle_id: Number(body?.puzzleId) || null, word, note: String(body?.note ?? '').slice(0, 500) || null });
    return json({ ok: true });
  }

  const message = String(body?.message ?? '').trim();
  const category = ['idea', 'bug', 'accessibility', 'other'].includes(body?.category) ? body.category : 'idea';
  if (message.length < 3) return json({ error: 'Write a little more so we know what you mean.' }, 400);
  await db.from('suggestions').insert({ user_id: user?.id ?? null, category, message: message.slice(0, 2000) });
  return json({ ok: true });
}
