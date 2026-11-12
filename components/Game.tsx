'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { PublicPuzzle } from '@/lib/data';
import { loadSoundSettings, play, primeAudio, saveSoundSettings } from '@/lib/sound';
import { wordPoints } from '@/lib/scoring';
import { Confetti, type ConfettiHandle } from './Confetti';
import { Countdown } from './Countdown';

type Me = {
  signedIn: boolean;
  profile?: { username: string | null; tokens: number; current_streak: number } | null;
  play?: { found: string[]; points: number; cleared: boolean } | null;
};

type Feedback = { kind: 'correct' | 'full' | 'wrong' | 'repeat' | 'info'; text: string } | null;

const TIER_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;

function storageKey(id: number) {
  return `ap:found:${id}`;
}

export default function Game({ puzzle }: { puzzle: PublicPuzzle }) {
  const [tiles, setTiles] = useState<string[]>(puzzle.letters);
  const [input, setInput] = useState('');
  const [found, setFound] = useState<string[]>([]);
  const [points, setPoints] = useState(0);
  const [me, setMe] = useState<Me | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [anim, setAnim] = useState<'shake' | 'lift' | null>(null);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState({ muted: false, effects: 0.8, celebrations: 0.8 });
  const [announce, setAnnounce] = useState('');
  const [copied, setCopied] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const boardRef = useRef<HTMLHeadingElement>(null);
  const confetti = useRef<ConfettiHandle>(null);
  const announceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const signedIn = !!me?.signedIn && !!me.profile?.username;
  const cleared = found.length >= puzzle.total;
  const lengths = useMemo(() => Object.keys(puzzle.lengths).map(Number).sort((a, b) => a - b), [puzzle.lengths]);

  // Screen reader announcements: clear then set so repeats are spoken.
  const say = useCallback((text: string) => {
    clearTimeout(announceTimer.current);
    setAnnounce('');
    announceTimer.current = setTimeout(() => setAnnounce(text), 60);
  }, []);

  useEffect(() => {
    setSound(loadSoundSettings());
  }, []);

  // Load saved progress: account first, then any guest words to merge in.
  useEffect(() => {
    let cancelled = false;
    const local: string[] = (() => {
      try {
        return JSON.parse(localStorage.getItem(storageKey(puzzle.id)) || '[]');
      } catch {
        return [];
      }
    })();

    (async () => {
      const res = await fetch(`/api/me?puzzle=${puzzle.id}`, { cache: 'no-store' }).catch(() => null);
      const data: Me = res?.ok ? await res.json() : { signedIn: false };
      if (cancelled) return;
      setMe(data);
      if (data.signedIn && data.profile?.username) {
        let serverFound = data.play?.found ?? [];
        const missing = local.filter((w) => !serverFound.includes(w));
        if (missing.length && puzzle.live) {
          await fetch('/api/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ puzzleId: puzzle.id, words: missing }) });
          const again = await fetch(`/api/me?puzzle=${puzzle.id}`, { cache: 'no-store' }).then((r) => r.json());
          if (cancelled) return;
          setMe(again);
          serverFound = again.play?.found ?? serverFound;
          try {
            localStorage.removeItem(storageKey(puzzle.id));
          } catch {}
        }
        setFound(serverFound);
        setPoints(data.play?.points ?? 0);
      } else {
        setFound(local);
        setPoints(local.reduce((s, w) => s + wordPoints(w.length, puzzle.sourceLength), 0));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [puzzle.id, puzzle.live, puzzle.sourceLength]);

  // Which tiles the current input is using.
  const usedTiles = useMemo(() => {
    const used = new Set<number>();
    for (const ch of input.toUpperCase()) {
      const idx = tiles.findIndex((t, i) => t === ch && !used.has(i));
      if (idx >= 0) used.add(idx);
    }
    return used;
  }, [input, tiles]);

  const remainingLetters = useMemo(() => tiles.filter((_, i) => !usedTiles.has(i)), [tiles, usedTiles]);

  const clampToLetters = useCallback(
    (value: string) => {
      const pool = tiles.map((t) => t.toLowerCase());
      let out = '';
      for (const ch of value.toLowerCase().replace(/[^a-z]/g, '')) {
        const i = pool.indexOf(ch);
        if (i >= 0) {
          pool.splice(i, 1);
          out += ch;
        }
      }
      return out;
    },
    [tiles],
  );

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    primeAudio();
    const next = clampToLetters(e.target.value);
    if (next.length > input.length) play('type');
    else if (next.length < input.length) play('remove');
    else if (e.target.value.length > input.length) {
      const ch = e.target.value.slice(-1).toUpperCase();
      say(/[A-Z]/.test(ch) ? `No ${ch} left` : 'Letters only');
    }
    setInput(next);
    if (feedback) setFeedback(null);
  }

  function tapTile(i: number) {
    primeAudio();
    if (usedTiles.has(i)) return;
    setInput((v) => v + tiles[i].toLowerCase());
    play('type');
    if (feedback) setFeedback(null);
  }

  function backspace() {
    if (!input) return;
    setInput((v) => v.slice(0, -1));
    play('remove');
  }

  function clearInput() {
    if (!input) return;
    setInput('');
    play('remove');
    say('Cleared');
    inputRef.current?.focus();
  }

  const shuffle = useCallback(() => {
    primeAudio();
    setTiles((t) => {
      const a = [...t];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      say(`Shuffled: ${a.join(', ')}`);
      return a;
    });
    play('shuffle');
  }, [say]);

  function flash(kind: 'shake' | 'lift') {
    setAnim(kind);
    setTimeout(() => setAnim(null), kind === 'shake' ? 420 : 380);
  }

  function remainingSummary(list = found) {
    return lengths
      .map((len) => {
        const left = puzzle.lengths[len] - list.filter((w) => w.length === len).length;
        return `${len} letters: ${left} left`;
      })
      .join('. ');
  }

  async function submit() {
    primeAudio();
    const word = input.toLowerCase();
    if (busy || !word) return;
    if (word.length < 4) {
      play('wrong');
      flash('shake');
      setFeedback({ kind: 'wrong', text: 'Words need at least 4 letters.' });
      say('Too short. Words need at least 4 letters.');
      return;
    }
    if (found.includes(word)) {
      play('repeat');
      setFeedback({ kind: 'repeat', text: `Already found ${word.toUpperCase()}` });
      say(`${word.toUpperCase()}, already found.`);
      document.getElementById(`w-${word}`)?.classList.add('pulse');
      setTimeout(() => document.getElementById(`w-${word}`)?.classList.remove('pulse'), 900);
      setInput('');
      return;
    }

    setBusy(true);
    const res = await fetch('/api/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puzzleId: puzzle.id, word }),
    }).catch(() => null);
    setBusy(false);
    const data = res ? await res.json().catch(() => null) : null;

    if (!data) {
      setFeedback({ kind: 'info', text: 'Connection problem. Try again.' });
      say('Connection problem. Try again.');
      return;
    }

    if (data.status === 'correct') {
      const nextFound = [...found, word];
      const total = puzzle.total;
      const before = found.length / total;
      const after = nextFound.length / total;
      setFound(nextFound);
      setPoints(typeof data.score === 'number' ? data.score : points + data.points);
      if (!data.saved) {
        try {
          localStorage.setItem(storageKey(puzzle.id), JSON.stringify(nextFound));
        } catch {}
      }
      setInput('');
      flash('lift');

      const isCleared = nextFound.length >= total;
      if (isCleared) {
        play('cleared');
        confetti.current?.burst(220);
      } else if (data.full) {
        play('full');
        confetti.current?.burst(120);
      } else {
        play('correct', word.length);
        confetti.current?.burst(24);
        if ([0.25, 0.5, 0.75].some((m) => before < m && after >= m)) setTimeout(() => play('milestone'), 260);
      }

      const tokenNote = data.tokens_earned ? ` Plus ${data.tokens_earned} tokens.` : '';
      const label = data.full ? 'Full Anagram! ' : '';
      setFeedback({ kind: data.full ? 'full' : 'correct', text: `${label}${word.toUpperCase()} +${data.points}` });
      say(
        isCleared
          ? `${word.toUpperCase()}, correct. Board cleared! You found all ${total} words.${tokenNote}`
          : `${label}${word.toUpperCase()}, correct, ${word.length} letters, ${data.points} points. ${nextFound.length} of ${total} found.${tokenNote}`,
      );
      if (data.tokens_earned && me?.profile) setMe({ ...me, profile: { ...me.profile, tokens: me.profile.tokens + data.tokens_earned } });
      return;
    }

    const messages: Record<string, string> = {
      wrong: `${word.toUpperCase()} is not in today's list.`,
      repeat: `Already found ${word.toUpperCase()}.`,
      short: 'Words need at least 4 letters.',
      letters: "Those letters aren't all in the puzzle.",
      closed: 'This puzzle has closed. A new one is up.',
      slow_down: 'Slow down a little and try again.',
    };
    const text = messages[data.status] ?? 'Something went wrong. Try again.';
    if (data.status === 'repeat') play('repeat');
    else play('wrong');
    flash('shake');
    setFeedback({ kind: data.status === 'repeat' ? 'repeat' : 'wrong', text });
    say(text);
    setInput('');
  }

  // Keyboard shortcuts. Alt (Option on Mac) plus a letter, using key codes so Mac works.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const actions: Record<string, () => void> = {
        KeyS: shuffle,
        KeyL: () => say(`Letters: ${tiles.join(', ')}`),
        KeyR: () => say(remainingSummary()),
        KeyB: () => boardRef.current?.focus(),
        KeyW: () => inputRef.current?.focus(),
        KeyM: () => {
          const next = saveSoundSettings({ muted: !sound.muted });
          setSound(next);
          say(next.muted ? 'Sound off' : 'Sound on');
        },
      };
      const fn = actions[e.code];
      if (fn) {
        e.preventDefault();
        fn();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function share() {
    const head = puzzle.kind === 'daily' ? `Anagram Party #${puzzle.number}` : 'Anagram Party Bonus Round';
    const streak = me?.profile?.current_streak ? `, ${me.profile.current_streak}-day streak` : '';
    const text = `${head}, ${TIER_LABEL[puzzle.tier]}\n${found.length} of ${puzzle.total} words found${cleared ? ', board cleared!' : ''}${streak}\nanagramparty.com`;
    try {
      if (navigator.share && /Mobi|iPhone|Android/i.test(navigator.userAgent)) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
      setCopied(true);
      say('Result copied. Paste it anywhere.');
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }

  const pct = Math.round((found.length / puzzle.total) * 100);
  const title = puzzle.kind === 'daily' ? `Puzzle #${puzzle.number}` : 'Bonus Round';

  return (
    <div className="game">
      <Confetti ref={confetti} />

      <div className="game-meta">
        <p className="eyebrow">
          {puzzle.live ? 'Daily Party' : puzzle.kind === 'bonus' ? 'Bonus Round, unranked' : 'Archive, unranked'}
          <span className={`badge badge-${puzzle.tier}`}>{TIER_LABEL[puzzle.tier]}</span>
        </p>
        <h1 className="game-title">{title}</h1>
        {puzzle.live && (
          <p className="reset">
            <Countdown />
          </p>
        )}
      </div>

      <section aria-labelledby="letters-h" className="letters-wrap">
        <h2 id="letters-h" className="sr-only">
          Today&apos;s letters
        </h2>
        <ul className={`tiles ${anim === 'shake' ? 'shake' : ''}`} aria-label={`${tiles.length} letters`}>
          {tiles.map((t, i) => {
            const used = usedTiles.has(i);
            return (
              <li key={i}>
                <button
                  type="button"
                  className={`tile tile-${i % 4} ${used ? 'used' : ''}`}
                  onClick={() => tapTile(i)}
                  aria-label={`${t}, ${used ? 'used' : 'available'}`}
                  aria-disabled={used}
                >
                  {t}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="definition">
          {puzzle.partOfSpeech && <em>{puzzle.partOfSpeech}. </em>}
          {puzzle.definition}
        </p>
      </section>

      <form
        className="entry"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        aria-label="Enter a word"
      >
        <label htmlFor="word" className="entry-label">
          Your word
        </label>
        <div className={`entry-row ${anim === 'shake' ? 'shake' : ''} ${anim === 'lift' ? 'lift' : ''}`}>
          <input
            id="word"
            ref={inputRef}
            value={input.toUpperCase()}
            onChange={onInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                clearInput();
              }
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="go"
            maxLength={puzzle.sourceLength}
            aria-describedby="entry-help"
            className="entry-input"
          />
          <button type="button" className="btn btn-ghost" onClick={backspace} aria-label="Delete last letter" disabled={!input}>
            ⌫
          </button>
        </div>
        <p id="entry-help" className="sr-only">
          Type letters from the puzzle. Enter submits, Escape clears. Alt plus R reads how many words are left.
        </p>
        <div className="entry-actions">
          <button type="button" className="btn" onClick={shuffle}>
            Shuffle letters
          </button>
          <button type="button" className="btn" onClick={clearInput} disabled={!input}>
            Clear answer
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !input}>
            Submit word
          </button>
        </div>
        <p className={`feedback ${feedback ? `fb-${feedback.kind}` : ''}`} aria-hidden="true">
          {feedback?.text ?? ' '}
        </p>
      </form>

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announce}
      </div>

      <section className="progress" aria-label="Progress">
        <dl className="stats">
          <div>
            <dt>Found</dt>
            <dd>
              {found.length} <span className="of">of {puzzle.total}</span>
            </dd>
          </div>
          <div>
            <dt>Points</dt>
            <dd>{points}</dd>
          </div>
          {signedIn && (
            <>
              <div>
                <dt>Streak</dt>
                <dd>{me?.profile?.current_streak ?? 0}</dd>
              </div>
              <div>
                <dt>Tokens</dt>
                <dd>{me?.profile?.tokens ?? 0}</dd>
              </div>
            </>
          )}
        </dl>
        <div className="bar" role="progressbar" aria-label="Words found" aria-valuemin={0} aria-valuemax={puzzle.total} aria-valuenow={found.length} aria-valuetext={`${found.length} of ${puzzle.total}, ${pct} percent`}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </section>

      {me && !signedIn && puzzle.live && (
        <aside className="callout">
          {me.signedIn ? (
            <p>
              Pick a player name to save your words and join the leaderboard. <Link href="/account">Choose a name</Link>
            </p>
          ) : (
            <p>
              Playing as a guest. <Link href="/account">Sign in</Link> to save your words, earn Party Tokens, and get on the leaderboard. Words you find now carry over.
            </p>
          )}
        </aside>
      )}

      {cleared && (
        <section className="party-complete" aria-labelledby="pc-h">
          <h2 id="pc-h" tabIndex={-1}>
            Party Complete!
          </h2>
          <p>You found all {puzzle.total} words.</p>
        </section>
      )}

      <section className="board" aria-labelledby="board-h">
        <div className="board-head">
          <h2 id="board-h" ref={boardRef} tabIndex={-1}>
            Your words
          </h2>
          <button type="button" className="btn btn-small" onClick={share} disabled={!found.length}>
            {copied ? 'Copied!' : 'Share result'}
          </button>
        </div>
        <div className="groups">
          {lengths.map((len) => {
            const words = found.filter((w) => w.length === len).sort();
            const totalLen = puzzle.lengths[len];
            const isFull = len === puzzle.sourceLength;
            return (
              <section key={len} className={`group ${isFull ? 'group-full' : ''}`} aria-labelledby={`g-${len}`}>
                <h3 id={`g-${len}`}>
                  {len} letters{isFull ? ', Full Anagram' : ''}, {words.length} of {totalLen} found
                </h3>
                <ul className="slots">
                  {words.map((w) => (
                    <li key={w} id={`w-${w}`} className={`slot filled ${isFull ? 'gold' : ''}`}>
                      {w.toUpperCase()}
                    </li>
                  ))}
                  {Array.from({ length: Math.max(0, totalLen - words.length) }).map((_, i) => (
                    <li key={`e${i}`} className="slot empty" aria-hidden="true">
                      {'•'.repeat(len)}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </section>

      <details className="sound-panel">
        <summary>Sound settings</summary>
        <div className="sound-controls">
          <label className="check">
            <input
              type="checkbox"
              checked={sound.muted}
              onChange={(e) => setSound(saveSoundSettings({ muted: e.target.checked }))}
            />
            Mute all sounds
          </label>
          <label>
            Effects volume
            <input type="range" min={0} max={1} step={0.1} value={sound.effects} onChange={(e) => setSound(saveSoundSettings({ effects: Number(e.target.value) }))} />
          </label>
          <label>
            Celebrations volume
            <input type="range" min={0} max={1} step={0.1} value={sound.celebrations} onChange={(e) => setSound(saveSoundSettings({ celebrations: Number(e.target.value) }))} />
          </label>
          <button type="button" className="btn btn-small" onClick={() => { primeAudio(); play('full'); }}>
            Test sound
          </button>
        </div>
      </details>

      <details className="shortcuts">
        <summary>Keyboard shortcuts</summary>
        <ul>
          <li><kbd>Enter</kbd> submit word</li>
          <li><kbd>Escape</kbd> clear answer</li>
          <li><kbd>Alt</kbd> + <kbd>S</kbd> shuffle letters</li>
          <li><kbd>Alt</kbd> + <kbd>L</kbd> read the letters</li>
          <li><kbd>Alt</kbd> + <kbd>R</kbd> read words left by length</li>
          <li><kbd>Alt</kbd> + <kbd>B</kbd> jump to your words</li>
          <li><kbd>Alt</kbd> + <kbd>W</kbd> jump to the answer field</li>
          <li><kbd>Alt</kbd> + <kbd>M</kbd> mute or unmute</li>
        </ul>
        <p className="muted">On a Mac, use Option instead of Alt.</p>
      </details>
    </div>
  );
}
