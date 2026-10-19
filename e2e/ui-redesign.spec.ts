// UI-only regression coverage. All database writes here target isolated emulators.
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
const run = randomUUID().slice(0, 8);
const email = `ui-review-${run}@example.test`;
const password = randomUUID() + 'Aa1!';
let uid = '';
test.beforeAll(async () => {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  if (!getApps().length) initializeApp({ projectId: 'demo-stillvein' });
  const u = await getAuth().createUser({ email, password });
  uid = u.uid;
  await getFirestore().doc(`users/${uid}`).set({ email, role: 'admin', active: true });
});
test.afterAll(async () => {
  if (uid) {
    await getAuth().deleteUser(uid);
    await getFirestore().doc(`users/${uid}`).delete();
  }
});

test('all public pages use the neutral stone UI without overflow at phone, tablet and desktop widths', async ({
  page,
}) => {
  test.setTimeout(180000);
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    for (const route of [
      '/',
      '/collection',
      '/materials/linen-vein',
      '/studio?material=linen-vein',
      '/contact',
      '/privacy',
      '/terms',
      '/compare',
      '/admin',
    ]) {
      await page.goto(route);
      await expect(page.locator('#main')).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      expect(
        await page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(),
        ),
      ).toBe('#f3f0e9');
    }
  }
});

test('reduced motion, keyboard navigation and enquiry dialog remain accessible', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.stone-journey')).toHaveAttribute('data-reduced', 'true');
  await expect(page.locator('.journey-pin')).toHaveCSS('position', 'relative');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeInViewport();
  await page.goto('/materials/linen-vein');
  await page.getByRole('button', { name: 'Enquire about this material' }).click();
  await expect(page.locator('dialog[open]')).toBeVisible();
  await expect(page.getByLabel('Your name *', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('admin overview and all management areas retain controls in the new design', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.getByRole('heading', { name: 'A considered overview.' })).toBeVisible();
  await expect(page.locator('.metric')).not.toHaveCount(0);
  await page.screenshot({ path: 'artifacts/qa/revolution-admin-overview.png', fullPage: true });
  const tabs = [
    ['Materials', 'Materials'],
    ['Categories & attributes', 'Categories & attributes'],
    ['Image library', 'Image library'],
    ['Conversations', 'Conversations'],
    ['Site & brand', 'Site & brand'],
    ['People & permissions', 'People & permissions'],
    ['Audit trail', 'Audit trail'],
  ];
  for (const [tab, heading] of tabs) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `artifacts/qa/revolution-admin-${tab.toLowerCase().replaceAll(' ', '-').replaceAll('&', 'and')}.png`,
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: 'Materials', exact: true }).click();
  await page.getByLabel('Search admin materials').fill('Linen Vein');
  await page.getByRole('button', { name: 'Edit / preview' }).click();
  await expect(page.getByLabel('Material name *', { exact: true })).toHaveValue('Linen Vein');
  await expect(page.getByRole('button', { name: 'Publish material', exact: true })).toBeVisible();
  await page.screenshot({
    path: 'artifacts/qa/revolution-admin-product-editor.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/qa/revolution-admin-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('updated public screens render actual content and unchanged studio controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/collection');
  await expect(page.locator('.product-card')).toHaveCount(6);
  await page.screenshot({ path: 'artifacts/qa/revolution-collection-desktop.png', fullPage: true });
  await page.goto('/materials/linen-vein');
  await expect(page.locator('.detail-price')).toContainText('$125.00');
  await page.screenshot({ path: 'artifacts/qa/revolution-material-desktop.png', fullPage: true });
  await page.goto('/studio?material=linen-vein');
  await expect(page.locator('.viewer')).toHaveAttribute('data-render-state', 'ready');
  await expect(page.getByLabel('Model preset', { exact: true })).toHaveValue('slab');
  await page.screenshot({ path: 'artifacts/qa/revolution-studio-desktop.png', fullPage: true });
  await page.goto('/contact');
  await expect(page.getByRole('button', { name: 'Send enquiry', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/qa/revolution-contact-desktop.png', fullPage: true });
});
