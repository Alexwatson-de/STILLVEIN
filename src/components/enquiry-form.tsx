'use client';
import { FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CheckCircle2, X, Download, Share2 } from 'lucide-react';
import { Product, enquirySchema } from '@/lib/schema';
import { api, download } from '@/lib/client';
import { priceLabel } from '@/lib/catalog';
export function EnquiryForm({ product }: { product?: Product }) {
  const id = useRef('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [started] = useState(Date.now());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError('');
    const f = new FormData(e.currentTarget);
    if (Date.now() - started < 1500) {
      setError('Please review your details before submitting.');
      return;
    }
    if (!id.current) id.current = crypto.randomUUID();
    const parsed = enquirySchema.safeParse({
      name: f.get('name'),
      email: f.get('email'),
      phone: f.get('phone'),
      company: f.get('company'),
      category: f.get('category'),
      productId: product?.id || null,
      quantity: f.get('quantity') ? Number(f.get('quantity')) : null,
      unit: f.get('unit'),
      projectType: f.get('projectType'),
      location: f.get('location'),
      message: f.get('message'),
      consent: f.get('consent') === 'on',
      website: f.get('website'),
      submissionId: id.current,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(' '));
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ reference: string }>('enquiries', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      setReference(r.reference);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (reference)
    return (
      <div className="empty" role="status">
        <CheckCircle2 size={35} />
        <h2>Consider it received.</h2>
        <p>Your enquiry has been saved. Keep this reference for follow-up.</p>
        <strong>{reference}</strong>
        <p style={{ marginTop: 20 }}>This is an enquiry, not an order or payment.</p>
      </div>
    );
  return (
    <form className="contact-form" onSubmit={submit}>
      {product && (
        <p className="notice">
          Enquiring about <strong>{product.name}</strong> · {product.sku}
        </p>
      )}
      <div className="form-grid">
        <label>
          Your name *
          <input name="name" autoComplete="name" required minLength={2} maxLength={100} />
        </label>
        <label>
          Email address *
          <input name="email" type="email" autoComplete="email" required maxLength={254} />
        </label>
        <label>
          Phone number *
          <input name="phone" type="tel" autoComplete="tel" required minLength={6} maxLength={30} />
        </label>
        <label>
          Company / organization
          <input name="company" autoComplete="organization" maxLength={150} />
        </label>
        <label>
          Enquiry category
          <select name="category" defaultValue={product ? 'Material quotation' : 'General enquiry'}>
            <option>Material quotation</option>
            <option>Specification support</option>
            <option>General enquiry</option>
          </select>
        </label>
        <label>
          Project type
          <input
            name="projectType"
            placeholder="Residential, hospitality, commercial…"
            maxLength={100}
          />
        </label>
        <label>
          Required quantity
          <input name="quantity" type="number" min="0.01" step="any" />
        </label>
        <label>
          Quantity unit
          <select name="unit" aria-label="Quantity unit">
            <option>m²</option>
            <option>ft²</option>
            <option>slabs</option>
            <option>pieces</option>
          </select>
        </label>
        <label className="full">
          Project location
          <input name="location" maxLength={150} />
        </label>
        <label className="full">
          How can we help? *
          <textarea
            name="message"
            required
            minLength={10}
            maxLength={4000}
            placeholder="Tell us about your space, specifications, timeline or questions."
          />
        </label>
        <label className="honeypot" aria-hidden="true">
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="form-footer">
        <label className="checkbox">
          <input type="checkbox" name="consent" required />I agree to the{' '}
          <Link className="text-link" href="/privacy" target="_blank">
            privacy policy
          </Link>{' '}
          and being contacted about this enquiry.
        </label>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <button className="button dark" disabled={busy}>
          {busy ? 'Saving your enquiry…' : 'Send enquiry'} <ArrowUpRight size={17} />
        </button>
        <small className="muted">
          No account needed. No checkout. Your enquiry is stored securely even when email
          notifications are not configured.
        </small>
      </div>
    </form>
  );
}
export function ProductActions({ product }: { product: Product }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState('');
  return (
    <>
      <div className="detail-actions">
        <button className="button dark" onClick={() => ref.current?.showModal()}>
          Enquire about this material <ArrowUpRight size={17} />
        </button>
        <Link href={`/studio?material=${product.slug}`} className="button">
          View in 3D
        </Link>
      </div>
      <div className="inline-actions" style={{ margin: '18px 0' }}>
        <button
          className="text-link"
          onClick={() =>
            download(
              `${product.slug}-specification.txt`,
              `${product.name}\n${product.sku}\n${product.isSample ? 'SAMPLE DATA - NOT A REAL PRODUCT SPECIFICATION\n' : ''}\n${product.description}\n\n${priceLabel(product)}\n${product.dimensions.length} x ${product.dimensions.width} mm\nThicknesses: ${product.thicknesses.join(', ')} mm\nFinish: ${product.finish}\nColour: ${product.colour}\nOrigin: ${product.origin || 'Unspecified'}\nApplications: ${product.applications.join(', ')}\n\nCare: ${product.care}\n\nAlways verify the actual slab and suitability.`,
              'text/plain',
            )
          }
        >
          <Download size={14} /> Specification sheet
        </button>
        <button
          className="text-link"
          onClick={async () => {
            try {
              if (navigator.share)
                await navigator.share({ title: product.name, url: location.href });
              else {
                await navigator.clipboard.writeText(location.href);
                setMessage('Link copied.');
              }
            } catch {
              setMessage('Sharing cancelled or unavailable.');
            }
          }}
        >
          <Share2 size={14} /> Share material
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      <dialog className="modal" ref={ref}>
        <div className="modal-header">
          <h2>A conversation begins here.</h2>
          <button aria-label="Close enquiry" onClick={() => ref.current?.close()}>
            <X size={22} />
          </button>
        </div>
        <EnquiryForm product={product} />
      </dialog>
    </>
  );
}
