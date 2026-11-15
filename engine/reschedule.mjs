// Rebuilds the daily schedule from a given date onward with:
//  - a random difficulty every day (easy, medium, or hard), never the same one 4 days running
//  - random "3-letter days" where 3-letter answers count too (about 1 day in 4, never 3 in a row)
// Puzzles before the start date are kept exactly as they were.
//
// Usage: node reschedule.mjs 2026-11-16 400
import fs from 'node:fs';
import { candidates, mulberry32, shuffle, DICTIONARY_VERSION } from './build.mjs';

const start = process.argv[2];
const days = Number(process.argv[3] || 400);
if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error('Give a start date: YYYY-MM-DD');

const out = new URL('./out/', import.meta.url);
const existing = JSON.parse(fs.readFileSync(new URL('puzzles.json', out)));
const bonus = JSON.parse(fs.readFileSync(new URL('bonus.json', out)));
const kept = existing.filter((p) => p.puzzle_date < start).map((p) => ({ min_length: 4, ...p }));
const used = new Set([...kept.map((p) => p.word), ...bonus.map((p) => p.word)]);
const firstNumber = (kept.at(-1)?.number ?? 0) + 1;

const rnd = mulberry32(Number(start.replace(/-/g, '')) ^ 0x5eed);
const pool = shuffle(candidates().filter((p) => !used.has(p.word)), rnd);
const byTier = { easy: [], medium: [], hard: [] };
for (const p of pool) byTier[p.tier].push(p);

const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const tiers = ['easy', 'medium', 'hard'];
const recentTiers = [];
const recent3 = [];
const fresh = [];

for (let i = 0; i < days; i++) {
  let tier;
  do tier = tiers[Math.floor(rnd() * 3)];
  while (recentTiers.length >= 3 && recentTiers.slice(-3).every((t) => t === tier));
  let three = rnd() < 0.25;
  if (recent3.length >= 2 && recent3.slice(-2).every(Boolean)) three = false;

  const list = byTier[tier];
  const idx = three ? list.findIndex((p) => p.ok3) : 0;
  if (idx < 0) three = false;
  const [p] = list.splice(three ? idx : 0, 1);
  if (!p) throw new Error(`Ran out of ${tier} words`);

  recentTiers.push(tier);
  recent3.push(three);
  fresh.push({
    puzzle_date: addDays(start, i),
    number: firstNumber + i,
    word: p.word,
    definition: p.definition,
    part_of_speech: p.pos,
    tier,
    min_length: three ? 3 : 4,
    total: three ? p.total3 : p.total,
    answers: three ? p.answers3 : p.answers,
    full_anagrams: p.fullAnagrams,
    dictionary_version: DICTIONARY_VERSION,
  });
}

const all = [...kept, ...fresh];
fs.writeFileSync(new URL('puzzles.json', out), JSON.stringify(all, null, 1));
const tally = fresh.reduce((a, p) => ((a[p.tier] = (a[p.tier] || 0) + 1), a), {});
const threes = fresh.filter((p) => p.min_length === 3).length;
console.log(`Kept ${kept.length}, generated ${fresh.length} from ${start} (#${firstNumber}).`);
console.log('Tiers:', tally, `3-letter days: ${threes}`);
console.log('Next 14 days:');
for (const p of fresh.slice(0, 14)) console.log(' ', p.puzzle_date, p.tier.padEnd(6), p.min_length === 3 ? '3+' : '4+', p.word, p.total);
