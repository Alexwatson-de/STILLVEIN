# Data model and trust boundaries

## Data ownership

Firestore is the authoritative store. Public React components call public API routes or server-rendered repository functions; products are never hardcoded into frontend objects. Cloudinary stores production image binaries. Firestore stores only image metadata and stable IDs. Local demonstration imagery is an explicit exception: the seed is restricted to the `demo-stillvein` emulator and uses CC0 images shipped in `public/textures`.

Collection contracts:

- `products/{id}`: validated product metadata, unique SKU and slug, category ID, stone type, descriptions, public price/range/mode/currency/unit, image references, texture, finish/colour/tones/pattern/origin/classification, dimensions in mm, thickness choices, applications, care, tags, custom attributes, featured flag, publication state, related IDs, SEO, visualization settings, ISO UTC timestamps and integer revision.
- `taxonomy/{id}`: `kind` (category, finish, colour, pattern, application, attribute), name and description. Category references must exist. Deletion is refused while products reference a category. Textual finish/colour/etc. values are historical specifications; removing a taxonomy choice does not silently rewrite existing products.
- `assets/{assetId}`: Cloudinary immutable asset ID, public ID, delivery URL, width/height, alt text, `state` (`ready`, `deleting`, `deleted`), reference IDs, creator and timestamps. Local samples are tagged `sample` and cannot be deleted via Cloudinary.
- `uploadTickets/{uuid}`: authorized staff UID, exact signed public ID, creation time, expiry and upload state. Ticket finalization checks the same UID and queries Cloudinary server-to-server; it does not trust the browser's asset URL or claimed MIME type.
- `enquiries/{hash}`: contact information, consent, category, quantity/unit, project details, message, product ID plus authoritative product name/SKU snapshot, unique reference, status, assignment, follow-up, internal notes/history and revision. Public submission returns the reference only.
- `users/{firebaseUid}`: email, role (`admin`, `editor`, `sales`), active flag and creation time. Only a trusted initial-provisioning script or an existing administrator can grant access.
- `settings/public`: brand, homepage text and hero asset, featured IDs, contact/social links, currency/unit defaults, SEO copy, policies and section visibility. No credentials belong here.
- `audit/{id}`: actor UID/email, action, target and time. Written by the server alongside sensitive mutations; never writable through the browser SDK.
- `unique/{hashed-slug-or-sku}`: transactional uniqueness locks.
- `rateLimits/{hashed-key}`: HMAC-hashed IP/email, hourly counter and expiry timestamp. No raw IP is stored. Paid automatic TTL is not enabled.

All source schemas are centralized in `src/lib/schema.ts`. Unknown product fields are stripped on writes and public projection. Internal costs or supplier secrets, if introduced later, must use a separate server-only collection and never be added to the public schema.

## Role matrix

- Administrator: all management areas, invitations, role changes and site settings.
- Editor: products, taxonomy, gallery/texture uploads and asset cleanup; no enquiry PII, settings or staff access.
- Sales: enquiry management and active lead-assignment staff list; no product mutation or upload authorization.
- Public: published catalog reads, public settings/taxonomy, and validated enquiry submissions.

Every privileged request verifies a Firebase ID token with revocation checking and reloads the active stored role. Client-supplied roles, hidden navigation and token custom claims are not authorization. Disabling a user blocks old tokens at the database-role check. Self-demotion/disabling is refused. The final active admin is retained.

Firestore client rules deny **all** direct reads/writes, including to apparently public collections. The Admin SDK bypasses rules, so server authorization and public projections are mandatory and independently tested. Do not weaken rules to fix a client permission error.

## Concurrent writes and assets

Product saves compare the expected revision, then atomically verify category, SKU/slug locks and every image registry entry, save metadata, adjust reference sets and append an audit event. Stale edits return 409.

Upload replacement is deliberately two-stage: verify and register the new asset, then save the product. The previous asset remains available until the save succeeds. Failed uploads or product saves cannot overwrite the old image reference. Orphan cleanup is explicit. Deletion reserves an unreferenced asset transactionally as `deleting`; a concurrent product save refuses that state. A failed provider deletion restores `ready`. Product deletion requires archived status and exact-name confirmation, preserves enquiry snapshots, and detaches rather than destroys assets.

Cloudinary does not enforce a per-preset byte limit. The server therefore issues a ticket only, validates the real binary stream (10 MB), magic bytes, MIME/decoded format and dimensions (25 MP), and signs the provider upload itself. No browser-held Cloudinary signature can bypass these checks. Original bytes are preserved after validation. The deployed host must accept the stated body limit; smaller serverless ingress limits require an explicit deployment adjustment.

CSV import validates every row before writes, then performs ordinary authorized, revision-checked saves sequentially. It is **not** an all-or-nothing database transaction; failure reports the number of saved rows. Existing verified asset IDs can be reused. Arbitrary CSV image URLs are rejected. Exports neutralize spreadsheet-formula prefixes and exclude internal enquiry notes.

## Enquiry abuse protection

The server validates all fields, requires explicit consent, rejects a honeypot, and limits to 15 enquiries per IP/hour and five per email/hour. It uses durable Firestore counters, not per-process memory. `TRUST_PROXY=true` is appropriate only behind an ingress that overwrites forwarding headers. With it false, the local process uses a shared conservative IP bucket. Public clients cannot choose the stored status, reference, assignment or private notes.

A submission UUID plus hashed email identifies retryable submissions. The same ID and payload returns the original reference; changed payload with the same ID is rejected. Concurrent retries are transactionally serialized. Optional email is not part of the persistence transaction and is not currently integrated.

## Query scaling and operational limits

- Browsers receive at most 24 public products per request; default 12. Admin product/enquiry/audit pages load 50 records at a time.
- Structured filters combine on the server. Substring search requires a bounded server scan because Firestore is not a full-text engine. Normal sort scans at most 1,000 candidates per request; continuation can scan further. Relevance ranks at most the newest 1,000 candidates. A visible notice identifies the limit. Add a dedicated search index before using this implementation for a large catalog.
- The public result count distinguishes page size from total published catalog size; it does not claim an exact global filtered count.
- Admin search/filter/sort/export operate on the explicitly loaded pages. Taxonomy is capped at 500 definitions, staff at 100, asset library at 100 ready assets, related-product picker at the first 50. These are disclosed small-catalog limits, not unlimited enterprise features.
- Enquiry trend charts use at most the latest 1,000 records in the selected 7/30/90-day period and label truncation. Overall dashboard totals use database aggregation counts.
- Historical notes/history are embedded in enquiry documents. Very long-running lead histories should be migrated to subcollections before approaching Firestore's document-size limit.
- ISO UTC timestamps originate on the trusted server. Product dimensions are mm; Three.js scene units are metres and preset sizes are illustrative.

## Additional release hardening

Configure managed ingress rate limiting for catalog reads and auth attempts; consider CAPTCHA/App Check for sustained spam. Approve privacy operator/retention/contact text, log redaction, account offboarding, backups and deletion procedures. Adopt nonce-based CSP if the deployment can provide per-request nonces; the current production policy excludes eval and external scripts but permits Next's inline bootstrap. Restrict ingress to HTTPS and monitor provider usage. Do not treat an emulator test as production integration verification.
