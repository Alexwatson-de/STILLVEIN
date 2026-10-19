import { test, expect } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
test.beforeAll(() => {
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  if (!getApps().length) initializeApp({ projectId: 'demo-stillvein' });
});
test('missing texture preserves gallery, details and enquiry', async ({ page }) => {
  const ref = getFirestore().doc('products/sample-1');
  const old = (await ref.get()).get('texture');
  try {
    await ref.update({ texture: null });
    await page.goto('/materials/linen-vein');
    await expect(
      page.getByText('A visualization texture has not been added', { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enquire about this material' })).toBeVisible();
    await expect(page.locator('.gallery-main img')).toBeVisible();
  } finally {
    await ref.update({ texture: old });
  }
});
test('failed texture request is contained by the WebGL error boundary', async ({ page }) => {
  await page.route('**/textures/Marble012.jpg', (route) => route.abort('failed'));
  await page.goto('/studio?material=linen-vein');
  await expect(page.getByRole('heading', { name: '3D preview unavailable' })).toBeVisible({
    timeout: 45000,
  });
  await expect(page.getByRole('link', { name: 'Specifications & enquiry' })).toBeVisible();
});
test('catalog network failure has a visible recoverable error', async ({ page }) => {
  await page.route('**/api/catalog*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Synthetic service interruption' }),
    }),
  );
  await page.goto('/collection');
  await expect(page.getByText('Synthetic service interruption')).toBeVisible();
  await page.unroute('**/api/catalog*');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(6);
});
test('public API strips private fields even if present in storage', async ({ request }) => {
  const ref = getFirestore().doc('products/sample-1');
  await ref.update({ privateCost: 123, supplierSecret: 'private QA value' });
  try {
    for (const path of [
      '/api/products/linen-vein',
      '/api/compare/sample-1',
      '/api/catalog?q=Linen',
    ]) {
      const response = await request.get(path);
      expect(response.ok()).toBe(true);
      expect(await response.text()).not.toContain('supplierSecret');
    }
  } finally {
    const { FieldValue } = await import('firebase-admin/firestore');
    await ref.update({ privateCost: FieldValue.delete(), supplierSecret: FieldValue.delete() });
  }
});
