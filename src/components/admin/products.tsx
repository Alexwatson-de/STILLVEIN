'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Download, Upload as UploadIcon } from 'lucide-react';
import { Product } from '@/lib/schema';
import { api, download } from '@/lib/client';
import { imageUrl, priceLabel } from '@/lib/catalog';
import { exportProducts, importProducts } from '@/lib/csv';
import { ProductEditor } from './product-editor';
export function Products() {
  const [items, setItems] = useState<Product[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [edit, setEdit] = useState<Product | null | undefined>();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState('newest');
  const load = useCallback(async (cursor?: string) => {
    setBusy(true);
    try {
      const r = await api<{ items: Product[]; nextCursor: string | null }>(
        `admin/products${cursor ? `?cursor=${cursor}` : ''}`,
        {},
        true,
      );
      setItems((old) => (cursor ? [...old, ...r.items] : r.items));
      setCursor(r.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function action(p: Product, action: string) {
    setError('');
    setBusy(true);
    try {
      if (action === 'duplicate') {
        const id = crypto.randomUUID();
        const product = {
          ...p,
          name: `${p.name} copy`,
          sku: `${p.sku}-${id.slice(0, 6)}`,
          slug: `${p.slug}-copy-${id.slice(0, 6)}`,
          status: 'draft',
          featured: false,
        };
        await api(
          `admin/products/${id}`,
          { method: 'POST', body: JSON.stringify({ product }) },
          true,
        );
      } else if (action === 'delete') {
        if (prompt(`Permanently delete archived material? Type ${p.name}`) !== p.name) return;
        await api(
          `admin/products/${p.id}`,
          { method: 'DELETE', body: JSON.stringify({ confirmation: p.name }) },
          true,
        );
      } else {
        await api(
          `admin/products/${p.id}`,
          {
            method: 'PUT',
            body: JSON.stringify({ product: { ...p, status: action }, revision: p.revision }),
          },
          true,
        );
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (edit !== undefined)
    return (
      <ProductEditor
        key={edit?.id || 'new'}
        product={edit}
        onClose={() => setEdit(undefined)}
        onSaved={() => void load()}
      />
    );
  const filtered = items
    .filter(
      (p) =>
        (!status || p.status === status) &&
        `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'price'
          ? (a.price ?? Infinity) - (b.price ?? Infinity)
          : b.createdAt.localeCompare(a.createdAt),
    );
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>Materials</h1>
          <p>Curate the atlas. Manage the details.</p>
        </div>
        <button className="button dark" onClick={() => setEdit(null)}>
          <Plus size={16} /> New material
        </button>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      <div className="admin-toolbar">
        <input
          aria-label="Search admin materials"
          placeholder="Search loaded materials by name or SKU…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Publication status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option>published</option>
          <option>draft</option>
          <option>archived</option>
        </select>
        <select
          aria-label="Sort admin products"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="newest">Newest</option>
          <option value="name">Name</option>
          <option value="price">Price</option>
        </select>
        <button
          className="button small"
          onClick={() => download('stillvein-materials.csv', exportProducts(filtered))}
        >
          <Download size={14} /> Export {filtered.length}
        </button>
        <label className="button small" style={{ position: 'relative', overflow: 'hidden' }}>
          <UploadIcon size={14} /> Import CSV
          <input
            type="file"
            accept=".csv"
            aria-label="Import products CSV"
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              setError('');
              let saved = 0;
              try {
                const rows = importProducts(await file.text());
                if (
                  !confirm(
                    `Import ${rows.length} validated rows? Existing IDs will update; imported status is preserved. Uploaded asset IDs must already be verified.`,
                  )
                )
                  return;
                for (const row of rows) {
                  const id = row.id || crypto.randomUUID();
                  let revision: number | undefined;
                  try {
                    revision = (await api<Product>(`admin/products/${id}`, {}, true)).revision;
                  } catch {}
                  await api(
                    `admin/products/${id}`,
                    { method: 'PUT', body: JSON.stringify({ product: row.product, revision }) },
                    true,
                  );
                  saved++;
                }
                setMessage(`Imported ${saved} materials.`);
                await load();
              } catch (e) {
                setError(
                  `Imported ${saved} rows before stopping. ${String((e as Error).message)} Retry only remaining rows.`,
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
      {selected.length > 0 && (
        <div className="admin-toolbar">
          <span>{selected.length} selected</span>
          {['published', 'draft', 'archived'].map((s) => (
            <button
              className="button small"
              key={s}
              disabled={busy}
              onClick={async () => {
                if (!confirm(`Set ${selected.length} selected materials to ${s}?`)) return;
                for (const p of items.filter((p) => selected.includes(p.id))) await action(p, s);
                setSelected([]);
              }}
            >
              Set {s}
            </button>
          ))}
        </div>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Material</th>
              <th>Category</th>
              <th>Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.name}`}
                    checked={selected.includes(p.id)}
                    onChange={(e) =>
                      setSelected((v) =>
                        e.target.checked ? [...v, p.id] : v.filter((id) => id !== p.id),
                      )
                    }
                  />
                </td>
                <td>
                  <div className="table-product">
                    {p.galleryImages[0] && (
                      <img src={imageUrl(p.galleryImages[0].url, 100)} alt="" />
                    )}
                    <span>
                      <b>{p.name}</b>
                      <small>
                        {p.sku}
                        {p.isSample ? ' · Sample' : ''}
                      </small>
                    </span>
                  </div>
                </td>
                <td>{p.stoneType}</td>
                <td>{priceLabel(p)}</td>
                <td>
                  <span className={`badge ${p.status}`}>{p.status}</span>
                </td>
                <td>
                  <div className="table-actions">
                    <button onClick={() => setEdit(p)}>Edit / preview</button>
                    <button disabled={busy} onClick={() => action(p, 'duplicate')}>
                      Duplicate
                    </button>
                    {p.status === 'archived' ? (
                      <button className="danger" onClick={() => action(p, 'delete')}>
                        Delete
                      </button>
                    ) : (
                      <button disabled={busy} onClick={() => action(p, 'archived')}>
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className="empty">
          {busy
            ? 'Loading materials…'
            : 'No materials match. Create a material or change the filters.'}
        </div>
      )}
      <p className="muted" style={{ fontSize: 11 }}>
        {items.length} loaded records. Search, sort and export apply to loaded records; load further
        pages to include more.
      </p>
      {cursor && (
        <button disabled={busy} className="button" onClick={() => load(cursor)}>
          Load next 50
        </button>
      )}
    </>
  );
}
