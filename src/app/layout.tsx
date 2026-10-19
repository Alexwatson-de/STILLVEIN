import type { Metadata } from 'next';
import './globals.css';
import './revolution.css';
import { CinematicAtmosphere } from '@/components/cinematic-atmosphere';
export const dynamic = 'force-dynamic';
import { settings } from '@/lib/server/data';
import { defaultSettings } from '@/lib/schema';
export async function generateMetadata(): Promise<Metadata> {
  const s = await settings().catch(() => defaultSettings);
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: { default: `${s.brand} — ${s.tagline}`, template: `%s | ${s.brand}` },
    description: s.seoDescription,
    robots: { index: true, follow: true },
    openGraph: { siteName: s.brand, title: s.brand, description: s.seoDescription },
  };
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
        <CinematicAtmosphere />
      </body>
    </html>
  );
}
