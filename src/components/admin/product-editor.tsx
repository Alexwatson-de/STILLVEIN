'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Product,
  ProductInput,
  Taxonomy,
  productSchema,
  visualizationSchema,
  Visualization,
} from '@/lib/schema';
import { api } from '@/lib/client';
import { Upload } from '../upload';
import { imageUrl } from '@/lib/catalog';
const Viewer = dynamic(() => import('../stone-viewer'), {
  ssr: false,
  loading: () => <p>Loading material preview…</p>,
});
export function emptyProduct(): ProductInput {
  return {
    name: '',
    sku: '',
    slug: '',
    categoryId: 'marble',
    stoneType: 'Marble',
    shortDescription: '',
    description: '',
    galleryImages: [],
    texture: null,
    price: null,
    priceMax: null,
    pricingMode: 'quote',
    currency: 'USD',
    priceUnit: 'm²',
    availability: 'On request',
    colour: '',
    tones: [],
    pattern: '',
    finish: 'Polished',
    origin: '',
    classification: '',
    dimensions: { length: 2800, width: 1600 },
    thicknesses: [20],
    applications: [],
    care: '',
    tags: [],
    attributes: {},
    featured: false,
    status: 'draft',
    relatedIds: [],
    isSample: false,
    seoTitle: '',
    seoDescription: '',
    visualization: visualizationSchema.parse({}),
  };
}
export function ProductEditor({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [id] = useState(() => product?.id || crypto.randomUUID());
  const [p, setP] = useState<ProductInput>(product || emptyProduct());
  const [revision, setRevision] = useState(product?.revision);
  const [types, setTypes] = useState<Taxonomy[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    api<Taxonomy[]>('admin/taxonomy', {}, true)
      .then(setTypes)
      .catch((e) => setError(e.message));
    api<{ items: Product[] }>('admin/products', {}, true)
      .then((r) => setRelated(r.items))
      .catch(() => {});
    if (!product)
      api<{ currency: string; priceUnit: string }>('settings')
        .then((s) => setP((v) => ({ ...v, currency: s.currency, priceUnit: s.priceUnit })))
        .catch(() => {});
  }, [product]);
  const change = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => {
    setP((v) => ({ ...v, [key]: value }));
    setMessage('');
  };
  async function save(status: ProductInput['status']) {
    setError('');
    const parsed = productSchema.safeParse({ ...p, status });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
      return;
    }
    setBusy(true);
    try {
      const result = await api<Product>(
        `admin/products/${id}`,
        { method: 'PUT', body: JSON.stringify({ product: parsed.data, revision }) },
        true,
      );
      setP(result);
      setRevision(result.revision);
      setMessage(`Saved as ${result.status}.`);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const text = (key: keyof ProductInput, label: string, long = false) => (
    <label key={key}>
      {label}
      {long ? (
        <textarea
          value={String(p[key] ?? '')}
          onChange={(e) => change(key, e.target.value as never)}
        />
      ) : (
        <input
          value={String(p[key] ?? '')}
          onChange={(e) => change(key, e.target.value as never)}
        />
      )}
    </label>
  );
  const select = (key: keyof ProductInput, label: string, options: string[]) => (
    <label key={key}>
      {label}
      <select value={String(p[key])} onChange={(e) => change(key, e.target.value as never)}>
        <option value="">Select…</option>
        {[...new Set([String(p[key]), ...options])].filter(Boolean).map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );
  const list = (key: 'tones' | 'tags' | 'applications' | 'thicknesses', label: string) => (
    <label key={key}>
      {label}
      <input
        defaultValue={p[key].join(', ')}
        onBlur={(e) =>
          change(
            key,
            (key === 'thicknesses'
              ? e.target.value.split(',').filter(Boolean).map(Number)
              : e.target.value
                  .split(',')
                  .map((v) => v.trim())
                  .filter(Boolean)) as never,
          )
        }
      />
      <small className="muted">Separate values with commas.</small>
    </label>
  );
  const asProduct = {
    ...p,
    id,
    revision: revision || 0,
    createdAt: product?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nameKey: p.name.toLowerCase(),
    priceSort: p.price || 0,
  } as Product;
  return (
    <div>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">MATERIAL EDITOR</span>
          <h1>{p.name || 'New material'}</h1>
          <p>
            {revision ? `Revision ${revision} · ${p.status}` : 'Unsaved draft'} · dimensions in mm
          </p>
        </div>
        <button
          className="button small"
          onClick={() => {
            if (message || confirm('Leave the editor? Unsaved changes will be lost.')) onClose();
          }}
        >
          ← Back to materials
        </button>
      </div>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="notice success">
          {message}
        </div>
      )}
      <div className="editor-grid">
        <fieldset>
          <legend>Identity & publication</legend>
          <div className="form-grid">
            {text('name', 'Material name *')}
            {text('sku', 'Unique SKU *')}
            {text('slug', 'URL slug *')}
            <label>
              Category *
              <select
                value={p.categoryId}
                onChange={(e) => {
                  const t = types.find((t) => t.id === e.target.value);
                  setP((v) => ({
                    ...v,
                    categoryId: e.target.value,
                    stoneType: t?.name || v.stoneType,
                  }));
                }}
              >
                <option value="">Choose category</option>
                {types
                  .filter((t) => t.kind === 'category')
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
            {text('stoneType', 'Stone type')}
            {text('classification', 'Classification')}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={p.featured}
                onChange={(e) => change('featured', e.target.checked)}
              />{' '}
              Featured material
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={p.isSample}
                onChange={(e) => change('isSample', e.target.checked)}
              />{' '}
              Sample data label
            </label>
            <div className="full">{text('shortDescription', 'Short description', true)}</div>
            <div className="full">{text('description', 'Detailed description', true)}</div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Public pricing & specifications</legend>
          <div className="form-grid">
            {select('pricingMode', 'Pricing mode', ['fixed', 'range', 'quote', 'contact'])}
            {select('availability', 'Availability', [
              'Available',
              'Limited',
              'On request',
              'Unavailable',
            ])}
            {(['price', 'priceMax'] as const).map((k) => (
              <label key={k}>
                {k === 'price' ? 'Price / range minimum' : 'Range maximum'}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={p[k] ?? ''}
                  onChange={(e) => change(k, e.target.value === '' ? null : Number(e.target.value))}
                />
              </label>
            ))}
            {text('currency', 'Currency (ISO code)')}
            {text('priceUnit', 'Pricing unit')}
            {select(
              'colour',
              'Colour',
              types.filter((t) => t.kind === 'colour').map((t) => t.name),
            )}
            {select(
              'finish',
              'Finish',
              types.filter((t) => t.kind === 'finish').map((t) => t.name),
            )}
            {select(
              'pattern',
              'Pattern / veining',
              types.filter((t) => t.kind === 'pattern').map((t) => t.name),
            )}
            {text('origin', 'Origin / source region')}
            {(['length', 'width'] as const).map((k) => (
              <label key={k}>
                Slab {k} (mm)
                <input
                  type="number"
                  min="1"
                  value={p.dimensions[k]}
                  onChange={(e) =>
                    change('dimensions', { ...p.dimensions, [k]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
            {list('thicknesses', 'Thickness options (mm)')}
            {list('tones', 'Dominant tones')}
            {list('applications', 'Applications')}
            {list('tags', 'Tags')}
            <div className="full">{text('care', 'Care & maintenance', true)}</div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Product gallery</legend>
          <Upload
            productId={id}
            kind="gallery"
            onUploaded={(a) => change('galleryImages', [...p.galleryImages, a])}
          />
          <div className="asset-grid">
            {p.galleryImages.map((a, i) => (
              <div key={`${a.assetId}-${i}`} className="asset-tile">
                <img src={imageUrl(a.url, 200)} alt={a.alt} />
                <label>
                  Alt text
                  <input
                    value={a.alt}
                    onChange={(e) =>
                      change(
                        'galleryImages',
                        p.galleryImages.map((v, j) =>
                          j === i ? { ...v, alt: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    change(
                      'galleryImages',
                      p.galleryImages.filter((_, j) => j !== i),
                    )
                  }
                >
                  Remove
                </button>
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      change('galleryImages', [a, ...p.galleryImages.filter((_, j) => j !== i)])
                    }
                  >
                    {' '}
                    / Make cover
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11 }}>
            Removing an image here only detaches it when the product is saved. Shared or previous
            assets are not destroyed.
          </p>
        </fieldset>
        <fieldset>
          <legend>Texture & material settings</legend>
          <Upload productId={id} kind="textures" onUploaded={(a) => change('texture', a)} />
          {p.texture && (
            <div className="asset-grid">
              <div className="asset-tile">
                <img src={imageUrl(p.texture.url, 200)} alt={p.texture.alt} />
                <button onClick={() => change('texture', null)}>Remove texture</button>
              </div>
              <small>
                {p.texture.width} × {p.texture.height} px
                <br />
                High-resolution original retained
              </small>
            </div>
          )}
          <div className="material-sliders">
            {(
              ['scale', 'repeatX', 'repeatY', 'rotation', 'roughness', 'reflectivity'] as const
            ).map((k) => (
              <label key={k}>
                {k}: {p.visualization[k]}
                <input
                  type="range"
                  aria-label={k}
                  min={
                    k === 'rotation'
                      ? -180
                      : k === 'roughness'
                        ? 0.08
                        : k === 'reflectivity'
                          ? 0
                          : 0.25
                  }
                  max={k === 'rotation' ? 180 : k === 'roughness' || k === 'reflectivity' ? 1 : 8}
                  step={k === 'rotation' ? 1 : 0.01}
                  value={p.visualization[k]}
                  onChange={(e) =>
                    change('visualization', { ...p.visualization, [k]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
          </div>
          <button
            className="button small"
            style={{ marginTop: 20 }}
            onClick={() => setPreview(!preview)}
          >
            {preview ? 'Hide' : 'Preview'} 3D configuration
          </button>
          <p className="muted" style={{ fontSize: 10 }}>
            Choose default model, background and camera in the live preview. All settings save with
            the product.
          </p>
        </fieldset>
        {preview && (
          <div className="full">
            {p.texture ? (
              <Viewer
                product={asProduct}
                settings={p.visualization}
                onSettingsChange={(v: Visualization) => change('visualization', v)}
              />
            ) : (
              <div className="empty">Upload a texture to preview this material.</div>
            )}
          </div>
        )}
        <fieldset>
          <legend>SEO & related materials</legend>
          <div className="form-grid">
            <div className="full">{text('seoTitle', 'SEO title (up to 70 characters)')}</div>
            <div className="full">
              {text('seoDescription', 'SEO description (up to 180 characters)', true)}
            </div>
            <label className="full">
              Related products (Ctrl / Cmd to select multiple)
              <select
                multiple
                value={p.relatedIds}
                onChange={(e) =>
                  change(
                    'relatedIds',
                    Array.from(e.target.selectedOptions).map((o) => o.value),
                  )
                }
              >
                {related
                  .filter((r) => r.id !== id)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} / {r.sku}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Custom attributes</legend>
          <div className="form-grid">
            {types
              .filter((t) => t.kind === 'attribute')
              .map((t) => (
                <label key={t.id}>
                  {t.name}
                  <input
                    value={p.attributes[t.name] || ''}
                    onChange={(e) =>
                      change('attributes', { ...p.attributes, [t.name]: e.target.value })
                    }
                  />
                </label>
              ))}
          </div>
          {!types.some((t) => t.kind === 'attribute') && (
            <p>Add attribute definitions in Categories & attributes. No code changes required.</p>
          )}
        </fieldset>
      </div>
      <div className="editor-sticky">
        <button className="button" disabled={busy} onClick={() => save('draft')}>
          Save draft / unpublish
        </button>
        <button className="button" disabled={busy} onClick={() => save('archived')}>
          Archive
        </button>
        <button className="button dark" disabled={busy} onClick={() => save('published')}>
          {busy ? 'Saving…' : 'Publish material'}
        </button>
      </div>
    </div>
  );
}
