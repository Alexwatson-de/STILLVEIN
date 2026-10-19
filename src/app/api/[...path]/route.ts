import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue, Query } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { requireUser, verifyOrigin, can } from '@/lib/server/auth';
import { services, AppError } from '@/lib/server/firebase';
import {
  catalog,
  settings,
  taxonomy,
  publicProduct,
  saveProduct,
  deleteProduct,
  audit,
  now,
} from '@/lib/server/data';
import { submitEnquiry } from '@/lib/server/enquiries';
import { authorizeUpload, transferUpload, finalizeUpload, deleteAsset } from '@/lib/server/assets';
import { enquiryUpdateSchema, settingsSchema, taxonomySchema, idSchema, roles } from '@/lib/schema';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function body(req: NextRequest) {
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 200000) throw new AppError(413, 'Request is too large.');
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError(400, 'Invalid JSON.');
  }
}
async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    verifyOrigin(req);
    const parts = (await params).path;
    const route = parts.join('/');
    const method = req.method;
    const ok = (data: unknown, status = 200) =>
      NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
    if (method === 'GET' && route === 'catalog') return ok(await catalog(req.nextUrl.searchParams));
    if (method === 'GET' && route === 'settings') return ok(await settings());
    if (method === 'GET' && route === 'taxonomy') return ok(await taxonomy());
    if (method === 'GET' && parts[0] === 'products' && parts.length === 2) {
      const p = await publicProduct(parts[1]);
      if (!p) throw new AppError(404, 'Material not found.');
      return ok(p);
    }
    if (method === 'POST' && route === 'enquiries')
      return ok(await submitEnquiry(req, await body(req)), 201);
    if (parts[0] !== 'admin') throw new AppError(404, 'Endpoint not found.');
    const actor = await requireUser(req);
    const { db, auth } = services();
    const resource = parts[1];
    const id = parts[2];
    if (id) idSchema.parse(id);
    const guard = (area: Parameters<typeof can>[1]) => {
      if (!can(actor.role, area)) throw new AppError(403, 'Your role cannot perform this action.');
    };
    if (route === 'admin/me' && method === 'GET') return ok(actor);
    if (route === 'admin/uploads' && method === 'POST') {
      guard('catalog');
      return ok(await authorizeUpload(await body(req), actor));
    }
    if (route === 'admin/uploads/complete' && method === 'POST') {
      guard('catalog');
      return ok(await finalizeUpload(await body(req), actor));
    }
    if (resource === 'uploads' && id && parts[3] === 'transfer' && method === 'POST') {
      guard('catalog');
      return ok(await transferUpload(req, id, actor));
    }
    if (resource === 'assets') {
      guard('catalog');
      if (method === 'GET')
        return ok(
          (await db.collection('assets').where('state', '==', 'ready').limit(100).get()).docs.map(
            (d) => ({ ...d.data(), id: d.id }),
          ),
        );
      if (method === 'DELETE' && id) {
        await deleteAsset(id, actor);
        return ok({ success: true });
      }
    }
    if (resource === 'products') {
      guard('catalog');
      if (method === 'GET') {
        if (id) {
          const d = await db.doc(`products/${id}`).get();
          if (!d.exists) throw new AppError(404, 'Material not found.');
          return ok({ ...d.data(), id: d.id });
        }
        let q: Query = db.collection('products').orderBy('updatedAt', 'desc');
        const cursor = req.nextUrl.searchParams.get('cursor');
        if (cursor) {
          idSchema.parse(cursor);
          const d = await db.doc(`products/${cursor}`).get();
          if (d.exists) q = q.startAfter(d);
        }
        const ds = await q.limit(50).get();
        return ok({
          items: ds.docs.map((d) => ({ ...d.data(), id: d.id })),
          nextCursor: ds.size === 50 ? ds.docs.at(-1)!.id : null,
        });
      }
      if ((method === 'POST' || method === 'PUT') && id) {
        const b = await body(req);
        return ok(await saveProduct(id, b.product, actor, b.revision));
      }
      if (method === 'DELETE' && id) {
        const b = await body(req);
        await deleteProduct(id, b.confirmation, actor);
        return ok({ success: true });
      }
    }
    if (resource === 'taxonomy') {
      guard('catalog');
      if (method === 'GET') return ok(await taxonomy());
      if (method === 'POST' || method === 'PUT') {
        const p = taxonomySchema.parse(await body(req));
        const ref = db.collection('taxonomy').doc(id || randomUUID());
        const batch = db.batch();
        batch.set(ref, p);
        batch.set(db.collection('audit').doc(), audit(actor, 'taxonomy.save', ref.id));
        await batch.commit();
        return ok({ ...p, id: ref.id });
      }
      if (method === 'DELETE' && id) {
        await db.runTransaction(async (tx) => {
          const ref = db.doc(`taxonomy/${id}`);
          const item = await tx.get(ref);
          if (!item.exists) throw new AppError(404, 'Attribute not found.');
          // Category deletion is blocked while used. Other definitions can be retired;
          // existing product text is preserved for historical specifications.
          const used = await tx.get(
            db.collection('products').where('categoryId', '==', id).limit(1),
          );
          if (!used.empty)
            throw new AppError(409, 'Category is in use. Reassign its materials first.');
          tx.delete(ref);
          tx.set(db.collection('audit').doc(), audit(actor, 'taxonomy.delete', id));
        });
        return ok({ success: true });
      }
    }
    if (resource === 'settings') {
      guard('settings');
      if (method === 'GET') return ok(await settings());
      if (method === 'PUT') {
        const p = settingsSchema.parse(await body(req));
        await db.runTransaction(async (tx) => {
          const ref = db.doc('settings/public');
          const old = (await tx.get(ref)).data();
          const asset = p.heroAsset ? await tx.get(db.doc(`assets/${p.heroAsset.assetId}`)) : null;
          if (
            p.heroAsset &&
            (!asset?.exists ||
              asset.get('state') !== 'ready' ||
              asset.get('url') !== p.heroAsset.url)
          )
            throw new AppError(400, 'Hero image must be a verified asset.');
          tx.set(ref, p);
          if (old?.heroAsset?.assetId && old.heroAsset.assetId !== p.heroAsset?.assetId)
            tx.update(db.doc(`assets/${old.heroAsset.assetId}`), {
              refs: FieldValue.arrayRemove('site'),
            });
          if (p.heroAsset)
            tx.update(db.doc(`assets/${p.heroAsset.assetId}`), {
              refs: FieldValue.arrayUnion('site'),
            });
          tx.set(db.collection('audit').doc(), audit(actor, 'settings.update', 'public'));
        });
        return ok(p);
      }
    }
    if (resource === 'enquiries') {
      guard('enquiries');
      if (method === 'GET') {
        if (id) {
          const d = await db.doc(`enquiries/${id}`).get();
          if (!d.exists) throw new AppError(404, 'Enquiry not found.');
          return ok({ ...d.data(), id: d.id });
        }
        let q: Query = db.collection('enquiries').orderBy('createdAt', 'desc');
        const cursor = req.nextUrl.searchParams.get('cursor');
        if (cursor) {
          idSchema.parse(cursor);
          const d = await db.doc(`enquiries/${cursor}`).get();
          if (d.exists) q = q.startAfter(d);
        }
        const d = await q.limit(50).get();
        return ok({
          items: d.docs.map((d) => ({ ...d.data(), id: d.id })),
          nextCursor: d.size === 50 ? d.docs.at(-1)!.id : null,
        });
      }
      if (method === 'PUT' && id) {
        const p = enquiryUpdateSchema.parse(await body(req));
        await db.runTransaction(async (tx) => {
          const ref = db.doc(`enquiries/${id}`);
          const d = await tx.get(ref);
          if (!d.exists) throw new AppError(404, 'Enquiry not found.');
          if (d.get('revision') !== p.revision)
            throw new AppError(409, 'Enquiry changed. Reload before saving.');
          if (p.assignedTo) {
            const user = await tx.get(db.doc(`users/${p.assignedTo}`));
            if (!user.get('active') || !['admin', 'sales'].includes(user.get('role')))
              throw new AppError(400, 'Assign to an active administrator or sales staff member.');
          }
          tx.update(ref, {
            status: p.status,
            assignedTo: p.assignedTo,
            followUp: p.followUp,
            revision: p.revision + 1,
            updatedAt: now(),
            ...(p.note
              ? { notes: FieldValue.arrayUnion({ text: p.note, by: actor.email, at: now() }) }
              : {}),
            ...(d.get('status') !== p.status
              ? { history: FieldValue.arrayUnion({ status: p.status, by: actor.email, at: now() }) }
              : {}),
          });
          tx.set(db.collection('audit').doc(), audit(actor, 'enquiry.update', id));
        });
        return ok({ success: true });
      }
    }
    if (resource === 'staff' && method === 'GET') {
      guard('enquiries');
      const ds = await db.collection('users').where('active', '==', true).limit(100).get();
      return ok(
        ds.docs
          .filter((d) => ['admin', 'sales'].includes(d.get('role')))
          .map((d) => ({ id: d.id, email: d.get('email') })),
      );
    }
    if (resource === 'users') {
      guard('users');
      if (method === 'GET')
        return ok(
          (await db.collection('users').limit(100).get()).docs.map((d) => ({
            ...d.data(),
            id: d.id,
          })),
        );
      if (method === 'POST') {
        const p = z.object({ email: z.email(), role: z.enum(roles) }).parse(await body(req));
        let user;
        try {
          user = await auth.getUserByEmail(p.email);
        } catch (e) {
          if ((e as { code: string }).code !== 'auth/user-not-found') throw e;
          user = await auth.createUser({ email: p.email });
        }
        if ((await db.doc(`users/${user.uid}`).get()).exists)
          throw new AppError(409, 'This staff member already exists. Edit their existing role.');
        await db
          .doc(`users/${user.uid}`)
          .set({ email: p.email, role: p.role, active: true, createdAt: now() });
        await db.collection('audit').add(audit(actor, 'user.invite', user.uid));
        const setupLink = await auth.generatePasswordResetLink(p.email);
        return ok({ uid: user.uid, setupLink });
      }
      if (method === 'PUT' && id) {
        const p = z.object({ role: z.enum(roles), active: z.boolean() }).parse(await body(req));
        if (id === actor.uid) throw new AppError(400, 'You cannot change your own role or access.');
        await db.runTransaction(async (tx) => {
          const ref = db.doc(`users/${id}`);
          const existing = await tx.get(ref);
          if (!existing.exists) throw new AppError(404, 'Staff member not found.');
          const admins = await tx.get(db.collection('users').where('role', '==', 'admin'));
          if (
            existing.get('role') === 'admin' &&
            existing.get('active') &&
            (p.role !== 'admin' || !p.active) &&
            admins.docs.filter((d) => d.get('active')).length <= 1
          )
            throw new AppError(409, 'Keep at least one active administrator.');
          tx.update(ref, p);
          tx.set(db.collection('audit').doc(), audit(actor, 'user.permissions', id));
        });
        if (!p.active) await auth.revokeRefreshTokens(id);
        return ok({ success: true });
      }
    }
    if (resource === 'audit' && method === 'GET') {
      guard('audit');
      let q: Query = db.collection('audit').orderBy('at', 'desc');
      const cursor = req.nextUrl.searchParams.get('cursor');
      if (cursor) {
        idSchema.parse(cursor);
        const d = await db.doc(`audit/${cursor}`).get();
        if (d.exists) q = q.startAfter(d);
      }
      const ds = await q.limit(50).get();
      return ok({
        items: ds.docs.map((d) => ({ ...d.data(), id: d.id })),
        nextCursor: ds.size === 50 ? ds.docs.at(-1)!.id : null,
      });
    }
    if (resource === 'overview' && method === 'GET') {
      const { overview } = await import('@/lib/server/overview');
      return ok(await overview(actor, Number(req.nextUrl.searchParams.get('days')) || 30));
    }
    throw new AppError(405, 'Operation not supported.');
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json(
        { error: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n') },
        { status: 400 },
      );
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('API failure:', e instanceof Error ? e.message : 'unknown');
    return NextResponse.json(
      {
        error:
          'The service could not complete this request. Your existing data is unchanged unless a successful save was confirmed. Please retry or contact the operator.',
      },
      { status: 503 },
    );
  }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
