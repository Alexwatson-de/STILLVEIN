'use client';
// Scroll choreography, not a recolored static hero. Native scroll drives a
// reusable texture-mapped model; the functional material studio is unchanged.
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Box } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Asset, Product, SiteSettings } from '@/lib/schema';
import { imageUrl } from '@/lib/catalog';
import { clamp01, stoneFrame } from '@/lib/stone-choreography';
const ScrollStoneScene = dynamic(() => import('./scroll-stone-scene'), { ssr: false });
export function StoneJourney({
  product,
  hero,
  settings,
}: {
  product?: Product;
  hero?: Asset;
  settings: SiteSettings;
}) {
  const track = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const invalidate = useRef<() => void>(() => {});
  // Reserve the full scroll track during capability detection to prevent a
  // late layout jump when a visitor immediately uses "Skip to collection".
  const [supported, setSupported] = useState<boolean | null>(null);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState('surface');
  const lastPhase = useRef('surface');
  // The existing administrator-selected hero override remains authoritative.
  const texture = settings.heroAsset || product?.texture || hero;
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => setReduced(media.matches);
    preference();
    media.addEventListener('change', preference);
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      setSupported(!!gl);
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      setSupported(false);
    }
    return () => media.removeEventListener('change', preference);
  }, []);
  const paint = useCallback((value: number) => {
    const node = track.current;
    if (!node) return;
    const f = stoneFrame(value, innerWidth < 760);
    node.style.setProperty('--intro-opacity', String(f.introOpacity));
    node.style.setProperty('--detail-opacity', String(f.detailOpacity));
    node.style.setProperty('--space-opacity', String(f.spaceOpacity));
    node.style.setProperty('--intro-shift', `${-55 * (1 - f.introOpacity)}px`);
    node.style.setProperty('--detail-shift', `${38 * (1 - f.detailOpacity)}px`);
    node.style.setProperty('--space-shift', `${38 * (1 - f.spaceOpacity)}px`);
    node.style.setProperty('--journey-progress', String(value));
    node.style.setProperty('--finish-opacity', String(f.background));
    node.dataset.sceneProgress = value.toFixed(3);
    node.dataset.scenePhase = f.phase;
    if (lastPhase.current !== f.phase) {
      lastPhase.current = f.phase;
      setPhase(f.phase);
    }
  }, []);
  useEffect(() => {
    const node = track.current;
    if (!node) return;
    let frame = 0;
    let target = 0;
    let last = performance.now();
    let active = true;
    const tick = (time: number) => {
      frame = 0;
      const dt = Math.min(0.15, Math.max(0.001, (time - last) / 1000));
      last = time;
      progress.current += (target - progress.current) * (1 - Math.exp(-7.5 * dt));
      if (Math.abs(target - progress.current) < 0.0003) progress.current = target;
      paint(progress.current);
      invalidate.current();
      if (active && Math.abs(target - progress.current) > 0.0003)
        frame = requestAnimationFrame(tick);
    };
    const update = () => {
      if (reduced || !supported || failed) {
        target = 0;
        progress.current = 0;
        paint(0);
        invalidate.current();
        return;
      }
      const rect = node.getBoundingClientRect();
      const next = clamp01(-rect.top / Math.max(1, rect.height - innerHeight));
      if (next === target && Math.abs(progress.current - next) < 0.0003) return;
      target = next;
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [failed, paint, reduced, supported]);
  const onReady = useCallback(() => {
    setReady(true);
    paint(progress.current);
  }, [paint]);
  const onFailure = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  const interactive = supported === true && !failed && !!texture;
  const advance = () => {
    if (!track.current) return;
    const top = track.current.getBoundingClientRect().top + scrollY;
    window.scrollTo({
      top: top + (track.current.offsetHeight - innerHeight) * 0.43,
      behavior: reduced ? 'auto' : 'smooth',
    });
  };
  return (
    <section
      ref={track}
      className="stone-journey"
      data-reduced={reduced}
      data-fallback={supported === false || failed || !texture}
      data-render-state={ready ? 'ready' : 'loading'}
      aria-label="A journey through natural stone"
    >
      <div className="journey-pin">
        <div className="journey-backdrop" aria-hidden="true" />
        <div className={`journey-fallback ${ready ? 'is-covered' : ''}`}>
          {hero && (
            <img
              className="hero-stone"
              src={imageUrl(hero.url, 1400)}
              alt={hero.alt}
              fetchPriority="high"
            />
          )}
        </div>
        {interactive && (
          <ScrollStoneScene
            asset={texture!}
            progress={progress}
            invalidateRef={invalidate}
            onReady={onReady}
            onFailure={onFailure}
            roughness={product?.visualization.roughness ?? 0.25}
            reflectivity={product?.visualization.reflectivity ?? 0.4}
          />
        )}
        <div className="journey-vignette" aria-hidden="true" />
        <div className="journey-coordinate">
          <span>STILLVEIN / MATERIAL STUDY 01</span>
          <span>FORMED BY NATURE. EXPLORED BY YOU.</span>
        </div>
        <div className="journey-intro">
          <span className="eyebrow">A DIFFERENT WAY TO EXPERIENCE STONE</span>
          <h1>
            {settings.heroTitle.split('\n').map((line, i) => (
              <span key={i}>{line}</span>
            ))}
          </h1>
          <p>{settings.heroDescription}</p>
        </div>
        <div className="journey-detail" aria-hidden={phase !== 'detail'}>
          <span className="eyebrow">02 / LOOK A LITTLE CLOSER</span>
          <h2>
            Every vein.
            <br />
            <em>Every dimension.</em>
          </h2>
          <p>
            Watch the surface turn in the light. Discover the quiet details that make each material
            different.
          </p>
          <div className="journey-spec">
            <span>{product?.name || 'Natural stone'}</span>
            <span>{product?.finish || 'Material study'}</span>
          </div>
        </div>
        <div className="journey-space" aria-hidden={phase !== 'space'}>
          <span className="eyebrow">03 / FROM MATERIAL TO SPACE</span>
          <h2>
            See the
            <br />
            <em>possibilities.</em>
          </h2>
          <p>
            From a single slab to an architectural surface. Explore your material in the interactive
            studio.
          </p>
          <small>Illustrative texture-mapped form. Not a 3D scan or fabrication model.</small>
        </div>
        <div className="journey-actions">
          <Link href="/collection" className="button dark">
            Explore the collection <ArrowUpRight size={17} />
          </Link>
          <Link href="/studio" className="button text">
            <Box size={17} /> View in 3D
          </Link>
        </div>
        <div className="journey-bottom">
          <button className="journey-scroll" onClick={advance} disabled={!interactive || reduced}>
            <span>
              <ArrowDown size={16} />
            </span>
            {ready && !reduced ? 'SCROLL TO TRANSFORM' : 'MATERIAL STUDY'}
          </button>
          <div className="journey-steps" aria-label={`Material presentation: ${phase}`}>
            <span className={phase === 'surface' ? 'active' : ''}>
              01 <b>Surface</b>
            </span>
            <i />
            <span className={phase === 'detail' ? 'active' : ''}>
              02 <b>Detail</b>
            </span>
            <i />
            <span className={phase === 'space' ? 'active' : ''}>
              03 <b>Space</b>
            </span>
          </div>
          <a href="#curated-collection" className="journey-skip">
            Skip to collection ↘
          </a>
        </div>
        <div className="journey-progress" aria-hidden="true" />
      </div>
    </section>
  );
}
