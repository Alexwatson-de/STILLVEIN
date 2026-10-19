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
        <section className="hero">
          <div className="hero-coordinate" aria-hidden="true">
            <span>01 / MATERIAL ATLAS</span>
            <span>TEXTURE · FORM · PERSPECTIVE</span>
          </div>
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="fine-line" /> NATURE, WITH A NEW PERSPECTIVE
            </div>
            <h1>
              {config.heroTitle.split('\n').map((line, i) => (
                <span key={line} className={i ? 'serif-italic' : ''}>
                  {line}
                </span>
              ))}
            </h1>
            <p>{config.heroDescription}</p>
            <div className="hero-actions">
              <Link href="/collection" className="button dark">
                Explore the collection <ArrowUpRight size={18} />
              </Link>
              <Link href="/studio" className="button text">
                <Box size={18} /> View in 3D
              </Link>
            </div>
            <div className="hero-foot">
              <span className="mini-orbit">◎</span>
              <span>
                Formed by nature.
                <br />
                <strong>Considered by you.</strong>
              </span>
              <span className="hero-foot-line" />
              <span>
                REAL TEXTURES
                <br />
                <strong>Infinite possibilities.</strong>
              </span>
            </div>
          </div>
          <div className="hero-art">
            <div className="specimen-orbit orbit-one" aria-hidden="true" />
            <div className="specimen-orbit orbit-two" aria-hidden="true" />
            {hero ? (
              <div className="hero-specimen">
                <img
                  className="hero-stone"
                  src={imageUrl(hero.url, 1800)}
                  alt={hero.alt}
                  fetchPriority="high"
                />
                <div className="specimen-edge" aria-hidden="true" />
              </div>
            ) : (
              <div className="image-fallback">Your material collection begins here.</div>
            )}
            <div className="hero-frame" />
            {products[1]?.galleryImages[0] && (
              <div
                className="satellite-stone"
                aria-hidden="true"
                style={{
                  backgroundImage: `url('${imageUrl(products[1].galleryImages[0].url, 600)}')`,
                }}
              />
            )}
            <span className="hero-art-label">THE MATERIAL STUDY — 001</span>
            <div className="hero-art-card">
              <span className="eyebrow">IN FOCUS</span>
              <h2>{products[0]?.name || 'A study in natural detail'}</h2>
              <p>
                {products[0]
                  ? `${products[0].stoneType} / ${products[0].finish}`
                  : 'Texture. Light. Dimension.'}
              </p>
              <Link
                href={products[0] ? `/materials/${products[0].slug}` : '/collection'}
                aria-label="Explore featured material"
              >
                <ArrowUpRight size={24} />
              </Link>
            </div>
            <div className="vertical-caption">EVERY VEIN TELLS A DIFFERENT STORY</div>
          </div>
          <a className="hero-scroll-cue" href="#curated-collection">
            <span className="scroll-ring">↓</span>
            <span>SCROLL TO DISCOVER</span>
          </a>
          <div className="hero-chapter" aria-hidden="true">
            <span>01</span>
            <i />
            <span>03</span>
          </div>
        </section>
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
