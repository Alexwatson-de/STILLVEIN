# STILLVEIN — The Material Atlas

A standalone natural-stone catalog, specification and interactive material-visualization application. This is **not a factory website, direct-purchase marketplace or payment system**. Visitors discover, compare and enquire; authorized staff curate the catalog and manage conversations.

## Delivery status

Implemented and verified with Firebase emulators **and actual Firebase/Cloudinary services**. The dedicated `stillvein` Firebase project now has a default `nam5` database, deployed deny-by-default rules/indexes, a scoped server identity and the approved initial administrator. Billing remains disabled. Real browser gallery/texture uploads, Cloudinary delivery, Firestore references, interactive 3D rendering and safe cleanup passed a live-service smoke test.

Source repository: https://github.com/Alexwatson-de/STILLVEIN. The optimized app runs locally at http://localhost:3000 using the real services; it is **not publicly hosted**. The real catalog starts empty after synthetic test cleanup. Use the explicit `:local` scripts for the separate sample database. Hosting approval, domain/HTTPS setup, policy review and hosted acceptance checks remain release gates.

- Public: editorial homepage, database-backed collection, debounced search, composable URL filters, grid/list views, sorting, cursor pagination, product gallery/zoom, pricing/specifications, comparison, specification download, enquiries, SEO and public policies.
- Studio: lazy-loaded React Three Fiber, slab/vertical/countertop/floor/wall presets, physical-scale UVs, aspect-aware repetition, texture rotation, roughness/reflectivity, studio backgrounds, environment lighting, contact shadows, camera/reset/zoom/fullscreen, touch orbit, failure boundaries and image fallback. It maps photographs onto reusable forms; it is **not 3D scanning**.
- Administration: authenticated roles; create/edit/duplicate/publish/unpublish/archive/delete, bulk status changes, gallery/texture management, material preview/settings, taxonomy and custom attributes, homepage/branding/contact/policies, staff invitations/access, enquiry assignment/notes/history/follow-up, CSV import/export, database metrics/trends and audit events.
- Storage: signed Cloudinary upload authorization and provider verification, image registry, transactional references, safe replacement and explicit orphan deletion. Existing assets survive upload/save failures. Missing credentials produce an actionable error, not fake success.

## Stack and source layout

Next.js App Router + React + TypeScript; shared authored CSS design system; Firebase Auth + Firestore Admin SDK; Zod; Cloudinary; Three.js / React Three Fiber / Drei; Vitest + Playwright. No unrelated application in the parent workspace was rewritten.

- `src/app`: server-rendered public pages and API routes.
- `src/components`: accessible public UI, studio and administrative panels.
- `src/lib/schema.ts`: shared validated domain contracts.
- `src/lib/server`: database, authorization, upload, enquiry and reporting logic.
- `scripts`: emulator-only sample seeding and trusted first-admin provisioning.
- `tests`, `e2e`: unit, emulator integration, security-rule, simulated provider-contract and browser tests.
- `docs`: deployment, security/data model, asset licensing and verification status.
- `artifacts/qa`: captured desktop/mobile/studio/admin browser screenshots.

## Local setup — no paid account required

Requirements: Node.js 24, npm, Java 21+ for current Firebase emulators. Do not connect demo seeds or tests to a live Firebase project.

```sh
npm ci
# Terminal 1: isolated auth + Firestore services
npm run emulators
# Terminal 2: seed real emulator database records, then start the app
npm run seed:local
npm run dev:local
```

The `:local` scripts use **process-scoped** `demo-stillvein` overrides. They do not overwrite owner-provided environment files. Local image assets are explicitly labelled sample data; production Cloudinary upload behavior is not emulated as success.

To persist emulator data, stop the current emulator and restart with:

```sh
npx firebase emulators:start --project demo-stillvein --only auth,firestore \
  --import=.emulator-data --export-on-exit=.emulator-data
```

On the first run, omit `--import` if the directory does not exist. Do not run two emulators on the same ports.

### Create your own local administrator

No hardcoded password or public admin-registration endpoint exists. Automated tests use random, temporary synthetic accounts and remove them afterward.

```sh
read -r -p 'Local admin email: ' ADMIN_EMAIL
read -r -s -p 'Local-only password: ' ADMIN_PASSWORD; echo
export ADMIN_EMAIL ADMIN_PASSWORD
npm run admin:local
unset ADMIN_PASSWORD
```

Visit http://localhost:3000/admin. For a real project use the separate provisioning procedure below; production provisioning does not create a default password. If an admin already exists, the bootstrap script refuses to run again.

## Real Firebase / Cloudinary setup

Copy the variable names from [.env.example](.env.example), then follow [deployment and provider setup](docs/DEPLOYMENT.md). Never commit credentials. The public Firebase `appId` must be the web app's ID, not a Storage bucket name. Public Firebase configuration alone does **not** authorize server Firestore access.

An environment that combines a non-demo project ID and emulator hosts is intentionally rejected. Use the `:local` scripts for isolated testing, or remove all emulator variables and supply the dedicated project's server identity for real operation.

## Working with the catalog

1. Provision an administrator and sign in.
2. Add material categories and optional finishes/colours/patterns/applications/custom attributes.
3. Create a product with a unique SKU and slug; save a draft.
4. Upload gallery photos and the separate texture through the signed Cloudinary workflow. Describe images with alt text.
5. Preview material settings, choose default model/background/camera and save.
6. Publish after adding a description and verified gallery image.
7. Check its public page, studio and enquiry flow.

Currency/unit settings initialize new products; existing products retain their explicitly saved currency and units. Featured product IDs configure homepage order. Natural-stone origin and prices must be supported by actual source documentation; sample flags should remain enabled for unverified demonstration records.

CSV exports contain readable summary columns plus a `product_json` column preserving the entire editable schema. Imports accept that export format, validate up to 100 rows / 2 MB, and reuse only existing verified assets. Image import is not an unrestricted remote-URL fetch. Imports are sequential and report partial progress on failure.

## Tests and production build

With local emulators and the local application running:

```sh
npm run lint
npm run typecheck
TEST_EMULATORS=1 npm test
npx playwright install chromium
npm run test:e2e
npm audit --omit=dev
```

Without `TEST_EMULATORS=1`, only pure unit tests run; integration suites are explicitly skipped. Browser tests require the local demo database and server; they must never target production. The local seed and test scripts do not grant access to a real project.

To verify the optimized bundle locally, stop the dev server first:

```sh
npm run build:local
npm run start:local
npm run test:e2e
```

Normal production deployment uses `npm run build` / `npm start`, **not** the `:local` overrides. See [verification results](docs/VERIFICATION.md) for executed checks and limits. [Schema and security](docs/SCHEMA-AND-SECURITY.md) documents authorization, storage and bounded search behavior. [Asset licenses](docs/ASSET-LICENSES.md) lists the real CC0 texture sources.

## Scope limits and outstanding release work

- Real upload/delivery, server identity, database writes and 3D texture rendering are verified from the local optimized server. Hosted ingress limits, production domain authorization, email delivery to the recipient and full hosted acceptance still need verification.
- Search uses a bounded server scan rather than a dedicated full-text service. Relevance ranks the newest 1,000 candidates; other sorts can continue scanning. The UI does not mislabel catalog size as an exact filtered total. Add a search index for large catalogs.
- Admin search/filter/export covers loaded pages; some small-catalog pickers have documented caps. These limits are visible and detailed in the schema document.
- No AI image processing, automatic texture cropping, PDF spec generation, email notification provider, measured popularity ranking or true stone reconstruction is included. The specification download is text. None is silently represented as working.
- Data deletion/retention operations for privacy requests require the operator's approved procedure. Review the default policy text, backups, ingress abuse controls and dependency advisories before launch.
- Development-only transitive advisories remain in upstream tooling; the production dependency audit is clean. See verification notes rather than treating the whole toolchain as vulnerability-free.
- The supplied Dockerfile is a deployment recipe; no Docker build or external hosting deployment has been executed. No hosting plan was purchased or upgraded, and Firebase billing remains disabled.
