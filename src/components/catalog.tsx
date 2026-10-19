'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Grid2X2, List, SlidersHorizontal, X } from 'lucide-react';
import { api } from '@/lib/client';
import { Product, Taxonomy } from '@/lib/schema';
import { filterKeys } from '@/lib/catalog';
import { ProductCard } from './product-card';
export function Catalog() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.toString();
  const [input, setInput] = useState(params.get('q') || '');
  const [products, setProducts] = useState<Product[]>([]);
  const [types, setTypes] = useState<Taxonomy[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [limited, setLimited] = useState(false);
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  function change(key: string, value: string) {
    const s = new URLSearchParams(query);
    if (value) s.set(key, value);
    else s.delete(key);
    if (key !== 'cursor' && key !== 'view') s.delete('cursor');
    router.replace(`/collection?${s}`, { scroll: false });
  }
  useEffect(() => {
    setInput(params.get('q') || '');
  }, [params]);
  useEffect(() => {
    if (input === (params.get('q') || '')) return;
    const timer = setTimeout(() => {
      const s = new URLSearchParams(query);
      if (input) s.set('q', input);
      else s.delete('q');
      s.delete('cursor');
      router.replace(`/collection?${s}`, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [input, params, query, router]);
  useEffect(() => {
    api<Taxonomy[]>('taxonomy')
      .then(setTypes)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError('');
    api<{ products: Product[]; nextCursor: string | null; total: number; searchLimited: boolean }>(
      `catalog?${query}`,
      { signal: c.signal },
    )
      .then((r) => {
        setProducts(r.products);
        setNext(r.nextCursor);
        setTotal(r.total);
        setLimited(r.searchLimited);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [query, retry]);
  const active = filterKeys.filter((k) => params.has(k));
  const select = (key: string, label: string, options: { value: string; label: string }[]) => (
    <label key={key}>
      {label}
      <select
        aria-label={label}
        value={params.get(key) || ''}
        onChange={(e) => change(key, e.target.value)}
      >
        <option value="">All {label.toLowerCase()}</option>
        {options.map((o) => (
          <option value={o.value} key={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  const opts = (xs: string[]) => xs.map((x) => ({ label: x, value: x }));
  return (
    <div className="catalog-layout">
      <div className="catalog-toolbar">
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="Search materials"
            placeholder="Search materials, colours, references…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            list="search-suggestions"
          />
          <datalist id="search-suggestions">
            {products.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        </div>
        <button className="button mobile-filters" onClick={() => setOpen(!open)}>
          <SlidersHorizontal size={16} /> Filters
        </button>
        <label className="sort-label">
          Sort by{' '}
          <select
            aria-label="Sort materials"
            value={params.get('sort') || 'relevance'}
            onChange={(e) => change('sort', e.target.value)}
          >
            <option value="relevance">Relevance</option>
            <option value="name">Name A–Z</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="newest">Newest additions</option>
          </select>
        </label>
        <div className="view-switch">
          <button
            aria-label="Grid view"
            aria-pressed={params.get('view') !== 'list'}
            onClick={() => change('view', '')}
          >
            <Grid2X2 size={18} />
          </button>
          <button
            aria-label="List view"
            aria-pressed={params.get('view') === 'list'}
            onClick={() => change('view', 'list')}
          >
            <List size={18} />
          </button>
        </div>
      </div>
      <aside className={`filters ${open ? 'is-open' : ''}`}>
        <div className="filter-title">
          <b>Refine collection</b>
          <SlidersHorizontal size={16} />
        </div>
        {select(
          'category',
          'Stone category',
          types.filter((t) => t.kind === 'category').map((t) => ({ value: t.id, label: t.name })),
        )}
        {select(
          'colour',
          'Colour',
          types.filter((t) => t.kind === 'colour').map((t) => ({ value: t.name, label: t.name })),
        )}
        {select(
          'finish',
          'Finish',
          types.filter((t) => t.kind === 'finish').map((t) => ({ value: t.name, label: t.name })),
        )}
        {select(
          'pattern',
          'Pattern',
          types.filter((t) => t.kind === 'pattern').map((t) => ({ value: t.name, label: t.name })),
        )}
        {select(
          'application',
          'Application',
          types
            .filter((t) => t.kind === 'application')
            .map((t) => ({ value: t.name, label: t.name })),
        )}
        {select(
          'availability',
          'Availability',
          opts(['Available', 'Limited', 'On request', 'Unavailable']),
        )}
        <details>
          <summary>Dimensions, origin & price</summary>
          {['type', 'tone', 'origin'].map((k) => (
            <label key={k}>
              {k}
              <input
                value={params.get(k) || ''}
                onChange={(e) => change(k, e.target.value)}
                placeholder={`Any ${k}`}
              />
            </label>
          ))}
          {[
            ['thickness', 'Thickness (mm)'],
            ['length', 'Min. length (mm)'],
            ['width', 'Min. width (mm)'],
            ['min', 'Minimum price'],
            ['max', 'Maximum price'],
          ].map(([k, l]) => (
            <label key={k}>
              {l}
              <input
                type="number"
                min="0"
                value={params.get(k) || ''}
                onChange={(e) => change(k, e.target.value)}
                placeholder="Any"
              />
            </label>
          ))}
        </details>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={params.get('featured') === 'true'}
            onChange={(e) => change('featured', e.target.checked ? 'true' : '')}
          />{' '}
          Curated / featured only
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={params.get('recent') === 'true'}
            onChange={(e) => change('recent', e.target.checked ? 'true' : '')}
          />{' '}
          Added in the last 30 days
        </label>
        <button className="text-link" onClick={() => router.replace('/collection')}>
          Clear all filters <X size={14} />
        </button>
        <p className="filter-note">
          Natural variation is part of the beauty. Images are representative; confirm the actual
          slab before specification.
        </p>
      </aside>
      <section className="catalog-results">
        <div className="results-line">
          <span aria-live="polite">
            {loading
              ? 'Finding your materials…'
              : `${products.length} materials on this page · ${total} in the atlas`}
          </span>
          <span>SELECTED BY NATURE</span>
        </div>
        {active.length > 0 && (
          <div className="filter-chips">
            {active.map((k) => (
              <button key={k} onClick={() => change(k, '')}>
                {k}: {params.get(k)} <X size={12} />
              </button>
            ))}
          </div>
        )}
        {error ? (
          <div className="notice" role="alert">
            {error}
            <button onClick={() => setRetry((v) => v + 1)}>Retry</button>
          </div>
        ) : loading ? (
          <div className="skeleton-grid">
            {[1, 2, 3].map((i) => (
              <div className="skeleton" key={i} />
            ))}
          </div>
        ) : (
          <>
            <div className={`product-grid ${params.get('view') === 'list' ? 'list-view' : ''}`}>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            {!products.length && (
              <div className="empty">
                <Search size={32} />
                <h2>No materials found.</h2>
                <p>Try a broader search or remove a filter.</p>
                <button className="button" onClick={() => router.replace('/collection')}>
                  Clear filters
                </button>
              </div>
            )}
            {limited && (
              <p className="notice">
                Search reached the scan limit. Continue to the next page to search further in the
                collection.
              </p>
            )}
            <div className="pagination">
              {params.get('cursor') && (
                <button className="button" onClick={() => change('cursor', '')}>
                  First page
                </button>
              )}
              {next && (
                <button className="button dark" onClick={() => change('cursor', next)}>
                  Next materials →
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
