import { test, expect } from '@playwright/test';
import { SKIN_IDS } from '../src/design/skins';
import { skinTable } from '../src/design/css';
import { contrastRatio, parseColor, type RGBA } from '../src/design/contrast';

/**
 * DOCSUX-295 (task r059): the "נסה שוב" button of the stopped-playback picture (investigate-playback `.stall sw-button`,
 * variant primary) was listed in the 2.0.0 release notes as low contrast in the dark Domus skin. sw-button paints a primary button as
 * --sw-text-inverse on --sw-accent (resting) and on --sw-accent-hover (hover). Computed from the tokens for every skin x scheme, both
 * states, at WCAG 2.x 4.5:1 (the label is 13 px semibold, small text).
 */
const MIN = 4.5;

for (const id of SKIN_IDS) {
  for (const mode of ['light', 'dark'] as const) {
    test(`stopped-playback retry button reads at 4.5:1 [${id} ${mode}]`, () => {
      const t = skinTable(id);
      const P = (n: string): RGBA => {
        const c = parseColor(t[n][mode]);
        if (!c) throw new Error(`${id}/${mode} ${n}: cannot parse ${t[n][mode]}`);
        return c;
      };
      const text = P('--sw-text-inverse');
      expect(contrastRatio(text, P('--sw-accent')), `${id}/${mode} resting`).toBeGreaterThanOrEqual(MIN);
      expect(contrastRatio(text, P('--sw-accent-hover')), `${id}/${mode} hover`).toBeGreaterThanOrEqual(MIN);
    });
  }
}
