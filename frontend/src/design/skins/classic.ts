import type { Skin } from './index';

/** Today's look: the base table as is, no overrides, no rules. The default; pixel-stable (tests/evidence-design-foundation.spec.ts). */
export const classic: Skin = {
  id: 'classic',
  name: 'Classic',
  nameHe: 'קלאסי',
  noteHe: 'המראה הנוכחי של המערכת',
  stage: 'stable',
  // bevels are allowed here (BEVEL_SKINS) but classic draws none: no material layer, no top-edge line, no glass
  features: { material: false, bevel: true, pixelEdge: false, glass: false },
  tokens: {},
  rules: '',
};
