// Mirrors public.word_points in the database. Used for display only;
// the server function is the source of truth.
export function wordPoints(len: number, sourceLen: number): number {
  const base = len <= 3 ? 2 : len === 4 ? 5 : len === 5 ? 10 : len === 6 ? 20 : len === 7 ? 35 : 50 + (len - 8) * 20;
  return base + (len === sourceLen ? 50 : 0);
}

export const MAX_HINTS = 3;

export const COSTS = {
  archive: 50,
  bonus: 75,
} as const;

/** Can `word` be built from the letters of `source`? */
export function fitsLetters(word: string, source: string): boolean {
  const counts: Record<string, number> = {};
  for (const ch of source) counts[ch] = (counts[ch] || 0) + 1;
  for (const ch of word) {
    if (!counts[ch]) return false;
    counts[ch]--;
  }
  return true;
}

export function lengthHistogram(answers: string[]): Record<number, number> {
  const h: Record<number, number> = {};
  for (const a of answers) h[a.length] = (h[a.length] || 0) + 1;
  return h;
}

/** Deterministic scramble so everyone sees the same starting tiles. */
export function scramble(word: string, seed: number): string[] {
  const letters = word.toUpperCase().split('');
  let s = seed || 1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  for (let attempt = 0; attempt < 10; attempt++) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    if (letters.join('') !== word.toUpperCase()) break;
  }
  return letters;
}
