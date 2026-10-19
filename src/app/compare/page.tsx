'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header, Footer } from '@/components/chrome';
import { Product, defaultSettings, SiteSettings } from '@/lib/schema';
import { api } from '@/lib/client';
import { imageUrl, priceLabel } from '@/lib/catalog';
export default function Compare() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    api<SiteSettings>('settings')
      .then(setSettings)
      .catch(() => {});
    let ids: string[] = [];
    try {
      ids = JSON.parse(localStorage.getItem('stillvein.compare') || '[]');
    } catch {}
    if (!ids.length) {
      setLoading(false);
      return;
    } // Resolve selected IDs on server without downloading the full catalog.
    Promise.all(
      ids.slice(0, 3).map((id) =>
        fetch(`/api/compare/${encodeURIComponent(id)}`).then(async (r) => {
          if (!r.ok) return null;
          return r.json() as Promise<Product>;
        }),
      ),
    )
      .then((ps) => setProducts(ps.filter((p): p is Product => !!p)))
      .catch(() => setError('Comparison could not load. Please try again.'))
      .finally(() => setLoading(false));
  }, []);
  return (
    <>
      <Header settings={settings} />
      <main id="main">
        <div className="page-heading">
          <span className="eyebrow">SIDE BY SIDE</span>
          <h1>A considered comparison.</h1>
          <p>Compare up to three materials. Only published materials are shown.</p>
        </div>
        <section className="section" style={{ paddingTop: 0 }}>
          {error && <div className="notice">{error}</div>}
          {loading ? (
            <p>Loading your selection…</p>
          ) : products.length ? (
            <div className="compare-grid">
              {products.map((p) => (
                <article className="compare-column" key={p.id}>
                  {p.galleryImages[0] && (
                    <img src={imageUrl(p.galleryImages[0].url, 800)} alt={p.galleryImages[0].alt} />
                  )}
                  <h2>{p.name}</h2>
                  <Link className="text-link" href={`/materials/${p.slug}`}>
                    Explore material ↗
                  </Link>
                  {Object.entries({
                    Price: priceLabel(p),
                    Type: p.stoneType,
                    Colour: p.colour,
                    Finish: p.finish,
                    Pattern: p.pattern,
                    Origin: p.origin || 'Not specified',
                    Dimensions: `${p.dimensions.length} × ${p.dimensions.width} mm`,
                    Thickness: `${p.thicknesses.join(', ')} mm`,
                    Applications: p.applications.join(', '),
                    Availability: p.availability,
                    Data: p.isSample ? 'Illustrative sample' : 'Catalog record',
                  }).map(([key, value]) => (
                    <div className="compare-row" key={key}>
                      <span>{key}</span>
                      {value}
                    </div>
                  ))}
                  <button
                    className="text-link"
                    onClick={() => {
                      const remaining = products.filter((x) => x.id !== p.id);
                      setProducts(remaining);
                      localStorage.setItem(
                        'stillvein.compare',
                        JSON.stringify(remaining.map((x) => x.id)),
                      );
                      window.dispatchEvent(new Event('compare-change'));
                    }}
                  >
                    Remove from comparison
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <h2>Give your ideas some company.</h2>
              <p>Use the Compare button on a material card to build a side-by-side selection.</p>
              <Link href="/collection" className="button dark">
                Explore the collection
              </Link>
            </div>
          )}
        </section>
      </main>
      <Footer settings={settings} />
    </>
  );
}
