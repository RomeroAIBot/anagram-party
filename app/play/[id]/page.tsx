import Link from 'next/link';
import { redirect } from 'next/navigation';
import Game from '@/components/Game';
import { getPublicPuzzle, hasUnlock } from '@/lib/data';
import { currentUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Archive days and bonus rounds the player unlocked with Party Tokens.
export default async function PlayUnlocked({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const puzzleId = Number(id);
  const user = await currentUser();
  if (!user) redirect('/account');
  const puzzle = await getPublicPuzzle(puzzleId);
  if (!puzzle) redirect('/account');
  if (puzzle.live) redirect('/');
  if (!(await hasUnlock(user.id, puzzleId))) {
    return (
      <div className="page">
        <h1>Locked</h1>
        <p>
          Unlock this puzzle with Party Tokens from your <Link href="/account">account page</Link>.
        </p>
      </div>
    );
  }
  return <Game puzzle={puzzle} />;
}
