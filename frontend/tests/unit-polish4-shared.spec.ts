import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIN_IDS, FROZEN_SKINS } from '../src/design/skins';
import { skinTable } from '../src/design/css';
import { contrastRatio, over, parseColor, type RGBA } from '../src/design/contrast';

// POLISH4-WP1 (polish round 4, shared stage 2 + the shell's floating pill): source guards for the opt-in pieces, and the contrast of
// the one settings key style (owner Q3a) in light, every live skin.

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\s+/g, ' ');

test('D1: the corner keys hover only under a fine pointer, give on press, and keep a 44 px hit area; the static dot is a key with a note', () => {
  const s = read('shell/sw-app.ts');
  expect(s).toContain('.float button::after { content: \'\'; position: absolute; inset: -8px; }');
  expect(s).toMatch(/@media \(hover: hover\) and \(pointer: fine\) \{ \.float button:hover \{/);
  expect(s).not.toMatch(/\.float button:hover,/);
  expect(s).toContain('.float button:active {');
  // the user without הגדרות › בריאות: a button with a popup, never a link to the health tab
  expect(s).toMatch(/<button type="button" class="sysdot \$\{status\}" data-sys-pill data-sys-static[^>]*aria-haspopup="dialog"/);
  expect(s).toContain('data-sys-pop role="dialog"');
  const pop = s.slice(s.indexOf('private renderSysPop()'), s.indexOf('private syncSysPopOutside()'));
  expect(pop).not.toContain('href');
});

test('sw-drawer: a footer-end slot at the far end of the footer row (opt-in)', () => {
  const s = read('components/sw-drawer.ts');
  expect(s).toContain('<slot name="footer-end"');
  expect(s).toContain('footer .fend { display: flex; gap: var(--sw-s-2); flex-wrap: wrap; margin-inline-start: auto; }');
  expect(s).toContain('?hidden=${!this.hasFooter && !this.hasFooterEnd}');
});

test('sw-sheet: the solid surface is opt-in; the footer slot stays outside the scrolling body', () => {
  const s = read('components/sw-sheet.ts');
  expect(s).toContain(':host([solid]) .sheet { background: var(--sw-surface-solid); -webkit-backdrop-filter: none; backdrop-filter: none; }');
  expect(s).toContain('<div class="body"><slot></slot></div> <footer');
});

test('sw-table: hideBelow drops a column below 768 / 1024 px; unset columns get no class', () => {
  const s = read('components/sw-table.ts');
  expect(s).toContain("hideBelow?: 'phone' | 'tablet';");
  expect(s).toContain('@media (max-width: 1023px) { .hb-tablet { display: none; } }');
  expect(s).toContain('@media (max-width: 767px) { .hb-phone { display: none; } }');
  expect(s).toContain('class=${c.hideBelow ? `hb-${c.hideBelow}` : nothing}');
});

test('sw-state-panel: the bare variant draws no card of its own and no resting height (owner Q2a)', () => {
  const s = read('components/sw-state-panel.ts');
  expect(s).toContain('@property({ type: Boolean, reflect: true }) bare = false;');
  expect(s).toContain(':host([bare]:not([compact])) { flex: none; margin-block: 0; min-block-size: 0;');
  expect(s).toContain(':host([bare]:not([compact])) .box { padding: 0; background: none; box-shadow: none;');
});

test('one settings key style: the pill-thumb key, every part still a --sw-seg-* knob (owner Q3a)', () => {
  const s = read('styles/settings.ts');
  expect(s).toContain('background: var(--sw-seg-track, var(--sw-surface-3));');
  expect(s).toContain('border-inline-start: var(--sw-seg-divider, 0 solid transparent);');
  // GATE2370-B: dark draws the chosen key as the light pill (--sw-seg-key, measured in unit-dark-polish-beds); light is unchanged
  expect(s).toContain('background: var(--sw-seg-on-bg, var(--sw-seg-key, var(--sw-surface)));');
  expect(s).toContain('color: var(--sw-seg-on-fg, var(--sw-seg-key-ink, var(--sw-accent-text)));');
  expect(s).toContain('box-shadow: var(--sw-seg-on-shadow, var(--sw-seg-thumb-shadow, var(--sw-shadow-1)));');
  expect(s).not.toContain('var(--sw-seg-on-bg, var(--sw-accent))');
});

test('the settings key reads in light: the selected label on its thumb and an unselected label on the track (4.5:1), every live skin', () => {
  const fails: string[] = [];
  for (const id of SKIN_IDS.filter((k) => !FROZEN_SKINS.includes(k))) {
    const t = skinTable(id);
    const c = (n: string) => parseColor(t[n].light) as RGBA;
    const page = over(c('--sw-bg'), [255, 255, 255, 1]);
    const card = over(c('--sw-surface'), page);
    const track = over(c('--sw-surface-3'), card);
    const thumb = over(c('--sw-surface'), track);
    const on = contrastRatio(over(c('--sw-accent-text'), thumb), thumb);
    const off = contrastRatio(over(c('--sw-text-2'), track), track);
    if (on < 4.5) fails.push(`${id} selected ${on.toFixed(2)}`);
    if (off < 4.5) fails.push(`${id} unselected ${off.toFixed(2)}`);
  }
  expect(fails).toEqual([]);
});

test('--sw-well is a token, and the settings ladder still re-declares it on its host', () => {
  expect(read('design/tokens.ts')).toContain("'--sw-well': same('color-mix(in srgb, var(--sw-surface-2) 76%, var(--sw-border))'),");
  expect(read('styles/settings.ts')).toContain('--sw-well: color-mix(in srgb, var(--sw-surface-2) 76%, var(--sw-border));');
});

test('notices sheet: the row wash is gated to a hovering fine pointer at the source', () => {
  expect(read('notices/styles.ts')).toContain('@media (hover: hover) and (pointer: fine) { table.t tr.go:hover td { background: var(--sw-surface-2); } }');
});

test('media: the player card keeps its text clear of the edit chips; the remote editor bar meets the top of the scroll box', () => {
  const card = read('components/media-player-card.ts');
  expect(card).toContain(':host([editing]) .tx { padding-inline-end: var(--mm-edit-w, 0px); }');
  expect(card.match(/<slot name="edit" @slotchange=\$\{this\.onEditSlot\}><\/slot>/g)?.length).toBe(2);
  expect(read('components/media-remote-css.ts')).toContain('sw-drawer[data-editing]::part(body) { padding-block-start: 0; }');
  expect(read('components/media-remote.ts')).toContain('<sw-drawer modal ?data-editing=${this.editing}');
});
