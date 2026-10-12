import { test, expect } from '@playwright/test';
import { DEFAULT_DPR_CAP, pixelRatioFor, RUNGS } from '../src/map/quality-ladder';
import { CHOICES, DEFAULT_VIEW, RANGES } from '../src/api/plan-view';

// ST7DPR (CR-029 section 3.5; the known limit of 2.4.7 "a mount that starts at the realistic rung ignores the person's dpr_cap"):
// the pixel ratio each rung draws at is ONE pure rule, applied by the 3D view at every step that can change it - the first build,
// a rung or level change, a dial change. Node only: no browser, no three. The browser half (the canvas, the post chain, the history
// map, the walk) is evidence-plan-3d-dpr-cap.spec.ts.
//   schematic, full  - the device's own ratio (the view clamps it to 2): their pictures do not move with the dial
//   lite             - pinned at 1 (the phone / integrated-GPU rung, LOOK_SPEC section 10)
//   realistic        - the person's dpr_cap, never above the device's own ratio

test('schematic and full draw at the device ratio whatever the cap: their pictures do not move', () => {
  for (const rung of ['schematic', 'full'] as const) {
    for (const base of [1, 1.5, 2]) {
      for (const cap of [1, 1.25, 1.5, 2]) expect(pixelRatioFor(rung, base, cap), `${rung} at ${base} with cap ${cap}`).toBe(base);
    }
  }
});

test('the lite rung is pinned at 1 whatever the cap; a device below 1 keeps its own ratio', () => {
  for (const cap of [1, 1.25, 1.5, 2]) {
    expect(pixelRatioFor('lite', 2, cap)).toBe(1);
    expect(pixelRatioFor('lite', 1.5, cap)).toBe(1);
    expect(pixelRatioFor('lite', 1, cap)).toBe(1);
  }
  expect(pixelRatioFor('lite', 0.75, 2)).toBe(0.75);
});

test('the realistic rung draws at the cap and never above the device ratio', () => {
  // a 2x phone / tablet: the dial decides (the table of the owner's checklist: 1 / 1.25 / 1.5 / 2)
  expect([1, 1.25, 1.5, 1.75, 2].map((cap) => pixelRatioFor('realistic', 2, cap))).toEqual([1, 1.25, 1.5, 1.75, 2]);
  // a 1.5x screen: a cap above its own ratio changes nothing
  expect([1, 1.25, 1.5, 2].map((cap) => pixelRatioFor('realistic', 1.5, cap))).toEqual([1, 1.25, 1.5, 1.5]);
  // a 1x desktop: always 1
  expect([1, 1.25, 1.5, 2].map((cap) => pixelRatioFor('realistic', 1, cap))).toEqual([1, 1, 1, 1]);
  // a zoomed-out browser (device ratio under 1) keeps it
  expect(pixelRatioFor('realistic', 0.8, 1.25)).toBe(0.8);
});

test('every rung of the ladder has an answer, and an unusable input falls back instead of poisoning the canvas', () => {
  for (const rung of RUNGS) expect(Number.isFinite(pixelRatioFor(rung, 2, 1.5)), rung).toBe(true);
  // no cap (NaN, 0, negative, not a number): the default dial; no device ratio: 1
  for (const cap of [Number.NaN, 0, -1, Number.POSITIVE_INFINITY]) expect(pixelRatioFor('realistic', 2, cap), `cap ${cap}`).toBe(DEFAULT_DPR_CAP);
  expect(pixelRatioFor('realistic', Number.NaN, 1.5)).toBe(1);
  expect(pixelRatioFor('full', 0, 1.5)).toBe(1);
  expect(pixelRatioFor('lite', Number.NaN, 1.5)).toBe(1);
});

test('the dial agrees with the rule: the default is the view\'s default, and the whole range is a valid cap', () => {
  expect(DEFAULT_VIEW.dpr_cap).toBe(DEFAULT_DPR_CAP);
  const [lo, hi, step] = RANGES.dpr_cap;
  for (let cap = lo; cap <= hi + 1e-9; cap += step) {
    const r = pixelRatioFor('realistic', 2, cap);
    expect(r).toBeGreaterThanOrEqual(1);
    expect(r).toBeLessThanOrEqual(2);
  }
  // the dial offers no choice the rule would not know (the rungs are the ladder's)
  expect([...CHOICES.quality].filter((q) => q !== 'auto').sort()).toEqual([...RUNGS].sort());
});
