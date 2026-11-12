import type { Metadata } from 'next';
import Link from 'next/link';
import { getLeaderboard, getPuzzleByDate, getRecap } from '@/lib/data';
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

  const [{ players, words, rarest }, board] = await Promise.all([getRecap(puzzle), getLeaderboard(puzzle.id, 3)]);
  const byLength = new Map<number, typeof words>();
  for (const w of words) byLength.set(w.word.length, [...(byLength.get(w.word.length) ?? []), w]);

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

      <div className="card">
        <h2>Every answer</h2>
        <p className="muted">Each word shows the share of players who found it.</p>
        {[...byLength.entries()].sort((a, b) => a[0] - b[0]).map(([len, list]) => (
          <section key={len} aria-labelledby={`r-${len}`}>
            <h3 id={`r-${len}`}>{len} letters</h3>
            <ul className="recap-words">
              {list.map((w) => (
                <li key={w.word}>
                  <strong>{w.word.toUpperCase()}</strong>
                  {w.full ? ' (full anagram)' : ''}, {w.pct}%
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p>
        <Link href="/">Play today&apos;s puzzle</Link>
      </p>
    </div>
  );
}
