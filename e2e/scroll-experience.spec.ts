import { test, expect, Page } from '@playwright/test';
import sharp from 'sharp';
async function scrollToProgress(page: Page, progress: number) {
  await page.evaluate((p) => {
    const track = document.querySelector<HTMLElement>('.stone-journey')!;
    scrollTo({
      top: track.getBoundingClientRect().top + scrollY + (track.offsetHeight - innerHeight) * p,
      behavior: 'instant',
    });
  }, progress);
  await expect
    .poll(
      async () => Number(await page.locator('.stone-journey').getAttribute('data-scene-progress')),
      { timeout: 30000 },
    )
    .toBeCloseTo(progress, 2);
}
async function actualPixels(page: Page) {
  const img = sharp(await page.locator('.journey-canvas canvas').screenshot());
  const size = await img.metadata();
  const stats = await img
    .extract({
      left: Math.floor(size.width! * 0.2),
      top: Math.floor(size.height! * 0.3),
      width: Math.floor(size.width! * 0.65),
      height: Math.floor(size.height! * 0.4),
    })
    .stats();
  expect(Math.max(...stats.channels.slice(0, 3).map((c) => c.stdev))).toBeGreaterThan(5);
}

test('native scroll pins the WebGL stage, rotates the slab, moves the camera and assembles a countertop', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.stone-journey')).toHaveAttribute('data-render-state', 'ready', {
    timeout: 45000,
  });
  await scrollToProgress(page, 0);
  const first = JSON.parse(
    (await page.locator('.journey-canvas canvas').getAttribute('data-scroll-pose'))!,
  );
  await actualPixels(page);
  await page.screenshot({ path: 'artifacts/qa/revolution-scroll-surface.png' });
  await scrollToProgress(page, 0.46);
  await expect(page.locator('.stone-journey')).toHaveAttribute('data-scene-phase', 'detail');
  expect(
    await page.locator('.journey-pin').evaluate((e) => Math.abs(e.getBoundingClientRect().top) < 2),
  ).toBe(true);
  const detail = JSON.parse(
    (await page.locator('.journey-canvas canvas').getAttribute('data-scroll-pose'))!,
  );
  expect(detail.rotation).not.toEqual(first.rotation);
  expect(detail.camera).not.toEqual(first.camera);
  await actualPixels(page);
  await page.screenshot({ path: 'artifacts/qa/revolution-scroll-detail.png' });
  await scrollToProgress(page, 0.97);
  await expect(page.locator('.stone-journey')).toHaveAttribute('data-scene-phase', 'space');
  const last = JSON.parse(
    (await page.locator('.journey-canvas canvas').getAttribute('data-scroll-pose'))!,
  );
  expect(last.sideReveal).toBeGreaterThan(0.98);
  await actualPixels(page);
  await page.screenshot({ path: 'artifacts/qa/revolution-scroll-space.png' });
  await scrollToProgress(page, 0.15);
  const reversed = JSON.parse(
    (await page.locator('.journey-canvas canvas').getAttribute('data-scroll-pose'))!,
  );
  expect(reversed.sideReveal).toBe(0);
  expect(reversed.rotation[2]).toBeGreaterThan(1);
  await page.getByRole('link', { name: 'Skip to collection', exact: false }).click();
  await expect(page.locator('#curated-collection')).toBeInViewport();
  expect(errors).toEqual([]);
});

test('mobile scrolling transforms real geometry without horizontal overflow or blocking page scroll', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.stone-journey')).toHaveAttribute('data-render-state', 'ready', {
    timeout: 45000,
  });
  for (const [phase, progress] of [
    ['surface', 0],
    ['detail', 0.46],
    ['space', 0.97],
  ] as const) {
    await scrollToProgress(page, progress);
    await actualPixels(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/qa/revolution-scroll-mobile-${phase}.png` });
  }
  await page.mouse.wheel(0, 900);
  await expect(page.locator('#curated-collection')).toBeInViewport();
});

test('section content reveals on entering the viewport and ordinary links still work', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Skip to collection', exact: false }).click();
  const heading = page.locator('.collection-section .section-heading');
  await expect(heading).toHaveAttribute('data-scroll-reveal', 'visible');
  await expect(heading).toHaveCSS('opacity', '1');
  const card = page.locator('.collection-section .product-card').first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveAttribute('data-scroll-reveal', 'visible');
  await expect(card).toHaveCSS('opacity', '1');
  await card.locator('.product-title').click();
  await expect(page).toHaveURL(/\/materials\//);
});

test('reduced motion and missing WebGL retain a short, usable static introduction', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.stone-journey')).toHaveAttribute('data-reduced', 'true');
  await expect(page.locator('.journey-pin')).toHaveCSS('position', 'relative');
  expect(
    await page.locator('.stone-journey').evaluate((e) => e.getBoundingClientRect().height),
  ).toBeLessThanOrEqual(1100);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.goto('/');
  await expect(page.locator('.stone-journey')).toHaveAttribute('data-fallback', 'true');
  await expect(page.locator('.journey-fallback .hero-stone')).toBeVisible();
  await page.getByRole('link', { name: 'Explore the collection', exact: true }).click();
  await expect(page).toHaveURL(/\/collection/);
});
