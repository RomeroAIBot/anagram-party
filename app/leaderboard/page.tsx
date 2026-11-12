import type { Metadata } from 'next';
import Link from 'next/link';
import { getLeaderboard, getProfile, getTodayPuzzle } from '@/lib/data';
import { currentUser } from '@/lib/supabase/server';
import { formatLongDate } from '@/lib/time';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Leaderboard' };

function timeOf(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
}

export default async function LeaderboardPage() {
  const puzzle = await getTodayPuzzle().catch(() => null);
  if (!puzzle) {
    return (
      <div className="page">
        <h1>Leaderboard</h1>
        <p>No puzzle is live right now.</p>
      </div>
    );
  }
  const [rows, user] = await Promise.all([getLeaderboard(puzzle.id), currentUser()]);
  const me = user ? await getProfile(user.id) : null;
  const clearedRows = rows.filter((r) => r.cleared).sort((a, b) => (a.clearedAt ?? '').localeCompare(b.clearedAt ?? ''));

  return (
    <div className="page">
      <h1>Daily Party Leaderboard</h1>
      <p className="muted">
        Puzzle #{puzzle.number}, {formatLongDate(puzzle.date!)}. {puzzle.total} words to find. Ranked by words found; ties go to whoever got there first.
      </p>

      <div className="card">
        {rows.length ? (
          <table className="board-table">
            <caption>Today&apos;s ranking</caption>
            <thead>
              <tr>
                <th scope="col" className="num">Rank</th>
                <th scope="col">Player</th>
                <th scope="col" className="num">Words</th>
                <th scope="col" className="num">Points</th>
                <th scope="col">Reached at</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.username} className={me?.username === r.username ? 'me' : undefined}>
                  <td className="num">{r.rank}</td>
                  <th scope="row">
                    {r.username}
                    {r.cleared && <span> (cleared)</span>}
                    {r.hints > 0 && <span> (used hints)</span>}
                    {me?.username === r.username && <span className="sr-only"> (you)</span>}
                  </th>
                  <td className="num">
                    {r.words} of {puzzle.total}
                  </td>
                  <td className="num">{r.points}</td>
                  <td>{timeOf(r.reachedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>
            Nobody is on the board yet. <Link href="/">Be the first.</Link>
          </p>
        )}
      </div>

      <div className="card">
        <h2>Cleared It</h2>
        {clearedRows.length ? (
          <table className="board-table">
            <caption className="sr-only">Players who found every word, in finishing order</caption>
            <thead>
              <tr>
                <th scope="col" className="num">Order</th>
                <th scope="col">Player</th>
                <th scope="col">Finished at</th>
              </tr>
            </thead>
            <tbody>
              {clearedRows.map((r, i) => (
                <tr key={r.username}>
                  <td className="num">{i + 1}</td>
                  <th scope="row">{r.username}</th>
                  <td>{timeOf(r.clearedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">Nobody has found every word yet today.</p>
        )}
      </div>
      {!me?.username && (
        <p>
          <Link href="/account">Sign in and pick a name</Link> to get on the board.
        </p>
      )}
    </div>
  );
}
