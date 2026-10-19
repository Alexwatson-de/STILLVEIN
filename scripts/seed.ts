import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { services } from '../src/lib/server/firebase';
import { saveProduct } from '../src/lib/server/data';
import { defaultSettings, productSchema } from '../src/lib/schema';
async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_PROJECT_ID !== 'demo-stillvein')
    throw new Error('Sample seeding is restricted to the isolated demo-stillvein emulator.');
  const { db } = services();
  if (!(await db.doc('settings/public').get()).exists)
    await db
      .doc('settings/public')
      .set({
        ...defaultSettings,
        featuredIds: ['sample-1', 'sample-3', 'sample-4', 'sample-2', 'sample-5', 'sample-6'],
        privacyText:
          'LOCAL DEMONSTRATION ONLY. Do not submit real personal information. Synthetic enquiries remain in your local Firebase emulator. This is not a live material supplier or ordering service.',
      });
  const taxonomies: Record<string, string[]> = {
    category: ['Marble', 'Granite', 'Travertine', 'Onyx', 'Quartz'],
    finish: ['Polished', 'Honed', 'Leathered', 'Brushed', 'Flamed'],
    colour: ['Ivory', 'Charcoal', 'Grey', 'Sand', 'Rose', 'White'],
    pattern: ['Veined', 'Fine grain', 'Mottled', 'Linear'],
    application: [
      'Countertops',
      'Flooring',
      'Wall cladding',
      'Bathrooms',
      'Stairs',
      'Feature walls',
    ],
  };
  for (const [kind, names] of Object.entries(taxonomies))
    for (const name of names) {
      const id =
        kind === 'category'
          ? name.toLowerCase()
          : `${kind}-${name.toLowerCase().replaceAll(' ', '-')}`;
      if (!(await db.doc(`taxonomy/${id}`).get()).exists)
        await db.doc(`taxonomy/${id}`).set({ kind, name, description: '' });
    }
  // All names/specifications/prices below are illustrative, never supplier claims.
  // CC0 surface photographs are downloaded assets, not generated faux uploads.
  const samples = [
    ['Linen Vein', 'Marble012', 'Marble', 'Ivory', 'Veined', 'Polished'],
    ['Silver Grain', 'Granite002A', 'Granite', 'Grey', 'Fine grain', 'Honed'],
    ['Midnight Mineral', 'Marble006', 'Marble', 'Charcoal', 'Veined', 'Polished'],
    ['Soft Strata', 'Travertine009', 'Travertine', 'Sand', 'Linear', 'Honed'],
    ['Rose Aggregate', 'Granite003A', 'Granite', 'Rose', 'Fine grain', 'Leathered'],
    ['Quiet Granite', 'Granite001A', 'Granite', 'White', 'Fine grain', 'Brushed'],
  ];
  for (const [i, [name, texture, category, colour, pattern, finish]] of samples.entries()) {
    const id = `sample-${i + 1}`;
    const existing = await db.doc(`products/${id}`).get();
    if (existing.exists && (process.env.REFRESH_SAMPLE_DATA !== '1' || !existing.get('isSample')))
      continue;
    const asset = {
      assetId: `sample-${texture}`,
      publicId: `local-samples/${texture}`,
      url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/textures/${texture}.jpg`,
      width: 2048,
      height: 2048,
      alt: `${name}: licensed ambientCG ${texture} surface photograph, illustrative sample`,
    };
    if (!(await db.doc(`assets/${asset.assetId}`).get()).exists)
      await db
        .doc(`assets/${asset.assetId}`)
        .set({
          ...asset,
          state: 'ready',
          refs: [],
          sample: true,
          source: `https://ambientcg.com/view?id=${texture}`,
          license: 'CC0',
        });
    const product = productSchema.parse({
      name,
      sku: `SV-DEMO-${String(i + 1).padStart(3, '0')}`,
      slug: name.toLowerCase().replaceAll(' ', '-'),
      categoryId: category.toLowerCase(),
      stoneType: category,
      shortDescription:
        'An exploratory material study in texture, light and natural character. Sample catalog record, not a supplier listing.',
      description: `${name} is an illustrative catalog entry built around a CC0 ambientCG surface photograph. The name, finish, dimensions, applications and optional price are demonstration data only; they are not verified properties of a commercially available stone. Replace this record with documented material specifications before publishing a live catalog.`,
      galleryImages: [asset],
      texture: asset,
      price: i < 2 ? 125 + i * 35 : null,
      priceMax: i === 1 ? 190 : null,
      pricingMode: i === 1 ? 'range' : i === 0 ? 'fixed' : 'quote',
      currency: 'USD',
      priceUnit: 'm²',
      availability: 'On request',
      colour,
      tones: [i % 2 ? 'Cool' : 'Warm'],
      pattern,
      finish,
      origin: '',
      classification: category,
      dimensions: { length: 2800, width: 1600 },
      thicknesses: [20, 30],
      applications:
        i % 2
          ? ['Flooring', 'Wall cladding', 'Stairs']
          : ['Countertops', 'Bathrooms', 'Feature walls'],
      care: 'Sample guidance only. Confirm a supplier-specific care, sealing and cleaning procedure before specification.',
      tags: ['sample', 'material study', colour.toLowerCase()],
      featured: true,
      status: 'published',
      isSample: true,
      seoTitle: `${name} — sample material study`,
      seoDescription:
        'Illustrative natural-stone texture study. Explore the surface in 3D; sample specifications are not supplier claims.',
      visualization: { model: 'slab', roughness: finish === 'Polished' ? 0.2 : 0.65 },
    });
    await saveProduct(
      id,
      product,
      { uid: 'local-seed', email: 'local-seed', role: 'admin' },
      existing.get('revision'),
    );
  }
  if (process.env.REFRESH_SAMPLE_DATA === '1')
    await db
      .doc('settings/public')
      .update({
        featuredIds: ['sample-1', 'sample-3', 'sample-4', 'sample-2', 'sample-5', 'sample-6'],
      });
  console.log(
    'Local sample catalog saved to Firestore. All sample products are explicitly labelled.',
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
