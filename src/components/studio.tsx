'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { api } from '@/lib/client';
import { Product } from '@/lib/schema';
import { imageUrl, priceLabel } from '@/lib/catalog';
import { ViewerLauncher } from './viewer-launcher';
export function Studio() {
  const params = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const c = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      api<{ products: Product[]; nextCursor: string | null }>(
        `catalog?limit=12&q=${encodeURIComponent(query)}`,
        { signal: c.signal },
      )
        .then((r) => {
          setProducts(r.products);
          setCursor(r.nextCursor);
        })
        .catch((e) => {
          if (e.name !== 'AbortError') setError(e.message);
        })
        .finally(() => {
          if (!c.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [query]);
  const slug = params.get('material');
  useEffect(() => {
    if (slug) {
      api<Product>(`products/${encodeURIComponent(slug)}`)
        .then(setProduct)
        .catch((e) => setError(e.message));
    } else if (products[0]) setProduct(products[0]);
  }, [slug, products]);
  return (
    <div className="studio-page">
      <aside className="studio-picker">
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="Find studio material"
            placeholder="Find a material…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {products.map((p) => (
          <button
            className={`studio-pick ${product?.id === p.id ? 'active' : ''}`}
            key={p.id}
            onClick={() => router.replace(`/studio?material=${p.slug}`, { scroll: false })}
          >
            {p.galleryImages[0] && (
              <img src={imageUrl(p.galleryImages[0].url, 150)} alt={p.galleryImages[0].alt} />
            )}
            <span>
              <strong>{p.name}</strong>
              <small>
                {p.stoneType} / {p.finish}
                {!p.texture ? ' · No texture' : ''}
              </small>
            </span>
          </button>
        ))}
        {loading && <p>Loading materials…</p>}
        {cursor && (
          <button
            className="text-link"
            onClick={async () => {
              try {
                const r = await api<{ products: Product[]; nextCursor: string | null }>(
                  `catalog?limit=12&q=${encodeURIComponent(query)}&cursor=${cursor}`,
                );
                setProducts((p) => [...p, ...r.products]);
                setCursor(r.nextCursor);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Load more materials →
          </button>
        )}
      </aside>
      <section>
        {error && (
          <div className="notice" role="alert">
            {error}
          </div>
        )}
        {product ? (
          <>
            <ViewerLauncher key={product.id} product={product} auto />
            <div className="studio-info">
              <div>
                <h2>{product.name}</h2>
                <p>
                  {product.finish} / {priceLabel(product)}
                  {product.isSample ? ' · Sample material' : ''}
                </p>
              </div>
              <Link className="button" href={`/materials/${product.slug}`}>
                Specifications & enquiry ↗
              </Link>
            </div>
          </>
        ) : (
          !loading && <div className="empty">No materials are available yet.</div>
        )}
      </section>
    </div>
  );
}
