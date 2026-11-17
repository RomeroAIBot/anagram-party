import type { Metadata } from 'next';
import Link from 'next/link';
import Game from '@/components/Game';
import { getRoomState } from '@/lib/room';
import { currentUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Puzzle Room' };

// Casual random puzzles for account holders. 3-letter words count, nothing is ranked.
export default async function RoomPage() {
  const user = await currentUser();
  if (!user) {
    return (
      <div className="page">
        <h1>Puzzle Room</h1>
        <p>
          The Puzzle Room is for players with an account. Play random puzzles just for fun, as many as you like, with 3-letter words counting.
        </p>
        <p>
          <Link href="/account">Sign in or create a free account</Link> to get in.
        </p>
      </div>
    );
  }

  const state = await getRoomState(user.id).catch(() => null);
  if (!state) {
    return (
      <div className="page">
        <h1>Puzzle Room</h1>
        <p>The Puzzle Room couldn&apos;t load a puzzle right now. Try again in a minute.</p>
      </div>
    );
  }

  return (
    <Game
      key={state.puzzle.id}
      puzzle={state.puzzle}
      room={{ initialFound: state.found, clearedTotal: state.clearedTotal, previous: state.previous }}
    />
  );
}
