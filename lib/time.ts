// The daily puzzle changes at 1:00 AM Eastern (America/New_York), all year,
// including daylight saving changes. Shifting "now" back one hour and taking the
// calendar date in New York gives the active puzzle date.

const NY = 'America/New_York';

function nyParts(d: Date) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: NY,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return p as Record<string, string>;
}

export function currentPuzzleDate(now = new Date()): string {
  const shifted = new Date(now.getTime() - 60 * 60 * 1000);
  const p = nyParts(shifted);
  return `${p.year}-${p.month}-${p.day}`;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Milliseconds until the next 1:00 AM Eastern reset. */
export function msUntilReset(now = new Date()): number {
  // Step forward minute by minute is wasteful; estimate then correct.
  const today = currentPuzzleDate(now);
  let lo = now.getTime();
  let hi = lo + 26 * 3600 * 1000;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (currentPuzzleDate(new Date(mid)) === today) lo = mid;
    else hi = mid;
  }
  return hi - now.getTime();
}

export function formatLongDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
