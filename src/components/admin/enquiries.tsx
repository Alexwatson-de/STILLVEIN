'use client';
import { useEffect, useState, useCallback } from 'react';
import { Enquiry, statuses } from '@/lib/schema';
import { api, download } from '@/lib/client';
import { exportEnquiries } from '@/lib/csv';
export function Enquiries() {
  const [items, setItems] = useState<Enquiry[]>([]);
  const [staff, setStaff] = useState<{ id: string; email: string }[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [current, setCurrent] = useState<Enquiry | null>(null);
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [assigned, setAssigned] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [product, setProduct] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (cursor?: string) => {
    try {
      const r = await api<{ items: Enquiry[]; nextCursor: string | null }>(
        `admin/enquiries${cursor ? `?cursor=${cursor}` : ''}`,
        {},
        true,
      );
      setItems((v) => (cursor ? [...v, ...r.items] : r.items));
      setCursor(r.nextCursor);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
    api<{ id: string; email: string }[]>('admin/staff', {}, true)
      .then(setStaff)
      .catch(() => {});
  }, [load]);
  const filtered = items.filter(
    (e) =>
      (!status || e.status === status) &&
      (!assigned || e.assignedTo === assigned) &&
      (!since || e.createdAt.slice(0, 10) >= since) &&
      (!until || e.createdAt.slice(0, 10) <= until) &&
      (!product || e.productId === product) &&
      `${e.name} ${e.email} ${e.reference} ${e.productName} ${e.sku}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>Conversations</h1>
          <p>Every enquiry is a project taking shape.</p>
        </div>
        <button
          className="button small"
          onClick={() =>
            download(
              'stillvein-enquiries.csv',
              exportEnquiries(filtered as unknown as Record<string, unknown>[]),
            )
          }
        >
          Export {filtered.length} visible enquiries
        </button>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {current ? (
        <div className="admin-panel">
          <button className="text-link" onClick={() => setCurrent(null)}>
            ← Back to enquiries
          </button>
          <h2 style={{ marginTop: 25 }}>{current.reference}</h2>
          <p>
            {current.name} · {current.email} · {current.phone}
          </p>
          <p>
            {current.company} / {current.location} / {current.projectType}
          </p>
          <p>
            {current.productName} · {current.sku} · {current.quantity} {current.unit}
          </p>
          <blockquote>{current.message}</blockquote>
          <div className="form-grid">
            <label>
              Status
              <select
                value={current.status}
                onChange={(e) =>
                  setCurrent({ ...current, status: e.target.value as Enquiry['status'] })
                }
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Assigned to
              <select
                value={current.assignedTo}
                onChange={(e) => setCurrent({ ...current, assignedTo: e.target.value })}
              >
                <option value="">Unassigned</option>
                {staff.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Follow-up date
              <input
                type="date"
                value={current.followUp}
                onChange={(e) => setCurrent({ ...current, followUp: e.target.value })}
              />
            </label>
            <label className="full">
              Add internal note
              <textarea value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
            </label>
          </div>
          <button
            className="button dark"
            style={{ marginTop: 20 }}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await api(
                  `admin/enquiries/${current.id}`,
                  {
                    method: 'PUT',
                    body: JSON.stringify({
                      status: current.status,
                      assignedTo: current.assignedTo,
                      followUp: current.followUp,
                      note,
                      revision: current.revision,
                    }),
                  },
                  true,
                );
                setCurrent(await api<Enquiry>(`admin/enquiries/${current.id}`, {}, true));
                setNote('');
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Saving…' : 'Save follow-up'}
          </button>
          <div className="notes-list" style={{ marginTop: 25 }}>
            <h3>Internal notes</h3>
            {current.notes.map((n, i) => (
              <p key={i}>
                {n.text}
                <small>
                  {n.by} · {new Date(n.at).toLocaleString()}
                </small>
              </p>
            ))}
            <h3>Status history</h3>
            {current.history.map((h, i) => (
              <p key={i}>
                {h.status}
                <small>
                  {h.by} · {new Date(h.at).toLocaleString()}
                </small>
              </p>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="admin-toolbar">
            <input
              aria-label="Search enquiries"
              placeholder="Search name, reference, material…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Enquiry status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="Assigned staff"
              value={assigned}
              onChange={(e) => setAssigned(e.target.value)}
            >
              <option value="">All staff</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.email}
                </option>
              ))}
            </select>
            <select
              aria-label="Enquiry product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            >
              <option value="">All materials</option>
              {[
                ...new Map(
                  items.filter((e) => e.productId).map((e) => [e.productId!, e.productName]),
                ).entries(),
              ].map(([id, name]) => (
                <option value={id} key={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-toolbar">
            <label>
              From date
              <input type="date" value={since} onChange={(e) => setSince(e.target.value)} />
            </label>
            <label>
              Until date
              <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference / date</th>
                  <th>Contact</th>
                  <th>Material</th>
                  <th>Status</th>
                  <th>Follow-up</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.reference}
                      <small style={{ display: 'block' }}>
                        {new Date(e.createdAt).toLocaleDateString()}
                      </small>
                    </td>
                    <td>
                      {e.name}
                      <small style={{ display: 'block' }}>{e.email}</small>
                    </td>
                    <td>{e.productName || 'General enquiry'}</td>
                    <td>
                      <span className={`badge ${e.status}`}>{e.status}</span>
                    </td>
                    <td>{e.followUp || '—'}</td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => {
                          setCurrent(e);
                          setNote('');
                        }}
                      >
                        Manage →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && <div className="empty">No enquiries match these filters.</div>}
          <p className="muted" style={{ fontSize: 11 }}>
            Filters and export apply to {items.length} loaded records. Internal notes are excluded
            from CSV.
          </p>
          {cursor && (
            <button className="button" onClick={() => load(cursor)}>
              Load next 50
            </button>
          )}
        </>
      )}
    </>
  );
}
