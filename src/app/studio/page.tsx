import { Suspense } from 'react';
import { Header, Footer } from '@/components/chrome';
import { Studio } from '@/components/studio';
import { settings } from '@/lib/server/data';
import { defaultSettings } from '@/lib/schema';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Interactive material studio' };
export default async function Page() {
  const s = await settings().catch(() => defaultSettings);
  return (
    <>
      <Header settings={s} />
      <main id="main">
        <div className="page-heading">
          <span className="eyebrow">TEXTURE. FORM. A DIFFERENT PERSPECTIVE.</span>
          <h1>The material studio.</h1>
          <p>Real textures. Reusable forms. A little room for imagination.</p>
        </div>
        <Suspense fallback={<div className="empty">Loading studio…</div>}>
          <Studio />
        </Suspense>
      </main>
      <Footer settings={s} />
    </>
  );
}
