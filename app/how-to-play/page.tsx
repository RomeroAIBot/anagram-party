import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'How to play' };

export default function HowToPlay() {
  return (
    <div className="page">
      <h1>How to play</h1>
      <p>Every day at 1:00 AM Eastern, everyone gets the same scrambled word. Find as many real words as you can using its letters.</p>

      <div className="card">
        <h2>The rules</h2>
        <ul>
          <li>Answers usually need at least 4 letters. On random days, 3-letter words count too; the puzzle shows a &ldquo;3-letter words count&rdquo; badge when they do.</li>
          <li>Use each letter only as many times as it appears.</li>
          <li>No proper nouns, abbreviations, or hyphenated words.</li>
          <li>Wrong guesses cost nothing, and there&apos;s no guess limit.</li>
          <li>A word that uses every letter is a Full Anagram and earns a bonus.</li>
          <li>The puzzle is open all day, so you can come back as often as you like.</li>
        </ul>
      </div>

      <div className="card">
        <h2>Points</h2>
        <table className="board-table">
          <caption className="sr-only">Points per word</caption>
          <thead>
            <tr>
              <th scope="col">Word</th>
              <th scope="col" className="num">Points</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row">3 letters (3-letter days)</th><td className="num">2</td></tr>
            <tr><th scope="row">4 letters</th><td className="num">5</td></tr>
            <tr><th scope="row">5 letters</th><td className="num">10</td></tr>
            <tr><th scope="row">6 letters</th><td className="num">20</td></tr>
            <tr><th scope="row">7 letters</th><td className="num">35</td></tr>
            <tr><th scope="row">8 letters</th><td className="num">50</td></tr>
            <tr><th scope="row">Each letter past 8</th><td className="num">+20</td></tr>
            <tr><th scope="row">Full Anagram</th><td className="num">+50</td></tr>
            <tr><th scope="row">Every word found</th><td className="num">+200</td></tr>
          </tbody>
        </table>
        <p>The leaderboard ranks by words found. Points show how big your vocabulary is.</p>
      </div>

      <div className="card">
        <h2>Hints</h2>
        <p>Stuck? Press Hint and 3 answers show for 5 seconds. At least one is a word you haven&apos;t found yet, but the others might be words you already have, so stay sharp. There&apos;s no limit on hints. While a hint is showing, and for 5 seconds after it closes, the Hint button waits before it gives you another set. You can show hints for anywhere from 1 to 7 seconds under Settings on the puzzle page. Using a hint on the daily puzzle puts a &ldquo;used hints&rdquo; note next to your name on the leaderboard.</p>
      </div>

      <div className="card">
        <h2>Puzzle Room</h2>
        <p>
          Signed in? Head to the <Link href="/room">Puzzle Room</Link> for random puzzles just for fun. 3-letter words count, nothing goes on the leaderboard, and your words are saved so you can come back later. Clear the board and grab another, or press &ldquo;Give me a new puzzle&rdquo; any time to start fresh. A new puzzle starts from the beginning, so the words you found on the old one are cleared.
        </p>
      </div>

      <div className="card">
        <h2>Party Tokens</h2>
        <p>
          Signed-in players earn tokens: 25 for finding 5 words in the daily puzzle, 15 for finding half, 50 for clearing the board, 10 per Full Anagram, 100 for every 7 days in a row, and 500 at 30 days. Spend them on bonus rounds and archive puzzles from your <Link href="/account">account page</Link>.
        </p>
      </div>

      <div className="card">
        <h2>Playing with a screen reader or keyboard</h2>
        <p>Type in the answer field and press Enter. Every result is announced, along with how many words you&apos;ve found.</p>
        <ul>
          <li><kbd>Escape</kbd> clears your answer.</li>
          <li><kbd>Alt</kbd> + <kbd>S</kbd> shuffles the letters.</li>
          <li><kbd>Alt</kbd> + <kbd>H</kbd> uses a hint. Screen readers hear the three words once.</li>
          <li><kbd>Alt</kbd> + <kbd>L</kbd> reads the letters.</li>
          <li><kbd>Alt</kbd> + <kbd>R</kbd> reads how many words are left at each length.</li>
          <li><kbd>Alt</kbd> + <kbd>B</kbd> jumps to your found words, grouped by length.</li>
          <li><kbd>Alt</kbd> + <kbd>W</kbd> jumps back to the answer field.</li>
          <li><kbd>Alt</kbd> + <kbd>M</kbd> mutes or unmutes sound.</li>
        </ul>
        <p>On a Mac, use Option instead of Alt. Sounds tell you what happened too: a pop for a correct word, a short buzz for a miss, and a dull thud for a word you already found.</p>
      </div>
      <p>
        <Link href="/">Start today&apos;s party</Link>
      </p>
    </div>
  );
}
