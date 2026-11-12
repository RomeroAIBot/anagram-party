'use client';
import { useState } from 'react';

export default function FeedbackForm() {
  const [kind, setKind] = useState<'suggestion' | 'flag'>('suggestion');
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    const body =
      kind === 'flag'
        ? { kind: 'flag', word: f.get('word'), note: f.get('message') }
        : { kind: 'suggestion', category: f.get('category'), message: f.get('message') };
    const res = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? 'Something went wrong. Try again.');
    setDone(kind === 'flag' ? 'Thanks. We review every word and changes apply to future puzzles.' : 'Thanks! We read every suggestion.');
    form.reset();
  }

  return (
    <form className="form card" onSubmit={onSubmit}>
      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        <legend style={{ fontWeight: 700, marginBottom: 6 }}>What are you sending?</legend>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 400 }}>
          <input type="radio" name="kind" checked={kind === 'suggestion'} onChange={() => setKind('suggestion')} /> An idea or a problem
        </label>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 400 }}>
          <input type="radio" name="kind" checked={kind === 'flag'} onChange={() => setKind('flag')} /> A word that should count
        </label>
      </fieldset>
      {kind === 'suggestion' ? (
        <label>
          Type
          <select name="category" defaultValue="idea">
            <option value="idea">Idea</option>
            <option value="bug">Something&apos;s broken</option>
            <option value="accessibility">Accessibility</option>
            <option value="other">Other</option>
          </select>
        </label>
      ) : (
        <label>
          The word
          <input type="text" name="word" required minLength={4} maxLength={15} autoComplete="off" />
        </label>
      )}
      <label>
        {kind === 'flag' ? 'Anything we should know? (optional)' : 'Your message'}
        <textarea name="message" required={kind === 'suggestion'} maxLength={2000} />
      </label>
      {error && (
        <p className="notice notice-err" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="notice notice-ok" role="status">
          {done}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}
