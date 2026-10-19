import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const run = randomUUID().slice(0, 8);
const credentials: Record<string, { uid: string; token: string }> = {};
let sample: Record<string, unknown>;
let revision = 0;
let enquiryId = '';
const productId = `qa-${run}`;
const enquiryEmail = `qa-${run}@example.test`;
const headers = (role?: string) => ({
  'Content-Type': 'application/json',
  ...(role ? { Authorization: `Bearer ${credentials[role].token}` } : {}),
});
async function request(path: string, method = 'GET', body?: unknown, role?: string) {
  return fetch(`${base}/api/${path}`, {
    method,
    headers: headers(role),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
describe.skipIf(process.env.TEST_EMULATORS !== '1')('Real API + Auth/Firestore emulators', () => {
  beforeAll(async () => {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    if (!getApps().length) initializeApp({ projectId: 'demo-stillvein' });
    for (const role of ['admin', 'editor', 'sales', 'outsider']) {
      const password = randomUUID() + 'Aa1!';
      const email = `qa-${role}-${run}@example.test`;
      const u = await getAuth().createUser({ email, password });
      if (role !== 'outsider')
        await getFirestore().doc(`users/${u.uid}`).set({ email, role, active: true });
      const response = await fetch(
        'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        },
      );
      credentials[role] = { uid: u.uid, token: (await response.json()).idToken };
    }
    const r = await request('catalog');
    sample = (await r.json()).products[0];
    expect(sample).toBeTruthy();
  });
  afterAll(async () => {
    const db = getFirestore();
    await db.doc(`products/${productId}`).delete();
    if (enquiryId) await db.doc(`enquiries/${enquiryId}`).delete();
    for (const x of Object.values(credentials)) {
      await getAuth().deleteUser(x.uid);
      await db.doc(`users/${x.uid}`).delete();
    }
  });
  it('denies anonymous privileged reads', async () =>
    expect((await request('admin/products')).status).toBe(401));
  it('rejects invalid bearer token', async () => {
    const r = await fetch(`${base}/api/admin/me`, { headers: { Authorization: 'Bearer invalid' } });
    expect(r.status).toBe(401);
  });
  it('denies authenticated non-staff', async () =>
    expect((await request('admin/me', 'GET', undefined, 'outsider')).status).toBe(403));
  it('enforces editor and sales separation', async () => {
    expect((await request('admin/enquiries', 'GET', undefined, 'editor')).status).toBe(403);
    expect((await request('admin/products', 'GET', undefined, 'sales')).status).toBe(403);
  });
  it('rejects cross-origin writes', async () => {
    const r = await fetch(`${base}/api/admin/taxonomy`, {
      method: 'POST',
      headers: { ...headers('admin'), Origin: 'https://attacker.example' },
      body: '{}',
    });
    expect(r.status).toBe(403);
  });
  it('creates a draft and hides it from public slug and comparison routes', async () => {
    const p = {
      ...sample,
      name: `QA ${run}`,
      sku: `QA-${run}`,
      slug: `qa-${run}`,
      status: 'draft',
    };
    const r = await request(`admin/products/${productId}`, 'PUT', { product: p }, 'editor');
    expect(r.status).toBe(200);
    const d = await r.json();
    revision = d.revision;
    expect((await request(`products/qa-${run}`)).status).toBe(404);
    expect((await request(`compare/${productId}`)).status).toBe(404);
  });
  it('detects stale writes', async () => {
    const p = {
      ...sample,
      name: `QA ${run}`,
      sku: `QA-${run}`,
      slug: `qa-${run}`,
      status: 'draft',
    };
    expect(
      (await request(`admin/products/${productId}`, 'PUT', { product: p, revision: 0 }, 'editor'))
        .status,
    ).toBe(409);
  });
  it('publishes and persists metadata', async () => {
    const p = {
      ...sample,
      name: `QA ${run}`,
      sku: `QA-${run}`,
      slug: `qa-${run}`,
      status: 'published',
      colour: 'QA colour',
    };
    const r = await request(
      `admin/products/${productId}`,
      'PUT',
      { product: p, revision },
      'editor',
    );
    expect(r.status).toBe(200);
    revision = (await r.json()).revision;
    const publicResult = await (await request(`products/qa-${run}`)).json();
    expect(publicResult.colour).toBe('QA colour');
  });
  it('prevents conflicting SKU and slug', async () => {
    expect(
      (await request(`admin/products/qa-dupe-${run}`, 'PUT', { product: sample }, 'editor')).status,
    ).toBe(409);
  });
  it('rejects unverified image replacement without losing existing data', async () => {
    const current = await (
      await request(`admin/products/${productId}`, 'GET', undefined, 'editor')
    ).json();
    const old = current.galleryImages[0].url;
    const r = await request(
      `admin/products/${productId}`,
      'PUT',
      {
        product: {
          ...current,
          galleryImages: [
            { ...current.galleryImages[0], url: 'https://attacker.example/test.jpg' },
          ],
        },
        revision,
      },
      'editor',
    );
    expect(r.status).toBe(400);
    const after = await (
      await request(`admin/products/${productId}`, 'GET', undefined, 'editor')
    ).json();
    expect(after.galleryImages[0].url).toBe(old);
  });
  it('supports combined filtering and bounded pagination', async () => {
    const first = await (await request('catalog?category=marble&finish=Polished&limit=1')).json();
    expect(first.products.length).toBeLessThanOrEqual(1);
    for (const p of first.products) {
      expect(p.categoryId).toBe('marble');
      expect(p.finish).toBe('Polished');
    }
    if (first.nextCursor) {
      const next = await (
        await request(`catalog?limit=1&category=marble&finish=Polished&cursor=${first.nextCursor}`)
      ).json();
      expect(next.products.every((p: { id: string }) => p.id !== first.products[0]?.id)).toBe(true);
    }
  });
  it('requires auth before upload configuration lookup', async () => {
    expect(
      (
        await request('admin/uploads', 'POST', {
          productId: 'x',
          kind: 'textures',
          mime: 'image/png',
          size: 10,
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(
          'admin/uploads',
          'POST',
          { productId: 'x', kind: 'textures', mime: 'image/png', size: 10 },
          'sales',
        )
      ).status,
    ).toBe(403);
  });
  it('reports missing Cloudinary credentials instead of fake upload success', async () => {
    const r = await request(
      'admin/uploads',
      'POST',
      { productId: productId, kind: 'textures', mime: 'image/png', size: 100 },
      'editor',
    );
    expect(r.status).toBe(503);
    expect((await r.json()).error).toContain('CLOUDINARY');
  });
  it('validates enquiry consent and required fields', async () =>
    expect((await request('enquiries', 'POST', { name: 'x', consent: false })).status).toBe(400));
  it('saves an enquiry once across retries, with authoritative product data', async () => {
    const p = {
      name: 'Synthetic QA',
      email: enquiryEmail,
      phone: '+10000000000',
      category: 'Material quotation',
      productId,
      quantity: 20,
      unit: 'm²',
      message: 'Synthetic integration test enquiry only.',
      consent: true,
      submissionId: randomUUID(),
    };
    const a = await request('enquiries', 'POST', p);
    expect(a.status).toBe(201);
    const one = await a.json();
    const b = await (await request('enquiries', 'POST', p)).json();
    expect(b.reference).toBe(one.reference);
    const ds = await getFirestore()
      .collection('enquiries')
      .where('reference', '==', one.reference)
      .get();
    expect(ds.size).toBe(1);
    enquiryId = ds.docs[0].id;
    expect(ds.docs[0].get('sku')).toBe(`QA-${run}`);
  });
  it('updates enquiry status, history, assignment and private notes', async () => {
    const r = await request(
      `admin/enquiries/${enquiryId}`,
      'PUT',
      {
        status: 'Contacted',
        assignedTo: credentials.sales.uid,
        followUp: '2026-12-20',
        note: 'Private QA note',
        revision: 1,
      },
      'sales',
    );
    expect(r.status).toBe(200);
    const doc = (await getFirestore().doc(`enquiries/${enquiryId}`).get()).data();
    expect(doc?.history).toHaveLength(2);
    expect(doc?.notes[0].text).toBe('Private QA note');
    expect((await request(`admin/enquiries/${enquiryId}`)).status).toBe(401);
  });
  it('disables access independently of cached tokens', async () => {
    await getFirestore().doc(`users/${credentials.editor.uid}`).update({ active: false });
    expect((await request('admin/products', 'GET', undefined, 'editor')).status).toBe(403);
    await getFirestore().doc(`users/${credentials.editor.uid}`).update({ active: true });
  });
  it('archives and requires typed confirmation before deletion', async () => {
    const current = await (
      await request(`admin/products/${productId}`, 'GET', undefined, 'admin')
    ).json();
    const r = await request(
      `admin/products/${productId}`,
      'PUT',
      { product: { ...current, status: 'archived' }, revision: current.revision },
      'admin',
    );
    expect(r.status).toBe(200);
    expect((await request(`products/qa-${run}`)).status).toBe(404);
    expect(
      (await request(`admin/products/${productId}`, 'DELETE', { confirmation: 'wrong' }, 'admin'))
        .status,
    ).toBe(400);
    expect(
      (
        await request(
          `admin/products/${productId}`,
          'DELETE',
          { confirmation: `QA ${run}` },
          'admin',
        )
      ).status,
    ).toBe(200);
  });
});
