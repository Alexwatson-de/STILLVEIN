import { services } from './firebase';
import { Actor, can } from './auth';
import { statuses } from '../schema';
export async function overview(actor: Actor, period: number) {
  const { db } = services();
  const days = [7, 30, 90].includes(period) ? period : 30;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const catalogAllowed = can(actor.role, 'catalog'),
    leadsAllowed = can(actor.role, 'enquiries');
  const products = catalogAllowed
    ? Object.fromEntries(
        await Promise.all(
          ['published', 'draft', 'archived'].map(async (s) => [
            s,
            (await db.collection('products').where('status', '==', s).count().get()).data().count,
          ]),
        ),
      )
    : {};
  const enquiries = leadsAllowed
    ? Object.fromEntries(
        await Promise.all(
          statuses.map(async (s) => [
            s,
            (await db.collection('enquiries').where('status', '==', s).count().get()).data().count,
          ]),
        ),
      )
    : {};
  const materials = catalogAllowed
    ? (await db.collection('products').orderBy('createdAt', 'desc').limit(5).get()).docs.map(
        (d) => ({ id: d.id, name: d.get('name'), status: d.get('status'), at: d.get('createdAt') }),
      )
    : [];
  const leads = leadsAllowed
    ? (
        await db
          .collection('enquiries')
          .where('createdAt', '>=', since)
          .orderBy('createdAt', 'desc')
          .limit(1000)
          .get()
      ).docs
    : [];
  const series = Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - 1 - i) * 86400000).toISOString().slice(0, 10),
    count: 0,
  }));
  for (const d of leads) {
    const day = series.find((s) => s.date === d.get('createdAt').slice(0, 10));
    if (day) day.count++;
  }
  return {
    products,
    enquiries,
    categories: (
      await db.collection('taxonomy').where('kind', '==', 'category').count().get()
    ).data().count,
    materials,
    recentEnquiries: leads
      .slice(0, 5)
      .map((d) => ({
        id: d.id,
        reference: d.get('reference'),
        status: d.get('status'),
        at: d.get('createdAt'),
      })),
    series: leadsAllowed ? series : [],
    truncated: leads.length === 1000,
    days,
    services: { database: true, cloudinary: !!process.env.CLOUDINARY_API_SECRET, email: false },
  };
}
