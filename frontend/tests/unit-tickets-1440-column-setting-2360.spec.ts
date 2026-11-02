import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_COLUMNS, TABLE_MID_DEFAULT, TABLE_MID_WIDTH, fitColumns, fitTable, parseTableMid, tableMinWidth,
} from '../src/tickets/table-model';
import type { ColumnKey } from '../src/api/tickets-table';
import { LIST_TEXT_KEYS, lt } from '../src/tickets/list-text';

// TICKETS-1440-COLUMN-SETTING-2360 (docs/changes/TICKETS-1440-COLUMN-SETTING-2360.md): at a medium table width (about 1440 px) the sentence
// column "מה קורה" and the department column cannot both fit; `ui.table_mid_width` (sentence - default, as before - / department) picks the
// one the default set keeps. The other stays in the column chooser; the viewer's own choice wins. Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-1440-column-setting-2360.spec.ts --workers=1

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');
/** The width the table card has at a desktop viewport (the budget of unit-small-ui-bugs-2343). */
const cardWidth = (viewport: number) => viewport - 72 - 72 - 2;

test('the setting: sentence by default (today), department, anything else reads as the default', () => {
  expect(TABLE_MID_WIDTH).toEqual(['sentence', 'department']);
  expect(TABLE_MID_DEFAULT).toBe('sentence');
  expect(parseTableMid('department')).toBe('department');
  expect(parseTableMid('sentence')).toBe('sentence');
  for (const bad of [undefined, null, '', 'both', 'Department', 7, true]) expect(parseTableMid(bad)).toBe('sentence');
});

test('the default ("sentence") is exactly today: fitTable equals fitColumns with the sentence in the budget', () => {
  for (const viewport of [1100, 1280, 1366, 1440, 1536, 1920]) {
    for (const select of [false, true]) {
      for (const choice of ['default', 'on'] as const) {
        const t = fitTable(DEFAULT_COLUMNS, cardWidth(viewport), select, choice);
        expect(t.columns, `${viewport} select=${select} ${choice}`).toEqual(fitColumns(DEFAULT_COLUMNS, cardWidth(viewport), select, ['sentence']));
        expect(t.sentence).toBe(true);
        expect(t.sentenceFitted).toBe(false);
      }
      const off = fitTable(DEFAULT_COLUMNS, cardWidth(viewport), select, 'off');
      expect(off.columns).toEqual(fitColumns(DEFAULT_COLUMNS, cardWidth(viewport), select, []));
      expect(off.sentence).toBe(false);
    }
  }
  // 1440: the sentence stays and the department steps aside (SMALL-UI-BUGS-2343 / GATE2342-B)
  const at1440 = fitTable(DEFAULT_COLUMNS, cardWidth(1440), true, 'default');
  expect(at1440.sentence).toBe(true);
  expect(at1440.columns).not.toContain('department');
});

test('"department": at 1440 the sentence column steps aside and the department stays', () => {
  for (const select of [false, true]) {
    const t = fitTable(DEFAULT_COLUMNS, cardWidth(1440), select, 'default', 'department');
    expect(t.sentence, `select=${select}`).toBe(false);
    expect(t.sentenceFitted).toBe(true);
    expect(t.columns).toEqual([...DEFAULT_COLUMNS]); // the whole default set, department included
    expect(tableMinWidth(t.columns, select)).toBeLessThanOrEqual(cardWidth(1440));
  }
});

test('"department": wide screens keep both, narrow screens still shed the low-priority columns', () => {
  // both fit: nothing to choose
  for (const viewport of [1920, 2560]) {
    const t = fitTable(DEFAULT_COLUMNS, cardWidth(viewport), true, 'default', 'department');
    expect(t.sentence).toBe(true);
    expect(t.sentenceFitted).toBe(false);
    expect(t.columns).toEqual([...DEFAULT_COLUMNS]);
  }
  // 1280: without the sentence the default set still needs its place / priority fitting - the same rules as before, the sentence is gone
  const t1280 = fitTable(DEFAULT_COLUMNS, cardWidth(1280), true, 'default', 'department');
  expect(t1280.sentence).toBe(false);
  expect(t1280.columns).toEqual(fitColumns(DEFAULT_COLUMNS, cardWidth(1280), true, []));
  expect(tableMinWidth(t1280.columns, true)).toBeLessThanOrEqual(cardWidth(1280));
  // not measured yet (width 0): nothing is dropped
  const t0 = fitTable(DEFAULT_COLUMNS, 0, true, 'default', 'department');
  expect(t0).toEqual({ columns: [...DEFAULT_COLUMNS], sentence: true, sentenceFitted: false });
});

test('the viewer\'s own choice wins over the setting', () => {
  // the sentence ticked in the chooser in this browser: kept, the department steps aside as it always did
  const on = fitTable(DEFAULT_COLUMNS, cardWidth(1440), true, 'on', 'department');
  expect(on.sentence).toBe(true);
  expect(on.columns).not.toContain('department');
  // the sentence unticked: gone, with either setting, and the department then fits at 1440
  for (const mid of TABLE_MID_WIDTH) {
    const off = fitTable(DEFAULT_COLUMNS, cardWidth(1440), true, 'off', mid);
    expect(off.sentence).toBe(false);
    expect(off.sentenceFitted).toBe(false);
    expect(off.columns).toEqual([...DEFAULT_COLUMNS]);
  }
  // a column set of the viewer's own (chooser / saved view): never fitted, whatever the setting says, the sentence as ticked
  const mine: ColumnKey[] = ['number', 'title', 'department', 'status', 'sla'];
  for (const mid of TABLE_MID_WIDTH) {
    expect(fitTable(mine, cardWidth(1280), true, 'default', mid)).toEqual({ columns: mine, sentence: true, sentenceFitted: false });
    expect(fitTable(mine, cardWidth(1280), true, 'off', mid)).toEqual({ columns: mine, sentence: false, sentenceFitted: false });
  }
  // the other column stays reachable: a hidden department in "sentence" mode and a hidden sentence in "department" mode are both in the chooser,
  // which lists every known column (chooserOrder) and the sentence tick; the viewer's tick or column choice then applies as above
  const sentenceMode = fitTable(DEFAULT_COLUMNS, cardWidth(1440), true, 'default', 'sentence');
  expect(sentenceMode.columns).not.toContain('department');
});

test('the screen asks fitTable with the module setting; the chooser knows when the sentence was fitted away', () => {
  const screen = read('src/screens/tickets-table.ts');
  expect(screen).toMatch(/fitTable\(this\.layout\.columns, this\.phone \? 0 : this\.fitWidth, this\.canSelect\(\), this\.sentenceChoice, parseTableMid\(this\.midWidth\)\)/);
  expect(read('src/screens/tickets-list.ts')).toContain(".midWidth=${this.module?.ui?.table_mid_width ?? ''}");
  expect(screen).toMatch(/\.sentence=\$\{this\.fittedTable\(\)\.sentence\} \.sentenceFitted=\$\{this\.fittedTable\(\)\.sentenceFitted\}/);
  expect(screen).toMatch(/this\.sentenceChoice = e\.detail\.on \? 'on' : 'off'/); // a tick in the chooser is the viewer's own choice
  const bar = read('src/tickets/table-toolbar.ts');
  expect(bar).toMatch(/const narrowed = shown\.length < this\.layout\.columns\.length \|\| this\.sentenceFitted/);
  const prefs = read('src/tickets/list-prefs.ts');
  expect(prefs).toMatch(/v === '0' \? 'off' : v === '1' \? 'on' : 'default'/);
});

test('the settings row sits in the display card next to the drawer rows, default first, Hebrew words', () => {
  const sys = read('src/screens/system-tickets.ts');
  expect(sys).toMatch(/\$\{drawerSettingsRows\(doc\.ui as never, this\.busy, save\)\}\$\{tableMidRow\(doc\.ui as never, this\.busy, save\)\}/);
  const row = read('src/tickets/settings-table.ts');
  expect(row).toContain('data-setting="table_mid_width"');
  expect(row).toContain('TABLE_MID_WIDTH.map');
  expect(row).toMatch(/save\(\{ table_mid_width: v \}\)/);
  expect(lt('setTableMid')).toBe('בטבלה ברוחב בינוני הצג');
  expect([lt('tmSentence'), lt('tmDepartment')]).toEqual(['משפט', 'מחלקה']);
  expect(lt('setTableMidSub')).toContain('בורר העמודות');
  expect(lt('setTableMidSub')).not.toMatch(/home assistant/i);
  for (const k of ['setTableMid', 'setTableMidSub', 'tmSentence', 'tmDepartment'] as const) expect(LIST_TEXT_KEYS).toContain(k);
});

test('the server and the frontend agree on the key, the values and the default', () => {
  const doc = readFileSync(path.resolve(ROOT, '../smplwise_vms/backend/smplwise/services/tickets/settings_doc.py'), 'utf8');
  expect(doc).toContain('("ui", "table_mid_width"): ("sentence", _choice("sentence", "department"))');
  const admin = readFileSync(path.resolve(ROOT, '../smplwise_vms/backend/smplwise/routers/tickets_admin.py'), 'utf8');
  expect(admin).toContain('table_mid_width: Literal["sentence", "department"] | None = None');
});
