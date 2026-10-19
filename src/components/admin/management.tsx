'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Asset, SiteSettings, Taxonomy, Role, roles } from '@/lib/schema';
import { Upload } from '../upload';
export function Taxonomies() {
  const [items, setItems] = useState<Taxonomy[]>([]);
  const [kind, setKind] = useState<Taxonomy['kind']>('category');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const load = () =>
    api<Taxonomy[]>('admin/taxonomy', {}, true)
      .then(setItems)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>Categories & attributes</h1>
          <p>Extend the catalog vocabulary without editing code.</p>
        </div>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <form
        className="admin-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          try {
            await api(
              `admin/taxonomy${id ? `/${id}` : ''}`,
              { method: id ? 'PUT' : 'POST', body: JSON.stringify({ kind, name, description }) },
              true,
            );
            setId('');
            setName('');
            setDescription('');
            await load();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="form-grid">
          <label>
            Definition type
            <select value={kind} onChange={(e) => setKind(e.target.value as Taxonomy['kind'])}>
              {['category', 'finish', 'colour', 'pattern', 'application', 'attribute'].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label>
            Name
            <input value={name} required maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="full">
            Description
            <textarea
              value={description}
              maxLength={600}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
        <button className="button dark" style={{ marginTop: 20 }}>
          {id ? 'Update definition' : 'Add definition'}
        </button>
        {id && (
          <button
            type="button"
            className="button text"
            onClick={() => {
              setId('');
              setName('');
              setDescription('');
            }}
          >
            Cancel edit
          </button>
        )}
      </form>
      <input
        aria-label="Search taxonomy"
        placeholder="Search definitions…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 20 }}
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items
              .filter((t) => `${t.name} ${t.kind}`.toLowerCase().includes(query.toLowerCase()))
              .map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.kind}</td>
                  <td>{t.description}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        onClick={() => {
                          setId(t.id);
                          setKind(t.kind);
                          setName(t.name);
                          setDescription(t.description);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="danger"
                        onClick={async () => {
                          if (
                            !confirm(
                              `Delete ${t.name}? Existing text specifications are retained; in-use categories cannot be deleted.`,
                            )
                          )
                            return;
                          try {
                            await api(`admin/taxonomy/${t.id}`, { method: 'DELETE' }, true);
                            await load();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
export function Settings() {
  const [value, setValue] = useState<SiteSettings | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<SiteSettings>('admin/settings', {}, true)
      .then(setValue)
      .catch((e) => setError(e.message));
  }, []);
  if (!value) return <p className="notice">{error || 'Loading site configuration…'}</p>;
  const v = value;
  const textKeys = [
    'brand',
    'tagline',
    'heroTitle',
    'heroDescription',
    'enquiryCta',
    'contactEmail',
    'contactPhone',
    'address',
    'instagram',
    'linkedin',
    'currency',
    'priceUnit',
    'seoDescription',
    'privacyText',
    'termsText',
  ] as const;
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>Site & brand</h1>
          <p>Homepage, contact information, policies and SEO.</p>
        </div>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          setMessage('');
          try {
            await api('admin/settings', { method: 'PUT', body: JSON.stringify(v) }, true);
            setMessage('Site settings saved. Public pages use the updated configuration.');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="notice success">
            {message}
          </p>
        )}
        <div className="admin-panel form-grid">
          {textKeys.map((k) => (
            <label key={k} className={/Text|Description|Title|Cta/.test(k) ? 'full' : ''}>
              {k.replace(/([A-Z])/g, ' $1')}
              {/Text|Description|Title|address/.test(k) ? (
                <textarea value={v[k]} onChange={(e) => setValue({ ...v, [k]: e.target.value })} />
              ) : (
                <input value={v[k]} onChange={(e) => setValue({ ...v, [k]: e.target.value })} />
              )}
            </label>
          ))}
          <label className="full">
            Featured product IDs (comma-separated; products must also be marked featured)
            <input
              value={v.featuredIds.join(',')}
              onChange={(e) =>
                setValue({
                  ...v,
                  featuredIds: e.target.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={v.showRecent}
              onChange={(e) => setValue({ ...v, showRecent: e.target.checked })}
            />{' '}
            Show recent materials
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={v.showApplications}
              onChange={(e) => setValue({ ...v, showApplications: e.target.checked })}
            />{' '}
            Show applications
          </label>
          <div className="full">
            <h3>Homepage hero image</h3>
            <Upload
              productId="site"
              kind="site"
              onUploaded={(a) => setValue({ ...v, heroAsset: a })}
            />
            {v.heroAsset && (
              <>
                <img src={v.heroAsset.url} alt={v.heroAsset.alt} style={{ maxHeight: 160 }} />
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setValue({ ...v, heroAsset: null })}
                >
                  Use featured material instead
                </button>
              </>
            )}
          </div>
        </div>
        <button className="button dark" disabled={busy}>
          {busy ? 'Saving…' : 'Save site configuration'}
        </button>
      </form>
    </>
  );
}
type Staff = { id: string; email: string; role: Role; active: boolean };
export function Users() {
  const [users, setUsers] = useState<Staff[]>([]);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () =>
    api<Staff[]>('admin/users', {}, true)
      .then(setUsers)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);
  async function update(user: Staff, patch: Partial<Staff>) {
    if (!confirm(`Change access for ${user.email}?`)) return;
    try {
      await api(
        `admin/users/${user.id}`,
        { method: 'PUT', body: JSON.stringify({ role: user.role, active: user.active, ...patch }) },
        true,
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>People & permissions</h1>
          <p>Admin: all areas · Editor: catalog & images · Sales: enquiries only.</p>
        </div>
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {link && (
        <div className="notice">
          <strong>Private account setup link</strong>
          <p>
            Share this link securely with the invited staff member. It is not emailed automatically.
          </p>
          <input
            readOnly
            value={link}
            aria-label="Private staff setup link"
            style={{ width: '100%' }}
          />
          <button onClick={() => setLink('')}>Dismiss private link</button>
        </div>
      )}
      <form
        className="admin-panel"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          const f = new FormData(e.currentTarget);
          try {
            const r = await api<{ setupLink: string }>(
              'admin/users',
              {
                method: 'POST',
                body: JSON.stringify({ email: f.get('email'), role: f.get('role') }),
              },
              true,
            );
            setLink(r.setupLink);
            await load();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          <label>
            Staff email
            <input name="email" type="email" required />
          </label>
          <label>
            Role
            <select name="role">
              <option>editor</option>
              <option>sales</option>
              <option>admin</option>
            </select>
          </label>
        </div>
        <button className="button dark" style={{ marginTop: 20 }} disabled={busy}>
          {busy ? 'Creating invitation…' : 'Invite staff member'}
        </button>
      </form>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Access</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>
                  <select
                    aria-label={`Role for ${u.email}`}
                    value={u.role}
                    onChange={(e) => update(u, { role: e.target.value as Role })}
                  >
                    {roles.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td>{u.active ? 'Active' : 'Disabled'}</td>
                <td>
                  <button className="text-link" onClick={() => update(u, { active: !u.active })}>
                    {u.active ? 'Disable' : 'Restore'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
export function Audit() {
  const [items, setItems] = useState<
    { id: string; at: string; email: string; action: string; target: string }[]
  >([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const load = useCallback(async (cursor?: string) => {
    try {
      const r = await api<{
        items: { id: string; at: string; email: string; action: string; target: string }[];
        nextCursor: string | null;
      }>(`admin/audit${cursor ? `?cursor=${cursor}` : ''}`, {}, true);
      setItems((v) => (cursor ? [...v, ...r.items] : r.items));
      setCursor(r.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <div className="admin-heading">
        <h1>Audit trail</h1>
      </div>
      <p>
        Sensitive changes are recorded by the server. No secrets or enquiry message content are
        copied here.
      </p>
      {error && <p className="notice error">{error}</p>}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search loaded audit events…"
        aria-label="Search audit events"
        style={{ marginBottom: 20 }}
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {items
              .filter((i) =>
                `${i.email} ${i.action} ${i.target}`.toLowerCase().includes(query.toLowerCase()),
              )
              .map((i) => (
                <tr key={i.id}>
                  <td>{new Date(i.at).toLocaleString()}</td>
                  <td>{i.email || 'Trusted setup'}</td>
                  <td>{i.action}</td>
                  <td>{i.target}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {cursor && (
        <button className="button" onClick={() => load(cursor)}>
          Load older events
        </button>
      )}
    </>
  );
}
export function Assets() {
  const [items, setItems] = useState<(Asset & { refs: string[]; sample?: boolean })[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(
    () =>
      api<(Asset & { refs: string[]; sample?: boolean })[]>('admin/assets', {}, true)
        .then(setItems)
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <div className="admin-heading">
        <h1>Image library</h1>
      </div>
      <p>
        Showing up to 100 ready assets. Only unreferenced Cloudinary assets can be deleted. Previous
        images remain intact until an authorized cleanup.
      </p>
      {error && <p className="notice error">{error}</p>}
      <div className="product-grid">
        {items.map((a) => (
          <div className="admin-panel" key={a.assetId}>
            <img
              src={a.url}
              alt={a.alt}
              style={{ height: 130, width: '100%', objectFit: 'cover' }}
            />
            <p style={{ fontSize: 11, marginTop: 10 }}>
              {a.alt}
              <br />
              {a.width} × {a.height} px · {a.refs.length} references
            </p>
            <button
              className="text-link danger"
              disabled={a.refs.length > 0 || a.sample}
              onClick={async () => {
                if (!confirm('Permanently delete this unreferenced image from Cloudinary?')) return;
                try {
                  await api(`admin/assets/${a.assetId}`, { method: 'DELETE' }, true);
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Delete unused asset
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
