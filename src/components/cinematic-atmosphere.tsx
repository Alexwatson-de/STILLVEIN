'use client';
// Progressive, presentation-only scrolling enhancements. Native wheel/touch,
// keyboard navigation and all application interactions are never intercepted.
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
export function CinematicAtmosphere() {
  const pathname = usePathname();
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const main = document.querySelector<HTMLElement>('#main');
    if (!main || main.classList.contains('admin-main')) return;
    const tracked = new Set<HTMLElement>();
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const node = entry.target as HTMLElement;
            node.dataset.scrollReveal = 'visible';
            observer.unobserve(node);
          }
        }
      },
      { threshold: 0.04, rootMargin: '0px 0px -24px 0px' },
    );
    const collect = () => {
      const candidates = main.querySelectorAll<HTMLElement>(
        '.section-heading,.product-card,.applications>a,.studio-feature-copy>*,.contact-side',
      );
      candidates.forEach((node, index) => {
        if (tracked.has(node)) return;
        tracked.add(node);
        node.style.setProperty(
          '--reveal-delay',
          `${node.classList.contains('product-card') ? (index % 3) * 65 : 0}ms`,
        );
        node.dataset.scrollReveal = media.matches ? 'visible' : 'pending';
        if (!media.matches) observer.observe(node);
      });
    };
    const motionPreference = () => {
      if (media.matches) {
        tracked.forEach((node) => (node.dataset.scrollReveal = 'visible'));
        observer.disconnect();
      }
    };
    const parallax = () => {
      frame = 0;
      if (media.matches) return;
      const art = main.querySelector<HTMLElement>('.studio-feature-art');
      if (!art) return;
      const rect = art.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      art.style.setProperty(
        '--section-drift',
        `${Math.max(-35, Math.min(35, (innerHeight / 2 - rect.top - rect.height / 2) * 0.08))}px`,
      );
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(parallax);
    };
    collect();
    const mutations = new MutationObserver(collect);
    mutations.observe(main, { childList: true, subtree: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    media.addEventListener('change', motionPreference);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      media.removeEventListener('change', motionPreference);
      tracked.forEach((node) => {
        delete node.dataset.scrollReveal;
        node.style.removeProperty('--reveal-delay');
      });
    };
  }, [pathname]);
  return <div className="ambient-grain" aria-hidden="true" />;
}
