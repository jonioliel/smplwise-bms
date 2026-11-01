import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTO_HIDE_ORDER, COLUMN_KEYS, COLUMN_WIDTH_PX, COST_COLUMN_KEYS, DEFAULT_COLUMNS, REQUIRED_COLUMNS, SELECT_COL_PX, TITLE_MIN_PX, fitColumns, isDefaultColumns, tableMinWidth,
} from '../src/tickets/table-model';
import { TABLE_TEXT_EN_KEYS, TABLE_TEXT_KEYS } from '../src/tickets/table-text';
import { SETTINGS_GROUPS, activeEntry, navActive, navTree, routeHref, searchSettings, visibleGroups } from '../src/screens/system-index';
import { parseRoute } from '../src/router';

// SMALL-UI-BUGS-2343 (docs/changes/SMALL-UI-BUGS-2343.md): two small UI defects of the 2.33.1 polish round.
//   1. the tickets table view overflowed sideways at 1440 px with the default columns -> fixed column widths, the default set fits
//      1280 / 1440, low-priority default columns hidden below their width (the chooser can still add them), tooltips on cut text;
//   2. the settings column repeated the calendars tabs (and every other screen's own tab strip) as a sub-list -> those sub-entries are
//      search results only.
// Node-only:  npx playwright test -c playwright.unit.config.ts tests/unit-small-ui-bugs-2343.spec.ts --workers=1

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');

// The width the table card has at a desktop viewport: the viewport, less the shell rail (70-72 px), the page's side padding (2 x 36 px)
// and the card's border (2 x 1 px). The real width is measured in the browser (ResizeObserver); this is the budget the defaults must meet.
const cardWidth = (viewport: number) => viewport - 72 - 72 - 2;

test('tickets table: every column has a fixed width; the title takes the rest', () => {
  for (const c of [...COLUMN_KEYS, ...COST_COLUMN_KEYS, 'sentence' as const]) {
    if (c === 'title') expect(COLUMN_WIDTH_PX.title).toBe(0);
    else expect(COLUMN_WIDTH_PX[c], c).toBeGreaterThanOrEqual(72);
  }
  expect(tableMinWidth(['number', 'title'], false)).toBe(COLUMN_WIDTH_PX.number + TITLE_MIN_PX);
  expect(tableMinWidth(['number', 'title'], true)).toBe(COLUMN_WIDTH_PX.number + TITLE_MIN_PX + SELECT_COL_PX);
  expect(tableMinWidth(['number', 'title', 'sentence'], false)).toBe(COLUMN_WIDTH_PX.number + TITLE_MIN_PX + COLUMN_WIDTH_PX.sentence);
});

test('tickets table: the default columns fit 1440 whole, and 1280 after the low-priority ones go', () => {
  for (const select of [false, true]) {
    expect(fitColumns(DEFAULT_COLUMNS, cardWidth(1440), select), `1440 select=${select}`).toEqual([...DEFAULT_COLUMNS]);
    expect(tableMinWidth(DEFAULT_COLUMNS, select)).toBeLessThanOrEqual(cardWidth(1440));
    const at1280 = fitColumns(DEFAULT_COLUMNS, cardWidth(1280), select);
    expect(tableMinWidth(at1280, select), `1280 select=${select}`).toBeLessThanOrEqual(cardWidth(1280));
    for (const c of DEFAULT_COLUMNS.filter((x) => !at1280.includes(x))) expect(AUTO_HIDE_ORDER, `${c} may be hidden`).toContain(c);
  }
  // the order of what goes first: department, then place, then priority; the required and the key columns never go
  expect(fitColumns(DEFAULT_COLUMNS, 1000, true)).toEqual(DEFAULT_COLUMNS.filter((c) => c !== 'department' && c !== 'place'));
  const tiny = fitColumns(DEFAULT_COLUMNS, 300, true);
  for (const c of [...REQUIRED_COLUMNS, 'status', 'assignee', 'activity'] as const) expect(tiny).toContain(c);
  expect(tiny).not.toContain('priority');
  // the sentence column (client-only) counts in the budget
  expect(fitColumns(DEFAULT_COLUMNS, cardWidth(1440), true, ['sentence']).length).toBeLessThan(DEFAULT_COLUMNS.length);
});

test('tickets table: a column set the user chose is never trimmed; not measured yet = nothing hidden', () => {
  expect(isDefaultColumns(DEFAULT_COLUMNS)).toBe(true);
  const mine = [...DEFAULT_COLUMNS, 'device' as const];
  expect(isDefaultColumns(mine)).toBe(false);
  expect(fitColumns(mine, 800, true)).toEqual(mine);
  const reordered = ['title', 'number', ...DEFAULT_COLUMNS.slice(2)] as typeof mine;
  expect(fitColumns(reordered, 800, true)).toEqual(reordered);
  expect(fitColumns(DEFAULT_COLUMNS, 0, true)).toEqual([...DEFAULT_COLUMNS]);
});

test('tickets table: fixed layout, <colgroup>, min width, tooltips on cut text; the chooser edits the shown columns', () => {
  const css = read('tickets/table-styles.ts');
  expect(css).toMatch(/table\.tt \{[^}]*table-layout: fixed;/);
  expect(css).not.toMatch(/max-inline-size: (240|320|360)px/); // the cells' text is cut by the column, not by a fixed cap
  const host = read('screens/tickets-table.ts');
  expect(host).toContain('<colgroup>');
  expect(host).toMatch(/style=\$\{`min-inline-size:\$\{tableMinWidth\(cols, select\)\}px`\}/);
  expect(host).toContain('new ResizeObserver');
  expect(host).toContain('.fitted=${this.fittedColumns()}');
  for (const t of ['title=${r.place_text || nothing}', 'title=${r.department?.name || nothing}', 'title=${r.device_name || nothing}', 'title=${name || nothing}', 'title=${c.text}', 'title=${r.title}']) {
    expect(host, t).toContain(t);
  }
  // no physical left / right in the new rules (RTL)
  expect(css).not.toMatch(/\b(margin|padding)-(left|right)\b|\btext-align: (left|right)\b/);
  const bar = read('tickets/table-toolbar.ts');
  expect(bar).toContain('const shown = this.fitted ?? this.layout.columns;');
  expect(bar).toContain('data-cols-fitted');
  expect(TABLE_TEXT_KEYS).toContain('columnsFitted');
  expect(TABLE_TEXT_EN_KEYS).toContain('columnsFitted');
  // saved views and the preference still read the layout itself, not the fitted columns
  expect(host).toContain('.current=${viewDoc({ scope: this.scope, ...this.base }, this.extra, this.layout)}');
  expect(host).toMatch(/saveBoardPrefs\(\{ columns: layout\.columns/);
});

test('settings column: the calendars tabs (and every screen with its own tab strip) are not repeated as a sub-list', () => {
  const groups = visibleGroups(false);
  const on = (hash: string) => {
    const active = activeEntry(groups, parseRoute(hash));
    const group = groups.find((g) => g.entries.includes(active!))!;
    return { active, marked: navActive(groups, active), shown: navTree(group, active).map((e) => e.href) };
  };
  for (const hash of ['#/system/calendars', '#/system/calendars?tab=behavior', '#/system/calendars?tab=retention']) {
    const r = on(hash);
    expect(r.shown.filter((h) => h.startsWith('#/system/calendars?')), hash).toEqual([]);
    expect(r.shown, hash).toContain('#/system/calendars');
    expect(r.marked?.href, `${hash}: the column marks the screen`).toBe('#/system/calendars');
  }
  expect(routeHref(parseRoute('#/system/calendars?tab=perm'))).toBe('#/system/calendars?tab=perm');
  expect(routeHref(parseRoute('#/system/calendars?tab=overlap'))).toBe('#/system/calendars');
  // the same for the other screens that draw their own tabs
  for (const [hash, base] of [['#/system/access?tab=roles', '#/system/access'], ['#/system/diagnostics?tab=media', '#/system/diagnostics'], ['#/system/multimedia?tab=cast', '#/system/multimedia'],
    ['#/system/security/cameras', '#/system/security'], ['#/system/access-control/policy', '#/system/access-control'], ['#/system/tickets?tab=departments', '#/system/tickets']] as const) {
    const r = on(hash);
    expect(r.active?.sub, `${hash} is a listed tab`).toBe(true);
    const subs = groups.flatMap((g) => g.entries).filter((e) => e.sub && e.href.startsWith(base));
    for (const s of subs) expect(r.shown, `${hash}: ${s.href} not in the column`).not.toContain(s.href);
    expect(r.marked?.sub, `${hash}: the screen is marked`).toBeFalsy();
  }
  // a screen with sections on one page (no tab strip) keeps its jump list
  const n = on('#/system/notifications?section=mail');
  expect(n.shown).toContain('#/system/notifications?section=quiet');
  expect(n.marked?.href).toBe('#/system/notifications?section=mail');
});

test('settings search still finds the tabs that left the column', () => {
  const groups = visibleGroups(false);
  expect(searchSettings(groups, 'פרטי אורחים')[0]?.entry.href).toBe('#/system/calendars?tab=retention');
  expect(searchSettings(groups, 'ערב חג').some((r) => r.entry.href === '#/system/calendars?tab=behavior')).toBe(true);
  expect(searchSettings(groups, 'תפקידים')[0]?.entry.href).toBe('#/system/access?tab=roles');
  // every sub-entry is still in the index (so in the search), and only top-level entries carry ownTabs
  const all = SETTINGS_GROUPS.flatMap((g) => g.entries);
  expect(all.filter((e) => e.href.startsWith('#/system/calendars?tab=')).length).toBe(4);
  for (const e of all.filter((x) => x.ownTabs)) expect(e.sub, e.href).toBeFalsy();
  const nav = read('screens/system-nav.ts');
  expect(nav).toContain('navTree(g, active).map((e) => this.link(e, marked))');
});
