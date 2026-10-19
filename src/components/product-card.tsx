'use client';
import Link from 'next/link';
import { ArrowUpRight, Plus, Check, Box } from 'lucide-react';
import { Product } from '@/lib/schema';
import { imageUrl, priceLabel } from '@/lib/catalog';
import { useEffect, useState } from 'react';
export function CompareButton({ id }: { id: string }) {
  const [selected, setSelected] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const sync = () => {
      try {
        setSelected(JSON.parse(localStorage.getItem('stillvein.compare') || '[]').includes(id));
      } catch {
        setSelected(false);
      }
    };
    sync();
    window.addEventListener('compare-change', sync);
    return () => window.removeEventListener('compare-change', sync);
  }, [id]);
  return (
    <button
      className="compare-button"
      aria-label={selected ? 'Remove from comparison' : 'Add to comparison'}
      title={message || 'Compare up to 3 materials'}
      onClick={() => {
        let ids: string[] = [];
        try {
          ids = JSON.parse(localStorage.getItem('stillvein.compare') || '[]');
        } catch {}
        if (!ids.includes(id) && ids.length >= 3) {
          setMessage('Compare is limited to 3 materials. Remove one on the Compare page.');
          return;
        }
        localStorage.setItem(
          'stillvein.compare',
          JSON.stringify(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]),
        );
        window.dispatchEvent(new Event('compare-change'));
        setMessage('');
      }}
    >
      {selected ? <Check size={16} /> : <Plus size={16} />}
      <span>{message || 'Compare'}</span>
    </button>
  );
}
export function ProductCard({ product: p }: { product: Product }) {
  const [failed, setFailed] = useState(false);
  return (
    <article className="product-card">
      <div className="product-image">
        <Link href={`/materials/${p.slug}`} aria-label={`Explore ${p.name}`}>
          {p.galleryImages[0] && !failed ? (
            <img
              src={imageUrl(p.galleryImages[0].url, 800)}
              alt={p.galleryImages[0].alt}
              loading="lazy"
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="image-fallback">Image unavailable</div>
          )}
        </Link>
        <div className="image-tags">
          {p.featured && <span>CURATED</span>}
          {p.texture && (
            <Link href={`/studio?material=${p.slug}`}>
              <Box size={12} /> 3D VIEW
            </Link>
          )}
        </div>
        <CompareButton id={p.id} />
      </div>
      <div className="product-meta">
        <span>
          {p.stoneType} <i>·</i> {p.finish}
        </span>
        <span>{p.sku}</span>
      </div>
      <Link href={`/materials/${p.slug}`} className="product-title">
        <h3>{p.name}</h3>
        <ArrowUpRight size={21} />
      </Link>
      <div className="product-bottom">
        <span>
          {p.colour} / {p.pattern}
        </span>
        <b>{priceLabel(p)}</b>
      </div>
      {p.isSample && (
        <span className="sample-label">
          Sample material · illustrative specifications{p.price !== null ? ' & price' : ''}
        </span>
      )}
    </article>
  );
}
