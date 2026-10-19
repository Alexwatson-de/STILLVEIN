import { createHash, createHmac } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { NextRequest } from 'next/server';
import { enquirySchema } from '../schema';
import { services, AppError } from './firebase';
import { now } from './data';
export async function submitEnquiry(req: NextRequest, input: unknown) {
  const p = enquirySchema.parse(input);
  if (p.website) throw new AppError(400, 'Unable to submit this form.');
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32)
    throw new AppError(503, 'Enquiry protection is not configured. Please try again after setup.');
  const { db } = services();
  const ip =
    process.env.TRUST_PROXY === 'true'
      ? req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
      : 'local';
  const ipHash = createHmac('sha256', secret).update(ip).digest('hex');
  const emailHash = createHmac('sha256', secret).update(p.email.toLowerCase()).digest('hex');
  const { submissionId, website: _website, ...data } = p;
  void _website;
  const fingerprint = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const key = createHash('sha256').update(`${submissionId}:${emailHash}`).digest('hex');
  const ref = db.doc(`enquiries/${key}`);
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      if (existing.get('fingerprint') !== fingerprint)
        throw new AppError(409, 'This submission ID was already used. Start a new enquiry.');
      return { reference: existing.get('reference') };
    }
    const hour = Math.floor(Date.now() / 3600000);
    const limits = [
      db.doc(`rateLimits/ip_${ipHash}_${hour}`),
      db.doc(`rateLimits/email_${emailHash}_${hour}`),
    ];
    const reads = await Promise.all(limits.map((r) => tx.get(r)));
    if ((reads[0].get('count') || 0) >= 15 || (reads[1].get('count') || 0) >= 5)
      throw new AppError(429, 'Too many enquiries. Please try again in an hour.');
    const product = p.productId ? await tx.get(db.doc(`products/${p.productId}`)) : null;
    if (p.productId && (!product?.exists || product.get('status') !== 'published'))
      throw new AppError(400, 'This material is not available for public enquiries.');
    const reference = `SV-${new Date().getUTCFullYear()}-${key.slice(0, 10).toUpperCase()}`;
    tx.set(ref, {
      ...data,
      id: key,
      fingerprint,
      reference,
      sku: product?.get('sku') || '',
      productName: product?.get('name') || '',
      status: 'New',
      assignedTo: '',
      followUp: '',
      notes: [],
      history: [{ status: 'New', by: 'public', at: now() }],
      revision: 1,
      createdAt: now(),
      updatedAt: now(),
    });
    limits.forEach((r, i) =>
      tx.set(r, {
        count: (reads[i].get('count') || 0) + 1,
        expiresAt: Timestamp.fromMillis(Date.now() + 7200000),
      }),
    );
    return { reference };
  });
}
