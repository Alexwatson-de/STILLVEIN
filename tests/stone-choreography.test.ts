import { describe, it, expect } from 'vitest';
import { clamp01, easeRange, stoneFrame } from '../src/lib/stone-choreography';
describe('Scroll-driven stone presentation', () => {
  it('clamps native scroll overshoot', () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(3)).toBe(1);
    expect(stoneFrame(-2)).toEqual(stoneFrame(0));
    expect(stoneFrame(3)).toEqual(stoneFrame(1));
  });
  it('has three real spatial chapters', () => {
    expect(stoneFrame(0).phase).toBe('surface');
    expect(stoneFrame(0.45).phase).toBe('detail');
    expect(stoneFrame(0.95).phase).toBe('space');
  });
  it('rotates the slab and changes the camera as the page scrolls', () => {
    expect(stoneFrame(0.45).rotation).not.toEqual(stoneFrame(0).rotation);
    expect(stoneFrame(0.45).camera).not.toEqual(stoneFrame(0).camera);
    expect(stoneFrame(1).rotation).toEqual([0, 0, 0]);
  });
  it('assembles the countertop only in the last chapter', () => {
    expect(stoneFrame(0.5).sideReveal).toBe(0);
    expect(stoneFrame(0.75).sideReveal).toBeGreaterThan(0);
    expect(stoneFrame(1).sideReveal).toBe(1);
  });
  it('reverses deterministically rather than playing a one-way video', () => {
    const a = stoneFrame(0.4);
    stoneFrame(1);
    expect(stoneFrame(0.4)).toEqual(a);
  });
  it('crossfades text and the neutral studio background', () => {
    expect(stoneFrame(0).introOpacity).toBe(1);
    expect(stoneFrame(0.45).introOpacity).toBe(0);
    expect(stoneFrame(0.45).detailOpacity).toBe(1);
    expect(stoneFrame(1).spaceOpacity).toBe(1);
    expect(stoneFrame(1).background).toBe(1);
  });
  it('backs the mobile camera away to keep the whole object in frame', () => {
    expect(stoneFrame(0.5, true).camera[2]).toBeGreaterThan(stoneFrame(0.5).camera[2]);
    expect(stoneFrame(1, true).position[0]).toBe(0);
  });
  it('uses bounded smoothstep interpolation', () => {
    for (let i = -10; i < 110; i++) {
      const x = easeRange(0.2, 0.8, i / 100);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    }
  });
});
