'use client';
import { useRef, useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { Asset } from '@/lib/schema';
import { imageUrl } from '@/lib/catalog';
export function Gallery({ images }: { images: Asset[] }) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const image = images[index];
  if (!image) return <div className="image-fallback">Photography coming soon</div>;
  return (
    <div className="detail-gallery">
      <button
        className="gallery-main"
        aria-label="Zoom material image"
        onClick={() => dialog.current?.showModal()}
      >
        {failed ? (
          <div className="image-fallback">Image could not be loaded</div>
        ) : (
          <img src={imageUrl(image.url, 1400)} alt={image.alt} onError={() => setFailed(true)} />
        )}
      </button>
      <p className="muted" style={{ fontSize: 10, marginTop: 10 }}>
        <ZoomIn size={12} /> Select image to inspect full resolution
      </p>
      <div className="gallery-thumbs">
        {images.map((a, i) => (
          <button
            key={a.assetId}
            className={i === index ? 'active' : ''}
            aria-label={`Show image ${i + 1}`}
            onClick={() => {
              setIndex(i);
              setFailed(false);
            }}
          >
            <img src={imageUrl(a.url, 200)} alt={a.alt} />
          </button>
        ))}
      </div>
      <dialog className="lightbox" ref={dialog}>
        <button aria-label="Close image zoom" onClick={() => dialog.current?.close()}>
          <X size={20} />
        </button>
        <img src={imageUrl(image.url, 2400)} alt={image.alt} />
        <div>
          <button onClick={() => setIndex((index + images.length - 1) % images.length)}>
            ← Previous
          </button>
          <span>
            {index + 1} / {images.length}
          </span>
          <button onClick={() => setIndex((index + 1) % images.length)}>Next →</button>
        </div>
      </dialog>
    </div>
  );
}
