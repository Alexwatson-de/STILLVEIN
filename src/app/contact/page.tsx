import { Header, Footer } from '@/components/chrome';
import { EnquiryForm } from '@/components/enquiry-form';
import { settings } from '@/lib/server/data';
import { defaultSettings } from '@/lib/schema';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Start a conversation' };
export default async function Page() {
  const s = await settings().catch(() => defaultSettings);
  return (
    <>
      <Header settings={s} />
      <main id="main">
        <div className="page-heading">
          <span className="eyebrow">FROM DISCOVERY TO DETAIL</span>
          <h1>Let’s talk materials.</h1>
          <p>A question, a specification, a space taking shape. Start here.</p>
        </div>
        <div className="contact-layout">
          <aside className="contact-side">
            <span className="eyebrow">A CONSIDERED CONVERSATION</span>
            <h2 style={{ marginTop: 25 }}>
              The right material.
              <br />
              The right information.
            </h2>
            <p>
              Use this form for quotations, specification questions or help exploring the atlas.
              Include your quantity and project details for a more useful response.
            </p>
            <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '30px 0' }} />
            {s.contactEmail && (
              <p>
                <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a>
              </p>
            )}
            {s.contactPhone && <p>{s.contactPhone}</p>}
            {s.address && <p>{s.address}</p>}
            <small className="muted">
              An independent discovery and enquiry platform.
              <br />
              We do not process orders or payments.
            </small>
          </aside>
          <EnquiryForm />
        </div>
      </main>
      <Footer settings={s} />
    </>
  );
}
