'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="error-page">
      <span className="eyebrow">A MOMENTARY INTERRUPTION</span>
      <h1>Let’s try that again.</h1>
      <p>
        The catalog service is temporarily unavailable. Your changes have not been silently replaced
        with sample data.
      </p>
      <button className="button dark" onClick={reset}>
        Retry connection
      </button>
      <Link className="button text" href="/">
        Return home
      </Link>
    </main>
  );
}
