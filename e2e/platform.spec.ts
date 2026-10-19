import { test, expect, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
const run = randomUUID().slice(0, 8);
const email = `browser-${run}@example.test`;
const password = randomUUID() + 'Aa1!';
let uid = '';
test.beforeAll(async () => {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  if (!getApps().length) initializeApp({ projectId: 'demo-stillvein' });
  const user = await getAuth().createUser({ email, password });
  uid = user.uid;
  await getFirestore().doc(`users/${uid}`).set({ email, role: 'admin', active: true });
});
test.afterAll(async () => {
  await getAuth().deleteUser(uid);
  await getFirestore().doc(`users/${uid}`).delete();
  const enquiries = await getFirestore().collection('enquiries').where('email', '==', email).get();
  for (const doc of enquiries.docs) await doc.ref.delete();
  const products = await getFirestore()
    .collection('products')
    .where('sku', '==', `BROWSER-${run}`)
    .get();
  for (const d of products.docs) await d.ref.delete();
});
async function login(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.getByRole('heading', { name: 'A considered overview.' })).toBeVisible();
}
test('homepage photography, links, accessibility structure and desktop layout', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('A quieter kind');
  await expect(page.locator('.product-card')).toHaveCount(10);
  await expect(page.locator('.hero-stone')).toBeVisible();
  expect(
    await page.locator('.hero-stone').evaluate((e: HTMLImageElement) => e.naturalWidth),
  ).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/qa/home-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('debounced URL search, combined filters, list view and reset', async ({ page }) => {
  await page.goto('/collection');
  await expect(page.locator('.product-card')).toHaveCount(6);
  await page.getByLabel('Search materials', { exact: true }).fill('Linen');
  await expect(page).toHaveURL(/q=Linen/);
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByLabel('Stone category', { exact: true }).selectOption('granite');
  await expect(page.getByText('No materials found.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await expect(page.locator('.list-view')).toBeVisible();
  await page.getByLabel('Sort materials', { exact: true }).selectOption('price-asc');
  await expect(page).toHaveURL(/sort=price-asc/);
});
test('comparison persists across navigation', async ({ page }) => {
  await page.goto('/collection');
  await page.getByRole('button', { name: 'Add to comparison' }).nth(0).click();
  await page.getByRole('button', { name: 'Add to comparison' }).nth(1).click();
  await page.goto('/compare');
  await expect(page.locator('.compare-column')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.compare-column')).toHaveCount(2);
  await page.getByRole('button', { name: 'Remove from comparison' }).first().click();
  await expect(page.locator('.compare-column')).toHaveCount(1);
});
test('detail gallery, sample pricing and enquiry persistence', async ({ page }) => {
  await page.goto('/materials/linen-vein');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Linen Vein');
  await expect(page.locator('.detail-price')).toContainText('$125.00');
  await page.getByRole('button', { name: 'Zoom material image' }).click();
  await expect(page.locator('dialog[open]')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Enquire about this material' }).click();
  await page.getByLabel('Your name *', { exact: true }).fill('Browser QA');
  await page.getByLabel('Email address *', { exact: true }).fill(email);
  await page.getByLabel('Phone number *', { exact: true }).fill('+10000000000');
  await page
    .getByLabel('How can we help? *', { exact: true })
    .fill('Synthetic browser enquiry for QA only.');
  await page.locator('input[name=consent]').check();
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Consider it received.' })).toBeVisible();
  const data = await getFirestore().collection('enquiries').where('email', '==', email).get();
  expect(data.size).toBe(1);
  expect(data.docs[0].get('productId')).toBe('sample-1');
});
test('3D texture loads, model/background/camera switches and camera reset', async ({ page }) => {
  await page.goto('/studio?material=linen-vein');
  await expect(page.locator('canvas')).toBeVisible({ timeout: 45000 });
  await expect(page.getByText('Loading stone texture…')).not.toBeVisible({ timeout: 45000 });
  await expect(page.getByText('3D preview unavailable')).not.toBeVisible();
  for (const model of ['vertical', 'countertop', 'floor', 'wall', 'slab']) {
    await page.getByLabel('Model preset', { exact: true }).selectOption(model);
    await expect(page.getByLabel('Model preset', { exact: true })).toHaveValue(model);
  }
  await page.getByLabel('Studio background', { exact: true }).selectOption('dark');
  await page.getByLabel('Camera angle', { exact: true }).selectOption('front');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 10 });
    await page.mouse.up();
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'artifacts/qa/studio-desktop.png', fullPage: true });
});
test('WebGL unavailable fallback keeps product usable', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.goto('/materials/linen-vein');
  await page.getByRole('button', { name: 'Launch interactive 3D preview' }).click();
  await expect(page.getByRole('heading', { name: '3D preview unavailable' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enquire about this material' })).toBeVisible();
});
test('admin login, product create, edit, draft and archive', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Materials', exact: true }).click();
  await page.getByRole('button', { name: 'New material', exact: true }).click();
  await page.getByLabel('Material name *', { exact: true }).fill(`Browser material ${run}`);
  await page.getByLabel('Unique SKU *', { exact: true }).fill(`BROWSER-${run}`);
  await page.getByLabel('URL slug *', { exact: true }).fill(`browser-${run}`);
  await page.getByRole('button', { name: 'Save draft / unpublish' }).click();
  await expect(page.getByText('Saved as draft.', { exact: true })).toBeVisible();
  await page.getByLabel('Material name *', { exact: true }).fill(`Edited material ${run}`);
  await page.getByRole('button', { name: 'Save draft / unpublish' }).click();
  await expect(page.getByText('Saved as draft.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(page.getByText('Saved as archived.', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/qa/admin-editor.png', fullPage: true });
});
test('admin upload configuration error preserves existing image', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Materials', exact: true }).click();
  await page.getByLabel('Search admin materials').fill('Linen Vein');
  await page.getByRole('button', { name: 'Edit / preview' }).click();
  await page
    .getByLabel('High-resolution texture', { exact: true })
    .setInputFiles('public/textures/marble_01.jpg');
  await expect(page.locator('.upload-box [role="alert"]')).toContainText('CLOUDINARY');
  await expect(page.locator('.asset-tile img').first()).toBeVisible();
});
test('admin texture settings save and public studio receives updated defaults', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: 'Materials', exact: true }).click();
  await page.getByLabel('Search admin materials').fill('Linen Vein');
  await page.getByRole('button', { name: 'Edit / preview' }).click();
  await page.getByRole('button', { name: 'Preview 3D configuration', exact: true }).click();
  await page.getByLabel('Model preset', { exact: true }).selectOption('vertical');
  await page.getByRole('button', { name: 'Publish material', exact: true }).click();
  await expect(page.getByText('Saved as published.', { exact: true })).toBeVisible();
  await page.goto('/studio?material=linen-vein');
  await expect(page.getByLabel('Model preset', { exact: true })).toHaveValue('vertical');
  await getFirestore().doc('products/sample-1').update({ 'visualization.model': 'slab' });
});
test('responsive public pages have no horizontal overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/', '/collection', '/materials/linen-vein', '/contact', '/admin']) {
    await page.goto(path);
    await page.waitForTimeout(600);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
  }
  await page.goto('/');
  await page.screenshot({ path: 'artifacts/qa/home-mobile.png', fullPage: true });
});
