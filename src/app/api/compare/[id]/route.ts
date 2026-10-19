import { NextResponse } from 'next/server';
import { services } from '@/lib/server/firebase';
import { idSchema } from '@/lib/schema';
import { publicRecord } from '@/lib/server/data';
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!idSchema.safeParse(id).success)
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    const d = await services().db.doc(`products/${id}`).get();
    if (!d.exists || d.get('status') !== 'published')
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(publicRecord(d.id, d.data()!), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Catalog unavailable' }, { status: 503 });
  }
}
