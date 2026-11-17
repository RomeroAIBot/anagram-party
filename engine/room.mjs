// Puzzle Room pool: casual, unranked puzzles where 3-letter words count.
// Skips every word used by the daily schedule and the bonus rounds so nothing is spoiled.
// Usage: node room.mjs   -> out/room.json, out/room.sql
import fs from 'node:fs';
import { candidates, DICTIONARY_VERSION, mulberry32, shuffle } from './build.mjs';
const read = (f) => JSON.parse(fs.readFileSync(new URL(`./out/${f}`, import.meta.url)));
const used = new Set([...read('puzzles.json'), ...read('bonus.json')].map((p) => p.word));
const pool = shuffle(candidates().filter((p) => !used.has(p.word) && p.ok3), mulberry32(4242));
const room = pool.map((p) => ({
  word: p.word, definition: p.definition, part_of_speech: p.pos, tier: p.tier,
  total: p.total3, answers: p.answers3, full_anagrams: p.fullAnagrams, dictionary_version: DICTIONARY_VERSION,
}));
const esc = (s) => s.replace(/'/g, "''");
const rows = room.map((p) => `('${p.word}','${esc(p.definition)}','${p.part_of_speech}','${p.tier}',${p.total},'${esc(JSON.stringify(p.answers))}'::jsonb,'${esc(JSON.stringify(p.full_anagrams))}'::jsonb,'${p.dictionary_version}')`);
const chunks = [];
for (let i = 0; i < rows.length; i += 100) chunks.push(`insert into public.room_puzzles (word, definition, part_of_speech, tier, total, answers, full_anagrams, dictionary_version) values\n${rows.slice(i, i + 100).join(',\n')}\non conflict (word) do nothing;`);
fs.writeFileSync(new URL('./out/room.sql', import.meta.url), chunks.join('\n\n'));
fs.writeFileSync(new URL('./out/room.json', import.meta.url), JSON.stringify(room));
console.log('room puzzles', room.length, room.reduce((a, p) => ((a[p.tier] = (a[p.tier] || 0) + 1), a), {}), 'answers min/max', Math.min(...room.map(p=>p.total)), Math.max(...room.map(p=>p.total)));
