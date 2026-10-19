import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { publicProduct, catalog, settings } from '@/lib/server/data';
import { defaultSettings } from '@/lib/schema';
import { Header, Footer } from '@/components/chrome';
import { Gallery } from '@/components/gallery';
import { ProductActions } from '@/components/enquiry-form';
import { ProductCard } from '@/components/product-card';
import { ViewerLauncher } from '@/components/viewer-launcher';
import { priceLabel } from '@/lib/catalog';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await publicProduct(slug).catch(() => null);
  if (!p) return { title: 'Material unavailable', robots: { index: false } };
  return {
    title: p.seoTitle || p.name,
    description: p.seoDescription || p.shortDescription,
    alternates: { canonical: `/materials/${p.slug}` },
    openGraph: {
      title: p.name,
      description: p.shortDescription,
      images: p.galleryImages[0]
        ? [{ url: p.galleryImages[0].url, alt: p.galleryImages[0].alt }]
        : [],
    },
  };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await publicProduct(slug);
  if (!p) notFound();
  const s = await settings().catch(() => defaultSettings);
  const candidates = (await catalog(new URLSearchParams({ category: p.categoryId, limit: '12' })))
    .products;
  const related = candidates
    .filter((r) => r.id !== p.id)
    .sort(
      (a, b) =>
        Number(p.relatedIds.includes(b.id)) - Number(p.relatedIds.includes(a.id)) ||
        Number(b.colour === p.colour) - Number(a.colour === p.colour),
    )
    .slice(0, 3);
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      sku: p.sku,
      description: p.description,
      image: p.galleryImages.map((i) => i.url),
      material: p.stoneType,
      color: p.colour,
      url: `${base}/materials/${p.slug}`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Collection', item: `${base}/collection` },
        { '@type': 'ListItem', position: 2, name: p.name, item: `${base}/materials/${p.slug}` },
      ],
    },
  ];
  return (
    <>
      <Header settings={s} />
      <main id="main">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
        />
        <div className="breadcrumb">
          <Link href="/">Home</Link> / <Link href="/collection">Collection</Link> /{' '}
          <span>{p.name}</span>
        </div>
        <section className="detail-layout">
          <Gallery images={p.galleryImages} />
          <div className="detail-copy">
            <span className="eyebrow">
              {p.stoneType} / {p.sku}
            </span>
            <h1>{p.name}</h1>
            <p className="lead">{p.shortDescription}</p>
            {p.isSample && (
              <p className="notice">
                Sample catalog material. Specifications and any prices are illustrative, not
                verified supplier data.
              </p>
            )}
            <div className="detail-price">
              {priceLabel(p)}
              <span className="badge" style={{ float: 'right', marginTop: 8 }}>
                {p.availability}
              </span>
            </div>
            <dl className="spec-grid">
              {Object.entries({
                Finish: p.finish,
                Colour: [p.colour, ...p.tones].filter(Boolean).join(' / '),
                Pattern: p.pattern,
                Origin: p.origin || 'Not specified',
                Dimensions: `${p.dimensions.length} × ${p.dimensions.width} mm`,
                Thickness: `${p.thicknesses.join(' / ')} mm`,
                Classification: p.classification || p.stoneType,
                Applications: p.applications.join(', '),
                ...p.attributes,
              }).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <ProductActions product={p} />
            <details open>
              <summary>About this material</summary>
              <p style={{ whiteSpace: 'pre-line' }}>{p.description}</p>
            </details>
            <details>
              <summary>Care & maintenance</summary>
              <p>
                {p.care ||
                  'Confirm care guidance with a qualified stone specialist before installation.'}
              </p>
            </details>
          </div>
        </section>
        <section className="section" style={{ paddingTop: 10 }}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">TEXTURE IN CONTEXT</span>
              <h2>A different perspective.</h2>
            </div>
            <p>Explore the surface. Rotate, zoom and change the light.</p>
          </div>
          <ViewerLauncher product={p} />
        </section>
        {related.length > 0 && (
          <section className="section">
            <div className="section-heading">
              <h2>A similar sensibility.</h2>
              <Link className="text-link" href="/collection">
                Explore more →
              </Link>
            </div>
            <div className="product-grid">
              {related.map((r) => (
                <ProductCard key={r.id} product={r} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer settings={s} />
    </>
  );
}
