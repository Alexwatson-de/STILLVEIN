# Mineral Revolution — presentation-only redesign

## Requirement

The owner requested a whole-site visual redesign informed by https://cornrevolution.resn.global/, with existing functionality and all other application behavior kept unchanged.

## Design interpretation

- Near-black and deep forest-green atmosphere, warm-white type and restrained mineral-green accents.
- Oversized condensed display typography, fine technical labels, orbital guides and specimen-like imagery.
- Cinematic homepage composition made from the existing configured material photographs. The hero uses decorative CSS perspective/parallax; it does not claim to be a stone scan or replace the actual interactive material studio.
- Consistent styling across collection/filter controls, cards, product galleries/specifications, comparison, studio chrome, contact and enquiry forms, dialogs, policies and error states.
- The same visual language at a denser scale in staff login, overview, product editor, taxonomy, image library, enquiries, settings, user management and audit tables.
- Normal scrolling, discoverable navigation and native inputs retained instead of adopting the reference's immersive-navigation constraints.

The reference informs atmosphere and composition, not brand/content. No Pioneer/Resn assets, source code, models or proprietary fonts are copied. The new self-hosted Barlow Condensed font is OFL-licensed; existing catalogue photography and copy remain authoritative.

## Preservation boundary

No changes to API routes, schemas, Firestore rules/indexes, authentication or authorization, provider configuration, pricing/data, CSV logic, enquiries, upload limits, or interactive 3D renderer/model settings. No live records were rewritten to fit the visual treatment. Existing hero/brand text remains admin-configurable.

The renderer still uses each material's saved background and lighting. Only the surrounding controls and the inactive preview-launch surface are restyled. Product photography in galleries/cards is not color-graded; atmospheric treatment applies only to decorative hero art.

Implementation:

- `src/app/revolution.css`: isolated visual theme layered over the established structural CSS.
- `src/components/cinematic-atmosphere.tsx`: small presentation-only pointer/scroll decoration. No event prevention or navigation interception; reduced-motion users do not receive parallax handlers.
- Homepage/chrome markup: decorative slab composition, scroll cue and visual wordmark treatment; existing content and destinations retained.
- Admin chart colors use theme tokens, with calculations and record sources unchanged.

## Verification

- 94 unit, API, upload-policy and Firestore/security tests passed.
- All 18 Playwright workflows passed against the optimized build: the original 14 functional workflows plus four new redesign regressions.
- Additional coverage checks public routes at widths 360, 390, 768 and 1440; every admin area; product editor controls; reduced motion; keyboard skip navigation; and enquiry dialog close behavior.
- A mobile contact-form grid overflow found during QA was repaired with shrinkable grid tracks and input constraints, not hidden with page-wide overflow clipping.
- Lint, TypeScript and optimized build passed. Production dependency audit remained clean.
- Screenshots of homepage, mobile hero, collection, product details, studio, contact, all staff sections and mobile editor were visually inspected. Third-party reference captures and sensitive live/inspection screenshots are excluded from Git.

Headless browser testing does not constitute a complete WCAG audit or physical-mobile GPU/performance certification. Native keyboard/touch controls and the previously verified WebGL fallback remain in place.
