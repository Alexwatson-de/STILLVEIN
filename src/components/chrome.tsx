import Link from 'next/link';
import { ArrowUpRight, Box, ArrowRight } from 'lucide-react';
import { SiteSettings, defaultSettings } from '@/lib/schema';
export function Header({ settings = defaultSettings }: { settings?: SiteSettings }) {
  return (
    <header className="header">
      <Link className="wordmark" href="/" aria-label={`${settings.brand} home`}>
        <span className="brand-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>
          {settings.brand}
          <small>{settings.tagline}</small>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/collection">Collection</Link>
        <Link href="/studio">
          <Box size={15} /> Material studio <span className="tiny-tag">3D</span>
        </Link>
        <Link href="/compare">Compare</Link>
      </nav>
      <Link className="header-cta" href="/contact">
        Start a conversation <ArrowUpRight size={16} />
      </Link>
    </header>
  );
}
export function Footer({ settings = defaultSettings }: { settings?: SiteSettings }) {
  return (
    <footer>
      <div className="footer-top">
        <div>
          <Link href="/" className="wordmark">
            {settings.brand}
          </Link>
          <p>
            A material library for spaces with intention.
            <br />
            Discover. Visualize. Specify.
          </p>
        </div>
        <div>
          <b>Explore</b>
          <Link href="/collection">The collection</Link>
          <Link href="/studio">Material studio</Link>
          <Link href="/compare">Compare materials</Link>
        </div>
        <div>
          <b>Connect</b>
          <Link href="/contact">
            Enquiries <ArrowUpRight size={13} />
          </Link>
          {settings.contactEmail && (
            <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
          )}
          {settings.contactPhone && (
            <a href={`tel:${settings.contactPhone}`}>{settings.contactPhone}</a>
          )}
          {settings.instagram && <a href={settings.instagram}>Instagram</a>}
          {settings.linkedin && <a href={settings.linkedin}>LinkedIn</a>}
        </div>
        <div>
          <b>A considered approach</b>
          <p>
            Independent discovery.
            <br />
            No checkout. No pressure.
            <br />
            Just the right material.
          </p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} {settings.brand}. All rights reserved.
        </span>
        <span>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/admin">Staff access</Link>
        </span>
      </div>
      <div className="footer-wordmark" aria-hidden="true">
        {settings.brand}
        <span>®</span>
      </div>
    </footer>
  );
}
export function EnquiryCta({ text = defaultSettings.enquiryCta }: { text?: string }) {
  return (
    <section className="enquiry-cta">
      <span className="eyebrow">FROM INSPIRATION TO SPECIFICATION</span>
      <h2>{text}</h2>
      <Link className="button dark" href="/contact">
        Tell us about your project <ArrowRight size={17} />
      </Link>
    </section>
  );
}
export function ServiceNotice({ message }: { message: string }) {
  return (
    <div className="notice" role="status">
      <strong>Catalog connection needs attention</strong>
      <p>{message}</p>
      <span>Existing data has not been replaced with demonstration records.</span>
    </div>
  );
}
