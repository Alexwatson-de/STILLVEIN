import { FieldValue, Query } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { services, AppError } from './firebase';
import { Actor } from './auth';
import {
  Product,
  ProductInput,
  productSchema,
  defaultSettings,
  SiteSettings,
  Taxonomy,
} from '../schema';
import { matches } from '../catalog';
export const now = () => new Date().toISOString();
export function audit(actor: Actor, action: string, target: string) {
  return { actor: actor.uid, email: actor.email, action, target, at: now() };
}
export async function settings(): Promise<SiteSettings> {
  const data = (await services().db.doc('settings/public').get()).data();
  return { ...defaultSettings, ...data } as SiteSettings;
}
export async function taxonomy(): Promise<Taxonomy[]> {
  return (await services().db.collection('taxonomy').orderBy('name').limit(500).get()).docs.map(
    (d) => ({ ...d.data(), id: d.id }) as Taxonomy,
  );
}
// Explicit public allowlist prevents future private/admin-only document fields
// from accidentally becoming part of a public API response.
export function publicRecord(id: string, data: FirebaseFirestore.DocumentData): Product {
  return {
    ...productSchema.parse(data),
    id,
    revision: data.revision,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    nameKey: data.nameKey,
    priceSort: data.priceSort,
  };
}
export async function featuredProducts(ids: string[]) {
  const docs = await Promise.all(
    ids.slice(0, 12).map((id) => services().db.doc(`products/${id}`).get()),
  );
  return docs
    .filter((d) => d.exists && d.get('status') === 'published')
    .map((d) => publicRecord(d.id, d.data()!));
}
export async function publicProduct(slug: string) {
  const snap = await services()
    .db.collection('products')
    .where('status', '==', 'published')
    .where('slug', '==', slug)
    .limit(1)
    .get();
  return snap.empty ? null : publicRecord(snap.docs[0].id, snap.docs[0].data());
}
export async function catalog(s: URLSearchParams) {
  const { db } = services();
  for (const [key, value] of s.entries()) {
    if (value.length > 400) throw new AppError(400, 'Filter value is too long.');
    if (
      ['min', 'max', 'length', 'width', 'thickness', 'limit'].includes(key) &&
      value &&
      (!Number.isFinite(Number(value)) || Number(value) < 0)
    )
      throw new AppError(400, `Invalid numeric filter: ${key}`);
  }
  const limit = Math.max(1, Math.min(24, Math.floor(Number(s.get('limit')) || 12)));
  const sort = s.get('sort');
  const field = sort === 'name' ? 'nameKey' : sort?.startsWith('price') ? 'priceSort' : 'createdAt';
  const dir = sort === 'price-desc' || field === 'createdAt' ? 'desc' : 'asc';
  const base = db.collection('products').where('status', '==', 'published');
  if (s.get('q') && (!sort || sort === 'relevance')) {
    const candidates = await base.orderBy('createdAt', 'desc').limit(1000).get();
    const queryText = s.get('q')!.toLowerCase().trim();
    const score = (p: Product) =>
      (p.name.toLowerCase() === queryText ? 100 : 0) +
      (p.sku.toLowerCase() === queryText ? 100 : 0) +
      (p.name.toLowerCase().startsWith(queryText) ? 40 : 0) +
      (p.name.toLowerCase().includes(queryText) ? 20 : 0) +
      (p.tags.some((t) => t.toLowerCase() === queryText) ? 10 : 0);
    const ranked = candidates.docs
      .map((d) => publicRecord(d.id, d.data()))
      .filter((p) => matches(p, s))
      .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
    const start = s.get('cursor')
      ? Math.max(0, ranked.findIndex((p) => p.id === s.get('cursor')) + 1)
      : 0;
    const products = ranked.slice(start, start + limit);
    const total = (await base.count().get()).data().count;
    return {
      products,
      nextCursor: start + limit < ranked.length ? products.at(-1)!.id : null,
      total,
      scanned: candidates.size,
      searchLimited: total > 1000,
    };
  }
  let query: Query = base.orderBy(field, dir);
  if (s.get('cursor')) {
    const cursor = s.get('cursor')!;
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(cursor)) throw new AppError(400, 'Invalid page cursor.');
    const doc = await db.collection('products').doc(cursor).get();
    if (doc.exists && doc.get('status') === 'published') query = query.startAfter(doc);
  }
  const products: Product[] = [];
  let nextCursor: string | null = null;
  let scanned = 0;
  let exhausted = false;
  // Bounded server-side scan keeps substring search composable without sending the
  // full catalog to browsers. Large catalogs should add an external search index.
  while (scanned < 1000 && products.length < limit) {
    const batch = await query.limit(100).get();
    if (batch.empty) {
      exhausted = true;
      break;
    }
    let last = batch.docs[0];
    for (const d of batch.docs) {
      last = d;
      scanned++;
      const p = publicRecord(d.id, d.data());
      if (matches(p, s)) products.push(p);
      if (products.length === limit) break;
    }
    nextCursor = last.id;
    query = query.startAfter(last);
    if (batch.size < 100 && last.id === batch.docs.at(-1)?.id) {
      exhausted = true;
      break;
    }
  }
  const total = (await base.count().get()).data().count;
  return {
    products,
    nextCursor: exhausted ? null : nextCursor,
    total,
    scanned,
    searchLimited: !exhausted && scanned >= 1000,
  };
}
export function assetsOf(p: Pick<ProductInput, 'galleryImages' | 'texture'>) {
  return [
    ...new Set([
      ...p.galleryImages.map((a) => a.assetId),
      ...(p.texture ? [p.texture.assetId] : []),
    ]),
  ];
}
function lockId(kind: string, value: string) {
  return `${kind}_${createHash('sha256').update(value.toLowerCase()).digest('hex')}`;
}
export async function saveProduct(
  id: string,
  input: unknown,
  actor: Actor,
  expectedRevision?: number,
) {
  const p = productSchema.parse(input);
  const { db } = services();
  const ref = db.doc(`products/${id}`);
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    const old = existing.data() as Product | undefined;
    if (old && old.revision !== expectedRevision)
      throw new AppError(409, 'This material changed in another session. Reload before saving.');
    const slugLock = db.doc(`unique/${lockId('slug', p.slug)}`);
    const skuLock = db.doc(`unique/${lockId('sku', p.sku)}`);
    const [sl, sk, category] = await Promise.all([
      tx.get(slugLock),
      tx.get(skuLock),
      tx.get(db.doc(`taxonomy/${p.categoryId}`)),
    ]);
    if ((sl.exists && sl.get('productId') !== id) || (sk.exists && sk.get('productId') !== id))
      throw new AppError(409, 'SKU or URL slug is already in use.');
    if (!category.exists || category.get('kind') !== 'category')
      throw new AppError(400, 'Choose an existing material category.');
    const oldIds = old ? assetsOf(old) : [];
    const newIds = assetsOf(p);
    const all = [...new Set([...oldIds, ...newIds])];
    const assetDocs = await Promise.all(all.map((a) => tx.get(db.doc(`assets/${a}`))));
    for (const asset of [...p.galleryImages, ...(p.texture ? [p.texture] : [])]) {
      const stored = assetDocs.find((d) => d.id === asset.assetId)?.data();
      if (
        !stored ||
        stored.state !== 'ready' ||
        stored.url !== asset.url ||
        stored.publicId !== asset.publicId ||
        stored.width !== asset.width ||
        stored.height !== asset.height
      )
        throw new AppError(400, 'Image is not a verified, available asset. Upload it first.');
    }
    const result = {
      ...p,
      id,
      nameKey: p.name.toLowerCase(),
      priceSort: p.price ?? 1e12,
      revision: (old?.revision ?? 0) + 1,
      createdAt: old?.createdAt ?? now(),
      updatedAt: now(),
    };
    tx.set(ref, result);
    tx.set(slugLock, { productId: id });
    tx.set(skuLock, { productId: id });
    if (old && old.slug !== p.slug) tx.delete(db.doc(`unique/${lockId('slug', old.slug)}`));
    if (old && old.sku !== p.sku) tx.delete(db.doc(`unique/${lockId('sku', old.sku)}`));
    for (const a of all)
      tx.update(db.doc(`assets/${a}`), {
        refs: newIds.includes(a) ? FieldValue.arrayUnion(id) : FieldValue.arrayRemove(id),
      });
    tx.set(
      db.collection('audit').doc(),
      audit(actor, old ? `product.update:${p.status}` : 'product.create', id),
    );
    return result;
  });
}
export async function deleteProduct(id: string, confirmation: string, actor: Actor) {
  const { db } = services();
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`products/${id}`);
    const doc = await tx.get(ref);
    const p = doc.data() as Product;
    if (!p) throw new AppError(404, 'Material not found.');
    if (p.status !== 'archived' || confirmation !== p.name)
      throw new AppError(400, 'Archive the material first, then confirm its exact name.');
    // Keep assets available: explicit orphan cleanup is separate and reference-checked.
    tx.delete(ref);
    tx.delete(db.doc(`unique/${lockId('slug', p.slug)}`));
    tx.delete(db.doc(`unique/${lockId('sku', p.sku)}`));
    for (const a of assetsOf(p))
      tx.update(db.doc(`assets/${a}`), { refs: FieldValue.arrayRemove(id) });
    tx.set(db.collection('audit').doc(), audit(actor, 'product.delete', id));
  });
}
