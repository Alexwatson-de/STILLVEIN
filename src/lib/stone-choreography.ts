// Pure keyframe math shared by the scroll-driven presentation and its tests.
// This is deliberately separate from product geometry/settings in the studio.
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
export function easeRange(start: number, end: number, value: number) {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const vector = (a: number[], b: number[], t: number) => a.map((n, i) => mix(n, b[i], t));
export function stoneFrame(progress: number, mobile = false) {
  const p = clamp01(progress),
    turn = easeRange(0.12, 0.56, p),
    assemble = easeRange(0.56, 0.91, p);
  const pose = {
    position: vector([mobile ? 0 : 1.15, 1.65, 0], [mobile ? 0 : -1.2, 0.98, 0], turn),
    rotation: vector([1.18, -0.32, 1.18], [0, 0.2, 0], turn),
    camera: vector(
      [0, mobile ? 2.8 : 1.8, mobile ? 11.3 : 7.4],
      [1.5, 3.25, mobile ? 12 : 6.8],
      turn,
    ),
    target: [0, mobile ? 2.1 : 1.05, 0],
  };
  return {
    progress: p,
    phase: p < 0.3 ? 'surface' : p < 0.65 ? 'detail' : 'space',
    position: vector(pose.position, [mobile ? 0 : -0.85, 0.95, 0], assemble),
    rotation: vector(pose.rotation, [0, 0, 0], assemble),
    camera: vector(pose.camera, [3.5, 2.6, mobile ? 12 : 7.2], assemble),
    target: vector(pose.target, [0, mobile ? 1.25 : 0.65, 0], assemble),
    sideReveal: assemble,
    introOpacity: 1 - easeRange(0.13, 0.3, p),
    detailOpacity: easeRange(0.25, 0.39, p) * (1 - easeRange(0.54, 0.68, p)),
    spaceOpacity: easeRange(0.64, 0.8, p),
    background: easeRange(0.57, 0.94, p),
  };
}
