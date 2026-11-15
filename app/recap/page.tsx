import type { Metadata } from 'next';
import Link from 'next/link';
import RecapBoard from '@/components/RecapBoard';
import { getLeaderboard, getPlay, getProfile, getPuzzleByDate, getRecap } from '@/lib/data';
import { currentUser } from '@/lib/supabase/server';
import { addDays, currentPuzzleDate, formatLongDate } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: "Yesterday's Party Recap" };

export default async function RecapPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const today = currentPuzzleDate();
  const requested = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date < today ? sp.date : addDays(today, -1);
  const puzzle = await getPuzzleByDate(requested).catch(() => null);

  if (!puzzle) {
    return (
      <div className="page">
        <h1>Daily Party Recap</h1>
        <p>There&apos;s no finished puzzle to show yet. Come back after the 1:00 AM Eastern reset.</p>
      </div>
    );
  }

  const [{ players, words, rarest }, board, user] = await Promise.all([getRecap(puzzle), getLeaderboard(puzzle.id, 3), currentUser()]);
  const profile = user ? await getProfile(user.id) : null;
  const myPlay = user && profile?.username ? await getPlay(user.id, puzzle.id) : null;
  const serverFound = profile?.username ? myPlay?.found ?? [] : null;

  return (
    <div className="page">
      <h1>Daily Party Recap</h1>
      <p className="muted">
        Puzzle #{puzzle.number}, {formatLongDate(puzzle.puzzle_date!)}. {players} {players === 1 ? 'player' : 'players'} on the board.
      </p>

      <div className="card">
        <h2>
          The word was {puzzle.word.toUpperCase()}
        </h2>
        <p>
          <strong>{puzzle.part_of_speech}.</strong> {puzzle.definition}
        </p>
        {rarest && (
          <p>
            Rarest find: <strong>{rarest.word.toUpperCase()}</strong>, found by {rarest.finders} {rarest.finders === 1 ? 'player' : 'players'}.
          </p>
        )}
        {board.length > 0 && (
          <p>
            Top players: {board.map((b) => `${b.username} (${b.words} words)`).join(', ')}.
          </p>
        )}
      </div>

      <RecapBoard puzzleId={puzzle.id} words={words} serverFound={serverFound} />
      <p>
        <Link href="/">Play today&apos;s puzzle</Link>
      </p>
    </div>
  );
}
