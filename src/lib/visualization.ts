import { Visualization } from './schema';
// Model dimensions use metres inside Three.js. UV coordinates use physical face
// dimensions relative to a reference texture footprint, never a stretched 0..1 box.
export const modelDimensions: Record<Visualization['model'], [number, number, number]> = {
  slab: [2.8, 0.035, 1.5],
  vertical: [2.1, 2.8, 0.035],
  countertop: [2.8, 0.04, 0.85],
  floor: [3, 0.025, 3],
  wall: [3, 2.4, 0.025],
};
export function textureRepeat(width: number, height: number, s: Visualization) {
  return [s.repeatX * s.scale, s.repeatY * s.scale * (width / height)] as const;
}
