import { json } from '@/lib/api';
import { usernameProblem } from '@/lib/blocklist';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return json({ error: 'Please sign in first.' }, 401);
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? '').trim();
  const problem = usernameProblem(username);
  if (problem) return json({ error: problem }, 400);

  const db = supabaseAdmin();
  const { data: taken } = await db.from('profiles').select('id').ilike('username', username).neq('id', user.id).maybeSingle();
  if (taken) return json({ error: 'That name is taken. Try another.' }, 409);

  const { error } = await db.from('profiles').upsert({ id: user.id, username });
  if (error) return json({ error: 'Could not save that name. Try again.' }, 500);
  return json({ ok: true, username });
}
