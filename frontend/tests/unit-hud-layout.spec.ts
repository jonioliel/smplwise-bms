import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HUD_BELOW_LIST,
  HUD_EDGE,
  HUD_END_LIST,
  HUD_END_PANEL,
  HUD_GAP,
  HUD_LIST_W,
  HUD_MINIMAP,
  HUD_MINIMAP_PHONE,
  HUD_PANEL_W,
  HUD_PHONE_MAX,
  HUD_PILL_MAX,
  HUD_PILL_ROW,
  HUD_SHEET,
  HUD_SHEET_MAX,
  HUD_SHEET_TALL,
  HUD_WALK_SHEET,
  cornerBottom,
  endItemWidth,
  hudBottom,
  hudEnd,
  listBottom,
  needsSecondRow,
} from '../src/map/hud-layout';

// The geometry contract of the HUD over the floor map (src/map/hud-layout.ts; owner 2026-10-13: the pictures of the opaque panels showed three
// layout collisions): the rules as numbers, and the CSS that has to agree with them, read from the sources (a number that drifts, or a rule that
// is turned back into what collided, fails here before a browser opens). The browser twin that reads the real rectangles of the real floor map
// in every skin, at 390 / 768 / 1440 px, is tests/evidence-hud-layout-live.spec.ts.
//   npx playwright test -c playwright.unit.config.ts tests/unit-hud-layout.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');

interface Rule {
  selectors: string[];
  body: string;
  at: string;
}

/** The rules of a CSS text, nested @media flattened (with the at-rule that wraps them). */
function parseRules(css: string, at = ''): Rule[] {
  const out: Rule[] = [];
  let i = 0;
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const head = text.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }
    const body = text.slice(open + 1, j - 1);
    if (head.startsWith('@')) out.push(...parseRules(body, `${at} ${head}`.trim()));
    else if (head) out.push({ selectors: head.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), body, at });
    i = j;
  }
  return out;
}

/** The rules of a module's `css` blocks (interpolations blanked to 0) whose selector list names `selector` exactly. */
function rulesOf(rel: string, selector: string): Rule[] {
  const css = [...read(rel).matchAll(/css`([\s\S]*?)`/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, '0')).join('\n');
  return parseRules(css).filter((r) => r.selectors.includes(selector));
}
const decl = (rule: Rule, prop: string): string | undefined => new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+)`, 'm').exec(rule.body)?.[1].trim();
const all = (rules: Rule[], prop: string): string[] => rules.map((r) => decl(r, prop)).filter((v): v is string => v !== undefined);

const MAP = 'screens/explore-floor-map.ts';
const P3D = 'map/sw-plan-3d.ts';
const CANVAS = 'map/sw-plan-canvas.ts';

test.describe('the numbers of the contract', () => {
  test('the docked panels: the end insets are the edge + the panel + a gap, and the panels are as wide as the CSS says', () => {
    expect(HUD_END_LIST).toBe(HUD_EDGE + HUD_LIST_W + HUD_GAP + 2);
    expect(HUD_END_PANEL).toBe(HUD_EDGE + HUD_PANEL_W + HUD_GAP + 2);
    // 236 px + the hairline; 272 px + 2 x 14 px padding + the hairline: the sources say the same
    const list = rulesOf(MAP, '.sidelist')[0];
    expect(decl(list, 'inline-size')).toBe('236px');
    expect(HUD_LIST_W).toBe(236 + 2);
    const panel = rulesOf(MAP, '.panel')[0];
    expect(decl(panel, 'inline-size')).toBe('272px');
    expect(decl(panel, 'padding')).toBe('12px 14px');
    expect(decl(panel, 'box-sizing') ?? 'content-box').toBe('content-box');
    expect(HUD_PANEL_W).toBe(272 + 2 * 14 + 2);
  });

  test('the minimap and the pill row are the sizes the 3D element draws', () => {
    // the 3D CSS interpolates the constants; what is NOT interpolated and must still agree: the hint pill's row, the circuit strip's widest
    expect(all(rulesOf(P3D, '.pill.hint'), 'inset-block-start')).toEqual([`var(--hud-hint-top, ${HUD_PILL_ROW}px)`]);
    expect(decl(rulesOf(MAP, '.circuits')[0], 'max-inline-size')).toBe('260px');
    expect(HUD_PILL_MAX).toBeGreaterThanOrEqual(150);
    expect(HUD_MINIMAP).toBe(160);
    expect(HUD_MINIMAP_PHONE).toBe(112);
    expect(HUD_PHONE_MAX).toBe(640);
    expect(HUD_SHEET_MAX).toBe(767);
    // the phone's sheet is 38 % of the stage, 78 % pulled up (the CSS of the floor map)
    const sheets = rulesOf(MAP, '.sidelist').filter((r) => r.at.includes('max-width: 767px'));
    expect(all(sheets, 'block-size')).toEqual([`${HUD_SHEET}%`]);
    expect(all(rulesOf(MAP, '.sidelist.tall'), 'block-size')).toEqual([`${HUD_SHEET_TALL}%`]);
  });

  test('cornerBottom: under the pill row, under the minimap (a phone has the small one), the edge when the corner is empty', () => {
    expect(cornerBottom(null, false)).toBe(12);
    expect(cornerBottom('pill', false)).toBe(56);
    expect(cornerBottom('pill', true)).toBe(56);
    expect(cornerBottom('minimap', false)).toBe(12 + 160 + 8);
    expect(cornerBottom('minimap', true)).toBe(12 + 112 + 8);
  });

  test('hudEnd: the side list docks from 768 px of viewport, the layers list from 641 px, both together take the wider', () => {
    const none = { sideList: false, panel: false };
    expect(hudEnd({ ...none, viewport: 1440 })).toBe(HUD_EDGE);
    expect(hudEnd({ sideList: true, panel: false, viewport: 1440 })).toBe(HUD_END_LIST);
    expect(hudEnd({ sideList: true, panel: false, viewport: 768 })).toBe(HUD_END_LIST);
    expect(hudEnd({ sideList: true, panel: false, viewport: 767 })).toBe(HUD_EDGE); // a bottom sheet: nothing at the end edge
    expect(hudEnd({ sideList: true, panel: false, viewport: 390 })).toBe(HUD_EDGE);
    expect(hudEnd({ sideList: false, panel: true, viewport: 768 })).toBe(HUD_END_PANEL);
    expect(hudEnd({ sideList: false, panel: true, viewport: 641 })).toBe(HUD_END_PANEL);
    expect(hudEnd({ sideList: false, panel: true, viewport: 640 })).toBe(HUD_EDGE); // up to 640 the popover covers the corner and the circuit buttons give way
    expect(hudEnd({ sideList: true, panel: true, viewport: 1440 })).toBe(HUD_END_PANEL);
    expect(hudEnd({ sideList: true, panel: true, viewport: 700 })).toBe(HUD_END_PANEL);
  });

  test('hudBottom: only a phone with its side list open (the sheet) lifts the zoom buttons, 38 % or 78 % + the edge', () => {
    expect(hudBottom({ sideList: false, viewport: 390, tall: false })).toBeNull();
    expect(hudBottom({ sideList: true, viewport: 1440, tall: false })).toBeNull();
    expect(hudBottom({ sideList: true, viewport: 768, tall: false })).toBeNull();
    expect(hudBottom({ sideList: true, viewport: 767, tall: false })).toBe('calc(38% + 12px)');
    expect(hudBottom({ sideList: true, viewport: 390, tall: true })).toBe('calc(78% + 12px)');
  });

  test('the list stops above the zoom buttons: the measured dock when the 2D view has one (Classic 102 px, Bubble 169 px from the bottom), else the 3D constant', () => {
    expect(HUD_BELOW_LIST).toBeGreaterThanOrEqual(120 + HUD_EDGE);
    expect(listBottom(null)).toBe(HUD_BELOW_LIST);
    expect(listBottom(102)).toBe(102 + HUD_GAP);
    expect(listBottom(168.4)).toBe(169 + HUD_GAP); // rounded up: the list never touches the buttons
    expect(listBottom(0)).toBe(HUD_GAP);
  });

  test('endItemWidth: the minimap, the pill, else the circuit buttons themselves', () => {
    expect(endItemWidth('minimap', 158)).toBe(HUD_MINIMAP);
    expect(endItemWidth('pill', 158)).toBe(HUD_PILL_MAX);
    expect(endItemWidth(null, 158)).toBe(158);
    expect(endItemWidth(null, 0)).toBe(0);
  });
});

test.describe('needsSecondRow: the level bar beside the floor chip and the corner, or a row of its own', () => {
  // the measured stages of the seeded building (tests/hud-live-seed.ts): the stage is 1309 / 637 / 390 px wide at 1440 / 768 / 390, the bar of the
  // ground floor (all levels, the gallery, the main level) 346 px + its hairline, the floor chip 72 px, the circuit button 158 px
  const BAR = 348;
  const CHIP = 72;
  test('a wide stage keeps it in row 1 in every state of the corner', () => {
    for (const corner of ['pill', 'minimap', null] as const) {
      expect(needsSecondRow({ stage: 1309, end: HUD_EDGE, bar: BAR, chip: CHIP, endItem: endItemWidth(corner, 158) }), `corner ${corner}`).toBe(false);
    }
  });
  test('1440 px with the side list docked still has room', () => {
    expect(needsSecondRow({ stage: 1309, end: HUD_END_LIST, bar: BAR, chip: CHIP, endItem: HUD_PILL_MAX })).toBe(false);
    expect(needsSecondRow({ stage: 1309, end: HUD_END_PANEL, bar: BAR, chip: CHIP, endItem: HUD_PILL_MAX })).toBe(false);
  });
  test('768 px (a 637 px stage): beside the pill or the circuit buttons it does not fit, alone with the chip it does', () => {
    expect(needsSecondRow({ stage: 637, end: HUD_EDGE, bar: BAR, chip: CHIP, endItem: HUD_PILL_MAX })).toBe(true);
    expect(needsSecondRow({ stage: 637, end: HUD_EDGE, bar: BAR, chip: CHIP, endItem: HUD_MINIMAP })).toBe(true);
    expect(needsSecondRow({ stage: 637, end: HUD_EDGE, bar: BAR, chip: CHIP, endItem: 158 })).toBe(true);
    expect(needsSecondRow({ stage: 637, end: HUD_EDGE, bar: BAR, chip: CHIP, endItem: 0 })).toBe(false);
    expect(needsSecondRow({ stage: 637, end: HUD_END_LIST, bar: BAR, chip: CHIP, endItem: 0 })).toBe(true); // the list took the room
  });
  test('390 px: never in row 1', () => {
    for (const endItem of [0, 158, HUD_PILL_MAX, HUD_MINIMAP]) expect(needsSecondRow({ stage: 390, end: HUD_EDGE, bar: BAR, chip: CHIP, endItem })).toBe(true);
  });
  test('the bar must fit with the gap on both sides of its centre: one pixel either way flips it', () => {
    const side = Math.max(CHIP, HUD_PILL_MAX) + HUD_GAP;
    const fits = BAR + 2 * side; // the band that just holds it
    expect(needsSecondRow({ stage: fits + HUD_EDGE + HUD_EDGE, end: HUD_EDGE, bar: BAR, chip: CHIP, endItem: HUD_PILL_MAX })).toBe(false);
    expect(needsSecondRow({ stage: fits + HUD_EDGE + HUD_EDGE - 1, end: HUD_EDGE, bar: BAR, chip: CHIP, endItem: HUD_PILL_MAX })).toBe(true);
  });
  test('a long floor name widens the chip lane: it can be the reason for the second row', () => {
    expect(needsSecondRow({ stage: 900, end: HUD_EDGE, bar: BAR, chip: 90, endItem: 0 })).toBe(false);
    expect(needsSecondRow({ stage: 900, end: HUD_EDGE, bar: BAR, chip: 320, endItem: 0 })).toBe(true);
  });
  test('more levels: a wider bar needs a wider stage; no bar (one level) never asks for a row', () => {
    expect(needsSecondRow({ stage: 1309, end: HUD_EDGE, bar: 900, chip: CHIP, endItem: HUD_PILL_MAX })).toBe(false); // nine hundred px still fits a 1309 px stage
    expect(needsSecondRow({ stage: 1309, end: HUD_EDGE, bar: 1000, chip: CHIP, endItem: HUD_PILL_MAX })).toBe(true);
    expect(needsSecondRow({ stage: 300, end: HUD_EDGE, bar: 0, chip: CHIP, endItem: HUD_PILL_MAX })).toBe(false);
  });
});

test.describe('the CSS agrees with the contract (the rules that collided are not coming back)', () => {
  test('the level bar is centred by two logical insets and auto margins - no percentage inset with a translate (it left the canvas in RTL)', () => {
    const rules = rulesOf(MAP, '.levelbar');
    expect(rules.length).toBeGreaterThan(0);
    const base = rules[0];
    expect(decl(base, 'inset-inline'), 'the two insets of the free band').toMatch(/^0px var\(--hud-end, 0px\)$/); // 12px / the end inset (interpolations read as 0)
    expect(decl(base, 'margin-inline')).toBe('auto');
    expect(decl(base, 'inline-size')).toBe('fit-content');
    // in its own row it wraps to a second line: no scrolling bar with chips out of view
    const own = rulesOf(MAP, '.stage[data-hud-row2] .levelbar');
    expect(own.length).toBe(1);
    expect(decl(own[0], 'white-space')).toBe('normal');
    expect(decl(own[0], 'inset-block-start')).toBe('var(--hud-bar-top)');
    expect(own[0].body, 'no overflow scroller').not.toMatch(/overflow/);
    expect(decl(base, 'white-space')).toBe('nowrap');
    for (const r of rules) {
      expect(r.body, 'no translate: a physical shift is wrong in one of the two directions').not.toMatch(/translate/);
      expect(decl(r, 'inset-inline-start'), 'no start inset of 50 %').toBeUndefined();
      expect(decl(r, 'max-inline-size') ?? '', 'not capped to a share of the stage (the 60 % wrapped it into three rows)').not.toMatch(/%$/);
    }
    // its surface is still the opaque menu surface (unit-menu-lint.spec.ts reads it from the registry as well)
    expect(decl(base, 'background')).toBe('var(--sw-menu-surface)');
  });

  test('the circuit buttons start past a docked list and below what the 3D keeps in the corner - no fixed 296 px shift any more', () => {
    const base = rulesOf(MAP, '.circuits')[0];
    expect(decl(base, 'inset-inline-end')).toMatch(/var\(--hud-end,/);
    expect(decl(base, 'inset-block-start')).toMatch(/var\(--hud-circuits-top,/);
    expect(rulesOf(MAP, '.circuits.shifted').every((r) => !decl(r, 'inset-inline-end')), 'the shifted strip no longer moves by a literal').toBe(true);
    expect(read(MAP)).not.toMatch(/inset-inline-end:\s*296px/);
    // the corner's offsets by what the 3D element reports
    const pill = rulesOf(MAP, ".stage[data-corner='pill']");
    const minimap = rulesOf(MAP, ".stage[data-corner='minimap']");
    expect(pill.length).toBeGreaterThan(0);
    expect(minimap.length).toBeGreaterThan(1); // the wide size and the phone's smaller minimap
    // the level bar's own row pushes the circuit buttons and both floor switchers below it
    expect(all(rulesOf(MAP, '.stage[data-hud-row2] .circuits'), 'inset-block-start')[0]).toMatch(/^max\(var\(--hud-circuits-top\), var\(--hud-cols-top\)\)$/);
    expect(all(rulesOf(MAP, '.stage[data-hud-row2] .floorstrip'), 'inset-block-start')).toEqual(['var(--hud-cols-top)']);
    expect(all(rulesOf(MAP, '.stage[data-hud-row2] .floorbtns'), 'inset-block-start')).toEqual(['var(--hud-cols-top)']);
  });

  test('the 3D corner blocks start past a docked list, the picker is a menu above everything and inside the band, the centred pills follow the band', () => {
    for (const sel of ['.timepill', '.timepop']) expect(decl(rulesOf(P3D, sel)[0], 'inset-inline-end'), sel).toMatch(/var\(--hud-end,/);
    expect(decl(rulesOf(P3D, '.minimap')[0], 'inset-inline-start')).toMatch(/var\(--hud-end,/);
    const pop = rulesOf(P3D, '.timepop')[0];
    expect(decl(pop, 'z-index'), 'the picker paints above the circuit buttons and the floor strip').toMatch(/calc\(var\(--sw-z-map-ui\) \+ 1\)/);
    expect(decl(pop, 'box-sizing'), 'its width is its own box (306 px at 390 reached under the floor strip)').toBe('border-box');
    expect(decl(pop, 'max-inline-size')).toMatch(/var\(--hud-end,/);
    for (const sel of ['.pill', '.toast']) expect(decl(rulesOf(P3D, sel)[0], 'left'), sel).toMatch(/var\(--hud-end,/);
    expect(decl(rulesOf(P3D, '.pill.aim')[0], 'left'), 'the aim label hangs under the crosshair: the canvas centre').toBe('50%');
    // the slow-device notice stands under the level bar when that has a row of its own, and paints above the columns it may cross
    expect(decl(rulesOf(P3D, '.pill.hint')[0], 'z-index')).toMatch(/calc\(var\(--sw-z-map-ui\) \+ 1\)/);
    expect(decl(rulesOf(MAP, '.stage[data-hud-row2]')[0], '--hud-hint-top')).toBe('var(--hud-cols-top)');
    expect(rulesOf(MAP, '.stage').map((r) => decl(r, '--hud-hint-top')).find(Boolean), 'one line of the bar: under its measured height (Bubble\'s chips make it 54 px)').toBe('calc(0px + var(--hud-bar-h, 38px) + 0px)');
  });

  test('the 2D canvas keeps its zoom buttons and scale in one row (the readout follows the buttons) and lifts it above the phone sheet (--hud-bottom)', () => {
    const dock = rulesOf(CANVAS, '.zoomdock')[0];
    expect(decl(dock, 'bottom')).toMatch(/^var\(--hud-bottom, /);
    expect(decl(dock, 'display')).toBe('flex');
    expect(decl(dock, 'align-items')).toBe('flex-end');
    for (const sel of ['.controls', '.scale']) {
      const r = rulesOf(CANVAS, sel)[0];
      expect(decl(r, 'position'), `${sel} is a child of the row, not placed by a fixed offset (Bubble's 52 px column lay 8 px over a readout at 56 px)`).toBeUndefined();
      expect(decl(r, 'left'), sel).toBeUndefined();
    }
  });

  test('the side list stops above the zoom buttons on a wide stage and is a bottom sheet on a narrow one', () => {
    const rules = rulesOf(MAP, '.sidelist');
    const base = rules.find((r) => r.at === '')!;
    expect(decl(base, 'inset-block')).toBe('0px var(--hud-list-bottom, 0px)'); // 12px, the measured zoom dock, else HUD_BELOW_LIST (interpolations read as 0)
    expect(read(MAP)).toMatch(/inset-block: \$\{HUD_EDGE\}px var\(--hud-list-bottom, \$\{HUD_BELOW_LIST\}px\);/);
    const sheet = rules.find((r) => r.at.includes('max-width: 767px'))!;
    expect(decl(sheet, 'inset')).toBe('auto 0 0 0');
    // during the walk the sheet stands above the walk's own bottom row: the phone's 60 px sheet, the floating bar's 12 + 58 px
    expect(HUD_WALK_SHEET).toBeGreaterThanOrEqual(12 + 58);
    const walkRows = rulesOf(MAP, ".stage[data-corner='minimap'] .sidelist");
    expect(walkRows.length).toBe(1);
    expect(walkRows[0].at).toContain('max-width: 767px');
    expect(decl(walkRows[0], 'inset-block-end')).toBe('calc(0px + env(safe-area-inset-bottom, 0px))'); // HUD_WALK_SHEET (read as 0) + the home indicator
    expect(read(MAP)).toMatch(/inset-block-end: calc\(\$\{HUD_WALK_SHEET\}px \+ env\(safe-area-inset-bottom, 0px\)\);/);
  });

  test('the floor map writes the contract onto the stage: --hud-end, --hud-bottom, --hud-bar-h, data-corner, data-hud-row2', () => {
    const src = read(MAP);
    for (const token of ["'--hud-end'", "'--hud-bottom'", "'--hud-bar-h'", "'--hud-list-bottom'", "'data-corner'", "'data-hud-row2'"]) expect(src, token).toContain(token);
    // the decision about the bar's row is made on its one-line width, whatever row it stands in now
    expect(src).toContain('barLineWidth(bar)');
    expect(src).toContain('zoomDockRect()');
    expect(src).toContain('@hud-corner=');
    // and the 3D element reports the corner
    expect(read(P3D)).toContain("'hud-corner'");
  });
});
