'use client';
import { useEffect, useState } from 'react';
import type { RecapWord } from '@/lib/data';

// Shows the full answer list for a finished puzzle, with a separate section for the
// words this player missed. Signed-in players' words come from the server; guests'
// come from what their browser saved while they played.
export default function RecapBoard({ puzzleId, words, serverFound }: { puzzleId: number; words: RecapWord[]; serverFound: string[] | null }) {
  const [found, setFound] = useState<string[] | null>(serverFound);

  useEffect(() => {
    if (serverFound) return;
    try {
      const local = JSON.parse(localStorage.getItem(`ap:found:${puzzleId}`) || '[]');
      if (Array.isArray(local) && local.length) setFound(local);
    } catch {}
  }, [puzzleId, serverFound]);

  const played = !!found && found.length > 0;
  const foundSet = new Set(found ?? []);
  const missed = words.filter((w) => !foundSet.has(w.word));
  const byLength = new Map<number, RecapWord[]>();
  for (const w of words) byLength.set(w.word.length, [...(byLength.get(w.word.length) ?? []), w]);
  const lengths = [...byLength.keys()].sort((a, b) => a - b);

  const pct = (w: RecapWord) => `${w.pct}% of players`;

  return (
    <>
      {played ? (
        <div className="card">
          <h2>Words you missed</h2>
          <p>
            You found {words.length - missed.length} of {words.length}.
            {missed.length === 0 ? ' You cleared the whole board!' : ` Here are the ${missed.length} you didn't get.`}
          </p>
          {missed.length > 0 && (
            <ul className="recap-words">
              {missed.map((w) => (
                <li key={w.word} className="rw rw-missed">
                  <strong>{w.word.toUpperCase()}</strong>
                  {w.full ? ', full anagram' : ''}
                  <span className="rw-meta">{pct(w)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="muted">You didn&apos;t play this puzzle on this device, so there&apos;s nothing to compare. Here&apos;s every answer.</p>
      )}

      <div className="card">
        <h2>Every answer</h2>
        {played && (
          <p className="legend">
            <span className="rw-key rw-found">✓ Found</span> <span className="rw-key rw-missed">✕ Missed</span>
          </p>
        )}
        {lengths.map((len) => (
          <section key={len} aria-labelledby={`r-${len}`}>
            <h3 id={`r-${len}`}>{len} letters</h3>
            <ul className="recap-words">
              {byLength.get(len)!.map((w) => {
                const got = foundSet.has(w.word);
                const cls = !played ? '' : got ? 'rw-found' : 'rw-missed';
                return (
                  <li key={w.word} className={`rw ${cls}`}>
                    <strong>{w.word.toUpperCase()}</strong>
                    {played && <span className="sr-only">{got ? ', found' : ', missed'}</span>}
                    {w.full ? ', full anagram' : ''}
                    <span className="rw-meta">{pct(w)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
