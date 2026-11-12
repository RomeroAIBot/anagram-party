import Game from '@/components/Game';
import { getTodayPuzzle } from '@/lib/data';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const puzzle = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.AP_DEMO === '1' ? await getTodayPuzzle().catch(() => null) : null;
  if (!puzzle) {
    return (
      <div className="page">
        <h1>The party is setting up</h1>
        <p>Today&apos;s puzzle isn&apos;t ready yet. Check back in a few minutes.</p>
      </div>
    );
  }
  return <Game puzzle={puzzle} />;
}
