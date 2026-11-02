import { test, expect } from '@playwright/test';
import {
  emptyState, labelCoverage, labelCoverageText, labelPointsTo, MAPPING_SETTINGS_DEFAULT, questions, resolve, TABLE_RULE,
  type BuildingRef, type MappingState, type Rule,
} from '../src/api/mapping-engine';
import { toData, type MappingRead } from '../src/api/mapping';

// HA-LABELS-SYNC-2351: the mapping assistant's label rules and the health card's coverage by label on REAL data - the shape the server's
// GET /sites/{id}/mapping now returns (areas carry their synced label NAMES, `items.labels` is the label registry, `labels_synced_at`).
//   npx playwright test -c playwright.unit.config.ts tests/unit-ha-labels-2351.spec.ts

const BUILDINGS = [
  { id: 'bN', name: 'בניין צפון', is_shared: false, floors: [] },
  { id: 'bS', name: 'בניין דרום', is_shared: false, floors: [] },
];

/** A server answer as routers/home_mapping.read_mapping builds it after a label sync. */
function serverRead(o: Partial<MappingRead['items']> = {}): MappingRead {
  return {
    site: { id: 's1', name: 'אתר' },
    state: null,
    revision: 0,
    settings: { ...MAPPING_SETTINGS_DEFAULT },
    multi_building: false,
    can_toggle: true,
    versions: [],
    seen: null,
    items: {
      floors: [{ id: 'f1', name: 'קומה 1', level: 1 }],
      areas: [
        { id: 'a1', name: 'לובי', floor_id: 'f1', labels: ['בניין צפון'] },
        { id: 'a2', name: 'משרדים', floor_id: 'f1', labels: ['בניין צפון', 'לילה'] },
        { id: 'a3', name: 'מחסן', floor_id: null, labels: ['בניין דרום'] },
        { id: 'a4', name: 'צפון · חדר אשפה', floor_id: null, labels: ['בניין דרום'] },
        { id: 'a5', name: 'גינה', floor_id: null, labels: [] },
      ],
      labels: [
        { id: 'north', name: 'בניין צפון', color: 'indigo', icon: null, areas: 2 },
        { id: 'south', name: 'בניין דרום', color: null, icon: 'mdi:office-building', areas: 2 },
        { id: 'night', name: 'לילה', color: 'blue', icon: null, areas: 1 },
        { id: 'unused', name: 'חורף', color: null, icon: null, areas: 0 },
      ],
      labels_synced_at: '2026-11-02T08:00:00Z',
      ...o,
    },
    buildings: BUILDINGS,
    links: { floors: [], areas: [], buildings: [] },
  };
}

const refs = (): BuildingRef[] => BUILDINGS.map((b) => ({ id: b.id, name: b.name }));
const ctx = () => ({ buildings: refs(), settings: { ...MAPPING_SETTINGS_DEFAULT } });
const labelRule = (value: string, to: string): Rule => ({ id: `r-${value}`, kind: 'label', value, to: { t: 'b', id: to }, on: true });

test('the server answer becomes engine items with the label names, and the registry only when it was listed', () => {
  const d = toData(serverRead());
  expect(d.mapItems.find((x) => x.id === 'a2')?.labels).toEqual(['בניין צפון', 'לילה']);
  expect(d.haLabels?.map((l) => l.name)).toEqual(['בניין צפון', 'בניין דרום', 'לילה', 'חורף']);
  // never listed (an old core) / an older server without the key: no registry, not "no labels"
  expect(toData(serverRead({ labels_synced_at: null })).haLabels).toBeNull();
  const old = serverRead();
  delete old.items.labels;
  delete old.items.labels_synced_at;
  expect(toData(old).haLabels).toBeNull();
});

test('"התווית היא" rules place areas by their real labels; the first matching rule wins', () => {
  const d = toData(serverRead());
  const state: MappingState = { ...emptyState(), advanced: true, rules: [labelRule('בניין דרום', 'bS'), labelRule('בניין צפון', 'bN'), { ...TABLE_RULE }] };
  const res = resolve(d.mapItems, state, ctx());
  expect(res.get('a:a1')?.to).toEqual({ t: 'b', id: 'bN' });
  expect(res.get('a:a2')?.to).toEqual({ t: 'b', id: 'bN' });
  expect(res.get('a:a3')?.to).toEqual({ t: 'b', id: 'bS' });
  expect(res.get('a:a3')?.rule).toBe('r-בניין דרום');
  expect(res.get('a:a5')?.to ?? null).toBeNull(); // no label, no mark
  // a label rule never matches a label the area does not carry (exact name, trimmed)
  const near = resolve(d.mapItems, { ...state, rules: [labelRule('בניין', 'bN')] }, ctx());
  expect(near.get('a:a1')?.to ?? null).toBeNull();
});

test('the token table read from labels ("בתווית" position) uses the synced names', () => {
  const d = toData(serverRead());
  const state: MappingState = { ...emptyState({ position: 'label', seps: [], kind: 'any', marker: 'בניין' }) };
  const res = resolve(d.mapItems, state, ctx());
  // the label is the building's own name: matched among our buildings without a table entry
  expect(res.get('a:a1')?.to).toEqual({ t: 'b', id: 'bN' });
  expect(res.get('a:a3')?.to).toEqual({ t: 'b', id: 'bS' });
  expect(labelPointsTo('לילה', state, refs())).toBeNull();
  expect(labelPointsTo('לילה', { tokens: { לילה: { t: 'none' } } }, refs())).toEqual({ t: 'none' });
});

test('a name that says one building and a real label that says another is a label question', () => {
  const d = toData(serverRead());
  const state: MappingState = { ...emptyState(), tokens: { צפון: { t: 'b', id: 'bN' } } };
  const res = resolve(d.mapItems, state, ctx());
  const r = res.get('a:a4')!;
  expect(r.to).toEqual({ t: 'b', id: 'bN' });
  expect(r.open).toBe(true);
  expect(r.conflict?.kind).toBe('label');
  expect(r.conflict?.alt).toEqual({ t: 'b', id: 'bS' });
  expect(questions(d.mapItems, res).some((q) => q.key === 'a:a4')).toBe(true);
});

test('the health card explains the real coverage by label', () => {
  const d = toData(serverRead());
  const nameState: MappingState = { ...emptyState(), tokens: { צפון: { t: 'b', id: 'bN' } } };
  const c = labelCoverage(d.mapItems, resolve(d.mapItems, nameState, ctx()), nameState, refs(), d.haLabels);
  expect(c).toMatchObject({ synced: true, areas: 5, labelled: 4, byLabel: 0, differs: 1 });
  const north = c.rows.find((r) => r.name === 'בניין צפון')!;
  expect(north).toMatchObject({ areas: 2, byLabel: 0, to: { t: 'b', id: 'bN' } });
  expect(c.rows.find((r) => r.name === 'בניין דרום')).toMatchObject({ areas: 2, differs: 1 }); // a4: the name says צפון
  expect(c.rows[c.rows.length - 1].name).toBe('חורף'); // a label no area carries comes last
  expect(labelCoverageText(c)).toBe('תוויות: 4 מתוך 5 אזורים מסומנים בתווית - בניין צפון (2), בניין דרום (2), לילה (1); אף אזור לא משויך לפי התווית; ב-1 התווית מצביעה על בניין אחר מהשם.');

  const byLabels: MappingState = { ...emptyState(), advanced: true, rules: [labelRule('בניין צפון', 'bN'), labelRule('בניין דרום', 'bS')] };
  const c2 = labelCoverage(d.mapItems, resolve(d.mapItems, byLabels, ctx()), byLabels, refs(), d.haLabels);
  expect(c2).toMatchObject({ labelled: 4, byLabel: 4, differs: 0 });
  expect(labelCoverageText(c2)).toContain('4 משויכים לפי התווית');
});

test('not synced and no labels are told apart', () => {
  const never = toData(serverRead({ labels_synced_at: null }));
  const s = emptyState();
  const c = labelCoverage(never.mapItems, resolve(never.mapItems, s, ctx()), s, refs(), never.haLabels);
  expect(c.synced).toBe(false);
  expect(labelCoverageText(c)).toContain('עדיין לא נקראו');
  const none = toData(serverRead({ areas: [{ id: 'a1', name: 'לובי', floor_id: null, labels: [] }], labels: [] }));
  expect(labelCoverageText(labelCoverage(none.mapItems, resolve(none.mapItems, s, ctx()), s, refs(), none.haLabels))).toBe('תוויות: אין תוויות במערכת הבית.');
  const unused = toData(serverRead({ areas: [{ id: 'a1', name: 'לובי', floor_id: null, labels: [] }], labels: [{ id: 'x', name: 'חורף', color: null, icon: null, areas: 0 }] }));
  expect(labelCoverageText(labelCoverage(unused.mapItems, resolve(unused.mapItems, s, ctx()), s, refs(), unused.haLabels))).toContain('אף אזור לא מסומן');
});
