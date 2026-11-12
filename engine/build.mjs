// Anagram Party word engine.
// Builds the accepted-answer dictionary, finds every valid answer for a source word,
// rates difficulty, and generates a dated schedule of daily puzzles.
//
// Usage: node build.mjs [startDate YYYY-MM-DD] [days]
// Output: out/puzzles.json, out/puzzles.sql

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const WL = path.join(ROOT, 'node_modules/wordlist-english');
const WN = path.join(ROOT, 'node_modules/wordnet-db/dict');

export const DICTIONARY_VERSION = 'scowl-50-v1';
const MIN_ANSWER = 4;
const TIERS = [10, 20, 35, 40, 50];

// ---------- Blocklist ----------
const extraBlock = [
  'nazi', 'nazis', 'rape', 'raped', 'rapes', 'rapist', 'slut', 'sluts', 'whore', 'whores',
  'dick', 'dicks', 'cock', 'cocks', 'tits', 'piss', 'pissed', 'shit', 'shits', 'fuck',
  'cunt', 'twat', 'wank', 'homo', 'homos', 'dyke', 'dykes', 'fags', 'faggot', 'spic',
  'spics', 'kike', 'kikes', 'gook', 'gooks', 'coon', 'coons', 'negro', 'negroes', 'retard',
  'retards', 'tranny', 'bitch', 'bitches', 'bastard', 'bastards', 'damn', 'damned', 'hell',
  'arse', 'arses', 'anal', 'anus', 'penis', 'vagina', 'semen', 'orgasm', 'porn', 'porno',
  'nude', 'nudes', 'sexy', 'boob', 'boobs', 'butt', 'butts', 'crap', 'kill', 'kills',
  'killer', 'murder', 'suicide', 'corpse', 'dildo', 'dildos', 'horny', 'erotic', 'pimp',
  'pimps', 'hooker', 'hookers', 'heroin', 'cocaine', 'jihad', 'slave', 'slaves', 'lynch',
];
const naughty = require('naughty-words/en.json').filter((w) => /^[a-z]+$/.test(w));
export const BLOCK = new Set([...naughty, ...extraBlock]);

// ---------- Dictionary ----------
const tierOf = new Map();
for (const t of TIERS) {
  for (const prefix of ['english', 'american']) {
    const list = JSON.parse(fs.readFileSync(path.join(WL, `${prefix}-words-${t}.json`), 'utf8'));
    for (const w of list) {
      if (!/^[a-z]+$/.test(w)) continue; // drops proper nouns, apostrophes, hyphens
      if (w.length < MIN_ANSWER) continue;
      if (BLOCK.has(w)) continue;
      if (!tierOf.has(w)) tierOf.set(w, t);
    }
  }
}
export const DICT = tierOf;

function counts(word) {
  const c = new Uint8Array(26);
  for (let i = 0; i < word.length; i++) c[word.charCodeAt(i) - 97]++;
  return c;
}
const dictEntries = [...tierOf.entries()].map(([w, t]) => ({ w, t, c: counts(w) }));

export function findAnswers(source) {
  const sc = counts(source);
  const out = [];
  outer: for (const e of dictEntries) {
    if (e.w.length > source.length) continue;
    for (let i = 0; i < 26; i++) if (e.c[i] > sc[i]) continue outer;
    out.push(e);
  }
  return out;
}

// ---------- WordNet definitions ----------
const POS = { noun: 'n', verb: 'v', adj: 'adj', adv: 'adv' };
const POS_LABEL = { noun: 'noun', verb: 'verb', adj: 'adjective', adv: 'adverb' };
const wnIndex = {};
const wnData = {};
for (const pos of Object.keys(POS)) {
  wnData[pos] = fs.readFileSync(path.join(WN, `data.${pos}`));
  const idx = new Map();
  for (const line of fs.readFileSync(path.join(WN, `index.${pos}`), 'utf8').split('\n')) {
    if (!line || line.startsWith(' ')) continue;
    const parts = line.trim().split(' ');
    const lemma = parts[0];
    const pCnt = Number(parts[3]);
    const senseCnt = Number(parts[4 + pCnt]);
    const tagCnt = Number(parts[5 + pCnt]);
    const offsets = parts.slice(6 + pCnt, 6 + pCnt + senseCnt);
    idx.set(lemma, { tagCnt, offsets });
  }
  wnIndex[pos] = idx;
}

function glossAt(pos, offset) {
  const buf = wnData[pos];
  const start = Number(offset);
  const end = buf.indexOf(10, start);
  const line = buf.subarray(start, end).toString('utf8');
  const g = line.split(' | ')[1] || '';
  const def = g.split(/;\s*"/)[0].split('; ')[0].trim();
  return def;
}

export function define(word) {
  let best = null;
  for (const pos of Object.keys(POS)) {
    const e = wnIndex[pos].get(word);
    if (!e) continue;
    if (!best || e.tagCnt > best.e.tagCnt) best = { pos, e };
  }
  if (!best) return null;
  const def = glossAt(best.pos, best.e.offsets[0]);
  if (!def || def.length < 8) return null;
  return { pos: POS_LABEL[best.pos], definition: def.charAt(0).toUpperCase() + def.slice(1) + '.' };
}

// ---------- Difficulty ----------
export function rate(source) {
  const answers = findAnswers(source);
  const total = answers.length;
  const common = answers.filter((a) => a.t <= 35).length;
  const commonShare = total ? common / total : 0;
  const full = answers.filter((a) => a.w.length === source.length);
  let tier = null;
  if (total >= 15 && total <= 30 && commonShare >= 0.8 && full.length >= 1) tier = 'easy';
  else if (total >= 31 && total <= 60 && commonShare >= 0.65) tier = 'medium';
  else if (total >= 61 && total <= 100) tier = 'hard';
  return {
    tier,
    total,
    answers: answers.map((a) => a.w).sort((x, y) => x.length - y.length || x.localeCompare(y)),
    fullAnagrams: full.map((a) => a.w),
  };
}

// ---------- Candidate source words ----------
function candidates() {
  const pool = [];
  for (const [w, t] of tierOf) {
    if (t > 35) continue;
    if (w.length < 6 || w.length > 11) continue;
    if (/s$/.test(w) && !/ss$/.test(w)) continue; // skip most plurals
    if (/(ed|ing)$/.test(w) && w.length < 9) continue; // skip short inflections
    const d = define(w);
    if (!d) continue;
    const r = rate(w);
    if (!r.tier) continue;
    pool.push({ word: w, ...d, ...r });
  }
  return pool;
}

// Deterministic shuffle so the schedule is reproducible.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Easy Mon/Tue, Medium Wed-Fri, Hard Sat, wildcard Sun.
const WEEK = ['wild', 'easy', 'easy', 'medium', 'medium', 'medium', 'hard'];

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function schedule(startDate, days, firstNumber = 1, used = new Set()) {
  const rnd = mulberry32(20261112);
  const pool = shuffle(candidates(), rnd);
  const byTier = { easy: [], medium: [], hard: [] };
  for (const p of pool) if (!used.has(p.word)) byTier[p.tier].push(p);
  const tiers = ['easy', 'medium', 'hard'];
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const dow = new Date(date + 'T12:00:00Z').getUTCDay();
    let tier = WEEK[dow];
    if (tier === 'wild') tier = tiers[Math.floor(rnd() * 3)];
    const p = byTier[tier].shift();
    if (!p) throw new Error(`Ran out of ${tier} words at ${date}`);
    out.push({
      puzzle_date: date,
      number: firstNumber + i,
      word: p.word,
      definition: p.definition,
      part_of_speech: p.pos,
      tier,
      total: p.total,
      answers: p.answers,
      full_anagrams: p.fullAnagrams,
      dictionary_version: DICTIONARY_VERSION,
    });
  }
  return { puzzles: out, poolSizes: Object.fromEntries(tiers.map((t) => [t, byTier[t].length])) };
}

// ---------- CLI ----------
if (process.argv[1] && process.argv[1].endsWith('build.mjs')) {
  const start = process.argv[2] || '2026-11-12';
  const days = Number(process.argv[3] || 400);
  const { puzzles, poolSizes } = schedule(start, days);
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'out/puzzles.json'), JSON.stringify(puzzles, null, 1));
  const esc = (s) => s.replace(/'/g, "''");
  const rows = puzzles.map(
    (p) =>
      `('${p.puzzle_date}',${p.number},'${p.word}','${esc(p.definition)}','${p.part_of_speech}','${p.tier}',${p.total},'${esc(JSON.stringify(p.answers))}'::jsonb,'${esc(JSON.stringify(p.full_anagrams))}'::jsonb,'${p.dictionary_version}')`,
  );
  const chunks = [];
  for (let i = 0; i < rows.length; i += 50) {
    chunks.push(
      `insert into public.puzzles (puzzle_date, number, word, definition, part_of_speech, tier, total, answers, full_anagrams, dictionary_version) values\n${rows.slice(i, i + 50).join(',\n')}\non conflict (puzzle_date) do nothing;`,
    );
  }
  fs.writeFileSync(path.join(ROOT, 'out/puzzles.sql'), chunks.join('\n\n'));
  console.log(`Dictionary: ${tierOf.size} words. Generated ${puzzles.length} puzzles from ${start}.`);
  console.log('Remaining unused pool:', poolSizes);
  const tally = puzzles.reduce((a, p) => ((a[p.tier] = (a[p.tier] || 0) + 1), a), {});
  console.log('Tier mix:', tally);
  for (const p of puzzles.slice(0, 8)) console.log(p.puzzle_date, p.tier, p.word, p.total, '|', p.definition);
}

// ---------- Bonus pool (unranked token rounds) ----------
export function bonusPool(count, exclude) {
  const rnd = mulberry32(777);
  const pool = shuffle(candidates().filter((p) => !exclude.has(p.word)), rnd).slice(0, count);
  return pool.map((p) => ({
    kind: 'bonus', word: p.word, definition: p.definition, part_of_speech: p.pos, tier: p.tier,
    total: p.total, answers: p.answers, full_anagrams: p.fullAnagrams, dictionary_version: DICTIONARY_VERSION,
  }));
}
