import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  MoveUpRight,
  Layers3,
  Scan,
  SlidersHorizontal,
} from 'lucide-react';
import { Header, Footer, EnquiryCta, ServiceNotice } from '@/components/chrome';
import { ProductCard } from '@/components/product-card';
import { catalog, settings, taxonomy, featuredProducts } from '@/lib/server/data';
import { defaultSettings, Product, Taxonomy } from '@/lib/schema';
import { imageUrl } from '@/lib/catalog';
import { StoneJourney } from '@/components/stone-journey';
export const dynamic = 'force-dynamic';
export default async function Home() {
  let config = defaultSettings;
  let products: Product[] = [];
  let recent: Product[] = [];
  let types: Taxonomy[] = [];
  let error = '';
  let total = 0;
  try {
    config = await settings();
    const result = await catalog(new URLSearchParams({ featured: 'true', limit: '6' }));
    products = config.featuredIds.length
      ? await featuredProducts(config.featuredIds)
      : result.products;
    total = result.total;
    recent = (await catalog(new URLSearchParams({ sort: 'newest', limit: '4' }))).products;
    types = (await taxonomy()).filter((t) => t.kind === 'category');
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unable to connect to the catalog.';
  }
  const hero = config.heroAsset || products[0]?.galleryImages[0];
  return (
    <>
      <Header settings={config} />
      <main id="main">
        <StoneJourney product={products[0]} hero={hero} settings={config} />
        <div className="editorial-strip">
          <span>AN INDEPENDENT MATERIAL LIBRARY</span>
          <span>Natural variation. Extraordinary character.</span>
          <span>
            <i /> EXPLORE IN THREE DIMENSIONS
          </span>
        </div>
        {error && (
          <div className="section">
            <ServiceNotice message={error} />
          </div>
        )}
        <section className="section collection-section" id="curated-collection">
          <div className="section-heading">
            <div>
              <span className="eyebrow">01 / THE COLLECTION</span>
              <h2>
                Distinct by nature.
                <br />
                <em>Selected with intention.</em>
              </h2>
            </div>
            <div className="heading-aside">
              <p>
                Quiet surfaces. Bold statements. Discover materials
                <br />
                that bring your vision into focus.
              </p>
              <Link className="text-link" href="/collection">
                View all {total || ''} materials <ArrowRight size={17} />
              </Link>
            </div>
          </div>
          <div className="category-tabs">
            <Link className="active" href="/collection">
              Curated selection
            </Link>
            {types.slice(0, 5).map((t) => (
              <Link key={t.id} href={`/collection?category=${t.id}`}>
                {t.name}
              </Link>
            ))}
          </div>
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {!products.length && !error && (
            <div className="empty">The collection is being curated. Please return soon.</div>
          )}
        </section>
        <section className="studio-feature">
          <div className="studio-feature-art">
            {products[1]?.galleryImages[0] && (
              <div
                className="floating-slab"
                style={{
                  backgroundImage: `url('${imageUrl(products[1].galleryImages[0].url, 1200)}')`,
                }}
              />
            )}
            <div className="studio-axis">
              <span>X</span>
              <span>Y</span>
              <span>Z</span>
            </div>
            <span className="studio-art-note">TEXTURE × FORM × LIGHT</span>
            <div className="studio-chip">
              <span className="status-dot" /> INTERACTIVE MATERIAL STUDIO <Box size={16} />
            </div>
          </div>
          <div className="studio-feature-copy">
            <span className="eyebrow">02 / A NEW DIMENSION</span>
            <h2>
              Don’t just imagine it.
              <br />
              <em>Experience it.</em>
            </h2>
            <p>
              Meet your material in a different light. Rotate a slab, explore a countertop, or see a
              surface come together. One material. A new perspective.
            </p>
            <div className="feature-list">
              <span>
                <Scan size={19} /> Real stone textures
              </span>
              <span>
                <Layers3 size={19} /> Architectural model presets
              </span>
              <span>
                <SlidersHorizontal size={19} /> Light & finish controls
              </span>
            </div>
            <Link className="button dark" href="/studio">
              Enter the material studio <MoveUpRight size={17} />
            </Link>
            <small>Image-mapped previews. Not 3D scans. Natural variation is expected.</small>
          </div>
        </section>
        {config.showApplications && (
          <section className="section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">03 / MATERIAL MEETS SPACE</span>
                <h2>
                  Made for your <em>next chapter.</em>
                </h2>
              </div>
              <p>Find the right surface for the way a space is lived.</p>
            </div>
            <div className="applications">
              {[
                'Countertops',
                'Flooring',
                'Wall cladding',
                'Bathrooms',
                'Stairs',
                'Feature walls',
              ].map((a, i) => (
                <Link key={a} href={`/collection?application=${encodeURIComponent(a)}`}>
                  <span>0{i + 1}</span>
                  <h3>{a}</h3>
                  <ArrowUpRight size={20} />
                </Link>
              ))}
            </div>
          </section>
        )}
        {config.showRecent && recent.length > 0 && (
          <section className="section recent-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">FRESH PERSPECTIVES</span>
                <h2>New to the atlas.</h2>
              </div>
              <Link className="text-link" href="/collection?sort=newest">
                See latest additions <ArrowRight size={17} />
              </Link>
            </div>
            <div className="product-grid four">
              {recent.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
        <EnquiryCta text={config.enquiryCta} />
      </main>
      <Footer settings={config} />
    </>
  );
}
