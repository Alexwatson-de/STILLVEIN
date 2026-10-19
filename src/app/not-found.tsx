import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main" className="error-page">
      <span className="eyebrow">NOT IN THE ATLAS</span>
      <h1>This page isn’t available.</h1>
      <p>The material may be unpublished, archived or moved.</p>
      <Link className="button dark" href="/collection">
        Explore the collection
      </Link>
    </main>
  );
}
