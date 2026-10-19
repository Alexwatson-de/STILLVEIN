'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
type Summary = {
  products: Record<string, number>;
  enquiries: Record<string, number>;
  categories: number;
  materials: { id: string; name: string; status: string; at: string }[];
  recentEnquiries: { id: string; reference: string; status: string; at: string }[];
  series: { date: string; count: number }[];
  truncated: boolean;
  services: Record<string, boolean>;
};
export function OverviewPanel() {
  const [data, setData] = useState<Summary | null>(null);
  const [period, setPeriod] = useState(30);
  const [error, setError] = useState('');
  useEffect(() => {
    const c = new AbortController();
    api<Summary>(`admin/overview?days=${period}`, { signal: c.signal }, true)
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => c.abort();
  }, [period]);
  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">YOUR MATERIAL ATLAS</span>
          <h1>A considered overview.</h1>
          <p>Live counts from the database. No invented activity.</p>
        </div>
        <Link href="/" className="button small">
          View public site ↗
        </Link>
      </div>
      {error && <div className="notice error">{error}</div>}
      {data ? (
        <>
          <div className="admin-grid">
            {Object.entries({
              ...data.products,
              Categories: data.categories,
              ...('New' in data.enquiries
                ? {
                    'New enquiries': data.enquiries.New,
                    'Pending enquiries': Object.entries(data.enquiries)
                      .filter(([s]) => !['Closed', 'Converted'].includes(s))
                      .reduce((sum, [, n]) => sum + n, 0),
                  }
                : {}),
            }).map(([label, count]) => (
              <div className="metric" key={label}>
                <span>{label}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          {Object.keys(data.enquiries).length > 0 && (
            <section className="admin-panel">
              <h2>The enquiry pipeline</h2>
              <p style={{ fontSize: 11 }}>
                All-time status distribution, derived from stored records.
              </p>
              {Object.entries(data.enquiries).map(([status, count]) => (
                <div className="bar-row" key={status}>
                  <span>{status}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${(count / Math.max(1, ...Object.values(data.enquiries))) * 100}%`,
                      }}
                    />
                  </div>
                  <span>{count}</span>
                </div>
              ))}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  margin: '30px 0 15px',
                }}
              >
                <h3>Enquiry activity</h3>
                <label>
                  Reporting period
                  <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                  </select>
                </label>
              </div>
              {data.series.some((d) => d.count > 0) ? (
                <>
                  <div
                    style={{ display: 'flex', height: 110, alignItems: 'flex-end', gap: 3 }}
                    role="img"
                    aria-label={`Enquiries over ${period} days; ${data.series.reduce((s, d) => s + d.count, 0)} records`}
                  >
                    {data.series.map((d) => (
                      <div
                        key={d.date}
                        title={`${d.date}: ${d.count}`}
                        style={{
                          flex: 1,
                          height: `${Math.max(1, (d.count / Math.max(1, ...data.series.map((x) => x.count))) * 100)}%`,
                          background: d.count ? '#7d876b' : '#e7e9df',
                        }}
                      />
                    ))}
                  </div>
                  <details style={{ marginTop: 15 }}>
                    <summary>Accessible daily data</summary>
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Enquiries</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.series.map((d) => (
                          <tr key={d.date}>
                            <td>{d.date}</td>
                            <td>{d.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </>
              ) : (
                <p>No enquiries in this period. A trend will appear when records exist.</p>
              )}
              {data.truncated && (
                <p className="notice">
                  Trend shows the most recent 1,000 enquiries in this period.
                </p>
              )}
            </section>
          )}
          <div className="form-grid">
            {data.materials.length > 0 && (
              <section className="admin-panel">
                <h2>Recently added materials</h2>
                {data.materials.map((p) => (
                  <div className="compare-row" key={p.id}>
                    {p.name}
                    <span>
                      {p.status} · {new Date(p.at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </section>
            )}
            {data.recentEnquiries.length > 0 && (
              <section className="admin-panel">
                <h2>Recent conversations</h2>
                {data.recentEnquiries.map((e) => (
                  <div className="compare-row" key={e.id}>
                    {e.reference}
                    <span>
                      {e.status} · {new Date(e.at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </section>
            )}
          </div>
          <section className="admin-panel">
            <h2>Service readiness</h2>
            <div className="health-list">
              {Object.entries(data.services).map(([key, ready]) => (
                <span key={key} className={ready ? '' : 'missing'}>
                  {key}: {ready ? 'configured' : 'not configured'}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 11, marginTop: 20 }}>
              Cloudinary credentials and preset restrictions are checked before uploads. Optional
              email is not required for enquiry persistence. Production deployment and
              privacy-policy review remain separate release gates.
            </p>
          </section>
        </>
      ) : (
        !error && <p>Loading database metrics…</p>
      )}
    </>
  );
}
