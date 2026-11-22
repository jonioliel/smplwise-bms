import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cellClassOf, cellPartOf, groupSegments, headClassOf, rowAttrAllowed, rowAttrMap, rowFocusStep } from '../src/components/table-logic';
import { loadFraction, loadTone } from '../src/components/load-bar-logic';

// CR-CMP2-TABLES-2450 (owner N10, 19.11): `sw-table` grows what the hand-built tables need to move in - per-row / per-cell hooks
// (`rowAttrs`, `cellAttrs`: the screens' spec selectors such as tr[data-board=...]), a small shared cell vocabulary (num, muted, status
// chip, actions, truncate; t1 / t2 lines) reachable as parts, `bare` (no second card inside a card), `static-rows` (a read-only list) and
// the row keyboard walk. The DOM-free rules (node), the contract in the source, and the screens that moved (no hand-built <table> comes
// back there). The look is pinned by tests/pixel-sw-table.spec.ts.
//   npx playwright test -c playwright.unit.config.ts tests/unit-sw-table.spec.ts

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');

test.describe('sw-table: the row hooks', () => {
  test('data-*, aria-* and title pass; the row wiring (class, tabindex, role, style, events, data-row-id) does not', () => {
    for (const ok of ['data-board', 'data-maint-tag', 'data-x.y', 'aria-label', 'aria-current', 'title']) expect(rowAttrAllowed(ok), ok).toBe(true);
    for (const no of ['class', 'tabindex', 'role', 'style', 'onclick', 'id', 'data-row-id', 'data-', 'part', 'hidden']) expect(rowAttrAllowed(no), no).toBe(false);
  });

  test('values: a string or number as text, true as an empty attribute, false / null / undefined leave it off', () => {
    expect(rowAttrMap({ 'data-board': 'b1', 'data-n': 3, 'data-on': true, 'data-off': false, 'data-null': null, 'data-u': undefined })).toEqual({
      'data-board': 'b1',
      'data-n': '3',
      'data-on': '',
    });
    expect(rowAttrMap(null)).toEqual({});
    expect(rowAttrMap(undefined)).toEqual({});
    // names are lower-cased (HTML attributes are), a disallowed name is dropped rather than thrown
    expect(rowAttrMap({ 'Data-Board': 'x', class: 'hot', tabindex: '-1' })).toEqual({ 'data-board': 'x' });
  });
});

test.describe('sw-table: the shared cell vocabulary', () => {
  test('a column with no kind keeps exactly the old class list (every existing table is unchanged)', () => {
    expect(cellClassOf({})).toBe('');
    expect(cellClassOf({ ltr: true, hideBelow: 'tablet', card: 'title' })).toBe('ltr hb-tablet c-title');
    expect(cellClassOf({ card: 'hide' })).toBe('');
    expect(cellPartOf({})).toBe('cell');
  });

  test('kinds become k-<kind> classes and cell-<kind> parts; unknown kinds are ignored; alignment is a class', () => {
    expect(cellClassOf({ kind: 'num' })).toBe('k-num');
    expect(cellClassOf({ kind: ['muted', 'truncate'], align: 'center' })).toBe('k-muted k-truncate a-center');
    expect(cellClassOf({ kind: 'actions', align: 'start' })).toBe('k-actions');
    expect(cellPartOf({ kind: ['num', 'status'] })).toBe('cell cell-num cell-status');
    expect(cellClassOf({ kind: ['num', 'bogus' as never] })).toBe('k-num');
  });

  test('a number or actions column puts its header at the reading end too; an explicit align wins', () => {
    expect(headClassOf({ kind: 'num' })).toBe('a-end');
    expect(headClassOf({ kind: 'actions', hideBelow: 'phone' })).toBe('hb-phone a-end');
    expect(headClassOf({ kind: 'num', align: 'start' })).toBe('');
    expect(headClassOf({ kind: 'muted' })).toBe('');
  });
});

test.describe('sw-table: the row keyboard walk', () => {
  test('ArrowDown / ArrowUp step without wrapping, Home / End jump; block keys, so RTL does not change them', () => {
    expect(rowFocusStep('ArrowDown', 0, 3)).toBe(1);
    expect(rowFocusStep('ArrowDown', 2, 3)).toBe(2);
    expect(rowFocusStep('ArrowUp', 0, 3)).toBe(0);
    expect(rowFocusStep('ArrowUp', 2, 3)).toBe(1);
    expect(rowFocusStep('Home', 2, 3)).toBe(0);
    expect(rowFocusStep('End', 0, 3)).toBe(2);
  });
  test('other keys and an empty table are not ours (Enter / Space stay the row-select keys)', () => {
    for (const k of ['Enter', ' ', 'Tab', 'ArrowLeft', 'ArrowRight']) expect(rowFocusStep(k, 0, 3), k).toBe(-1);
    expect(rowFocusStep('ArrowDown', 0, 0)).toBe(-1);
  });
});

test.describe('sw-table: the contract in the source', () => {
  const src = read('components/sw-table.ts');
  const styles = src.slice(src.indexOf('static styles'), src.indexOf('private pick('));

  test('rowAttrs / cellAttrs go through one element directive that also removes a dropped hook', () => {
    expect(src).toContain('@property({ attribute: false }) rowAttrs?: (row: Record<string, unknown>) => RowAttrs;');
    expect(src).toContain('cellAttrs?: (row: Row) => RowAttrs;');
    expect(src).toMatch(/data-row-id=\$\{String\(row\[this\.rowKey\] \?\? ''\)\} \$\{rowHooks\(hooks \? hooks\(row\) : null\)\}/);
    expect(src).toContain('${rowHooks(c.cellAttrs ? c.cellAttrs(row) : null)}');
    expect(src).toContain('for (const name of this.last) if (!(name in want)) el.removeAttribute(name);');
  });

  test('parts: table, head-row, head, row, cell (+ cell-<kind>), empty; a screen may slot its own empty state', () => {
    for (const p of ['part="table"', 'part="head-row"', 'part="head"', 'part="row"', 'part=${cellPartOf(c)}', 'part="empty"']) expect(src, p).toContain(p);
    expect(src).toContain('<slot name="empty"><div class="empty" part="empty">${this.emptyText}</div></slot>');
  });

  test('bare draws no card; static-rows has no pointer, no press tint and never picks; the knobs keep the old defaults', () => {
    expect(styles).toMatch(/:host\(\[bare\]\) \{\s*background: none;\s*border: 0;\s*border-radius: 0;\s*box-shadow: none;/);
    expect(styles).toMatch(/:host\(\[static-rows\]\) tr\.clickable \{\s*cursor: default;/);
    expect(src).toContain('if (this.staticRows) return false;');
    expect(src).toContain('@click=${() => this.staticRows || this.pick(row)}');
    expect(styles).toContain('min-inline-size: var(--sw-table-min, 560px);');
    expect(styles).toContain('background: var(--sw-table-head-bg, var(--sw-surface));');
    expect(styles).toMatch(/td\.k-truncate \.trunc \{\s*display: block;\s*max-inline-size: var\(--sw-table-trunc, 260px\);\s*overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap;/);
  });

  test('the vocabulary: t1 / t2, mut, num (an LTR isolate, tabular), chip tones, actions at the reading end, truncate; tokens only', () => {
    for (const sel of ['.t1 {', '.t2 {', '.mut {', '.num {', '.chip {', ".chip[data-tone='ok']", ".chip[data-tone='warn']", ".chip[data-tone='bad']", ".chip[data-tone='info']", 'td.k-num {', 'td.k-muted {', 'td.k-status {', 'td.k-actions {', 'td.k-truncate .trunc {'])
      expect(styles, sel).toContain(sel);
    expect(styles).toMatch(/\.num \{\s*direction: ltr;\s*unicode-bidi: isolate;\s*font-variant-numeric: tabular-nums;/);
    expect(styles).toMatch(/td\.k-num \{\s*font-variant-numeric: tabular-nums;\s*text-align: end;/);
    const added = styles.slice(styles.indexOf('CR-CMP2-TABLES-2450 (owner N10): what the hand-built tables'));
    expect(added.length).toBeGreaterThan(500);
    expect(added).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    // no motion on the rows' keyboard walk or the vocabulary
    expect(added).not.toMatch(/transition|animation/);
  });

  test('RTL: the phone selected-row mark sits on the start edge; the phone stack aligns every cell to the reading start', () => {
    expect(styles).toContain('box-shadow: inset var(--_sel-mark, 3px) 0 0 var(--sw-accent);');
    expect(styles).toMatch(/:host\(:dir\(rtl\)\) tr\.selected \{\s*--_sel-mark: -3px;/);
    expect(styles).toMatch(/@media \(max-width: 767px\) \{\s*td\.k-num,\s*td\.k-actions,\s*td\.a-end,\s*td\.a-center \{\s*text-align: start;/);
  });

  test('keyboard: Enter / Space pick, the block arrows walk the focusable rows, a key on a control inside a cell is left alone', () => {
    expect(src).toContain("if (e.target !== e.currentTarget) return; // a key on a control inside a cell is that control's");
    expect(src).toContain("const rows = [...this.renderRoot.querySelectorAll<HTMLTableRowElement>('tbody tr[tabindex=\"0\"]')];");
    expect(src).toContain('rows[to].focus();');
  });
});

// CR-CMP2-TABLES-CONSUMPTION-2450 (owner N10): the electricity and water tables moved to sw-table, one screen at a time. What they needed on
// top (a foot row for totals, links in a cell, a two-line truncated cell) and the guard that no hand-built data table comes back there.
test.describe('sw-table: the module tables (electricity, water)', () => {
  const src = read('components/sw-table.ts');
  const styles = src.slice(src.indexOf('static styles'), src.indexOf('private pick('));

  test('a foot row: drawn when a column names a foot cell, bold under a strong rule, an empty foot cell is left out of the phone stack', () => {
    expect(src).toContain('foot?: () => TemplateResult | string | typeof nothing;');
    expect(src).toContain('const hasFootRow = <R>(cols: readonly TableColumn<R>[]): boolean => cols.some((c) => !!c.foot);');
    expect(src).toContain('${hasFootRow(this.columns) ? html`<tfoot><tr part="foot-row">${this.columns.map((c) => this.footCell(c))}</tr></tfoot>` : nothing}');
    expect(styles).toMatch(/tfoot td \{\s*font-weight: var\(--sw-fw-bold\);[^}]*border-block-start: 1px solid var\(--sw-border-strong\);/);
    expect(styles).toMatch(/tfoot td:empty \{\s*display: none;/);
  });

  test('links in a cell: a.t1 names the row, a.lnk in the accent ink; no underline until hovered; the hit area is a knob', () => {
    expect(styles).toMatch(/a\.t1,\s*a\.lnk \{\s*display: inline-flex;\s*align-items: center;\s*min-block-size: var\(--sw-table-link-h, auto\);/);
    expect(styles).toMatch(/a\.t1:focus-visible,\s*a\.lnk:focus-visible \{\s*outline: var\(--sw-focus-w\) solid var\(--sw-focus\);/);
    expect(styles).toMatch(/td\.k-truncate \.trunc > \.t1,\s*td\.k-truncate \.trunc > \.t2 \{\s*overflow: hidden;\s*text-overflow: ellipsis;/);
    const added = styles.slice(styles.indexOf('CR-CMP2-TABLES-CONSUMPTION-2450'));
    expect(added).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  test('no hand-built data table is left in the moved electricity / water screens (print paths, the chart table and the tou editor stay)', () => {
    const moved = [
      'screens/electricity/page-meters.ts', 'electricity/elec-account-list.ts', 'electricity/elec-account-page.ts', 'electricity/elec-bills-table.ts',
      'electricity/elec-bill-page.ts', 'electricity/elec-formula-editor.ts', 'electricity/elec-wizard.ts', 'electricity/elec-settings.ts',
      'electricity/elec-settings-calendar.ts', 'electricity/permission-rows.ts', 'screens/water/page-meters.ts', 'screens/water/page-accounts.ts',
      'screens/water/page-alerts.ts', 'screens/water/page-usage.ts', 'screens/water/page-customers.ts', 'screens/water/page-settings.ts',
    ];
    for (const f of moved) {
      const s = read(f);
      expect(s, f).not.toMatch(/<table\b/);
      expect(s, f).toContain('<sw-table ');
    }
    // the module skin: never wider than its card, the module's header band / reading size / row height, links on the module's hit area
    const elec = read('electricity/styles.ts');
    expect(elec).toMatch(/sw-table\.t \{\s*--sw-table-min: 0;\s*--sw-table-head-bg: var\(--sw-surface-2\);\s*--sw-table-cell-pad: 12px;\s*--sw-table-fs: var\(--sw-fs-md\);\s*--sw-table-link-h: var\(--elec-touch\);/);
    expect(read('water/styles.ts')).toMatch(/sw-table\.t \{\s*--sw-table-cell-pad: 9px 12px;/);
  });
});

// CR-CMP2-GEN-REST-2460 (owner N10): the two generator screens left out - the live phase table (a totals foot row, a load bar per phase:
// the new shared sw-load-bar) and the alert routing matrix (group heading rows: new in sw-table, opt-in; the per-row "on" switch a
// sw-toggle; the module's recipient / channel chips through parts).
test.describe('sw-table: group heading rows, keep-columns (generator)', () => {
  const src = read('components/sw-table.ts');
  const styles = src.slice(src.indexOf('static styles'), src.indexOf('private pick('));

  test('rows split at their headings: a leading run without one, empty groups kept, no heading = one segment', () => {
    const head = (r: string) => r.startsWith('#');
    expect(groupSegments(['a', 'b'], head)).toEqual([{ head: null, rows: ['a', 'b'] }]);
    expect(groupSegments([], head)).toEqual([{ head: null, rows: [] }]);
    expect(groupSegments(['#1', 'a', '#2', 'b', 'c'], head)).toEqual([
      { head: '#1', rows: ['a'] },
      { head: '#2', rows: ['b', 'c'] },
    ]);
    expect(groupSegments(['x', '#1', '#2', 'b'], head)).toEqual([
      { head: null, rows: ['x'] },
      { head: '#1', rows: [] },
      { head: '#2', rows: ['b'] },
    ]);
  });

  test('the contract: opt-in, a band across every column opening its own tbody, the row hooks, never picked or focused', () => {
    expect(src).toContain('@property({ attribute: false }) groupHeading?: (row: Record<string, unknown>) => TemplateResult | string | null | undefined;');
    expect(src).toContain('const groups = !!this.groupHeading && this.rows.some((r) => this.headingOf(r) !== null);');
    expect(src).toMatch(/<tr class="group" part="group-row" data-row-id=\$\{String\(row\[this\.rowKey\] \?\? ''\)\} \$\{rowHooks\(hooks \? hooks\(row\) : null\)\}><th class="grp" part="group" scope="rowgroup" colspan=\$\{this\.columns\.length \|\| 1\}>/);
    // the heading row has no click, no tabindex, no keydown (the arrow walk only finds tbody tr[tabindex="0"])
    const groupRow = src.slice(src.indexOf('private groupRow('), src.indexOf('private dataRow('));
    expect(groupRow).not.toMatch(/@click|tabindex|@keydown|clickable/);
    // the band: static (only the column header sticks), tokens only, no motion
    expect(styles).toMatch(/th\.grp \{\s*position: static;\s*z-index: auto;\s*background: var\(--sw-table-group-bg, var\(--sw-surface-2\)\);/);
    const added = styles.slice(styles.indexOf('CR-CMP2-GEN-REST-2460'));
    expect(added.length).toBeGreaterThan(500);
    expect(added).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|transition|animation/i);
  });

  test('keep-columns: the phone keeps the table (opt-in), the columns that step out stay out', () => {
    expect(src).toContain("@property({ type: Boolean, reflect: true, attribute: 'keep-columns' }) keepColumns = false;");
    expect(styles).toMatch(/:host\(\[keep-columns\]\) table \{\s*display: table;/);
    expect(styles).toMatch(/:host\(\[keep-columns\]\) td \{\s*display: table-cell;\s*padding: var\(--sw-table-cell-pad, 9px 14px\);/);
    // a foot cell of a column that steps out stays out too (the empty foot cell rule would draw it as a fifth column)
    expect(styles).toMatch(/:host\(\[keep-columns\]\) \.hb-phone,\s*:host\(\[keep-columns\]\) \.hb-tablet,\s*:host\(\[keep-columns\]\) tfoot td\.hb-phone,\s*:host\(\[keep-columns\]\) tfoot td\.hb-tablet \{\s*display: none;/);
  });
});

test.describe('sw-load-bar: the shared load bar', () => {
  test('how full: clamped to 0..1, a missing / bad value or max is empty', () => {
    expect(loadFraction(50)).toBe(0.5);
    expect(loadFraction(120)).toBe(1);
    expect(loadFraction(-5)).toBe(0);
    expect(loadFraction(null)).toBe(0);
    expect(loadFraction(undefined)).toBe(0);
    expect(loadFraction(Number.NaN)).toBe(0);
    expect(loadFraction(30, 60)).toBe(0.5);
    expect(loadFraction(30, 0)).toBe(0);
  });

  test('the tone: above the danger limit bad, above the warning limit warn (strictly above, as the old .pbar), no limit never fires', () => {
    expect(loadTone(80, 80, 90)).toBe('normal');
    expect(loadTone(80.1, 80, 90)).toBe('warn');
    expect(loadTone(90, 80, 90)).toBe('warn');
    expect(loadTone(91, 80, 90)).toBe('bad');
    expect(loadTone(99)).toBe('normal');
    expect(loadTone(99, null, 95)).toBe('bad');
    expect(loadTone(null, 80, 90)).toBe('normal');
  });

  test('the element: a meter, tokens only, a compositor fill from the reading start, still under reduced motion', () => {
    const el = read('components/sw-load-bar.ts');
    expect(el).toContain('role="meter"');
    expect(el).toMatch(/transform: scaleX\(var\(--_f, 0\)\);\s*transform-origin: left center;/);
    expect(el).toMatch(/:host\(:dir\(rtl\)\) \.fill \{\s*transform-origin: right center;/);
    expect(el).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.fill \{\s*transition: none;/);
    expect(el).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    for (const tok of ['--sw-accent', '--sw-warning', '--sw-danger', '--sw-surface-3']) expect(el, tok).toContain(`var(${tok})`);
  });
});

test.describe('generator: the phase table and the alert routing are the shared table', () => {
  test('no hand-built table is left on the live page or the routing screen; the hooks the specs read are row hooks', () => {
    const live = read('generator/gen-live-page.ts');
    const routing = read('generator/gen-routing.ts');
    for (const [f, s] of [['gen-live-page', live], ['gen-routing', routing]] as const) {
      expect(s, f).not.toMatch(/<table\b/);
      expect(s, f).toContain('<sw-table ');
    }
    expect(live).toContain('<sw-load-bar ');
    expect(live).not.toContain('class="pbar"');
    expect(live).toContain("'data-phase': String(r.key)");
    expect(live).toMatch(/<sw-table bare static-rows keep-columns data-gen-table data-gen-phase/);
    // the routing: the severity rows, the type rows (+ no sensor / off), the group rows; the "on" switch is a sw-toggle that never opens the row
    expect(routing).toContain("'data-severity-row': String(r.key)");
    expect(routing).toContain("return { 'data-type': m.item.key, 'data-na': !m.item.available, 'data-off': m.item.available && !(m.item.policy?.enabled ?? true) };");
    expect(routing).toContain('.groupHeading=${(r: Record<string, unknown>) => (r as MatrixRow).grp ?? null}');
    expect(routing).toMatch(/<sw-toggle \.checked=\$\{live\(on\)\}[^>]*@click=\$\{\(e: Event\) => e\.stopPropagation\(\)\}/);
    expect(routing).not.toContain('<input type="checkbox" .checked=${on} aria-label=${S.colOn}'); // the old per-row checkbox
    // the module chips reach the table through parts; the old .pbar / table.routing / table.phase rules are gone
    const st = read('generator/gen-styles.ts');
    for (const p of ['::part(rec)', '::part(rec-item)', '::part(rec-item usr)', '::part(chs)', '::part(ch)', '::part(ch on)', '::part(off)']) expect(st, p).toContain(`sw-table[data-gen-routing-table]${p}`);
    expect(st).not.toMatch(/\.pbar|table\.routing|table\.phase/);
  });
});
