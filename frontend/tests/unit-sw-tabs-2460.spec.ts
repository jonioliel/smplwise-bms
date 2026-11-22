import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chipOn, tabPillShown } from '../src/components/segmented-logic';

// CR-CMP2-TABS-2460: sw-tabs gained a count pill per item, the screen's icon (`glyph`), a full-width row (`fill`) and a controlled mode;
// the nine tab strips the screens drew as segments moved to it (pill). sw-chip-choice gained an icon, a count and a `multi` mode (the
// personal home panel's summary tiles). The rules here are node-only (the pure helpers) and the contracts in the source; the look and the
// behaviour in a browser are pinned by tests/pixel-sw-tabs.spec.ts.
//   npx playwright test -c playwright.unit.config.ts tests/unit-sw-tabs-2460.spec.ts

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');
const flat = (rel: string) => read(rel).replace(/\s+/g, ' ');

test.describe('the pure helpers (components/segmented-logic.ts)', () => {
  test('tabPillShown: a number (0 included) or a non-empty string draws a pill; nothing, null or an empty string do not', () => {
    expect(tabPillShown(0)).toBe(true);
    expect(tabPillShown(12)).toBe(true);
    expect(tabPillShown('2/5')).toBe(true);
    expect(tabPillShown('')).toBe(false);
    expect(tabPillShown(undefined)).toBe(false);
    expect(tabPillShown(null)).toBe(false);
  });

  test('chipOn: one choice compares with the value; multi asks the values (the value is ignored)', () => {
    expect(chipOn('a', 'a', false, [])).toBe(true);
    expect(chipOn('b', 'a', false, ['b'])).toBe(false);
    expect(chipOn('b', 'a', true, ['b', 'c'])).toBe(true);
    expect(chipOn('a', 'a', true, ['b'])).toBe(false);
    expect(chipOn('', '', true, [''])).toBe(true); // "follow the installation" is the empty value
    expect(chipOn('x', '', true, [])).toBe(false);
  });
});

test.describe('sw-tabs: the new item fields and host options (components/sw-tabs.ts)', () => {
  const src = read('components/sw-tabs.ts');
  const one = src.replace(/\s+/g, ' ');

  test('an item carries a count pill (a <small>, part "pill") and a glyph (decorative, part "glyph") in the bar forms', () => {
    expect(src).toMatch(/pill\?: number \| string;/);
    expect(src).toMatch(/glyph\?: TemplateResult;/);
    expect(one).toContain('${tabPillShown(it.pill) ? html`<small class="cpill" part="pill">${it.pill}</small>` : \'\'}');
    expect(one).toContain('${it.glyph ? html`<span class="gl" part="glyph" aria-hidden="true">${it.glyph}</span>` : \'\'}');
    // the pill: tokens only, the label's ink on a soft wash, knobs to make it a plain figure
    expect(one).toMatch(/\.cpill \{[^}]*background: var\(--sw-tabs-pill-bg, color-mix\(in srgb, currentColor 12%, transparent\)\);/);
    expect(one).toMatch(/\.cpill \{[^}]*padding-inline: var\(--sw-tabs-pill-pad, 5px\);/);
    expect(one).toMatch(/\.cpill \{[^}]*min-inline-size: var\(--sw-tabs-pill-min-w, 18px\);/);
  });

  test('fill: always, or on a phone only - the row grows over its box, the tabs share it, a tab is never narrower than its label', () => {
    expect(src).toMatch(/@property\(\{ reflect: true \}\) fill\?: 'always' \| 'phone';/);
    expect(one).toMatch(/:host\(\[fill='always'\]\) \{ display: flex; inline-size: 100%; \}/);
    expect(one).toMatch(/:host\(\[fill='always'\]\) \.row > a, :host\(\[fill='always'\]\) \.row > button \{ flex: 1 1 0;/);
    expect(one).toMatch(/@media \(max-width: 767px\) \{ :host\(\[fill='phone'\]\) \{ display: flex; inline-size: 100%; \}/);
    // flex: 1 0 auto on the row (it never shrinks below its tabs, so a long row still scrolls sideways inside the viewport)
    expect(one).toMatch(/:host\(\[fill='always'\]\) \.row \{ flex: 1 0 auto; \}/);
  });

  test('controlled: a press reports and leaves `active` to the host; uncontrolled strips keep moving it themselves', () => {
    expect(src).toMatch(/@property\(\{ type: Boolean \}\) controlled = false;/);
    expect(one).toMatch(/private choose\(item: TabItem\) \{ if \(!this\.controlled\) this\.active = item\.id; this\.dispatchEvent\(new CustomEvent\('change', \{ detail: \{ id: item\.id \}, bubbles: true, composed: true \}\)\);/);
  });

  test('the pill key height is a knob (28 px by default, the track 6 px taller) - no literal 34 px left', () => {
    expect(one).toContain("--_trk: calc(var(--sw-tabs-key-h, 28px) + 6px);");
    expect(one).toContain('min-block-size: max(var(--_trk), var(--_h));');
    expect(one).toContain('inset-block: max(0px, calc((var(--_h) - var(--_trk)) / 2));');
    expect(src).not.toMatch(/34px/);
  });

  test('the tablist contract is unchanged: real tabs, one Tab stop, the arrows walk, the data-* hooks land on the tab', () => {
    expect(one).toContain('role="tablist"');
    expect(one).toContain('role="tab"');
    expect(one).toContain('tabindex=${i === stop ? 0 : -1}');
    expect(one).toContain('private applyHooks()');
  });
});

test.describe('sw-chip-choice: icon, count, multi (components/sw-chip-choice.ts)', () => {
  const one = flat('components/sw-chip-choice.ts');

  test('an option carries an icon (part "icon", decorative) and a count (part "count")', () => {
    expect(one).toContain('icon?: TemplateResult;');
    expect(one).toContain('count?: number;');
    expect(one).toContain('${o.icon ? html`<span class="ic" part="icon" aria-hidden="true">${o.icon}</span>` : nothing}');
    expect(one).toContain('${o.count !== undefined ? html`<small class="n" part="count">${o.count}</small>` : nothing}');
  });

  test('multi: the chips that are on are `values`; a press asks for the opposite state and the host re-renders (controlled)', () => {
    expect(one).toContain('@property({ type: Boolean, reflect: true }) multi = false;');
    expect(one).toContain('@property({ attribute: false }) values: readonly string[] = [];');
    expect(one).toContain('return chipOn(o.value, this.value, this.multi, this.values);');
    expect(one).toContain('pressed: !this.on(o)');
    expect(one).not.toMatch(/this\.values\s*=[^=]/);
  });
});

// the nine tab strips (role="tablist" + aria-selected; they switch a panel) that were drawn as segments
const TAB_STRIPS: { file: string; hooks: string[] }[] = [
  { file: 'components/media-player-panel.ts', hooks: ['data-pn-libtabs', "'data-pn-libtab': k", "'data-pn-libtab': LIBRARY_TAB", 'data-pn-zones', "'data-pn-zone': x.id"] },
  { file: 'components/media-remote.ts', hooks: ["'data-mr-tab': t"] },
  { file: 'screens/scenarios-panel.ts', hooks: ["'data-scen-runs-tab': ''"] },
  { file: 'screens/automation-editor-base.ts', hooks: ['data-view-toggle', "'data-view': 'builder'", "'data-view': 'code'"] },
  { file: 'screens/automation-ext-dialogs.ts', hooks: ['data-kav-test-mode', "'data-m': 'dry'", "'data-m': 'dev'"] },
  { file: 'plan-wizard/plan-wizard.ts', hooks: ['data-wz-dev-tabs', "'data-wz-tab': 'devices'", "'data-wz-tab': 'cameras'"] },
  { file: 'screens/devices-automations.ts', hooks: ["'data-segment': 'schedules'", "'data-segment': s.id", "'data-segment': 'scenarios'"] },
  { file: 'screens/devices-schedules.ts', hooks: ['data-kavarnit-segments', "'data-segment': 'schedules'", "'data-segment': s.id"] },
];

test('adoption: the tab strips drawn as segments are sw-tabs (pill, controlled) with every data-* hook kept', () => {
  const bad: string[] = [];
  for (const { file, hooks } of TAB_STRIPS) {
    const src = read(file);
    if (/role="tablist"/.test(src)) bad.push(`${file}: a hand-built role="tablist" strip`);
    if (/class="seg[\s"]/.test(src)) bad.push(`${file}: a hand-built class="seg" group`);
    if (!/<sw-tabs controlled variant="pill"/.test(src)) bad.push(`${file}: no <sw-tabs controlled variant="pill">`);
    if (!/import '((\.\.\/)+components|\.)\/sw-tabs';/.test(src)) bad.push(`${file}: does not import the component`);
    for (const h of hooks) if (!src.includes(h)) bad.push(`${file}: lost the hook ${h}`);
    // the composed change of the strip stops at its host's handler (no ancestor @change hears it)
    if (!/<sw-tabs controlled[\s\S]*?@change=\$\{\((e|ev): CustomEvent<\{ id: string \}>\) => \{ (e|ev)\.stopPropagation\(\);/.test(src)) bad.push(`${file}: the change is not stopped at the strip`);
  }
  expect(bad).toEqual([]);
});

test('the devices kind strips: counts as <small> pills, the phone row shared equally, the hand-built keyboard helper gone', () => {
  for (const file of ['screens/devices-automations.ts', 'screens/devices-schedules.ts']) {
    const src = read(file);
    expect(src, file).toContain('fill="phone" class="kinds"');
    expect(src, file).toMatch(/pill: /);
    expect(src, file).not.toContain('tablistKeydown');
  }
  // the glass hosts draw the counts as plain figures (the state strip beside them does) and map their palette on the strip
  const glass = flat('styles/media-glass.ts');
  expect(glass).toMatch(/sw-tabs\[variant='pill'\] \{[^}]*--sw-tabs-pill-bg: transparent;[^}]*--sw-tabs-pill-pad: 0;[^}]*--sw-tabs-pill-min-w: 0;/);
  expect(glass).toMatch(/sw-tabs\[variant='pill'\] \{[^}]*--sw-seg-key: var\(--mm-seg-thumb\);/);
});

test('the leftovers: the events centre chip rows, the overview departments, the personal summary tiles', () => {
  const ev = read('screens/investigate-events.ts');
  expect(ev).not.toMatch(/<span class="seg"/);
  expect(ev).toContain("attrs: { 'data-mode-windows': '' }");
  expect(ev.match(/<sw-chip-choice class="evc"/g)?.length).toBe(2);
  const ov = read('screens/tickets-overview.ts');
  expect(ov).not.toMatch(/class="seg/);
  expect(ov).toContain('<div class="depts" data-dept-chips><sw-segmented radio size="sm"');
  expect(ov).toContain("attrs: { 'data-dept': x.id }");
  // the paged desktop still scrolls the strip sideways (and the page still measures that box for its fade)
  expect(ov).toContain('.paged .dh-det .depts { flex: 0 1 auto; min-inline-size: 0; overflow-x: auto; scrollbar-width: none; }');
  expect(ov).toContain(".depts > sw-segmented { --sw-seg-wrap: nowrap; max-inline-size: none; }");
  expect(ov).toContain("this.renderRoot.querySelector<HTMLElement>('[data-dept-chips]')");
  const hp = read('shell/sw-home-personal.ts');
  expect(hp).not.toMatch(/class="seg/);
  expect(hp).toContain('<sw-chip-choice multi class="tiles"');
  expect(hp).toContain(".values=${tiles === null ? [''] : tiles}");
  expect(hp).toContain("attrs: { 'data-home-personal-tile': k }");
});

test('out of scope stays untouched: home v3 and the home switches keep their hand-built segments', () => {
  // a sanity check that this row did not reach into them (the files still hold their own segments)
  expect(read('home/sw-home.ts')).toMatch(/seg/);
  expect(read('screens/home-widgets.ts')).toMatch(/seg/);
});
