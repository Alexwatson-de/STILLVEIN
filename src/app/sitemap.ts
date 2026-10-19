import { MetadataRoute } from 'next';
import { services } from '@/lib/server/firebase';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const pages = ['', '/collection', '/studio', '/contact'].map((p) => ({ url: `${base}${p}` }));
  try {
    const snap = await services()
      .db.collection('products')
      .where('status', '==', 'published')
      .limit(10000)
      .get();
    return [
      ...pages,
      ...snap.docs.map((d) => ({
        url: `${base}/materials/${d.get('slug')}`,
        lastModified: d.get('updatedAt'),
      })),
    ];
  } catch {
    return pages;
  }
}
