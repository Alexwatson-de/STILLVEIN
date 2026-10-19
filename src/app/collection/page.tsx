import { Suspense } from 'react';
import { Header, Footer } from '@/components/chrome';
import { Catalog } from '@/components/catalog';
import { settings } from '@/lib/server/data';
import { defaultSettings } from '@/lib/schema';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'The collection',
  description: 'Explore and filter natural stone by finish, colour, application and specification.',
};
export default async function Page() {
  const s = await settings().catch(() => defaultSettings);
  return (
    <>
      <Header settings={s} />
      <main id="main">
        <div className="page-heading">
          <span className="eyebrow">THE MATERIAL ATLAS</span>
          <h1>The collection.</h1>
          <p>Extraordinary surfaces. A world of possibility.</p>
        </div>
        <Suspense fallback={<p className="section">Loading collection…</p>}>
          <Catalog />
        </Suspense>
      </main>
      <Footer settings={s} />
    </>
  );
}
