import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy and terms' };

// Plain-language starting point. Have it reviewed before launch.
export default function Privacy() {
  return (
    <div className="page">
      <h1>Privacy and terms</h1>
      <p className="muted">Draft. Last updated November 2026.</p>
      <div className="card">
        <h2>What we collect</h2>
        <ul>
          <li>Your email address, only to send sign-in links.</li>
          <li>Your player name, the words you find, your points, streak, and Party Tokens.</li>
          <li>Suggestions and word flags you send us.</li>
        </ul>
        <p>Guests&apos; words are saved only in their own browser. We don&apos;t sell your information or show you ads based on it.</p>
      </div>
      <div className="card">
        <h2>Who can see what</h2>
        <p>Your player name, words-found count, and points appear on public leaderboards. Your email is never shown.</p>
      </div>
      <div className="card">
        <h2>Ages</h2>
        <p>You must be 13 or older to create an account. Anyone can play as a guest.</p>
      </div>
      <div className="card">
        <h2>Fair play</h2>
        <p>Automated guessing, sharing answers during a live puzzle to game the board, or offensive player names can get an account removed from leaderboards.</p>
      </div>
      <div className="card">
        <h2>Deleting your account</h2>
        <p>
          Email <a href="mailto:support@anagramparty.com">support@anagramparty.com</a> and we&apos;ll delete your account and its data.
        </p>
      </div>
    </div>
  );
}
