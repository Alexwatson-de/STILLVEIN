import { z } from 'zod';
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const text = (max = 500) => z.string().trim().max(max);
const strings = z.array(text(100)).max(40);
export const roles = ['admin', 'editor', 'sales'] as const;
export const statuses = [
  'New',
  'Contacted',
  'In Discussion',
  'Quotation Sent',
  'Converted',
  'Closed',
] as const;
export const models = ['slab', 'vertical', 'countertop', 'floor', 'wall'] as const;
export const visualizationSchema = z.object({
  model: z.enum(models).default('slab'),
  background: z.enum(['neutral', 'warm', 'dark']).default('neutral'),
  scale: z.number().min(0.25).max(8).default(1),
  repeatX: z.number().min(0.25).max(8).default(1),
  repeatY: z.number().min(0.25).max(8).default(1),
  rotation: z.number().min(-180).max(180).default(0),
  roughness: z.number().min(0.08).max(1).default(0.28),
  reflectivity: z.number().min(0).max(1).default(0.4),
  camera: z.enum(['perspective', 'top', 'front']).default('perspective'),
});
export const imageSchema = z.object({
  assetId: idSchema,
  publicId: text(300).min(1),
  url: z.string().url().max(1000),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: text(250).min(1),
});
export const productSchema = z
  .object({
    name: text(120).min(2),
    sku: text(60).min(2),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(140),
    categoryId: idSchema,
    stoneType: text(80),
    shortDescription: text(350),
    description: text(8000),
    galleryImages: z.array(imageSchema).max(12).default([]),
    texture: imageSchema.nullable().default(null),
    price: z.number().min(0).max(1e9).nullable(),
    priceMax: z.number().min(0).max(1e9).nullable().default(null),
    pricingMode: z.enum(['fixed', 'range', 'quote', 'contact']).default('quote'),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default('USD'),
    priceUnit: text(30).min(1).default('m²'),
    availability: z
      .enum(['Available', 'Limited', 'On request', 'Unavailable'])
      .default('On request'),
    colour: text(60),
    tones: strings.default([]),
    pattern: text(100),
    finish: text(80),
    origin: text(100),
    classification: text(100),
    dimensions: z.object({
      length: z.number().positive().max(20000),
      width: z.number().positive().max(20000),
    }),
    thicknesses: z.array(z.number().positive().max(500)).min(1).max(12),
    applications: strings,
    care: text(4000),
    tags: strings,
    attributes: z.record(z.string().max(80), text(300)).default({}),
    featured: z.boolean().default(false),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
    relatedIds: z.array(idSchema).max(12).default([]),
    isSample: z.boolean().default(false),
    seoTitle: text(70),
    seoDescription: text(180),
    visualization: visualizationSchema.default(() => visualizationSchema.parse({})),
  })
  .superRefine((p, ctx) => {
    if (['fixed', 'range'].includes(p.pricingMode) && p.price === null)
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'A public price is required.' });
    if (
      p.pricingMode === 'range' &&
      (p.priceMax === null || p.price === null || p.priceMax < p.price)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['priceMax'],
        message: 'Maximum must be at least the minimum price.',
      });
    if (p.status === 'published' && (!p.description || !p.galleryImages.length))
      ctx.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'Publication requires a description and at least one verified image.',
      });
  });
export type ProductInput = z.infer<typeof productSchema>;
export type Product = ProductInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  nameKey: string;
  priceSort: number;
};
export type Asset = z.infer<typeof imageSchema>;
export type Visualization = z.infer<typeof visualizationSchema>;
export type Role = (typeof roles)[number];
export const enquirySchema = z.object({
  name: text(100).min(2),
  email: z.email().max(254),
  phone: z
    .string()
    .trim()
    .min(6)
    .max(30)
    .regex(/^[+()\d\s.-]+$/),
  company: text(150).default(''),
  category: z.enum(['Material quotation', 'Specification support', 'General enquiry']),
  productId: idSchema.nullable().default(null),
  quantity: z.number().positive().max(1e9).nullable().default(null),
  unit: text(30).default('m²'),
  projectType: text(100).default(''),
  location: text(150).default(''),
  message: text(4000).min(10),
  consent: z.literal(true),
  website: text(200).default(''),
  submissionId: z.uuid(),
});
export type EnquiryInput = z.infer<typeof enquirySchema>;
export type Enquiry = Omit<EnquiryInput, 'website' | 'submissionId'> & {
  id: string;
  reference: string;
  sku: string;
  productName: string;
  status: (typeof statuses)[number];
  assignedTo: string;
  followUp: string;
  notes: { text: string; by: string; at: string }[];
  history: { status: string; by: string; at: string }[];
  createdAt: string;
  updatedAt: string;
  revision: number;
};
export const enquiryUpdateSchema = z.object({
  status: z.enum(statuses),
  assignedTo: z.string().max(128),
  followUp: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  note: text(2000).default(''),
  revision: z.number().int(),
});
export const taxonomySchema = z.object({
  kind: z.enum(['category', 'finish', 'colour', 'pattern', 'application', 'attribute']),
  name: text(80).min(1),
  description: text(600).default(''),
});
export type Taxonomy = z.infer<typeof taxonomySchema> & { id: string };
const safeLink = z.union([
  z.literal(''),
  z
    .string()
    .url()
    .refine((v) => v.startsWith('https://'), 'Use HTTPS'),
]);
export const settingsSchema = z.object({
  brand: text(50).min(2),
  tagline: text(100),
  heroTitle: text(150).min(5),
  heroDescription: text(400),
  contactEmail: z.union([z.literal(''), z.email()]),
  contactPhone: text(60),
  address: text(300),
  instagram: safeLink,
  linkedin: safeLink,
  currency: z.string().regex(/^[A-Z]{3}$/),
  priceUnit: text(30).min(1),
  featuredIds: z.array(idSchema).max(12),
  heroAsset: imageSchema.nullable(),
  seoDescription: text(180),
  privacyText: text(15000).min(20),
  termsText: text(15000).min(20),
  enquiryCta: text(160),
  showRecent: z.boolean(),
  showApplications: z.boolean(),
});
export type SiteSettings = z.infer<typeof settingsSchema>;
export const defaultSettings: SiteSettings = {
  brand: 'STILLVEIN',
  tagline: 'The material atlas',
  heroTitle: 'A quieter kind\nof extraordinary.',
  heroDescription:
    'Discover natural stone through texture, detail and dimension. An independent material library for spaces with intention.',
  contactEmail: '',
  contactPhone: '',
  address: '',
  instagram: '',
  linkedin: '',
  currency: 'USD',
  priceUnit: 'm²',
  featuredIds: [],
  heroAsset: null,
  seoDescription:
    'Explore marble, granite and natural stone. Compare materials, study specifications and visualize surfaces in an interactive 3D studio.',
  privacyText:
    'We use enquiry details only to respond to your material and specification requests. Administrators can access your submitted contact information. This installation must publish its operator, retention period and privacy contact before accepting live enquiries.',
  termsText:
    'This is a material discovery and enquiry platform, not a direct-purchase marketplace. Visualizations are texture previews, not 3D scans. Natural stone varies; confirm the actual slab, suitability, dimensions and quotation before specification.',
  enquiryCta: 'Every considered space begins with a conversation.',
  showRecent: true,
  showApplications: true,
};
