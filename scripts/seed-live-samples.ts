// Explicitly requested demonstration data for the connected real catalog.
// Additive/idempotent: never replaces existing materials, taxonomy or branding.
// Images use the same validated, server-signed transfer path as admin uploads.
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { readFileSync } from 'node:fs';
import { services } from '../src/lib/server/firebase';
import { authorizeUpload, transferUpload } from '../src/lib/server/assets';
import { saveProduct, audit, now } from '../src/lib/server/data';
import { defaultSettings, productSchema, Product, Asset } from '../src/lib/schema';

async function main() {
  const project = process.env.FIREBASE_PROJECT_ID;
  if (
    !project ||
    process.env.CONFIRM_PROJECT !== project ||
    process.env.INCLUDE_SAMPLE_DATA !== '1' ||
    process.env.FIRESTORE_EMULATOR_HOST
  )
    throw new Error(
      'Set CONFIRM_PROJECT and INCLUDE_SAMPLE_DATA=1 for the explicitly approved real project.',
    );
  const operatorEmail = process.env.SEED_ADMIN_EMAIL;
  if (!operatorEmail)
    throw new Error('SEED_ADMIN_EMAIL must name an existing active administrator.');
  const { db, auth } = services();
  const operator = await auth.getUserByEmail(operatorEmail);
  const role = (await db.doc(`users/${operator.uid}`).get()).data();
  if (operator.disabled || role?.role !== 'admin' || !role.active)
    throw new Error('The approved operator is not an active administrator.');
  const actor = {
    uid: 'trusted-sample-seed',
    email: 'trusted sample initializer',
    role: 'admin' as const,
  };
  const samples = [
    ['Linen Vein', 'Marble012', 'Marble', 'Ivory', 'Veined', 'Polished'],
    ['Silver Grain', 'Granite002A', 'Granite', 'Grey', 'Fine grain', 'Honed'],
    ['Midnight Mineral', 'Marble006', 'Marble', 'Charcoal', 'Veined', 'Polished'],
    ['Soft Strata', 'Travertine009', 'Travertine', 'Sand', 'Linear', 'Honed'],
    ['Rose Aggregate', 'Granite003A', 'Granite', 'Rose', 'Fine grain', 'Leathered'],
    ['Quiet Granite', 'Granite001A', 'Granite', 'White', 'Fine grain', 'Brushed'],
  ];
  // Check collisions before any uploads. Previously seeded sample records are retained.
  for (let i = 0; i < samples.length; i++) {
    const d = await db.doc(`products/sample-${i + 1}`).get();
    if (d.exists && !d.get('isSample'))
      throw new Error(
        `sample-${i + 1} belongs to a non-sample record; nothing will be overwritten.`,
      );
  }
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
      const ref = db.doc(`taxonomy/${id}`);
      if (!(await ref.get()).exists)
        await ref.create({
          kind,
          name,
          description: 'Demonstration catalog vocabulary; configurable in admin.',
        });
    }
  let created = 0;
  for (const [i, [name, texture, category, colour, pattern, finish]] of samples.entries()) {
    const id = `sample-${i + 1}`;
    const existing = await db.doc(`products/${id}`).get();
    if (existing.exists) {
      console.log('Preserved existing sample:', existing.get('name'));
      continue;
    }
    // If a previous seed was interrupted after upload, reuse its ready orphan.
    const ready = await db.collection('assets').where('seedProductId', '==', id).get();
    let asset: Asset | undefined = ready.docs.find((d) => d.get('state') === 'ready')?.data() as
      Asset | undefined;
    if (!asset) {
      const bytes = readFileSync(`public/textures/${texture}.jpg`);
      const ticket = await authorizeUpload(
        { productId: id, kind: 'textures', mime: 'image/jpeg', size: bytes.byteLength },
        actor,
      );
      asset = await transferUpload(
        new Request('http://localhost/trusted-sample-transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: new Uint8Array(bytes),
        }),
        ticket.ticket,
        actor,
      );
      await db
        .doc(`assets/${asset.assetId}`)
        .update({
          seedProductId: id,
          source: `https://ambientcg.com/view?id=${texture}`,
          license: 'CC0',
        });
      await db.doc(`uploadTickets/${ticket.ticket}`).delete();
    }
    asset = {
      ...asset,
      alt: `${name}: licensed ambientCG ${texture} surface photograph. Illustrative sample.`,
    };
    const p = productSchema.parse({
      name,
      sku: `SV-DEMO-${String(i + 1).padStart(3, '0')}`,
      slug: name.toLowerCase().replaceAll(' ', '-'),
      categoryId: category.toLowerCase(),
      stoneType: category,
      shortDescription:
        'An exploratory material study in texture, light and natural character. Sample catalog record, not a supplier listing.',
      description: `${name} is a demonstration material built around a licensed CC0 ambientCG surface photograph. Its name, finish, dimensions, application suggestions and optional price are illustrative sample information, not verified properties or a quotation for a commercial product. Confirm actual slabs and supplier documentation before specification.`,
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
      care: 'Demonstration only. Confirm supplier-specific cleaning, sealing and care requirements before using a real stone.',
      tags: ['sample', 'material study', colour.toLowerCase()],
      featured: true,
      status: 'published',
      isSample: true,
      seoTitle: `${name} — sample material study`,
      seoDescription:
        'Illustrative natural-stone texture study. Sample specifications and prices are not supplier claims.',
      visualization: { model: 'slab', roughness: finish === 'Polished' ? 0.2 : 0.65 },
    });
    const saved: Product = await saveProduct(id, p, actor);
    created++;
    console.log(
      'Published labelled sample:',
      saved.name,
      `(${saved.texture?.width} × ${saved.texture?.height} px, Cloudinary)`,
    );
  }
  const config = db.doc('settings/public');
  const existing = (await config.get()).data();
  const featuredIds = ['sample-1', 'sample-3', 'sample-4', 'sample-2', 'sample-5', 'sample-6'];
  if (!existing)
    await config.create({
      ...defaultSettings,
      featuredIds,
      privacyText:
        'DEMONSTRATION PLATFORM. The catalog contains clearly labelled sample materials, illustrative prices and synthetic test enquiries. Do not submit sensitive or real customer information during testing. Enquiries are stored in the connected Firebase project and are visible only to authorized staff. The operator must publish approved contact, retention and privacy details before public release.',
    });
  else if (!existing.featuredIds?.length && !existing.heroAsset)
    await config.update({ featuredIds });
  await db
    .collection('audit')
    .add({
      ...audit(actor, 'sample.catalog.initialize', project),
      requestedBy: operator.uid,
      createdCount: created,
      at: now(),
    });
  console.log(
    `Ready: ${created} sample materials added; existing records and administrator access preserved.`,
  );
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
