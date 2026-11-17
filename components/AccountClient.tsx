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
  const [pwStatus, setPwStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState<'signin' | 'signup' | 'link'>('signup');

  async function sendLink(addr: string) {
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: addr,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/account` },
    });
    if (error) {
      setError(/rate|limit|many/i.test(error.message) ? 'Too many sign-in emails were sent recently. Try again in an hour, or use a password instead.' : 'We could not send the link. Check the address and try again.');
    } else setSentTo(addr);
  }

  async function submitAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const f = new FormData(e.currentTarget);
    const addr = String(f.get('email') || '').trim();
    const password = String(f.get('password') || '');
    if (!addr) return setError('Enter your email address.');
    setBusy(true);
    const sb = supabaseBrowser();
    try {
      if (mode === 'link') {
        await sendLink(addr);
      } else if (mode === 'signup') {
        if (password.length < 8) return setError('Use a password with at least 8 characters.');
        const { data, error } = await sb.auth.signUp({
          email: addr,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/account` },
        });
        if (error) {
          setError(/registered|exists/i.test(error.message) ? 'That email already has an account. Choose Sign in instead.' : error.message);
        } else if (data.user && data.user.identities?.length === 0) {
          // Supabase answers a repeat sign-up with a fake success and sends no email.
          setError("That email already has an account. Choose Sign in with my password, or Email me a sign-in link if you don't know the password. Once you're in, you can set a new password on this page.");
        } else if (data.session) {
          router.refresh();
        } else {
          setSentTo(addr);
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: addr, password });
        if (error) setError('That email and password don\'t match. Try again, or get a sign-in link by email.');
        else router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setPwStatus(null);
    const form = e.currentTarget;
    const password = String(new FormData(form).get('newpassword') || '');
    if (password.length < 8) return setPwStatus({ ok: false, text: 'Use a password with at least 8 characters.' });
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      const same = /different|same/i.test(error.message);
      return setPwStatus({ ok: false, text: same ? 'That is already your password. Choose a different one.' : 'Could not update your password. Try again.' });
    }
    form.reset();
    setPwStatus({ ok: true, text: 'Your password has been updated. Use it next time you sign in.' });
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
    const labels = { signup: 'Create account', signin: 'Sign in', link: 'Email me a link' } as const;
    return (
      <>
        <h1>{mode === 'signup' ? 'Create your account' : 'Sign in'}</h1>
        <p>An account saves your words, keeps your streak, earns Party Tokens, and puts you on the leaderboard.</p>
        {status}
        {sentTo ? (
          <p className="notice notice-ok" role="status">
            Check {sentTo} for an email from us. Open the link in it to finish signing in.
          </p>
        ) : (
          <form className="form card" onSubmit={submitAuth}>
            <fieldset className="mode-switch">
              <legend>What do you want to do?</legend>
              {(['signup', 'signin', 'link'] as const).map((m) => (
                <label key={m} className="radio">
                  <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => { setMode(m); setError(null); }} />
                  {m === 'signup' ? 'Create a new account' : m === 'signin' ? 'Sign in with my password' : 'Email me a sign-in link (no password)'}
                </label>
              ))}
            </fieldset>
            <label>
              Email address
              <input type="email" name="email" autoComplete="email" required />
            </label>
            {mode !== 'link' && (
              <label>
                Password
                <input
                  type="password"
                  name="password"
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  aria-describedby={mode === 'signup' ? 'pw-help' : undefined}
                />
              </label>
            )}
            {mode === 'signup' && (
              <p id="pw-help" className="muted">
                At least 8 characters.
              </p>
            )}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'One moment…' : labels[mode]}
            </button>
            {mode === 'signin' && (
              <button type="button" className="linkish" onClick={() => setMode('link')}>
                Forgot your password? Get a sign-in link by email.
              </button>
            )}
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

      <section className="card" aria-labelledby="pw-h">
        <h2 id="pw-h">Password</h2>
        <form className="form" onSubmit={changePassword}>
          <label>
            New password
            <input type="password" name="newpassword" minLength={8} required autoComplete="new-password" />
          </label>
          <button className="btn" type="submit" disabled={busy}>
            Save password
          </button>
        </form>
        <div role="status" aria-live="polite">
          {pwStatus && <p className={`notice ${pwStatus.ok ? 'notice-ok' : 'notice-err'}`}>{pwStatus.text}</p>}
        </div>
      </section>

      <p className="muted">Signed in as {email}.</p>
      <button className="btn" type="button" onClick={signOut}>
        Sign out
      </button>
    </>
  );
}
