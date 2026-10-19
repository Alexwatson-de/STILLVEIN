# Verification report

Date: 19 October 2026. Targets: isolated Firebase emulators, plus the optimized local server connected to the authorized real `stillvein` Firebase project and Cloudinary account. **No public hosting deployment has been performed.**

## Live-service follow-up

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

- Actual delivery of the password-setup email to the recipient and full hosted-domain Auth configuration; only Firebase's acceptance of the email request is verified.
- Hosting-specific binary body limits, runtime secret injection, TLS and live monitoring. The real-service upload/3D test used the local server, not an externally deployed host.
- A deployed hosting URL, commercial-plan eligibility, infrastructure abuse controls, backups and restore exercise. No external deployment occurred.
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
