import { test, expect } from '@playwright/test';
import { SKIN_IDS } from '../src/design/skins';
import { skinTable } from '../src/design/css';
import { contrastRatio, over, parseColor, type RGBA } from '../src/design/contrast';

/**
 * UIPOLISH-2320 (owner decision 2A, 2026-10-31): in the dark schemes the secondary / muted inks measured ~4.0:1 on the screens (the
 * alarm hint, the 11 px lines of the messaging accounts, the electricity tree count). unit-muted-contrast checks the token beds one
 * level deep; these lines sit one level deeper - a hint inside a card that is itself a translucent surface over the page, a count on
 * the chip / hover fill of a card, a nested surface-2 panel inside a card. This guard composites those stacks per skin, dark only, and
 * keeps every muted tier at >= 5.0:1 (WCAG 2.x 4.5:1 for small text, plus margin), the selected (accent-soft) and hovered rows of a card included. Light mode is out of scope here (unchanged, guarded by unit-muted-contrast).
 */

// WCAG asks 4.5:1; the token floor is 5.0:1 so the anti-aliased 10.5-12.5 px glyphs measured on screen stay above 4.5:1 (the ~4.0 readings
// came from tokens that sat at 4.35-4.6:1 on these beds)
const MIN = 5.0;
const MUTED = ['--sw-text-2', '--sw-text-3'];

function darkBeds(id: (typeof SKIN_IDS)[number]): { v: (n: string) => string; beds: Record<string, RGBA> } {
  const t = skinTable(id);
  const v = (n: string) => t[n]?.dark ?? '';
  const P = (n: string) => {
    const c = parseColor(v(n));
    if (!c) throw new Error(`${id}/dark ${n}: cannot parse ${v(n)}`);
    return c;
  };
  const bg = P('--sw-bg');
  const card = over(P('--sw-surface'), bg); // a card on the page
  const solid = P('--sw-surface-solid');
  const beds: Record<string, RGBA> = {
    page: bg,
    'card over page': card,
    'surface-solid': solid,
    'surface-2-solid': P('--sw-surface-2-solid'),
    'surface-2 over card': over(P('--sw-surface-2'), card),
    'surface-2 over surface-solid': over(P('--sw-surface-2'), solid),
    'nav-glass over page': over(P('--sw-nav-glass'), bg),
    // a selected row (the messaging accounts list, the electricity tree) and a hovered row inside a card
    'accent-soft over card': over(P('--sw-accent-soft'), card),
    'hover-wash over card': over(P('--sw-hover-wash'), card),
  };
  if (id !== 'bubble') {
    // the chip / hover fill (in bubble the slider track, never a text bed - unit-muted-contrast)
    beds['surface-3 over card'] = over(P('--sw-surface-3'), card);
    beds['surface-3 over surface-solid'] = over(P('--sw-surface-3'), solid);
  }
  return { v, beds };
}

test('dark schemes: the muted inks (--sw-text-2, --sw-text-3) read at >= 5.0:1 on the page, the card and the nested beds, every skin', () => {
  const rows: string[] = [];
  const fails: string[] = [];
  for (const id of SKIN_IDS) {
    const { v, beds } = darkBeds(id);
    for (const n of MUTED) {
      const fg = parseColor(v(n))!;
      let worst = Infinity;
      let where = '';
      for (const [bed, b] of Object.entries(beds)) {
        const r = contrastRatio(over(fg, b), b);
        if (r < worst) [worst, where] = [r, bed];
      }
      rows.push(`${id}/dark ${n} ${v(n)}: ${worst.toFixed(2)} (${where})`);
      if (worst < MIN) fails.push(rows[rows.length - 1]);
    }
  }
  console.log(rows.join('\n'));
  expect(fails).toEqual([]);
});

test('dark schemes: the muted tier stays below the secondary tier (the two inks keep their order), every skin', () => {
  const lum = (c: RGBA) => contrastRatio(c, [0, 0, 0, 1]);
  for (const id of SKIN_IDS) {
    const { v } = darkBeds(id);
    const t2 = parseColor(v('--sw-text-2'))!;
    const t3 = parseColor(v('--sw-text-3'))!;
    expect(lum(t3), `${id}: --sw-text-3 ${v('--sw-text-3')} must stay dimmer than --sw-text-2 ${v('--sw-text-2')}`).toBeLessThanOrEqual(lum(t2));
  }
});
