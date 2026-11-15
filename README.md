# Anagram Party

Daily anagram word game at anagramparty.com. Next.js on Vercel, Supabase for accounts and data.

## How it works

- A new puzzle goes live every day at 1:00 AM Eastern. The active date is computed in `lib/time.ts`; no scheduler is needed because puzzles are generated months ahead.
- The browser never receives the source word or the answer list. Every guess is checked on the server (`app/api/guess`), and signed-in guesses are scored by the `submit_word` database function so points, tokens, and streaks can't be faked.
- Guests can play; their words are kept in the browser and move into their account when they sign in.
- All tables have row level security on with no public policies. Only the server, using the service role key, reads or writes them.

## Environment variables (Vercel and `.env.local`)

| Name | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API (publishable key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API (secret; server only) |
| `NEXT_PUBLIC_SITE_URL` | `https://anagramparty.com` |

## Supabase setup

1. Run `supabase/migrations/0001_anagram_party.sql`.
2. Load puzzles: `engine/out/puzzles.sql` (daily schedule) and `engine/out/bonus.sql` (token bonus rounds).
3. Authentication > URL Configuration: set Site URL to `https://anagramparty.com` and add `https://anagramparty.com/auth/callback` (plus the Vercel preview URL) to Redirect URLs.
4. Authentication > Emails: before launch, set up custom SMTP so sign-in emails come from hello@anagramparty.com and aren't rate limited.

## Word engine (`engine/`)

```
cd engine && npm install
node build.mjs 2026-11-12 400   # start date, number of days
node bonus.mjs 300              # bonus round pool
```

- Accepted answers: SCOWL size 50 and below (English + American), lowercase only, 4+ letters, blocklist removed. About 60,000 words.
- Definitions: WordNet 3.1.
- Tiers come from the answer count and how common the answers are: Easy 15 to 30, Medium 31 to 60, Hard 61 to 100.
- `node reschedule.mjs YYYY-MM-DD 400` rebuilds the schedule from that date, keeping earlier days: a random tier each day (never the same 4 days running) and random 3-letter days, about 1 in 4, never 3 in a row. On 3-letter days, common 3-letter words count and score 2 points.
- The daily loader job only adds dates that don't exist yet. To replace future days, delete them first (`delete from puzzles where kind='daily' and puzzle_date > current date`) and run the loader.
- Dictionary changes apply to future puzzles only.

## Local demo without a database

```
npm install
AP_DEMO=1 npm run build && AP_DEMO=1 npm start
```

Reads `engine/out/puzzles.json`. Guest play only. Never set `AP_DEMO` in production.

## Sounds

`lib/sound.ts` synthesizes the free Balloon Party pack with the Web Audio API: type (3 variations), remove, shuffle, correct (pitch climbs with word length), wrong, already found, full anagram, milestone, board cleared. Recorded packs can replace these behind the same `play()` calls.
