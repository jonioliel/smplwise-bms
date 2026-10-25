import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DoorBlockEntity, DoorBlockItem, DoorBlocks } from '../src/api/door-blocks';
import {
  cleanNote, domainLabel, entityBadge, entityMeta, filterEntities, itemBadge, itemDevicesLine, NOTE_MAX, NOTE_MIN, noteProblem, noteProblemText, page, PAGE, releasedLine, summaryLine, usedByLine,
} from '../src/access-control/door-blocks-logic';
import { bt, DOOR_BLOCKS_HE } from '../src/i18n/door-blocks';

// WXUNBLK (owner 2026-10-13): the pure logic of Settings > "חסימות פתיחת דלתות" - search, filter, paging, the words of a row, the note
// check - and the source guards that keep the screen a thin client of the server's rules. Plain node.
//   npx playwright test -c playwright.unit.config.ts tests/unit-wxunblk.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(HERE, rel), 'utf8');

const ent = (over: Partial<DoorBlockEntity> = {}): DoorBlockEntity => ({
  entity_id: 'switch.gate', name: 'שער חצר', domain: 'switch', platform: 'template', area: 'חצר', state: 'blocked', overridable: true, stale: false, override: null, used_by: [], used_more: 0, ...over,
});
const released = (over: Partial<DoorBlockEntity> = {}) => ent({ state: 'unblocked', override: { note: 'מתג רגיל של הדייר', by: 'יוני', at: '2026-10-13T08:00:00Z' }, ...over });

const SET: DoorBlockEntity[] = [
  ent(),
  released({ entity_id: 'light.hall', name: 'מנורת מבואה', domain: 'light', area: null }),
  ent({ entity_id: 'lock.virtual', name: 'מנעול וירטואלי', domain: 'lock', area: 'כניסה' }),
  ent({ entity_id: 'lock.mapped', name: 'מנעול ממופה', domain: 'lock', area: null, state: 'door', overridable: false }),
  ent({ entity_id: 'cover.shutter', name: 'Roller Shutter', domain: 'cover', area: 'Living Room' }),
];

test.describe('WXUNBLK: the note a release needs', () => {
  test('whitespace is collapsed, then at least 3 and at most 300 characters - the server\'s own limits', () => {
    expect(cleanNote('  שער \n  החצר\t של   הדייר ')).toBe('שער החצר של הדייר');
    expect([NOTE_MIN, NOTE_MAX]).toEqual([3, 300]);
    const server = read('../../smplwise_vms/backend/smplwise/services/door_overrides.py');
    expect(server).toMatch(/^NOTE_MIN = 3$/m);
    expect(server).toMatch(/^NOTE_MAX = 300$/m);
    expect(noteProblem('')).toBe('required');
    expect(noteProblem('   ')).toBe('required');
    expect(noteProblem('ab')).toBe('required');
    expect(noteProblem(' a  ')).toBe('required');
    expect(noteProblem('abc')).toBeNull();
    expect(noteProblem('a b')).toBeNull();
    expect(noteProblem('א'.repeat(300))).toBeNull();
    expect(noteProblem('א'.repeat(301))).toBe('too_long');
    expect(noteProblem(('א ').repeat(150))).toBeNull(); // 299 characters once collapsed
    expect(noteProblemText('required')).toBe('נדרשת סיבה (לפחות 3 תווים)');
    expect(noteProblemText('too_long')).toBe('הסיבה ארוכה מדי (עד 300 תווים)');
  });
});

test.describe('WXUNBLK: search, filter, paging', () => {
  test('a search matches the name, the entity id, the area, the kind of device and the reason of a release; every word must match', () => {
    const ids = (q: string, s: 'all' | 'blocked' | 'released' = 'all') => filterEntities(SET, q, s).map((e) => e.entity_id);
    expect(ids('')).toEqual(['switch.gate', 'light.hall', 'lock.virtual', 'lock.mapped', 'cover.shutter']);
    expect(ids('שער')).toEqual(['switch.gate', 'cover.shutter']); // the name, and the kind of the cover ("תריס או שער")
    expect(ids('שער חצר')).toEqual(['switch.gate']); // every word must match
    expect(ids('light.hall')).toEqual(['light.hall']);
    expect(ids('חצר')).toEqual(['switch.gate']);
    expect(ids('מנעול')).toEqual(['lock.virtual', 'lock.mapped']); // the name and the kind
    expect(ids('מנעול כניסה')).toEqual(['lock.virtual']);
    expect(ids('roller living')).toEqual(['cover.shutter']);
    expect(ids('ROLLER')).toEqual(['cover.shutter']);
    expect(ids('דייר')).toEqual(['light.hall']); // the note of a release
    expect(ids('יוני')).toEqual(['light.hall']); // who released it
    expect(ids('zzz')).toEqual([]);
  });

  test('the status chips: blocked leaves out the released ones (a door-mapped one stays: it is blocked), released keeps only those', () => {
    expect(filterEntities(SET, '', 'blocked').map((e) => e.entity_id)).toEqual(['switch.gate', 'lock.virtual', 'lock.mapped', 'cover.shutter']);
    expect(filterEntities(SET, '', 'released').map((e) => e.entity_id)).toEqual(['light.hall']);
    expect(filterEntities(SET, 'מנעול', 'released')).toEqual([]);
  });

  test('paging: the first rows and how many are left', () => {
    const rows = Array.from({ length: PAGE * 2 + 5 }, (_, i) => i);
    expect(page(rows, PAGE)).toEqual({ rows: rows.slice(0, PAGE), left: PAGE + 5 });
    expect(page(rows, PAGE * 3)).toEqual({ rows, left: 0 });
    expect(page([], PAGE)).toEqual({ rows: [], left: 0 });
  });
});

test.describe('WXUNBLK: the words of a row', () => {
  test('the kind of a device and where it is', () => {
    expect(domainLabel('switch')).toBe('מתג');
    expect(domainLabel('lock')).toBe('מנעול');
    expect(domainLabel('light')).toBe('תאורה');
    expect(domainLabel('never_heard_of')).toBe('התקן');
    expect(entityMeta(ent())).toBe('מתג · חצר');
    expect(entityMeta(ent({ area: null, domain: 'cover' }))).toBe('תריס או שער');
  });

  test('the badge: blocked, released (and gone when stale), mapped to a door', () => {
    expect(entityBadge(ent())).toEqual({ kind: 'stale', text: 'חסום' });
    expect(entityBadge(released())).toEqual({ kind: 'live', text: 'משוחרר' });
    expect(entityBadge(released({ stale: true })).text).toBe('משוחרר · כבר אינו בקטלוג');
    expect(entityBadge(ent({ state: 'door' }))).toEqual({ kind: 'unknown', text: 'משויך לדלת' });
  });

  test('which items use it, and who released it when and why', () => {
    expect(usedByLine(ent())).toBe('');
    expect(usedByLine(ent({ used_by: ['א', 'ב'] }))).toBe('בשימוש: א, ב');
    expect(usedByLine(ent({ used_by: ['א', 'ב'], used_more: 3 }))).toBe('בשימוש: א, ב ועוד 3');
    expect(releasedLine(ent(), (i) => i)).toBe('');
    expect(releasedLine(released(), (i) => `<${i}>`)).toBe('שוחרר בידי יוני · <2026-10-13T08:00:00Z>');
    expect(releasedLine(released({ override: { note: 'x y z', by: '', at: '2026-10-13T08:00:00Z' } }), (i) => i)).toBe('שוחרר בידי — · 2026-10-13T08:00:00Z');
  });

  test('an item: still blocked or freed, and the devices behind it', () => {
    const item = (over: Partial<DoorBlockItem> = {}): DoorBlockItem => ({
      key: 'script:a', kind: 'script', kind_text: 'סקריפט', name: 'א', state: 'ready', blocked: true, opens_door: false, guard: 'g', why: null, reasons: [], devices: [], devices_more: 0, ...over,
    });
    expect(itemBadge(item())).toEqual({ kind: 'stale', text: 'חסום' });
    expect(itemBadge(item({ blocked: false }))).toEqual({ kind: 'live', text: 'אינו חסום עוד' });
    expect(itemDevicesLine(item())).toBe('');
    expect(itemDevicesLine(item({ devices: [{ name: 'מנורה', state: 'blocked' }, { name: 'שער', state: 'unblocked' }] }))).toBe('התקנים וירטואליים: מנורה, שער (משוחרר)');
    expect(itemDevicesLine(item({ devices: [{ name: 'מנורה', state: 'blocked' }], devices_more: 4 }))).toBe('התקנים וירטואליים: מנורה ועוד 4');
  });

  test('the summary line', () => {
    const data = (over: Partial<DoorBlocks>): Pick<DoorBlocks, 'wiskey_present' | 'counts'> => ({
      wiskey_present: true, counts: { entities: 5, blocked: 4, unblocked: 1, items: 2, items_blocked: 1 }, ...over,
    });
    expect(summaryLine(data({}))).toBe('4 חסומים · 1 משוחררים');
    expect(summaryLine(data({ wiskey_present: false, counts: { entities: 0, blocked: 0, unblocked: 0, items: 0, items_blocked: 0 } }))).toBe('אין דלת אינטרקום בהתקנה, ולכן שום התקן אינו חסום');
  });
});

test.describe('WXUNBLK: strings and the thin client', () => {
  test('every Hebrew string has text, no placeholder is left unnamed and no internal code is shown as text', () => {
    for (const [key, text] of Object.entries(DOOR_BLOCKS_HE)) {
      expect(text.trim().length, key).toBeGreaterThan(0);
      expect(text, key).not.toMatch(/\bundefined\b|\[object|CR-0\d\d|\bD10a\b|\bWXUNBLK\b|door_step|template_/);
    }
    expect(bt('more', { n: 7 })).toBe('הצג עוד (7)');
    expect(bt('toggle', { name: 'שער' })).toBe('שחרור שער');
  });

  test('no Home Assistant branding in the screen (a Settings page may name the intercom, never the platform)', () => {
    for (const text of [read('../src/i18n/door-blocks.ts'), read('../src/screens/system-door-blocks.ts')]) expect(text).not.toMatch(/Home Assistant|\bHA\b|Ingress/);
  });

  test('the screen only asks the server: one list read, one write per change - the confirmation and the note go with it', () => {
    const api = read('../src/api/door-blocks.ts');
    expect(api).toMatch(/get<DoorBlocks>\('doors\/blocks'\)/);
    expect(api).toMatch(/put<EntityBlockReply>\(`doors\/blocks\/entities\/\$\{encodeURIComponent\(entityId\)\}`, \{ unblocked, \.\.\.\(note \? \{ note \} : \{\}\), confirmed: true \}\)/);
    const screen = read('../src/screens/system-door-blocks.ts');
    expect(screen).toContain('setEntityBlock(p.entity.entity_id, p.release, cleanNote(this.note) || undefined)');
    // a release is never sent without the check of the note; a switch never changes anything by itself (it opens the question)
    expect(screen).toMatch(/if \(p\.release\) \{\s*const bad = noteProblem\(this\.note\);/);
    expect(screen).toMatch(/@change=\$\{\(ev: CustomEvent<\{ checked: boolean \}>\) => this\.ask\(e, ev\.detail\.checked\)\}/);
    // an item has no switch of its own: the release is on the device
    const item = /private itemRow\(i: DoorBlockItem\) \{([\s\S]*?)\n  \}\n/.exec(screen)![1];
    expect(item).not.toMatch(/sw-toggle|setEntityBlock|\.ask\(/);
  });

  test('the card is on the Connections page for system administrators only, and findable in the Settings search', () => {
    const setup = read('../src/screens/system-setup.ts');
    expect(setup).toMatch(/can\('system\.configure'\) \? html`<sw-door-setup data-door-setup><\/sw-door-setup><sw-door-inventory data-door-inventory><\/sw-door-inventory><sw-door-blocks data-door-blocks><\/sw-door-blocks><sw-emergency-open-settings><\/sw-emergency-open-settings>` : nothing/);
    expect(setup).toContain("import './system-door-blocks';");
    expect(read('../src/screens/system-index.ts')).toMatch(/label: 'חיבורים'[^\n]*חסימות פתיחת דלתות/);
  });
});
