import { describe, it, expect } from 'vitest';
import {
  productSchema,
  visualizationSchema,
  enquirySchema,
  Product,
  defaultSettings,
  settingsSchema,
} from '../src/lib/schema';
import { matches, priceLabel, safeCsv, imageUrl } from '../src/lib/catalog';
import { textureRepeat, modelDimensions } from '../src/lib/visualization';
import { exportProducts, importProducts } from '../src/lib/csv';
import { can } from '../src/lib/server/auth';
const sample = {
  name: 'Test White',
  sku: 'DEMO-1',
  slug: 'test-white',
  categoryId: 'marble',
  stoneType: 'Marble',
  shortDescription: 'Sample',
  description: 'Sample material',
  galleryImages: [
    {
      assetId: 'a',
      publicId: 'p',
      url: 'https://res.cloudinary.com/demo/image/upload/a.jpg',
      width: 2048,
      height: 1024,
      alt: 'Sample stone',
    },
  ],
  texture: null,
  price: 100,
  priceMax: 150,
  pricingMode: 'range',
  currency: 'USD',
  priceUnit: 'm²',
  availability: 'Available',
  colour: 'White',
  tones: ['Cool'],
  pattern: 'Veined',
  finish: 'Honed',
  origin: 'Test region',
  classification: 'Marble',
  dimensions: { length: 2800, width: 1600 },
  thicknesses: [20, 30],
  applications: ['Flooring'],
  care: 'Sample care',
  tags: ['calm'],
  attributes: { grade: 'A' },
  featured: true,
  status: 'published',
  relatedIds: [],
  isSample: true,
  seoTitle: '',
  seoDescription: '',
};
const p = {
  ...productSchema.parse(sample),
  id: 'test',
  revision: 1,
  nameKey: 'test white',
  priceSort: 100,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as Product;
describe('Catalog filters', () => {
  it.each([
    ['q=WHITE%20CALM', true],
    ['q=unknown', false],
    ['category=marble&finish=Honed&colour=White', true],
    ['category=granite&finish=Honed', false],
    ['min=140&max=160', true],
    ['max=99', false],
    ['min=151', false],
    ['thickness=30', true],
    ['thickness=40', false],
    ['length=3000', false],
    ['width=1600', true],
    ['tone=Cool', true],
    ['origin=Test%20region', true],
    ['application=Flooring', true],
    ['application=Bathrooms', false],
    ['availability=Limited', false],
    ['featured=true&recent=true', true],
    ['type=Marble&pattern=Veined', true],
  ])('%s matches %s', (query, expected) =>
    expect(matches(p, new URLSearchParams(query))).toBe(expected),
  );
  it('excludes quote prices from price filtering', () =>
    expect(matches({ ...p, price: null, pricingMode: 'quote' }, new URLSearchParams('min=1'))).toBe(
      false,
    ));
  it('renders ranges and enquiry price states', () => {
    expect(priceLabel(p)).toBe('$100.00 – $150.00 / m²');
    expect(priceLabel({ ...p, pricingMode: 'quote' })).toBe('Price on enquiry');
    expect(priceLabel({ ...p, pricingMode: 'contact' })).toBe('Contact for price');
  });
});
describe('Validated writes', () => {
  it('rejects publication without gallery', () =>
    expect(productSchema.safeParse({ ...sample, galleryImages: [] }).success).toBe(false));
  it('allows drafts without photography', () =>
    expect(productSchema.safeParse({ ...sample, status: 'draft', galleryImages: [] }).success).toBe(
      true,
    ));
  it('rejects inverted ranges', () =>
    expect(productSchema.safeParse({ ...sample, priceMax: 90 }).success).toBe(false));
  it('rejects negative prices', () =>
    expect(productSchema.safeParse({ ...sample, price: -1 }).success).toBe(false));
  it('rejects invalid slugs', () =>
    expect(productSchema.safeParse({ ...sample, slug: '../bad' }).success).toBe(false));
  it('strips unknown private metadata', () =>
    expect(productSchema.parse({ ...sample, privateCost: 50 })).not.toHaveProperty('privateCost'));
  it('defaults are valid site settings', () =>
    expect(settingsSchema.safeParse(defaultSettings).success).toBe(true));
  it('rejects javascript social links', () =>
    expect(
      settingsSchema.safeParse({ ...defaultSettings, instagram: 'javascript:alert(1)' }).success,
    ).toBe(false));
  it('requires privacy consent', () =>
    expect(
      enquirySchema.safeParse({
        name: 'AA',
        email: 'a@example.test',
        phone: '12345678',
        category: 'General enquiry',
        message: 'A synthetic test message',
        consent: false,
        submissionId: crypto.randomUUID(),
      }).success,
    ).toBe(false));
});
describe('CSV and image delivery', () => {
  it('round trips all editable fields', () =>
    expect(importProducts(exportProducts([p]))[0].product).toEqual(productSchema.parse(p)));
  it('rejects broken rows', () =>
    expect(() => importProducts('id,product_json\nx,invalid')).toThrow(/Row 2/));
  it.each(['=CMD()', '+run', '-formula', '@SUM()', '\tcmd'])(
    'escapes spreadsheet formula %s',
    (s) => expect(safeCsv(s)).toBe(`'${s}`),
  );
  it('optimizes Cloudinary delivery without modifying local samples', () => {
    expect(imageUrl(p.galleryImages[0].url, 800)).toContain('f_auto,q_auto,c_limit,w_800');
    expect(imageUrl('/sample.jpg')).toBe('/sample.jpg');
  });
});
describe('3D defaults and permissions', () => {
  it('preserves image aspect in repeat settings', () =>
    expect(textureRepeat(2048, 1024, visualizationSchema.parse({}))).toEqual([1, 2]));
  it('defines all five dimensional models', () =>
    expect(Object.keys(modelDimensions)).toHaveLength(5));
  it('rejects out-of-range material parameters', () =>
    expect(visualizationSchema.safeParse({ roughness: -1 }).success).toBe(false));
  it.each([
    ['admin', 'users', true],
    ['editor', 'catalog', true],
    ['editor', 'enquiries', false],
    ['sales', 'enquiries', true],
    ['sales', 'catalog', false],
    ['sales', 'settings', false],
  ] as const)('%s / %s => %s', (role, area, allowed) => expect(can(role, area)).toBe(allowed));
});
