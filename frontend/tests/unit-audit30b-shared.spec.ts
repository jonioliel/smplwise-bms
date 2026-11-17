import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIN_IDS, SKINS } from '../src/design/skins';
import { skinTable } from '../src/design/css';
import { contrastRatio, over, parseColor, type RGBA } from '../src/design/contrast';

// AUDIT30-B-SHARED (design audit round 30, branch B: the shared components). Node only - source guards for the new opt-in APIs and the
// contrast of every new colour pair resolved through every skin's token table, light and dark (WCAG 2.x: 4.5:1 for 12-13 px text).
//   finding 4  - one selected chip: accent-soft field, accent ink, no edge, no raised key (classic rule 1 drew it as a filled key)
//   finding 7  - sw-kpi: unit, secondary, tone warn | alarm, dot
//   finding 10 - sw-table: TableColumn.card, the phone row template under 600 px
//   finding 12 - filled badges: tests/unit-badge-tab-contrast-2437.spec.ts (the base branch) stays the guard; re-checked in the browser spec
//   finding 16 - sw-field type="search"
// The in-browser receipts (computed styles, row heights at 375 px, the clear key) are tests/evidence-audit30b-shared.spec.ts.

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');
const flat = (f: string) => read(f).replace(/\s+/g, ' ');

type Scheme = 'light' | 'dark';
function resolver(id: (typeof SKIN_IDS)[number], scheme: Scheme) {
  const t = skinTable(id);
  return (name: string): RGBA => {
    const raw = t[name]?.[scheme];
    const c = raw ? parseColor(raw) : null;
    if (!c) throw new Error(`${id}/${scheme}: cannot resolve ${name} (${raw})`);
    return c;
  };
}

test('finding 4: the shared selected chip is the soft accent field, >= 4.5:1 in every skin, light and dark', () => {
  const s = flat('components/sw-chip.ts');
  // the exported fragment and its use on the chip itself
  expect(s).toMatch(/export const chipSelected = css` background: var\(--sw-accent-soft\); color: var\(--sw-accent-text\); border-color: transparent; font-weight: var\(--sw-fw-semibold\); box-shadow: none; `;/);
  // regression (runner, pixel-round4-leftovers wk-overview domus): the component's own selected state keeps the accent key with inverse
  // ink - domus rule 6 repaints only the background of the selected chip and relies on this ink; a soft-field ink there was accent on accent
  expect(s).toContain(':host([selected]) button { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); }');
  expect(s).toContain('color: var(--sw-chip-on-count, var(--sw-text-inverse));');
  const rows: string[] = [];
  const fails: string[] = [];
  for (const id of SKIN_IDS) {
    for (const scheme of ['light', 'dark'] as const) {
      const v = resolver(id, scheme);
      const panel = v('--sw-surface-solid');
      const field = over(v('--sw-accent-soft'), panel);
      const r = contrastRatio(over(v('--sw-accent-text'), field), field);
      const row = `${id}/${scheme}: accent-text on accent-soft = ${r.toFixed(2)}`;
      rows.push(row);
      if (!(r >= 4.5)) fails.push(row);
    }
  }
  console.log(rows.join('\n'));
  expect(fails).toEqual([]);
});

test('finding 4: classic rule 1 no longer paints the selected chip as the raised primary key', () => {
  const rules = SKINS.classic.rules;
  // the primary button keeps its key; the selected chip is not in that selector list any more
  expect(rules).toContain(":host(sw-button[variant='primary']) button { background: linear-gradient(");
  expect(rules).not.toMatch(/sw-chip\[selected\]\) button \{ background: linear-gradient/);
  expect(rules).not.toMatch(/:host\(sw-chip\[selected\]\) button:active:not\(:disabled\) \{ background: var\(--sw-accent-hover\)/);
  expect(rules).toContain(':host(sw-chip[selected]) button { background: var(--sw-accent-soft); color: var(--sw-accent-text); border-color: transparent; box-shadow: none; }');
  // the count and the dot ring follow the soft field (white on the soft field would vanish)
  expect(rules).toContain(':host(sw-chip[selected]) { --sw-chip-on-count: var(--sw-accent-text); --sw-chip-dot-ring: var(--sw-surface-solid); }');
  // classic draws exactly the exported fragment's pair
  const frag = flat('components/sw-chip.ts');
  expect(frag).toContain('background: var(--sw-accent-soft); color: var(--sw-accent-text); border-color: transparent;');
  // no hover lift on the selected chip (the unselected key keeps its lift)
  expect(rules).toMatch(/:host\(sw-chip\[selected\]\) button:hover:not\(:disabled\) \{[^}]*transform: none; box-shadow: none; \}/);
  expect(rules).toContain(':host(sw-chip) button:hover:not(:disabled) { transform: translateY(-1px);');
});

test('finding 7: sw-kpi has unit, secondary, tone warn | alarm and dot; the defaults draw the old tile', () => {
  const s = flat('components/sw-kpi.ts');
  expect(s).toContain("export type KpiTone = StateKind | 'warn' | 'alarm';");
  expect(s).toContain("@property({ reflect: true }) tone: KpiTone = 'neutral';");
  expect(s).toContain("@property() unit = '';");
  expect(s).toContain("@property() secondary = '';");
  expect(s).toContain("@property({ reflect: true }) dot: KpiTone | '' = '';");
  // nothing rendered for an unset unit / secondary; the icon tile unless a dot is asked for
  expect(s).toContain('${this.unit ? html`<span class="unit" data-kpi-unit>${this.unit}</span>` : nothing}');
  expect(s).toContain('${this.secondary ? html`<span class="sec" data-kpi-secondary>${this.secondary}</span>` : nothing}');
  expect(s).toMatch(/\$\{this\.dot \? html`<div class="sdot" data-kpi-dot aria-hidden="true"><\/div>` : html`<div class="icon"/);
  // the compact height is unchanged (DESIGN.md: 60 px)
  expect(s).toContain('min-block-size: var(--sw-kpi-compact-min-block, 60px);');
  // warn / alarm: soft fill + 1 px state hairline (the host border), tokens only
  expect(s).toContain(":host([tone='warn']) { background: var(--sw-warning-soft); border-color: var(--sw-warning); }");
  expect(s).toContain(":host([tone='alarm']) { background: var(--sw-danger-soft); border-color: var(--sw-danger); }");
  expect(s).toContain(":host([tone='warn']) .detail, :host([tone='alarm']) .detail { color: var(--sw-text); }");
});

test('finding 7: a warn / alarm tile keeps every text >= 4.5:1 (value, label, unit, detail), every skin, light and dark', () => {
  const rows: string[] = [];
  const fails: string[] = [];
  for (const id of SKIN_IDS) {
    for (const scheme of ['light', 'dark'] as const) {
      const v = resolver(id, scheme);
      const canvas = v('--sw-bg');
      for (const [tone, soft, icon] of [
        ['warn', '--sw-warning-soft', '--sw-warning-text'],
        ['alarm', '--sw-danger-soft', '--sw-danger-text'],
      ] as const) {
        const field = over(v(soft), canvas);
        for (const [part, fg] of [
          ['value', '--sw-heading'],
          ['label/unit', '--sw-text-2'],
          ['detail', '--sw-text'],
        ] as const) {
          const r = contrastRatio(over(v(fg), field), field);
          const row = `${id}/${scheme} ${tone} ${part}: ${fg} on ${soft} = ${r.toFixed(2)}`;
          rows.push(row);
          if (!(r >= 4.5)) fails.push(row);
        }
        // the state glyph on its solid tile inside the fill (non-text, WCAG 1.4.11: 3:1)
        const tile = v('--sw-surface-solid');
        const g = contrastRatio(over(v(icon), tile), tile);
        rows.push(`${id}/${scheme} ${tone} icon: ${icon} on surface-solid = ${g.toFixed(2)}`);
        if (!(g >= 3)) fails.push(`${id}/${scheme} ${tone} icon ${g.toFixed(2)}`);
      }
    }
  }
  console.log(rows.join('\n'));
  expect(fails).toEqual([]);
});

test('finding 10: sw-table TableColumn.card - opt-in phone row template under 600 px, the old stack otherwise', () => {
  const s = flat('components/sw-table.ts');
  expect(s).toContain("card?: 'title' | 'badge' | 'meta' | 'show' | 'hide';");
  expect(s).toContain('export const usesCardTemplate = <R>(cols: readonly TableColumn<R>[]): boolean => cols.some((c) => !!c.card);');
  expect(s).toContain("this.toggleAttribute('card-template', card);");
  // every rule of the template is behind the host attribute and the 599 px query, so a table that marks nothing is unchanged
  const block = s.slice(s.indexOf('@media (max-width: 599px)'), s.indexOf('.empty {'));
  const selectors = block.match(/[^{};]+\{/g)!.map((x) => x.trim()).filter((x) => !x.startsWith('@media'));
  expect(selectors.length).toBeGreaterThan(5);
  for (const sel of selectors) expect(sel, sel).toContain(':host([card-template');
  expect(s).toContain('.cmeta { display: none; }');
  // the meta line: the meta columns in column order, " · " between them
  expect(s).toContain(".filter((c) => c.card === 'meta')");
  expect(s).toContain('<span class="sep"> · </span>');
  expect(s).toContain('${card ? this.metaCell(row) : nothing}');
});

test('finding 16: sw-field type="search" - its own input, icon, clear key, 34 px / --sw-r-sm, 44 px and 16 px under a coarse pointer', () => {
  const s = flat('components/sw-field.ts');
  expect(s).toContain("@property({ reflect: true }) type: '' | 'search' = '';");
  expect(s).toContain("if (this.type === 'search') return this.renderSearch();");
  expect(s).toMatch(/input\.search \{ -webkit-appearance: none; appearance: none; inline-size: 100%; box-sizing: border-box; block-size: 34px;[^}]*border-radius: var\(--sw-r-sm\);/);
  expect(s).toMatch(/@media \(pointer: coarse\) \{ input\.search \{ block-size: 44px; font-size: max\(16px, var\(--sw-fs-sm\)\);/);
  expect(s).toContain('<sw-icon name="search" size=${15}></sw-icon>');
  expect(s).toContain('data-search-clear');
  expect(s).toContain("new CustomEvent('search-clear', { bubbles: true, composed: true })");
  // the native cancel glyph is hidden (one clear key, ours)
  expect(s).toContain('input.search::-webkit-search-cancel-button');
});

test('no new literal colours in the branch: every colour of the new rules is a --sw-* token or a mix of tokens', () => {
  const pieces = [
    read('components/sw-chip.ts').split('AUDIT30-B-SHARED')[1] ?? '',
    flat('components/sw-kpi.ts').slice(flat('components/sw-kpi.ts').indexOf('AUDIT30-B-SHARED (audit round 30'), flat('components/sw-kpi.ts').indexOf('.txt {')),
    flat('components/sw-table.ts').slice(flat('components/sw-table.ts').indexOf('@media (max-width: 599px)'), flat('components/sw-table.ts').indexOf('.empty {')),
    flat('components/sw-field.ts').slice(flat('components/sw-field.ts').indexOf('.sbox {'), flat('components/sw-field.ts').indexOf('::slotted([data-ltr])')),
  ];
  for (const p of pieces) {
    expect(p.length).toBeGreaterThan(100);
    expect(p).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  }
});
