import { test, expect } from '@playwright/test';
import type { AdminDevice, AdminEndpoint } from '../src/api/media-admin';
import {
  DEFAULT_VIEW, NO_AREA, NO_INTEGRATION, buildView, factsOf, integrationsOf, isFiltered, loadView, matchesText, optionsOf, parseView, saveView, typeBucket,
  type ListView,
} from '../src/screens/media-admin-list-logic';

// 0.1.161: the pure logic of the settings lists (screens, speakers / players): ids and integrations per row, the filters (integration multi-select, area,
// type, approval, availability, free text over names, ids and integration names), sort, group, and the remembered view. No browser page.

const ep = (id: string, platform: string, role: AdminEndpoint['role'] = 'vendor', hidden = false): AdminEndpoint => ({ endpoint_id: `ha:${id}`, platform, role, rule: '1', link_source: 'auto', hidden, primary_for: [] });
const dev = (key: string, name: string, kind: AdminDevice['kind'], area: string | null, endpoints: AdminEndpoint[], extra: Partial<AdminDevice> = {}): AdminDevice => ({
  key, name, kind, kind_source: 'auto', approved: true, public: false, profile: 'generic', profile_source: 'auto', confidence: 'exact',
  anchor_entity_id: endpoints[0]?.endpoint_id.replace(/^ha:/, '') ?? '', floor_name: area ? 'קומה 1' : null, area_name: area, audio_link_key: null, audio_default: 'screen',
  volume_max: null, model_keys: [], also_turns_on: [], endpoints, ...extra,
});

const LIST: AdminDevice[] = [
  dev('a', 'טלוויזיה סלון', 'screen', 'סלון', [ep('media_player.tv_living', 'samsungtv_smart'), ep('media_player.tv_living_cast', 'cast', 'cast', true)], { ha_device_id: 'dev123', available: true }),
  dev('b', 'טלוויזיה מטבח', 'screen', 'מטבח', [ep('media_player.tv_kitchen', 'webostv')], { available: false, approved: false }),
  dev('c', 'רמקול חצר', 'speaker', null, [ep('media_player.yard', 'sonos')], { available: true }),
  dev('d', 'מגבר', 'receiver', 'סלון', [ep('media_player.amp', 'denonavr')], { available: true, ha_device_id: 'ampdev' }),
  dev('e', 'ללא אינטגרציה', 'player', 'מטבח', []),
  dev('f', 'אלפא', 'speaker', 'סלון', [ep('media_player.alpha', 'sonos')], { available: true }),
];
/** The keys in the list's own order; `names` is the same set in key order (the filters' tests do not care about the order). */
const ordered = (v: Partial<ListView>) => buildView(LIST, { ...DEFAULT_VIEW, ...v }).groups.flatMap((g) => g.rows.map((r) => r.d.key)).join('');
const names = (v: Partial<ListView>) => [...ordered(v)].sort().join('');

test.describe('settings lists: what a row shows', () => {
  test('integrations come from every endpoint (the vendor first, no repeats); the server list is merged in; ids are the anchor entity and the device id', () => {
    expect(integrationsOf(LIST[0])).toEqual(['samsungtv_smart', 'cast']);
    expect(integrationsOf({ ...LIST[0], endpoints: [], integrations: ['x'] })).toEqual(['x']);
    expect(integrationsOf(LIST[4])).toEqual([]);
    const f = factsOf(LIST[0]);
    expect(f.entityId).toBe('media_player.tv_living');
    expect(f.deviceId).toBe('dev123');
    expect(f.primary).toBe('samsungtv_smart');
    expect(factsOf(LIST[4]).entityId).toBe('');
    expect(factsOf(LIST[2]).areaKey).toBe(NO_AREA);
  });

  test('type buckets: screen, speaker, everything else', () => {
    expect(['screen', 'speaker', 'receiver', 'player', 'group'].map(typeBucket)).toEqual(['screen', 'speaker', 'other', 'other', 'other']);
  });

  test('availability: the live read wins over the list; unknown stays unknown', () => {
    expect(factsOf(LIST[1]).available).toBe(false);
    expect(factsOf(LIST[4]).available).toBeNull();
    expect(factsOf(LIST[1], () => true).available).toBe(true);
  });
});

test.describe('settings lists: filters', () => {
  test('integration is a multi-select (any of); "no integration" is its own choice', () => {
    expect(names({ integrations: ['sonos'] })).toBe('cf');
    expect(names({ integrations: ['sonos', 'webostv'] })).toBe('bcf');
    expect(names({ integrations: [NO_INTEGRATION] })).toBe('e');
    expect(names({ integrations: ['cast'] })).toBe('a'); // a hidden duplicate's integration counts: the device is reached through it
  });

  test('area, type, approval and availability', () => {
    expect(names({ area: 'סלון' })).toBe('adf');
    expect(names({ area: NO_AREA })).toBe('c');
    expect(names({ type: 'speaker' })).toBe('cf');
    expect(names({ type: 'other' })).toBe('de');
    expect(names({ approval: 'pending' })).toBe('b');
    expect(names({ approval: 'approved' })).toBe('acdef');
    expect(names({ avail: 'unavailable' })).toBe('b');
    expect(names({ avail: 'available' })).toBe('acdf');
  });

  test('free text matches names, areas, entity ids, device ids and integration names; every word must match', () => {
    expect(names({ q: 'sonos' })).toBe('cf');
    expect(names({ q: 'MEDIA_PLAYER.tv_' })).toBe('ab');
    expect(names({ q: 'dev123' })).toBe('a');
    expect(names({ q: 'ampdev' })).toBe('d');
    expect(names({ q: 'סלון' })).toBe('adf');
    expect(names({ q: 'סלון sonos' })).toBe('f');
    expect(names({ q: 'cast' })).toBe('a'); // the id of a hidden endpoint
    expect(names({ q: '   ' })).toBe('abcdef');
    expect(matchesText(LIST[0], factsOf(LIST[0]), 'nothing here')).toBe(false);
  });

  test('filters compose; isFiltered ignores sort and group', () => {
    expect(names({ integrations: ['sonos'], area: 'סלון', approval: 'approved' })).toBe('f');
    expect(isFiltered(DEFAULT_VIEW)).toBe(false);
    expect(isFiltered({ ...DEFAULT_VIEW, sort: 'id', dir: 'desc', group: 'area' })).toBe(false);
    expect(isFiltered({ ...DEFAULT_VIEW, q: 'x' })).toBe(true);
  });

  test('the choices come from what the list holds, with counts', () => {
    const o = optionsOf(LIST);
    expect(o.integrations).toEqual([{ id: 'cast', count: 1 }, { id: 'denonavr', count: 1 }, { id: 'samsungtv_smart', count: 1 }, { id: 'sonos', count: 2 }, { id: 'webostv', count: 1 }, { id: NO_INTEGRATION, count: 1 }]);
    expect(o.areas.at(-1)?.id).toBe(NO_AREA);
    expect(o.types).toEqual(['screen', 'speaker', 'other']);
  });
});

test.describe('settings lists: sort and group', () => {
  test('sort by name, type, integration, area and id, both directions; an empty value is last either way', () => {
    expect(ordered({ sort: 'name', dir: 'asc' })).toBe('fbaedc');
    expect(ordered({ sort: 'name', dir: 'desc' })).toBe('cdeabf');
    expect(ordered({ sort: 'type' })).toBe('edbafc');
    expect(ordered({ sort: 'integration', dir: 'asc' })).toBe('dafcbe');
    expect(ordered({ sort: 'integration', dir: 'desc' }).endsWith('e')).toBe(true);
    expect(ordered({ sort: 'area', dir: 'asc' }).endsWith('c')).toBe(true);
    expect(ordered({ sort: 'area', dir: 'desc' }).endsWith('c')).toBe(true);
    expect(ordered({ sort: 'id', dir: 'asc' })).toBe('fdbace');
    expect(ordered({ sort: 'id', dir: 'desc' })).toBe('cabdfe');
    expect(ordered({ sort: 'status', dir: 'asc' })).toBe('fadcbe');
  });

  test('group by integration: one group per primary integration with its count, "no integration" last', () => {
    const { groups } = buildView(LIST, { ...DEFAULT_VIEW, group: 'integration' });
    expect(groups.map((g) => `${g.label}:${g.rows.length}`)).toEqual(['denonavr:1', 'samsungtv_smart:1', 'sonos:2', 'webostv:1', 'ללא אינטגרציה:1']);
  });

  test('group by area and by type; a filter shrinks the groups and drops the empty ones', () => {
    expect(buildView(LIST, { ...DEFAULT_VIEW, group: 'area' }).groups.map((g) => `${g.label}:${g.rows.length}`)).toEqual(['מטבח:2', 'סלון:3', 'ללא חדר:1']);
    expect(buildView(LIST, { ...DEFAULT_VIEW, group: 'type' }).groups.map((g) => `${g.id}:${g.rows.length}`)).toEqual(['other:2', 'screen:2', 'speaker:2']);
    const g = buildView(LIST, { ...DEFAULT_VIEW, group: 'area', type: 'screen' });
    expect(g.groups.map((x) => `${x.label}:${x.rows.length}`)).toEqual(['מטבח:1', 'סלון:1']);
    expect(g.shown).toBe(2);
    expect(g.total).toBe(6);
  });

  test('group order follows the sort direction when the sort key is the group key', () => {
    const asc = buildView(LIST, { ...DEFAULT_VIEW, group: 'integration', sort: 'integration', dir: 'asc' }).groups.map((g) => g.id);
    const desc = buildView(LIST, { ...DEFAULT_VIEW, group: 'integration', sort: 'integration', dir: 'desc' }).groups.map((g) => g.id);
    expect(desc.slice(0, -1)).toEqual(asc.slice(0, -1).reverse());
    expect(desc.at(-1)).toBe(NO_INTEGRATION);
  });

  test('the rows keep their identity through a filter (the keys do not move with the order)', () => {
    const all = buildView(LIST, DEFAULT_VIEW).groups[0].rows.map((r) => r.d.key);
    const some = buildView(LIST, { ...DEFAULT_VIEW, q: 'tv' }).groups[0].rows.map((r) => r.d.key);
    expect(some.every((k) => all.includes(k))).toBe(true);
    expect(new Set(some).size).toBe(some.length);
  });
});

test.describe('settings lists: the remembered view', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  test('saved per section and per user; the free text is never remembered', () => {
    const s = mem();
    saveView('screens', 'u1', { ...DEFAULT_VIEW, q: 'tv', integrations: ['sonos'], sort: 'id', dir: 'desc', group: 'area', collapsed: ['סלון'] }, s);
    expect(loadView('screens', 'u1', s)).toEqual({ ...DEFAULT_VIEW, integrations: ['sonos'], sort: 'id', dir: 'desc', group: 'area', collapsed: ['סלון'] });
    expect(loadView('screens', 'u2', s)).toEqual(DEFAULT_VIEW);
    expect(loadView('players', 'u1', s)).toEqual(DEFAULT_VIEW);
  });

  test('never required: a failing or missing store, junk and old shapes all give a valid view', () => {
    const boom = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadView('screens', 'u', boom)).toEqual(DEFAULT_VIEW);
    expect(() => saveView('screens', 'u', DEFAULT_VIEW, boom)).not.toThrow();
    const s = mem();
    s.m.set('sw.media-admin.view.screens.u', '{not json');
    expect(loadView('screens', 'u', s)).toEqual(DEFAULT_VIEW);
    expect(parseView({ sort: 'bogus', dir: 5, group: 'x', type: 'tv', approval: 'zzz', integrations: [1, 'a'], collapsed: 'no' })).toEqual({ ...DEFAULT_VIEW, integrations: ['a'] });
    expect(parseView(null)).toEqual(DEFAULT_VIEW);
    expect(parseView('str')).toEqual(DEFAULT_VIEW);
  });
});
