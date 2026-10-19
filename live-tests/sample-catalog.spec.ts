// Live-service acceptance after explicitly requested demonstration seeding.
// Sample materials remain. KEEP_SAMPLE_ENQUIRIES=1 explicitly retains this run's
// synthetic enquiries; subsequent regression runs clean only their own enquiries.
// Temporary staff are removed; the approved owner's role/profile are never changed.
import { test, expect, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { services } from '../src/lib/server/firebase';
import { Product, Enquiry } from '../src/lib/schema';
const names = [
  'Linen Vein',
  'Silver Grain',
  'Midnight Mineral',
  'Soft Strata',
  'Rose Aggregate',
  'Quiet Granite',
];
const run = randomUUID().slice(0, 8);
const staffEmail = `sample-qa-staff-${run}@example.test`;
const password = randomUUID() + 'Aa1!';
let staffId = '';
let ownerId = '';
let ownerRole: unknown;
let ownerActive: unknown;
let enquiryId = '';
let reference = '';
const leadEmail = `sample-project-${run}@example.test`;
let suiteCompleted = false;
test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  const ownerEmail = process.env.TEST_ADMIN_EMAIL;
  if (!ownerEmail)
    throw new Error('TEST_ADMIN_EMAIL must identify the existing approved administrator.');
  const { auth, db } = services();
  const owner = await auth.getUserByEmail(ownerEmail);
  ownerId = owner.uid;
  const profile = await db.doc(`users/${ownerId}`).get();
  ownerRole = profile.get('role');
  ownerActive = profile.get('active');
  expect(ownerRole).toBe('admin');
  expect(ownerActive).toBe(true);
  const sample = (await db.doc('products/sample-1').get()).data();
  expect(sample?.isSample).toBe(true);
  const staff = await auth.createUser({ email: staffEmail, password });
  staffId = staff.uid;
  await db.doc(`users/${staffId}`).set({
    email: staffEmail,
    role: 'admin',
    active: true,
    createdAt: new Date().toISOString(),
    purpose: 'Temporary user-requested sample-data QA',
  });
});
test.afterAll(async () => {
  const { auth, db } = services();
  if (!suiteCompleted || process.env.KEEP_SAMPLE_ENQUIRIES !== '1') {
    const failedRun = await db
      .collection('enquiries')
      .where('email', 'in', [leadEmail, `sample-general-${run}@example.test`])
      .get();
    for (const d of failedRun.docs) await d.ref.delete();
  }
  if (staffId) {
    const assigned = await db.collection('enquiries').where('assignedTo', '==', staffId).get();
    for (const d of assigned.docs) await d.ref.update({ assignedTo: '' });
    await auth.deleteUser(staffId);
    await db.doc(`users/${staffId}`).delete();
  }
  const owner = await db.doc(`users/${ownerId}`).get();
  expect(owner.get('role')).toBe(ownerRole);
  expect(owner.get('active')).toBe(ownerActive);
});
async function login(page: Page) {
  await page.goto('/admin');
  await page.getByLabel('Email address', { exact: true }).fill(staffEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.getByRole('heading', { name: 'A considered overview.' })).toBeVisible();
}

test('six labelled Cloudinary-backed materials populate homepage and public product pages', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(10);
  await expect(page.locator('.hero-stone')).toBeVisible();
  expect(
    await page
      .locator('.hero-stone')
      .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
  ).toBe(true);
  const result = await (await request.get('/api/catalog?limit=24&q=SV-DEMO')).json();
  const samples = result.products.filter((p: Product) => p.id.startsWith('sample-'));
  expect(samples).toHaveLength(6);
  for (const p of samples as Product[]) {
    expect(p.isSample).toBe(true);
    expect(p.texture?.url).toContain('https://res.cloudinary.com/');
    expect(p.texture?.width).toBe(2048);
    expect(p.galleryImages).toHaveLength(1);
    // Check original availability without downloading six multi-megabyte originals.
    // Actual optimized image decoding is independently checked in the browser below.
    const image = await request.head(p.galleryImages[0].url, { timeout: 20000 });
    expect(image.ok()).toBe(true);
    const detail = await request.get(`/materials/${p.slug}`);
    expect(detail.status()).toBe(200);
  }
  for (const image of await page.locator('.collection-section .product-card img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'artifacts/qa/live-samples-home-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('search, combined filters, price/specification displays, sorting and pagination', async ({
  page,
  request,
}) => {
  await page.goto('/collection?q=SV-DEMO');
  await expect(page.locator('.product-card .sample-label')).toHaveCount(6);
  await page.getByLabel('Search materials', { exact: true }).fill('Linen');
  await expect(page).toHaveURL(/q=Linen/);
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByLabel('Stone category', { exact: true }).selectOption('granite');
  await expect(page.getByText('No materials found.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByLabel('Stone category', { exact: true }).selectOption('marble');
  await page.getByLabel('Finish', { exact: true }).selectOption('Polished');
  await expect(
    page.locator('.product-card').filter({ has: page.locator('.sample-label') }),
  ).toHaveCount(2);
  await page.getByRole('button', { name: 'Clear all filters' }).click();
  await page.getByLabel('Sort materials', { exact: true }).selectOption('price-asc');
  await expect(
    page
      .locator('.product-card')
      .filter({ has: page.locator('.sample-label') })
      .first(),
  ).toContainText('Linen Vein');
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await expect(page.locator('.list-view')).toBeVisible();
  const first = await (await request.get('/api/catalog?limit=2&sort=name')).json();
  expect(first.products).toHaveLength(2);
  expect(first.nextCursor).toBeTruthy();
  const second = await (
    await request.get(`/api/catalog?limit=2&sort=name&cursor=${first.nextCursor}`)
  ).json();
  expect(second.products).toHaveLength(2);
  expect(
    second.products.every((p: Product) => !first.products.some((q: Product) => q.id === p.id)),
  ).toBe(true);
  await page.goto('/materials/linen-vein');
  await expect(page.locator('.detail-price')).toContainText('$125.00');
  await expect(page.locator('.detail-copy')).toContainText('2800 × 1600 mm');
  await expect(page.locator('.detail-copy')).toContainText('Sample catalog material');
  await page.getByRole('button', { name: 'Zoom material image' }).click();
  await expect(page.locator('dialog[open]')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/materials/silver-grain');
  await expect(page.locator('.detail-price')).toContainText('$160.00 – $190.00');
  await page.goto('/materials/midnight-mineral');
  await expect(page.locator('.detail-price')).toContainText('Price on enquiry');
});

test('comparison persists and can remove selections', async ({ page }) => {
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

test('all six real textures load; five 3D presets, camera, background and zoom work', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  async function expectRendered() {
    await expect(page.locator('.viewer')).toHaveAttribute('data-render-state', 'ready');
    // A canvas element alone does not prove geometry rendered. Inspect its centre
    // (away from DOM captions) and reject a uniform, empty studio background.
    await expect
      .poll(async () => {
        const pixels = await page.locator('.viewer canvas').screenshot();
        const image = sharp(pixels);
        const meta = await image.metadata();
        const stats = await image
          .extract({
            left: Math.floor(meta.width! * 0.2),
            top: Math.floor(meta.height! * 0.2),
            width: Math.floor(meta.width! * 0.6),
            height: Math.floor(meta.height! * 0.6),
          })
          .stats();
        return Math.max(...stats.channels.slice(0, 3).map((c) => c.stdev));
      })
      .toBeGreaterThan(3);
  }
  await page.goto('/studio?material=linen-vein');
  await expect(page.locator('canvas')).toBeVisible();
  await expectRendered();
  for (const name of names) {
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await expect(page.locator('.studio-info h2')).toHaveText(name);
    await expect(page.locator('canvas')).toBeVisible();
    await expectRendered();
    await expect(page.getByText('3D preview unavailable')).not.toBeVisible();
  }
  for (const model of ['slab', 'vertical', 'countertop', 'floor', 'wall']) {
    await page.getByLabel('Model preset', { exact: true }).selectOption(model);
    await expect(page.getByLabel('Model preset', { exact: true })).toHaveValue(model);
    await expectRendered();
  }
  await page.getByLabel('Model preset', { exact: true }).selectOption('countertop');
  await page.getByLabel('Studio background', { exact: true }).selectOption('warm');
  await page.getByLabel('Camera angle', { exact: true }).selectOption('top');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.getByLabel('Camera angle', { exact: true }).selectOption('perspective');
  await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
  await page.waitForTimeout(1000);
  await expectRendered();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'artifacts/qa/live-samples-studio.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('product enquiry saves synthetic contact, quantities and reference correctly', async ({
  page,
}) => {
  await page.goto('/materials/linen-vein');
  await page.getByRole('button', { name: 'Enquire about this material' }).click();
  await page.getByLabel('Your name *', { exact: true }).fill('SAMPLE — Avery Stone');
  await page.getByLabel('Email address *', { exact: true }).fill(leadEmail);
  await page.getByLabel('Phone number *', { exact: true }).fill('+1 202 555 0127');
  await page.getByLabel('Company / organization').fill('Demo Architecture Studio — SAMPLE');
  await page.getByLabel('Project type', { exact: true }).fill('Sample residential kitchen');
  await page.getByLabel('Required quantity', { exact: true }).fill('25');
  await page.getByLabel('Quantity unit', { exact: true }).selectOption('m²');
  await page
    .getByLabel('Project location', { exact: true })
    .fill('Fictional demonstration project');
  await page
    .getByLabel('How can we help? *', { exact: true })
    .fill(
      'SAMPLE / QA ONLY — not a real customer or quotation request. Please demonstrate the enquiry workflow for 25 m² of Linen Vein, 20 mm thick, polished finish. Do not contact this synthetic person.',
    );
  await page.locator('input[name=consent]').check();
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Consider it received.' })).toBeVisible();
  const docs = await services().db.collection('enquiries').where('email', '==', leadEmail).get();
  expect(docs.size).toBe(1);
  const data = docs.docs[0].data();
  enquiryId = docs.docs[0].id;
  reference = data.reference;
  expect(data.productId).toBe('sample-1');
  expect(data.sku).toBe('SV-DEMO-001');
  expect(data.quantity).toBe(25);
  expect(data.status).toBe('New');
});

test('admin manages the saved sample enquiry, notes, follow-up and CSV export', async ({
  page,
}) => {
  expect(enquiryId).toBeTruthy();
  await login(page);
  await page.getByRole('button', { name: 'Conversations', exact: true }).click();
  await page.getByLabel('Search enquiries').fill(reference);
  await page.getByRole('button', { name: 'Manage →' }).click();
  await page.getByLabel('Status', { exact: true }).selectOption('Contacted');
  await page.getByLabel('Assigned to', { exact: true }).selectOption(staffId);
  const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel('Follow-up date', { exact: true }).fill(date);
  await page
    .getByLabel('Add internal note', { exact: true })
    .fill(
      'SAMPLE RECORD — synthetic contact, no action or external communication needed. QA verified the lead-management workflow.',
    );
  await page.getByRole('button', { name: 'Save follow-up' }).click();
  await expect(page.locator('.notes-list')).toContainText(
    'SAMPLE RECORD — synthetic contact, no action or external communication needed. QA verified the lead-management workflow.',
  );
  const data = (await services().db.doc(`enquiries/${enquiryId}`).get()).data() as Enquiry;
  expect(data.status).toBe('Contacted');
  expect(data.followUp).toBe(date);
  expect(data.notes).toHaveLength(1);
  expect(data.history).toHaveLength(2);
  await page.getByLabel('Assigned to', { exact: true }).selectOption('');
  await page.getByRole('button', { name: 'Save follow-up' }).click();
  await expect(page.getByLabel('Assigned to', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Save follow-up' })).toBeEnabled();
  await expect
    .poll(async () => (await services().db.doc(`enquiries/${enquiryId}`).get()).get('assignedTo'))
    .toBe('');
  await page.getByRole('button', { name: 'Back to enquiries' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export 1 visible enquiries/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('stillvein-enquiries.csv');
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The enquiry pipeline' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/qa/live-samples-admin-dashboard.png', fullPage: true });
});

test('general sample enquiry is saved once across an identical retry', async ({ request }) => {
  const payload = {
    name: 'SAMPLE — Morgan Field',
    email: `sample-general-${run}@example.test`,
    phone: '+1 202 555 0143',
    company: 'Demo Interiors — SAMPLE',
    category: 'General enquiry',
    projectType: 'Sample showroom',
    location: 'Fictional project location',
    message:
      'SAMPLE / QA ONLY — demonstrate a general enquiry. This is synthetic information, not a real customer. Do not contact.',
    consent: true,
    submissionId: randomUUID(),
  };
  const a = await request.post('/api/enquiries', { data: payload });
  expect(a.status()).toBe(201);
  const first = await a.json();
  const b = await request.post('/api/enquiries', { data: payload });
  expect(b.status()).toBe(201);
  expect((await b.json()).reference).toBe(first.reference);
  const docs = await services()
    .db.collection('enquiries')
    .where('reference', '==', first.reference)
    .get();
  expect(docs.size).toBe(1);
  expect(docs.docs[0].get('status')).toBe('New');
});

test('mobile pages remain usable and private endpoints reject anonymous access', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const url of ['/', '/collection', '/materials/linen-vein', '/contact', '/admin']) {
    await page.goto(url);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), url).toBe(
      true,
    );
  }
  await page.goto('/');
  await page.screenshot({ path: 'artifacts/qa/live-samples-home-mobile.png', fullPage: true });
  expect((await request.get('/api/admin/products')).status()).toBe(401);
  expect((await request.get('/api/admin/enquiries')).status()).toBe(401);
  expect(
    (await request.post('/api/enquiries', { data: { name: 'Invalid', consent: false } })).status(),
  ).toBe(400);
  suiteCompleted = true;
});
