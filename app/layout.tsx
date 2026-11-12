import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://anagramparty.com'),
  title: { default: 'Anagram Party, the daily word scramble', template: '%s | Anagram Party' },
  description: 'One word. Hundreds of possibilities. One daily competition. Find every word hiding inside today\'s word and climb the leaderboard.',
  openGraph: {
    title: 'Anagram Party',
    description: 'One word. Hundreds of possibilities. One daily competition.',
    siteName: 'Anagram Party',
    type: 'website',
  },
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#12163a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip">
          Skip to main content
        </a>
        <header className="site-header">
          <Link href="/" className="logo" aria-label="Anagram Party, home">
            <span aria-hidden="true" className="logo-mark">
              <span>A</span>
              <span>P</span>
            </span>
            <span className="logo-text">Anagram Party</span>
          </Link>
          <nav aria-label="Main">
            <ul>
              <li>
                <Link href="/">Play</Link>
              </li>
              <li>
                <Link href="/leaderboard">Leaderboard</Link>
              </li>
              <li>
                <Link href="/recap">Yesterday</Link>
              </li>
              <li>
                <Link href="/account">Account</Link>
              </li>
            </ul>
          </nav>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="site-footer">
          <nav aria-label="Footer">
            <ul>
              <li>
                <Link href="/how-to-play">How to play</Link>
              </li>
              <li>
                <Link href="/feedback">Suggestions</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy and terms</Link>
              </li>
              <li>
                <a href="mailto:hello@anagramparty.com">hello@anagramparty.com</a>
              </li>
            </ul>
          </nav>
          <p>Words from SCOWL. Definitions from WordNet, Princeton University.</p>
        </footer>
      </body>
    </html>
  );
}
