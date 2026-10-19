import { Product } from './schema';
export const filterKeys = [
  'q',
  'category',
  'type',
  'min',
  'max',
  'colour',
  'tone',
  'finish',
  'pattern',
  'origin',
  'thickness',
  'length',
  'width',
  'application',
  'availability',
  'featured',
  'recent',
] as const;
export function matches(p: Product, s: URLSearchParams, now = Date.now()) {
  const has = (key: string, value: string) =>
    !s.get(key) || value.toLowerCase() === s.get(key)!.toLowerCase();
  const search = [
    p.name,
    p.sku,
    p.categoryId,
    p.stoneType,
    p.colour,
    p.pattern,
    p.finish,
    p.origin,
    ...p.tags,
    ...p.applications,
    ...Object.values(p.attributes),
  ]
    .join(' ')
    .toLowerCase();
  if (
    s.get('q') &&
    !s
      .get('q')!
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .every((t) => search.includes(t))
  )
    return false;
  if (
    !has('category', p.categoryId) ||
    !has('type', p.stoneType) ||
    !has('colour', p.colour) ||
    !has('finish', p.finish) ||
    !has('pattern', p.pattern) ||
    !has('origin', p.origin) ||
    !has('availability', p.availability)
  )
    return false;
  if (s.get('tone') && !p.tones.some((x) => x.toLowerCase() === s.get('tone')!.toLowerCase()))
    return false;
  if (s.get('application') && !p.applications.includes(s.get('application')!)) return false;
  if (s.get('thickness') && !p.thicknesses.includes(Number(s.get('thickness')))) return false;
  if (s.get('length') && p.dimensions.length < Number(s.get('length'))) return false;
  if (s.get('width') && p.dimensions.width < Number(s.get('width'))) return false;
  if (s.get('min') && (p.price === null || (p.priceMax ?? p.price) < Number(s.get('min'))))
    return false;
  if (s.get('max') && (p.price === null || p.price > Number(s.get('max')))) return false;
  if (s.get('featured') === 'true' && !p.featured) return false;
  if (s.get('recent') === 'true' && now - Date.parse(p.createdAt) > 30 * 86400000) return false;
  return true;
}
export function priceLabel(
  p: Pick<Product, 'price' | 'priceMax' | 'pricingMode' | 'currency' | 'priceUnit'>,
) {
  if (p.pricingMode === 'contact') return 'Contact for price';
  if (p.pricingMode === 'quote' || p.price === null) return 'Price on enquiry';
  const f = (n: number) =>
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency: p.currency,
      maximumFractionDigits: 2,
    }).format(n);
  return `${f(p.price)}${p.pricingMode === 'range' && p.priceMax !== null ? ` – ${f(p.priceMax)}` : ''} / ${p.priceUnit}`;
}
export function imageUrl(url: string, width = 800) {
  if (!url.startsWith('https://res.cloudinary.com/')) return url;
  return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${width}/`);
}
export function safeCsv(value: unknown) {
  const s = String(value ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
