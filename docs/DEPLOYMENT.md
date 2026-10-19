# Deployment and service configuration

## Current hosted deployment

STILLVEIN is hosted at **https://stillvein.vercel.app**, with staff access at **/admin**. The owner explicitly selected personal, non-commercial demo use on the existing Vercel Hobby team (`dhruv-820e`). The Vercel project is connected to `Alexwatson-de/STILLVEIN`, production branch `main`, Next.js with Node.js 24. Paid plans were not enabled. Hobby must not be used for commercial operation.

The dedicated `stillvein` Firebase project remains in `nam5`, with deny-by-default rules/indexes and the scoped server identity. Firebase billing remains disabled. The production domain was added to Firebase Auth authorized domains without removing existing domains. Hosted browser sign-in, actual Cloudinary gallery/texture uploads, Firestore persistence, 3D drawing, enquiries and cleanup passed. Temporary hosted test assets/accounts were removed; previously requested sample data and owner materials remain.

Fifteen production-only environment variables are stored in Vercel; private credentials use sensitive values. The local credential file path and emulator variables are never deployed. Preview environments intentionally have no production secrets. GitHub pushes to `main` trigger production builds.

Hosted upload policy: `NEXT_PUBLIC_MAX_IMAGE_MB=4` at build and runtime. Vercel Functions accept at most 4.5 MB request bodies; a 4 MB cap is validated by the UI, ticket schema, bounded binary stream and final provider metadata check. A real 4 MB + 1-byte transfer was rejected by the application with 413, and an under-limit 2048-pixel JPEG succeeded. Original existing assets are not recompressed or deleted.

Two Vercel-only integration fixes were required: complete the optional dependency lock entries for the clean npm install, and bundle Firebase Admin/JWKS/JOSE with Next so Vercel's instrumented runtime does not attempt a CJS require of an external ESM module. No cryptography downgrade or authorization bypass was introduced.

Local server credentials live in the ignored, mode-0700 `.secrets` directory (key mode 0600), referenced by `GOOGLE_APPLICATION_CREDENTIALS`. Git, Docker and Vercel upload exclusions protect this directory. The hosted server receives `FIREBASE_SERVICE_ACCOUNT_JSON` through Vercel's sensitive production environment, never Git. Rotate credentials shared in chat; no automatic rotation was performed.

Choose an authorized hosting environment that supports Node.js 24, Next.js server routes and the intended commercial use. Do not deploy a commercial platform to a plan that prohibits commercial use. Obtain explicit approval before purchasing a plan or enabling Firebase/Cloudinary billing. Static-only hosting is insufficient.

## 1. Dedicated Firebase project

1. Use a dedicated approved project, not RoomSync, Workpulse or another application.
2. Create/confirm a Firestore database and review region, quotas and cost policy. Do not enable a paid tier without approval.
3. Enable Email/Password in Firebase Authentication and add the production domain to authorized domains. Configure password-reset email templates and sender settings.
4. Register a Firebase Web App and copy its `apiKey`, `authDomain`, `projectId` and **appId** into the corresponding `NEXT_PUBLIC_FIREBASE_*` variables. An app ID normally looks like `1:...:web:...`; a `firebasestorage.app` value is a Storage bucket, not an app ID. This application does not need Firebase Storage.
5. Set server `FIREBASE_PROJECT_ID`. Supply the trusted server with `FIREBASE_SERVICE_ACCOUNT_JSON` as a private secret, or use the host's application-default workload identity. Never put this identity in browser variables or source control.
6. Grant only necessary Firestore data and Firebase Authentication user-management permissions to that server identity. The exact IAM binding must be reviewed by the project owner; do not use a general Owner key or share another app's credentials.
7. Review and deploy rules/indexes to the **explicit** project:

```sh
npx firebase deploy --only firestore:rules,firestore:indexes --project YOUR_APPROVED_PROJECT_ID
```

This is a real security change and should only be executed once the owner has approved the target project. Included rules deny direct browser access; public access is through the validated server APIs. Wait for indexes to finish building before live smoke tests. Paid TTL cleanup is intentionally not enabled in the shipped configuration. Counters expire logically by hourly keys; add an approved retention cleanup process separately.

8. Provision the initial admin from a trusted machine with the same server identity:

```sh
ADMIN_EMAIL='approved-operator@example.com' npm run provision-admin
```

No default production password is created. Use Firebase's configured password reset flow to establish the account password. The script refuses when an administrator already exists. Subsequent staff invitations are administered through the protected dashboard; private setup links are shown once and must be delivered securely. No optional mail provider is silently assumed.

## 2. Cloudinary signed uploads

Server-only secrets:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_PRESET`

Create a **signed** image upload preset, for example `stillvein_signed`:

- unsigned mode disabled;
- allowed formats exactly a safe subset of `jpg`, `jpeg`, `png`, `webp`;
- do not configure a fictitious `max_file_size` setting: Cloudinary does not support it as a server-side upload-preset restriction;
- resource type image, no SVG/raw/video acceptance;
- preserve the full-resolution original; do not impose an incoming downscale that silently destroys the source texture;
- no overwrite; avoid preset folder transformations that contradict signed public IDs;
- review account-level 25-megapixel limit, delivery restrictions and upload quotas.

The server verifies that the preset is signed, allows only approved raster formats and disables overwrite. The browser receives only an owned, expiring ticket, never a reusable Cloudinary signature. It transfers raw bytes to the authenticated server, which caps the actual stream at the deployment limit (4 MB on Vercel, 10 MB local default), checks raster magic bytes, validates MIME/format and fully decodes within a 25-megapixel limit. Only then does the Cloudinary SDK sign and send the image. Assets live under:

- `stillvein/products/{product-id}/gallery/{uuid}`
- `stillvein/products/{product-id}/textures/{uuid}`
- `stillvein/site/{uuid}`

After the validated server-signed transfer, finalization queries Cloudinary by the fixed public ID, validates its real metadata and registers the asset. Only then may a product reference it. Failed uploads do not alter existing product images. Cancellation stops the browser request; an already-started provider transfer may leave an unreferenced asset for authorized reconciliation. Tickets expire after one hour and are reserved before transfer to prevent concurrent reuse. Do not delete provider assets manually without checking the registry.

The hosting ingress must support the advertised binary body and transfer time. Vercel uses the explicitly displayed 4 MB limit. Larger hosted uploads require a separately approved authenticated upload service; do not bypass validation by exposing signatures again. Saving a JPEG/WebP below 4 MB can retain its 2048-pixel dimensions without requiring geometry or material changes.

### Free-plan check (researched 19 October 2026)

Official Cloudinary sources report **25 shared monthly credits**, where one credit corresponds to 1 GB managed storage, 1 GB delivery bandwidth, or 1,000 transformations. These share the credit pool, not three independent 25-unit allowances. Delivery/transform usage uses a rolling period; storage is the stored total. Free image limits are 10 MB and 25 megapixels. Commercial use is permitted under applicable terms; no paid plan was enabled here. Verify the actual account dashboard because provider limits and promotions can change.

Sources:

- https://cloudinary.com/documentation/billing_and_plans
- https://cloudinary.com/pricing/compare-plans
- https://cloudinary.com/documentation/upload_images
- https://cloudinary.com/documentation/upload_presets

Large/high-traffic libraries can exhaust free allowances quickly. Inspect usage before launch and monitor it afterward. Do not switch providers or upgrade automatically. Provider-specific operations are isolated in `src/lib/server/assets.ts`, while image delivery transformations are isolated in `src/lib/catalog.ts`.

## 3. Hosting environment

- `NEXT_PUBLIC_SITE_URL`: exact canonical HTTPS origin; also used for request-origin checks.
- `NEXT_PUBLIC_MAX_IMAGE_MB`: 4 on Vercel, 10 on unrestricted local hosts; keep build/runtime values identical.
- Public Firebase variables must be supplied **at build time**. Changing them requires a rebuild.
- Server Firebase/Cloudinary variables are runtime secrets; never `NEXT_PUBLIC_*` or `VITE_*`.
- `RATE_LIMIT_SECRET`: unique cryptographically random secret of at least 32 characters.
- `TRUST_PROXY=true`: only behind an ingress known to overwrite `x-forwarded-for`; otherwise configure a safe trusted-client-IP strategy before launch.
- Vercel's direct ingress overwrites `x-forwarded-for` to prevent spoofing, so the production deployment enables `TRUST_PROXY`. See https://vercel.com/docs/headers/request-headers.
- Remove `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL` and `ALLOW_LOCAL_PRODUCTION_TEST` from production. Non-demo emulator combinations are rejected.
- Configure HTTPS, server timeouts, request-body limits and platform-level rate limiting. Public filtered reads are intentionally not cached until a safe published-data invalidation strategy is added.

```sh
npm ci
npm run lint
npm run typecheck
npm run build
npm start
```

The included Dockerfile uses a non-root runtime user and excludes local environment files via `.dockerignore`. Public Firebase variables are build arguments, not server secrets. Inject server secrets using the host's secret manager. The Docker recipe has not itself been executed in this workspace.

A compatible Next.js hosting service can use the application folder as its project root, with `npm run build` as its build command. Select the repository and project explicitly; do not automatically reuse another application's connected deployment.

## 4. Required live acceptance run

Before announcing any production URL:

1. Confirm valid HTTPS, origin and canonical metadata; sitemap lists only published products.
2. Provision a synthetic editor and sales user; verify cross-role and anonymous API denial.
3. Upload a small valid gallery JPEG and a 2K+ texture via the actual signed Cloudinary flow. Inspect account public IDs, content type, saved Firestore asset IDs and optimized delivery.
4. Attempt SVG, oversized and unauthorized uploads; expect refusal. Disconnect network during replacement; previous public image must remain.
5. Save/publish a synthetic product, confirm new texture and saved roughness/model/background on public page and studio. Verify desktop and real mobile touch/WebGL behavior.
6. Submit a synthetic enquiry twice with the same ID; only one record/reference should exist. Check assignment, private notes/history and authorized CSV export.
7. Archive/delete synthetic products, verify unpublishing, reference-aware asset deletion and audit events.
8. Revoke a test staff account; cached tokens must lose access. Remove all synthetic records/assets/accounts.
9. Approve actual privacy contact, legal operator, retention policy, image rights and sample-record removal.
10. Verify production logging, backup/recovery and provider usage; record results and only then share the live URL.

## Troubleshooting

- **Mixed emulator/project error:** use `npm run dev:local` or remove all emulator settings for a real project. Never rename a real project ID to bypass the safeguard.
- **Server Firebase error:** the web API key is not an Admin credential. Supply a private server identity and verify project/IAM permissions.
- **Cloudinary setup error:** confirm all four server variables and the signed preset. A 503 is intentional until restrictions can be verified.
- **Image changed in upload preview but not publicly:** save the product after successful upload. Unsaved previews never alter published records.
- **409 save conflict:** another session changed the record. Reload; do not force overwrite.
- **Missing-index error:** deploy the included indexes to the approved project and wait for readiness. Emulators do not prove production index deployment.
- **3D image failure:** inspect CORS, Cloudinary delivery URL and WebGL 2 support. Gallery/details/enquiry remain usable. No 3D scan is inferred from an upload.
- **Large catalog incomplete relevance results:** the bounded search window is documented; add a dedicated search index rather than raising browser payload size.
- **Rate-limit responses during repeated tests:** wait for the hourly bucket or clean only the isolated emulator test counters. Never disable live protections as a workaround.
