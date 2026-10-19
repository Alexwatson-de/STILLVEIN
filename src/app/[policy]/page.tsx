import { notFound } from 'next/navigation';
import { Header, Footer } from '@/components/chrome';
import { settings } from '@/lib/server/data';
import { defaultSettings } from '@/lib/schema';
export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ policy: string }> }) {
  const { policy } = await params;
  if (!['privacy', 'terms'].includes(policy)) notFound();
  const s = await settings().catch(() => defaultSettings);
  return (
    <>
      <Header settings={s} />
      <main id="main" className="policy">
        <span className="eyebrow">THE MATERIAL ATLAS</span>
        <h1>{policy === 'privacy' ? 'Privacy policy' : 'Terms of use'}</h1>
        <p>{policy === 'privacy' ? s.privacyText : s.termsText}</p>
      </main>
      <Footer settings={s} />
    </>
  );
}
