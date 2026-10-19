# Verification report

Date: 19 October 2026. Targets: isolated Firebase emulators, the optimized local server and the hosted Vercel demo connected to the authorized real `stillvein` Firebase project and Cloudinary account.

## Vercel hosted acceptance

### Scroll-experience correction

The owner rejected the earlier color-focused green design. It has been replaced with a neutral charcoal/ivory stone palette and a genuine scroll-driven WebGL presentation: slab rotation, camera travel, reversible countertop side assembly, background/copy crossfades, sticky-stage pin/release and section reveals. The old green theme stylesheet and static hero are removed.

**102 automated tests and 22 browser workflows passed** on the optimized local build. The eight new pure tests validate deterministic choreography; four new browser tests inspect actual scene poses and canvas pixels at multiple scroll positions, reverse the motion, exercise mobile scrolling and verify reduced-motion/WebGL fallbacks. The original functional suites remain intact. Lint, TypeScript, production build and production dependency audit pass.

Desktop/mobile Surface, Detail and Space screenshots were visually reviewed. The mobile camera was widened and lowered in composition to avoid cropping or overlapping copy. The existing functional material studio renderer, saved product settings, APIs, data, roles and upload policy were not changed. See [UI-REDESIGN.md](UI-REDESIGN.md).

### Earlier whole-site UI redesign regression (superseded visually)

The Corn Revolution-inspired visual update is documented in [UI-REDESIGN.md](UI-REDESIGN.md). Before deployment, all **94 automated tests** and **18 browser workflows** passed against the optimized local build. The added UI coverage checks nine public/login routes at four widths (360/390/768/1440), all administrative sections, actual product/preview content, keyboard skip navigation, enquiry dialog dismissal and reduced motion. Screenshots were inspected; one mobile form overflow was corrected.

The patch does not modify APIs, database records/schemas/rules, provider configuration, role logic, upload limits, or the interactive renderer's geometry/settings. Existing text and admin-configurable content remain unchanged. Display case, colors, font, spacing, composition and decorative motion are presentation concerns only.

Live demo: **https://stillvein.vercel.app**. The owner explicitly confirmed personal, non-commercial use on the existing Hobby team; no paid upgrade or Firebase billing enablement occurred. Successful application deployment source: `8aa4360` (subsequent documentation-only commits may redeploy the same code).

Executed on the actual public HTTPS origin:

- Homepage, collection, material detail, admin login and catalog API return 200. Anonymous admin API requests return 401.
- Real synthetic staff sign-in through Firebase, gallery upload and 2048 x 2048 texture upload through Vercel, Cloudinary delivery and Firestore references all succeeded.
- Both browser validation and an actual over-limit binary transfer enforce the hosted 4 MB limit. The server returned application-level 413 for 4 MB + 1 byte. Forged image bytes were rejected without altering the existing texture.
- Interactive WebGL countertop renders the actual Cloudinary texture. Mesh-draw readiness and centre-canvas pixel variance confirmed geometry rather than a blank canvas.
- Product enquiry submitted through the hosted browser persists with the correct material ID. Cross-origin privileged writes return 403. Canonical sitemap URLs use the production origin, not localhost.
- Desktop and 390px mobile browsing passed; mobile Marble + Polished filters returned the two sample materials without horizontal overflow. Zero uncaught browser errors in the visual-review run.
- Synthetic hosted staff, product, category, enquiry and Cloudinary images were removed; audit events retained. Owner records and the requested sample demonstration data were preserved.
- 59 focused unit tests pass (46 catalog/schema, 10 image-validation, 3 deployment upload-policy), plus lint/type checking and Vercel's optimized build. Production dependency audit remains at zero vulnerabilities.

Initial Vercel clean-install and CJS/ESM runtime errors were investigated and repaired, not treated as successful deployments. The repaired lockfile includes optional platform dependencies, and Firebase/JWKS/JOSE are bundled for the hosted runtime without downgrading token verification.

## Live-service follow-up

### Requested sample catalog test

Six published sample products were added through the validated server upload/domain path, with original 2048 x 2048 Cloudinary textures and Firestore references. All sample prices/specifications are explicitly illustrative. Two clearly marked synthetic enquiries remain (New and Contacted); temporary QA staff were removed, the original admin remained active, and the owner-added non-sample Granite 01 record was preserved.

**Eight live browser workflows passed against the optimized real-service build**, covering sample photography/product pages; rapid search/combined filters/sort/pagination; persistent comparison; six textures and five model presets; product enquiry persistence; admin status/assignment/notes/follow-up and CSV; general-enquiry idempotency; mobile layouts and anonymous denial. Lint, type checking, production build and the production dependency audit also passed.

Two findings were corrected rather than hidden by the tests:

- Rapid filter changes could reuse a stale server-navigation query and restore cleared filters. Synchronous URL-history updates now merge the latest parameters without waiting for a server page navigation. Search text is only resynchronized when the URL search value changes.
- Screenshot review caught an empty 3D frame and a loading-portal removal error that the original DOM-only check missed. Loading feedback now lives in ordinary DOM outside the suspended 3D scene, and readiness is reported only after the stone mesh draws to the visible framebuffer. Stale material fetches are cancelled. Tests wait for this render signal, check centre-canvas pixel variation for every texture/model, and assert no uncaught page errors. The final screenshot was visually inspected and shows the textured countertop.

Live captures are intentionally kept out of Git because they can contain owner-entered catalog data or enquiries. Sample-seeding and live tests require explicit project confirmation; subsequent regression runs clean only the synthetic records they created.

### Initial live-service setup

- Real default Firestore database created in `nam5`; deny-by-default rules and composite indexes deployed. Dedicated server identity verified. Firebase billing remains disabled.
- Approved initial admin exists in Auth and the server-managed role store, active and not disabled. Firebase accepted the password-reset/setup email request; inbox delivery was not independently observed.
- Real Cloudinary signed preset verified. Live validation revealed that `max_file_size` is not a supported preset restriction; uploads now use server-validated binary transfer and server-side signing instead of issuing bypassable signatures.
- Actual browser gallery and 2048 x 2048 texture uploads succeeded. Cloudinary delivery URLs and asset IDs persisted in real Firestore. The texture rendered in the interactive WebGL studio and model switching worked.
- A forged PNG request was rejected before provider upload; the existing saved texture remained intact. Anonymous admin reads were denied.
- Synthetic user, product, category, metadata and Cloudinary images were removed. Audit records were retained; provider lookup confirmed no remaining live-smoke images.

## Executed and passed

- `npm run lint`: no errors or warnings.
- `npm run typecheck`: passed.
- `npm run build:local`: optimized Next.js production build passed; public pages, admin and API routes built successfully.
- `TEST_EMULATORS=1 npm test`: **91 tests passed** across five suites:
  - 46 pure tests: schemas, all composable filter families, pricing, safe CSV round-trip/formula escaping, image transformations, physical texture aspect settings and role matrix.
  - 18 real local API/Auth/Firestore integration tests: anonymous/invalid/outsider denial, editor/sales isolation, cross-origin denial, drafts hidden, optimistic concurrency, publish/archive/delete, unique SKU/slug, unverified asset rejection, cursor pagination, missing provider credentials, enquiry consent/persistence/retry, lead history/private notes and disabled-account enforcement.
  - 9 Firestore-rule tests: public collection reads/writes denied, role escalation denied and untrusted role claims denied.
  - 10 real image-decoder/stream-validation tests: JPEG/PNG/WebP acceptance, forged MIME, byte caps with/without declared length, SVG rejection, invalid/empty data and pixel limits.
  - 8 **simulated Cloudinary SDK contract** tests with real emulator metadata writes: file restrictions, insecure preset refusal, fixed upload destination, verified registration, ticket ownership, reference-aware delete refusal, provider-delete failure recovery and orphan deletion. These do not prove real signed uploads or provider configuration.
- `npm run test:e2e`: **14 Chromium browser workflows passed**, originally against the optimized bundle and rerun after upload changes against the isolated local development server. The real-provider smoke test then ran against the optimized real-service build. Coverage includes:
  - desktop homepage imagery, navigation structure, no uncaught page errors;
  - debounced search/query URL, combined filters, reset, list view and sort;
  - persistent material comparison;
  - product image zoom, sample pricing and product-specific enquiry persistence;
  - real WebGL canvas and texture loading, all five model presets, background/camera/zoom/reset and drag orbit;
  - WebGL-disabled fallback, missing texture and failed image-request containment;
  - authenticated product create/edit/draft/archive;
  - missing-Cloudinary setup failure preserving existing images;
  - admin material-setting save reflected in the public studio;
  - public projection stripping private fields added directly to Firestore;
  - catalog service failure and successful Retry recovery;
  - 390 px layouts without horizontal overflow on home, collection, product, contact and admin login.
- `npm audit --omit=dev`: **0 production dependency vulnerabilities** at verification time. Firebase Admin was upgraded and gRPC is pinned to a patched version.
- HTTP checks: local root returns 200; production CSP excludes eval; nosniff, anti-framing, referrer policy and permissions policy headers are emitted.
- Visual review: desktop/mobile homepage, studio and admin-editor captures inspected. A contact-shadow clear-alpha issue was corrected and the 3D screenshot re-inspected after the final build/test run.

## Development-toolchain advisories

The all-dependency audit still reports **12 development-only transitive advisories: 7 high, 5 moderate, 0 critical**. Remaining paths include the latest Firebase CLI and Next ESLint tooling (notably upstream `braces` through glob tooling, plus CLI dependencies). Firebase CLI and Vitest were upgraded to remove the earlier critical findings. The latest published `braces` version was itself in the advisory range at review time; no arbitrary unreviewed fork or downgrade was introduced.

Production installation excludes these dev-only packages. Do not process untrusted repositories/patterns through this toolchain; monitor upstream fixes and repeat both full and production audits before release. A clean production audit is not a claim that the whole development dependency tree is clean.

## Findings corrected during QA

- Development CSP initially blocked Webpack eval-based source maps; eval allowance is now limited to development, and the optimized production build was browser-tested without it.
- Filter select accessible names are explicit and stable.
- Public API projection now allowlists product fields rather than spreading arbitrary database fields.
- Catalog Retry now actually reissues the failed request without requiring a URL change.
- Newest sort uses creation time, not last edit time. Relevance uses a bounded ranked search window rather than pretending newest is relevance.
- Featured homepage order uses configured, published IDs.
- Transparent framebuffer clearing prevents an opaque square in contact shadows.
- Tests scope upload alerts separately from Next's route announcer.

## Not verified / outstanding

- Actual delivery of the password-setup email to the recipient; hosted Firebase sign-in and domain authorization are verified, but inbox receipt is not.
- Long-duration monitoring, sustained abuse/load testing, backups and restore exercises. Hosted runtime secrets, HTTPS and upload-body limits were exercised successfully.
- Commercial operation is not authorized by the current Hobby deployment; an eligible commercial plan would be required separately.
- Safari/iOS/Android physical-device touch behavior, fullscreen variants and GPU memory/thermal behavior. Headless Chromium used software WebGL; it is not a real mobile GPU certification.
- A completed WCAG audit, load/performance benchmarks or penetration test. Basic focus/labels/reduced motion/responsive behavior exist, but these do not replace specialist audits.
- Optional email/AI/image-preparation/PDF/popularity services are not implemented. Core enquiry persistence does not depend on them.
- Docker build was not run. The supplied Dockerfile and deployment notes require verification on the chosen host.

## Evidence

- [Desktop homepage](../artifacts/qa/home-desktop.png)
- [Mobile homepage](../artifacts/qa/home-mobile.png)
- [Interactive studio](../artifacts/qa/studio-desktop.png)
- [Admin product editor](../artifacts/qa/admin-editor.png)

Tests use random synthetic accounts and approved local sample records. Their credentials are never hardcoded in application source. Production acceptance is intentionally left open until the live checks in [deployment instructions](DEPLOYMENT.md) succeed.
