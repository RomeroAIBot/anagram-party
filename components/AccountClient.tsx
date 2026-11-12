'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { COSTS } from '@/lib/scoring';
import type { Profile } from '@/lib/data';

type Props = {
  email: string | null;
  profile: Profile | null;
  unlocked: { id: number; label: string }[];
  history: { amount: number; reason: string; created_at: string }[];
  archiveMin: string;
  archiveMax: string;
};

const REASONS: Record<string, string> = {
  daily_play: 'Played the daily puzzle',
  half_found: 'Found half the words',
  cleared: 'Cleared the board',
  full_anagram: 'Full Anagram',
  streak_7: '7-day streak',
  streak_30: '30-day streak',
  unlock: 'Unlocked a puzzle',
};

export default function AccountClient({ email, profile, unlocked, history, archiveMin, archiveMax }: Props) {
  const router = useRouter();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const addr = String(new FormData(e.currentTarget).get('email') || '').trim();
    if (!addr) return setError('Enter your email address.');
    setBusy(true);
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: `${window.location.origin || site}/auth/callback?next=/account` },
    });
    setBusy(false);
    if (error) setError('We could not send the link. Check the address and try again.');
    else setSentTo(addr);
  }

  async function saveName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const username = String(new FormData(e.currentTarget).get('username') || '').trim();
    setBusy(true);
    const res = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setOk(`You're ${data.username}. Saved.`);
    router.refresh();
  }

  async function unlock(type: 'bonus' | 'archive', date?: string) {
    setError(null);
    setOk(null);
    setBusy(true);
    const res = await fetch('/api/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, date }) });
    const data = await res.json();
    setBusy(false);
    if (data.status === 'ok' || data.status === 'already') return router.push(`/play/${data.puzzle_id}`);
    const msg: Record<string, string> = {
      insufficient: `Not enough tokens yet. You have ${data.tokens ?? 0}.`,
      none_left: "You've played every bonus round. More are coming.",
      no_puzzle: 'There was no puzzle on that date.',
      invalid: 'Pick a date before today.',
    };
    setError(msg[data.status] ?? 'Something went wrong. Try again.');
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.refresh();
  }

  const status = (
    <>
      {error && (
        <p className="notice notice-err" role="alert">
          {error}
        </p>
      )}
      {ok && (
        <p className="notice notice-ok" role="status">
          {ok}
        </p>
      )}
    </>
  );

  if (!email) {
    return (
      <>
        <h1>Sign in</h1>
        <p>Sign in to save your words, keep a streak, earn Party Tokens, and appear on the leaderboard. No password needed; we email you a sign-in link.</p>
        {status}
        {sentTo ? (
          <p className="notice notice-ok" role="status">
            Check {sentTo} for your sign-in link. It works once and expires in an hour.
          </p>
        ) : (
          <form className="form card" onSubmit={sendLink}>
            <label>
              Email address
              <input type="email" name="email" autoComplete="email" required />
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        )}
        <p className="muted">You must be 13 or older to make an account.</p>
      </>
    );
  }

  if (!profile?.username) {
    return (
      <>
        <h1>Pick your player name</h1>
        <p>This is the name everyone sees on the leaderboard.</p>
        {status}
        <form className="form card" onSubmit={saveName}>
          <label>
            Player name
            <input type="text" name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" aria-describedby="name-help" autoComplete="nickname" />
          </label>
          <p id="name-help" className="muted">3 to 20 letters, numbers, or underscores.</p>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Save name
          </button>
        </form>
        <button className="btn" type="button" onClick={signOut}>
          Sign out
        </button>
      </>
    );
  }

  return (
    <>
      <h1>{profile.username}</h1>
      {status}
      <dl className="stats">
        <div>
          <dt>Party Tokens</dt>
          <dd>{profile.tokens}</dd>
        </div>
        <div>
          <dt>Streak</dt>
          <dd>{profile.current_streak}</dd>
        </div>
        <div>
          <dt>Best streak</dt>
          <dd>{profile.best_streak}</dd>
        </div>
      </dl>

      <section className="card" aria-labelledby="shop-h">
        <h2 id="shop-h">Spend tokens</h2>
        <p className="muted">These rounds are just for fun. They never change your spot on the daily leaderboard.</p>
        <div className="shop">
          <div className="item">
            <h3>Bonus Round</h3>
            <p>A fresh puzzle you haven&apos;t seen, any time.</p>
            <p className="price">{COSTS.bonus} tokens</p>
            <button className="btn btn-primary" type="button" disabled={busy || profile.tokens < COSTS.bonus} onClick={() => unlock('bonus')}>
              Unlock a bonus round
            </button>
          </div>
          <form
            className="item"
            onSubmit={(e) => {
              e.preventDefault();
              unlock('archive', String(new FormData(e.currentTarget).get('date')));
            }}
          >
            <h3>Archive Puzzle</h3>
            <p>Replay any past daily puzzle.</p>
            <p className="price">{COSTS.archive} tokens</p>
            <label className="form">
              Puzzle date
              <input type="date" name="date" min={archiveMin} max={archiveMax} required />
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy || profile.tokens < COSTS.archive || archiveMax < archiveMin}>
              Unlock that day
            </button>
          </form>
        </div>
      </section>

      {unlocked.length > 0 && (
        <section className="card" aria-labelledby="unl-h">
          <h2 id="unl-h">Your unlocked puzzles</h2>
          <ul>
            {unlocked.map((u) => (
              <li key={u.id}>
                <Link href={`/play/${u.id}`}>{u.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className="card" aria-labelledby="hist-h">
          <h2 id="hist-h">Recent tokens</h2>
          <table className="board-table">
            <caption className="sr-only">Your recent token activity</caption>
            <thead>
              <tr>
                <th scope="col">What</th>
                <th scope="col" className="num">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <th scope="row">{REASONS[h.reason] ?? h.reason}</th>
                  <td className="num">{h.amount > 0 ? `+${h.amount}` : h.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="muted">Signed in as {email}.</p>
      <button className="btn" type="button" onClick={signOut}>
        Sign out
      </button>
    </>
  );
}
