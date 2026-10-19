// Explicit opt-in live acceptance test. Creates only synthetic, short-lived
// staff/material/assets; cleans them in finally. Never prints credentials.
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { services } from '../src/lib/server/firebase';
import { productSchema, Product, Asset } from '../src/lib/schema';
async function main() {
  const project = process.env.FIREBASE_PROJECT_ID;
  if (!project || process.env.CONFIRM_PROJECT !== project || process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error('Explicit CONFIRM_PROJECT is required; emulators must be off.');
  const base = new URL(
    process.env.TEST_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  ).origin;
  const hosted = new URL(base).hostname !== 'localhost';
  if (
    hosted &&
    (new URL(base).protocol !== 'https:' || process.env.CONFIRM_DEPLOYMENT !== new URL(base).host)
  )
    throw new Error(
      'Hosted testing requires HTTPS and explicit CONFIRM_DEPLOYMENT matching the exact host.',
    );
  const capMB = Number(process.env.EXPECT_MAX_IMAGE_MB || (hosted ? '4' : '10'));
  const capBytes = capMB * 1024 * 1024;
  const health = await fetch(`${base}/api/catalog?limit=1`);
  assert(health.ok, 'Catalog must be reachable before creating synthetic staff.');
  const fixture = {
    name: 'QA-stone-2048.jpg',
    mimeType: 'image/jpeg',
    buffer: await sharp('public/textures/Marble012.jpg').jpeg({ quality: 80 }).toBuffer(),
  };
  assert(fixture.buffer.byteLength < capBytes);
  const { db, auth } = services();
  const run = randomUUID().slice(0, 8);
  const id = `live-qa-${run}`;
  const email = `${id}@example.test`;
  const password = randomUUID() + 'Aa1!';
  const user = await auth.createUser({ email, password });
  await db
    .doc(`users/${user.uid}`)
    .set({ email, role: 'editor', active: true, createdAt: new Date().toISOString() });
  const signin = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const session = await signin.json();
  if (!signin.ok) {
    await auth.deleteUser(user.uid);
    await db.doc(`users/${user.uid}`).delete();
    throw new Error(`Synthetic sign-in failed: ${session.error?.message}`);
  }
  const token = session.idToken as string;
  async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(`${base}/api/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`${path}: ${response.status} ${data.error}`);
    return data as T;
  }
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  let category = '';
  let record: Product | undefined;
  const assets: Asset[] = [];
  try {
    category = (
      await api<{ id: string }>('admin/taxonomy', 'POST', {
        kind: 'category',
        name: `QA ${run}`,
        description: 'Temporary live-service test category',
      })
    ).id;
    const input = productSchema.parse({
      name: `Live QA ${run}`,
      sku: `LIVE-QA-${run}`,
      slug: id,
      categoryId: category,
      stoneType: 'Marble',
      shortDescription: 'Temporary synthetic acceptance test.',
      description: 'Synthetic test only. Not a real commercial stone or specification.',
      galleryImages: [],
      texture: null,
      price: null,
      pricingMode: 'quote',
      currency: 'USD',
      priceUnit: 'm²',
      colour: 'White',
      tones: [],
      pattern: 'Veined',
      finish: 'Polished',
      origin: '',
      classification: 'Sample',
      dimensions: { length: 2800, width: 1600 },
      thicknesses: [20],
      applications: ['Countertops'],
      care: 'Synthetic test only',
      tags: ['temporary-live-qa'],
      featured: false,
      status: 'draft',
      isSample: true,
      seoTitle: '',
      seoDescription: '',
    });
    record = await api<Product>(`admin/products/${id}`, 'PUT', { product: input });
    const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
    await page.goto(`${base}/admin`);
    await page.getByLabel('Email address', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in securely' }).click();
    await page.getByRole('heading', { name: 'A considered overview.' }).waitFor();
    await page.getByRole('button', { name: 'Materials', exact: true }).click();
    await page.getByLabel('Search admin materials').fill(input.name);
    await page.getByRole('button', { name: 'Edit / preview' }).click();
    assert((await page.locator('.upload-box small').first().innerText()).includes(`${capMB} MB`));
    await page.getByLabel('Upload image', { exact: true }).setInputFiles(fixture);
    await page.locator('.asset-tile img').nth(0).waitFor({ timeout: 120000 });
    await page.getByLabel('High-resolution texture', { exact: true }).setInputFiles(fixture);
    await page.locator('.asset-tile img').nth(1).waitFor({ timeout: 120000 });
    await page.getByRole('button', { name: 'Publish material', exact: true }).click();
    await page.getByText('Saved as published.', { exact: true }).waitFor({ timeout: 60000 });
    record = await api<Product>(`admin/products/${id}`);
    assert(record.texture);
    assets.push(...record.galleryImages, record.texture);
    assert(
      record.texture.url.startsWith(
        `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`,
      ),
    );
    assert.equal(record.texture.width, 2048);
    assert.equal(record.texture.height, 2048);
    console.log(
      'PASS: actual browser gallery/texture upload, Cloudinary delivery and Firestore asset references.',
    );
    await page
      .getByLabel('High-resolution texture', { exact: true })
      .setInputFiles({
        name: 'oversized.png',
        mimeType: 'image/png',
        buffer: Buffer.alloc(capBytes + 1),
      });
    await page.locator('.upload-box [role="alert"]').waitFor();
    assert((await page.locator('.upload-box [role="alert"]').innerText()).includes(`${capMB} MB`));
    const oversizedTicket = await api<{ ticket: string }>('admin/uploads', 'POST', {
      productId: id,
      kind: 'textures',
      mime: 'image/png',
      size: 12,
    });
    const oversized = await fetch(`${base}/api/admin/uploads/${oversizedTicket.ticket}/transfer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
      body: new Uint8Array(capBytes + 1),
    });
    assert.equal(oversized.status, 413);
    assert((await oversized.json()).error.includes(`${capMB} MB`));
    console.log(
      `PASS: ${capMB} MB upload limit enforced by both browser and actual server transfer.`,
    );
    await page.goto(`${base}/studio?material=${id}`);
    await page.locator('canvas').waitFor({ timeout: 60000 });
    await page.getByText('Loading stone texture…').waitFor({ state: 'hidden', timeout: 60000 });
    await page.getByLabel('Model preset', { exact: true }).selectOption('countertop');
    await page.getByLabel('Studio background', { exact: true }).selectOption('warm');
    await page.locator('.viewer[data-render-state="ready"]').waitFor({ timeout: 60000 });
    const canvas = sharp(await page.locator('canvas').screenshot());
    const meta = await canvas.metadata();
    const stats = await canvas
      .extract({
        left: Math.floor(meta.width! * 0.2),
        top: Math.floor(meta.height! * 0.2),
        width: Math.floor(meta.width! * 0.6),
        height: Math.floor(meta.height! * 0.6),
      })
      .stats();
    assert(
      Math.max(...stats.channels.slice(0, 3).map((c) => c.stdev)) > 3,
      'The studio must contain rendered geometry, not an empty background.',
    );
    assert.equal(await page.getByText('3D preview unavailable').count(), 0);
    console.log(
      'PASS: real Cloudinary texture rendered in interactive WebGL studio with model switching.',
    );
    const ticket = await api<{ ticket: string }>('admin/uploads', 'POST', {
      productId: id,
      kind: 'textures',
      mime: 'image/png',
      size: 12,
    });
    const invalid = await fetch(`${base}/api/admin/uploads/${ticket.ticket}/transfer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/png' },
      body: 'not-an-image',
    });
    assert.equal(invalid.status, 400);
    const unchanged = await api<Product>(`admin/products/${id}`);
    assert.equal(unchanged.texture?.assetId, record.texture.assetId);
    assert.equal((await fetch(`${base}/api/admin/products`)).status, 401);
    const publicResult = await fetch(`${base}/api/products/${id}`);
    assert(publicResult.ok);
    console.log(
      'PASS: forged image rejected, existing texture preserved, public product available and anonymous admin access denied.',
    );
    await page.goto(`${base}/materials/${id}`);
    await page.getByRole('button', { name: 'Enquire about this material' }).click();
    await page.getByLabel('Your name *', { exact: true }).fill('HOSTED QA ONLY');
    await page.getByLabel('Email address *', { exact: true }).fill(email);
    await page.getByLabel('Phone number *', { exact: true }).fill('+1 202 555 0148');
    await page
      .getByLabel('How can we help? *', { exact: true })
      .fill('Synthetic hosting acceptance test only. Not a real customer; do not contact.');
    await page.locator('input[name=consent]').check();
    await page.waitForTimeout(1600);
    await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
    await page.getByRole('heading', { name: 'Consider it received.' }).waitFor({ timeout: 30000 });
    const leads = await db.collection('enquiries').where('email', '==', email).get();
    assert.equal(leads.size, 1);
    assert.equal(leads.docs[0].get('productId'), id);
    const crossOrigin = await fetch(`${base}/api/admin/taxonomy`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Origin: 'https://untrusted.example',
      },
      body: JSON.stringify({ kind: 'category', name: 'Rejected request' }),
    });
    assert.equal(crossOrigin.status, 403);
    const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
    assert(sitemap.includes(`${base}/materials/`));
    if (hosted) assert(!sitemap.includes('localhost'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/collection`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    console.log(
      'PASS: hosted enquiry persistence, cross-origin write denial, canonical sitemap and mobile catalog layout.',
    );
  } finally {
    await browser.close();
    // Fetch latest state even if UI failed after a successful save.
    const saved = await db.doc(`products/${id}`).get();
    if (saved.exists) {
      record = { ...saved.data(), id } as Product;
      for (const a of [...record.galleryImages, ...(record.texture ? [record.texture] : [])])
        if (!assets.some((x) => x.assetId === a.assetId)) assets.push(a);
      record = await api<Product>(`admin/products/${id}`, 'PUT', {
        product: { ...record, status: 'archived' },
        revision: record.revision,
      });
      await api(`admin/products/${id}`, 'DELETE', { confirmation: record.name });
    }
    // Include uploaded but unsaved assets owned only by this synthetic staff UID.
    const orphanAssets = await db.collection('assets').where('createdBy', '==', user.uid).get();
    for (const d of orphanAssets.docs)
      if (!assets.some((a) => a.assetId === d.id)) assets.push(d.data() as Asset);
    for (const a of assets) {
      await api(`admin/assets/${a.assetId}`, 'DELETE');
      await db.doc(`assets/${a.assetId}`).delete();
    }
    if (category) await api(`admin/taxonomy/${category}`, 'DELETE');
    const tickets = await db.collection('uploadTickets').where('uid', '==', user.uid).get();
    for (const d of tickets.docs) await d.ref.delete();
    const leads = await db.collection('enquiries').where('email', '==', email).get();
    for (const d of leads.docs) await d.ref.delete();
    await auth.deleteUser(user.uid);
    await db.doc(`users/${user.uid}`).delete();
    console.log(
      'CLEANUP: synthetic staff, material, category, Cloudinary images and temporary metadata removed. Audit events retained.',
    );
  }
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Live acceptance failed:', e.message);
    process.exit(1);
  });
