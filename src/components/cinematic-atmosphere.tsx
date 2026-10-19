'use client';
// Presentation only. No navigation interception, scroll-jacking or data access.
// The natural scroll position and all native pointer/keyboard controls remain intact.
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
export function CinematicAtmosphere() {
  const pathname = usePathname();
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) return;
    const hero = document.querySelector<HTMLElement>('.hero');
    if (!hero) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    let scroll = 0;
    const paint = () => {
      frame = 0;
      hero.style.setProperty('--drift-x', `${x}px`);
      hero.style.setProperty('--drift-y', `${y}px`);
      hero.style.setProperty('--hero-scroll', `${scroll}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const rect = hero.getBoundingClientRect();
      x = (event.clientX / innerWidth - 0.5) * 14;
      y = ((event.clientY - rect.top) / rect.height - 0.5) * 10;
      schedule();
    };
    const leave = () => {
      x = 0;
      y = 0;
      schedule();
    };
    const onScroll = () => {
      scroll = Math.min(70, Math.max(0, -hero.getBoundingClientRect().top * 0.12));
      schedule();
    };
    hero.addEventListener('pointermove', pointer, { passive: true });
    hero.addEventListener('pointerleave', leave);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      hero.removeEventListener('pointermove', pointer);
      hero.removeEventListener('pointerleave', leave);
      window.removeEventListener('scroll', onScroll);
      hero.style.removeProperty('--drift-x');
      hero.style.removeProperty('--drift-y');
      hero.style.removeProperty('--hero-scroll');
    };
  }, [pathname]);
  return <div className="ambient-grain" aria-hidden="true" />;
}
