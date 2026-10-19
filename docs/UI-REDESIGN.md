# Stone in motion — scroll-driven material experience

## Corrected requirement

The owner clarified that the Corn Revolution reference is about **animation, scrolling, 3D camera movement and smooth transitions**, not adopting its green palette. The green design and static CSS slab hero were rejected. The website must look appropriate for marble/granite while retaining its business functionality.

## Implemented experience

- Neutral charcoal, warm ivory, limestone/taupe and restrained bronze. The former green theme stylesheet is removed.
- A real React Three Fiber / Three.js hero, not a transformed image or prerecorded video. The existing material texture is mapped onto a reusable solid slab with aspect-aware physical UVs and studio lighting. An administrator's custom hero override remains authoritative.
- A native-scroll, sticky 3D stage spanning three chapters:
  1. **Surface:** a vertical, floating slab beside the configured hero headline.
  2. **Detail:** the slab rotates, the camera moves closer/around it, and supporting copy crossfades.
  3. **Space:** the slab settles horizontally, two stone sides rise into a waterfall countertop arrangement, and the studio background transitions from charcoal to warm ivory.
- Scrolling backward reverses the same continuous choreography. Damped interpolation smooths the motion; there is no wheel/touch interception, page-scroll replacement or looping video.
- Scene rendering is on demand, stops after interpolation settles, and does not continue rendering while the page scrolls outside the journey. Mobile uses a wider camera framing, lower-resolution texture, bounded DPR and low-resolution contact shadows.
- Staggered section/card reveals, a gently scrolling studio teaser and refined hover transitions extend the motion language beyond the hero.
- Persistent collection/studio links and a direct skip link keep the application navigable. Reduced-motion users get an unpinned short introduction; unsupported/failed WebGL uses the configured image and keeps the rest of the site usable.

The presentation is an illustrative material visualization, not a stone scan or fabrication model. No Pioneer/Resn assets, source code or proprietary models are copied.

## Preservation boundary

APIs, schemas, Firestore rules/indexes, authentication, roles, upload authorization/limits, provider configuration, prices/specifications, CSV, enquiries and saved functional studio settings are unchanged. The existing material studio still has its original manual rotate/zoom/reset/model/lighting controls; the homepage scroll scene is separate.

No live record is rewritten to fit the design. The configured hero title/description and brand fields continue to drive the homepage. New chapter copy describes the visual presentation without inventing supplier claims.

## Source map

- `src/components/stone-journey.tsx`: pinned stage, native-scroll sampling, damped progress, chapter text and progressive enhancement.
- `src/components/scroll-stone-scene.tsx`: actual texture-mapped meshes, camera transforms, lighting and resource disposal.
- `src/lib/stone-choreography.ts`: pure deterministic keyframes/interpolation, isolated from business data logic.
- `src/components/cinematic-atmosphere.tsx`: viewport reveals and presentation-only teaser parallax.
- `src/app/stone-experience.css`: neutral site-wide UI and motion styles layered over the existing structural CSS.

## Verification

- **102 automated tests passed**, including eight new choreography tests for clamping, spatial phase changes, camera/model transforms, reverse scrolling, side-panel assembly, text/background interpolation and mobile framing.
- **22 browser workflows passed against the optimized build**: original functional suites, whole-site UI regressions and four new motion tests.
- Scroll tests inspect the live model/camera pose, verify nonuniform canvas pixels, check that the stage pins/releases, reverse the sequence, exercise mobile native scrolling and confirm the static reduced-motion/WebGL fallback.
- Revealed cards still navigate normally. Public/admin layouts remain checked at phone/tablet/desktop widths. Lint, type checking and production build pass; the production dependency audit remains clean.
- Actual screenshots at Surface, Detail and Space were reviewed on desktop and mobile. Mobile framing was moved below the copy and widened to avoid clipping the countertop. Desktop geometry was shifted clear of the detail text.

Headless software WebGL tests demonstrate correct behavior but are not a claim of a measured frame-rate target on all physical phones/GPUs. The scene deliberately uses lightweight geometry, on-demand frames and bounded texture resolution.
