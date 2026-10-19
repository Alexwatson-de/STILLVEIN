'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Box } from 'lucide-react';
import { Product } from '@/lib/schema';
import { imageUrl } from '@/lib/catalog';
const Viewer = dynamic(() => import('./stone-viewer'), {
  ssr: false,
  loading: () => <div className="empty">Loading the 3D studio…</div>,
});
export function ViewerLauncher({ product, auto = false }: { product: Product; auto?: boolean }) {
  const [active, setActive] = useState(auto);
  if (!product.texture)
    return (
      <div className="empty">
        {product.galleryImages[0] && (
          <img
            style={{ height: 240, margin: '0 auto 20px' }}
            src={imageUrl(product.galleryImages[0].url, 800)}
            alt={product.galleryImages[0].alt}
          />
        )}
        <p>
          A visualization texture has not been added for this material. Gallery and specifications
          remain available.
        </p>
      </div>
    );
  if (active) return <Viewer key={product.id} product={product} />;
  return (
    <div
      className="viewer viewer-launcher"
      style={{
        minHeight: 340,
        display: 'grid',
        placeItems: 'center',
        backgroundImage: `linear-gradient(#211e19c4,#211f1ab0),url('${imageUrl(product.texture.url, 800)}')`,
        backgroundSize: 'cover',
      }}
    >
      <button className="button dark" onClick={() => setActive(true)}>
        <Box size={20} /> Launch interactive 3D preview
      </button>
    </div>
  );
}
