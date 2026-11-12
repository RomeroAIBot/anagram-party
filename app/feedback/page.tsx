import type { Metadata } from 'next';
import FeedbackForm from '@/components/FeedbackForm';

export const metadata: Metadata = { title: 'Suggestions' };

export default function FeedbackPage() {
  return (
    <div className="page">
      <h1>Suggestions</h1>
      <p>
        Have an idea, found a bug, or think a word should count? Send it here or email{' '}
        <a href="mailto:hello@anagramparty.com">hello@anagramparty.com</a>.
      </p>
      <FeedbackForm />
    </div>
  );
}
