import type { Metadata } from 'next';
import AccountClient from '@/components/AccountClient';
import { getProfile } from '@/lib/data';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';
import { currentPuzzleDate, addDays } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your account' };

export default async function AccountPage() {
  const user = await currentUser();
  const profile = user ? await getProfile(user.id) : null;
  let unlocked: { id: number; label: string }[] = [];
  let history: { amount: number; reason: string; created_at: string }[] = [];
  if (user) {
    const db = supabaseAdmin();
    const [u, t] = await Promise.all([
      db.from('unlocks').select('puzzle_id, created_at, puzzles(kind, number, puzzle_date)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      db.from('token_transactions').select('amount, reason, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    ]);
    unlocked = (u.data ?? []).map((r: any) => ({
      id: r.puzzle_id,
      label: r.puzzles?.kind === 'bonus' ? 'Bonus Round' : `Puzzle #${r.puzzles?.number} (${r.puzzles?.puzzle_date})`,
    }));
    history = t.data ?? [];
  }
  const today = currentPuzzleDate();
  return (
    <div className="page">
      <AccountClient
        email={user?.email ?? null}
        profile={profile}
        unlocked={unlocked}
        history={history}
        archiveMax={addDays(today, -1)}
        archiveMin="2026-11-12"
      />
    </div>
  );
}
