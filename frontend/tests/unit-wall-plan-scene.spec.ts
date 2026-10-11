import { test, expect } from '@playwright/test';
import { demoRooms } from '../src/fixtures/demo';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import type { MapBundle } from '../src/api/maps';
import type { GeomCircuit, GeometryDoc } from '../src/map/geometry';
import { DEFAULT_SKIN, SKIN_IDS } from '../src/design/skins';
import { TOKENS } from '../src/design/tokens';
import { skinTable } from '../src/design/css';
import { skinOf, themeScope } from '../src/map/theme-scope';
import { wallCircuitStates, wallLamps, wallLevel, wallRoomStates, wallScene } from '../src/wall/wall-plan-scene';

// Plan Studio 6, slice S5-B (CR-030 section 4.1 / 4.2, docs/changes/CR-029-ST7-S5B-NOTES.md) in node: what the map band of a wall display
// knows and draws. A wall user holds the floor's circuit switches, not entity states: lit rooms come from the circuits, a stale switch
// lights nothing, nothing is operable (no cameras, no entity pins); and the wall's own theme column for the plan's subtree.

const input = demoSceneInput('f0')!;
const rooms = demoRooms('f0');
const zones = rooms.map((r, i) => ({ id: `z${i}`, name: `חדר ${i}`, polygon: [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }], level_id: 'L0' }));
const circuit = (id: string, members: string[]): GeomCircuit => ({ id, name: id, switch_entity_id: `switch.${id}`, member_ids: members, color_token: 'light', power_w: 40 });
const doc = (circuits: GeomCircuit[]): GeometryDoc => ({ ...input.doc, circuits });
const cs = (state: string | null, fresh = true) => ({ entity_id: 'switch.x', name: null, color_token: null, member_ids: [], power_w: null, state, known: state !== null, fresh });

function bundle(circuitStates: MapBundle['circuitStates'], levels: MapBundle['levels'] = input.doc.levels): MapBundle {
  return { source: 'api', floorId: 'f0', width: input.width, height: input.height, zones, levels, circuitStates, scaleMPerPx: null, planVersionId: 'v1' } as unknown as MapBundle;
}

test.describe('what the wall knows of the floor', () => {
  test('circuit switches: a switch that is not fresh is unknown, never on', () => {
    expect(wallCircuitStates({ circuitStates: { a: cs('on'), b: cs('off'), c: cs('on', false), d: cs(null) } })).toEqual({ a: 'on', b: 'off', c: null, d: null });
  });

  test('lamps are the members of the circuits; only an "on" circuit glows; a member that is not in the document is ignored', () => {
    const d = doc([circuit('c1', ['dl0', 'dl1', 'ghost']), circuit('c2', ['dl2'])]);
    const lamps = wallLamps(d, { c1: 'on', c2: 'off' });
    expect(lamps).toHaveLength(3);
    expect(lamps.map((l) => l.on)).toEqual([true, true, false]);
    expect(wallLamps(d, { c1: null, c2: 'on' }).map((l) => l.on)).toEqual([false, false, true]);
    expect(wallLamps(d, {}).every((l) => !l.on)).toBe(true);
    expect(wallLamps(doc([]), { c1: 'on' })).toEqual([]);
  });

  test('lit rooms come from the circuits; a stale switch lights nothing; no zones or no structure is no layer', () => {
    const d = doc([circuit('c1', ['dl0'])]);
    const on = wallRoomStates(bundle({ c1: cs('on') }), d, 1_000);
    expect(on?.rooms.z0.lit).toBe(true);
    expect(Object.values(on!.rooms).filter((r) => r.lit)).toHaveLength(1);
    expect(on!.openOpenings).toEqual([]); // the wall holds no door sensors: nothing is drawn open
    expect(Object.values(wallRoomStates(bundle({ c1: cs('off') }), d, 1_000)!.rooms).some((r) => r.lit)).toBe(false);
    expect(Object.values(wallRoomStates(bundle({ c1: cs('on', false) }), d, 1_000)!.rooms).some((r) => r.lit)).toBe(false);
    expect(wallRoomStates(bundle({ c1: cs('on') }), null, 1_000)).toBeNull();
    expect(wallRoomStates({ ...bundle({ c1: cs('on') }), zones: [] }, d, 1_000)).toBeNull();
  });

  test('a floor with several levels shows its default level; one level shows everything', () => {
    const lv = (id: string, d: boolean) => ({ id, name: id, elevation_m: 0, ceiling_height_m: 3, is_default: d });
    expect(wallLevel({ levels: [lv('L0', true)] })).toBeNull();
    expect(wallLevel({ levels: [lv('L0', false), lv('L1', true)] })).toBe('L1');
    expect(wallLevel({ levels: [lv('L0', false), lv('L1', false)] })).toBe('L0');
  });
});

test.describe('the scene of the map band', () => {
  const parts = { catalog3d: input.catalog ?? null, materials: null };

  test('built from the structure and the circuits: a lit circuit adds glow, nothing is bound to a camera or an entity, and it is deterministic', () => {
    const d = doc([circuit('c1', ['dl0'])]);
    const off = wallScene({ bundle: bundle({ c1: cs('off') }), geometry: d, ...parts }, { level: null, realistic: false, layer: wallRoomStates(bundle({ c1: cs('off') }), d, 1) });
    const on = wallScene({ bundle: bundle({ c1: cs('on') }), geometry: d, ...parts }, { level: null, realistic: false, layer: wallRoomStates(bundle({ c1: cs('on') }), d, 1) });
    expect(off && on).toBeTruthy();
    const count = (s: typeof on, kind: string) => s!.parts.filter((p) => p.kind === kind).length;
    expect(count(on, 'glow')).toBeGreaterThan(count(off, 'glow'));
    expect(on!.parts.some((p) => p.kind === 'wall')).toBe(true);
    for (const kind of ['camera', 'cone', 'entity']) expect(count(on, kind), kind).toBe(0);
    const again = wallScene({ bundle: bundle({ c1: cs('on') }), geometry: d, ...parts }, { level: null, realistic: false, layer: wallRoomStates(bundle({ c1: cs('on') }), d, 1) });
    expect(JSON.stringify(again)).toBe(JSON.stringify(on));
  });

  test('no structure document: no scene', () => {
    expect(wallScene({ bundle: bundle({}), geometry: null, ...parts }, { level: null, realistic: false, layer: null })).toBeNull();
  });
});

test.describe("the wall's own theme column (a dark wall on a light installation)", () => {
  test('themeScope sets the skin table in the wanted column, for every skin; the columns differ where the product does', () => {
    for (const id of SKIN_IDS) {
      const table = skinTable(id);
      for (const col of ['light', 'dark'] as const) {
        const decls = new Map(themeScope(col, id).split(';').map((d) => [d.slice(0, d.indexOf(':')), d.slice(d.indexOf(':') + 1)] as const));
        expect(decls.size, `${id}/${col}`).toBe(Object.keys(table).length);
        for (const name of ['--sw-map-bg', '--sw-surface', '--sw-text', '--sw-accent']) expect(decls.get(name), `${id}/${col} ${name}`).toBe(table[name][col]);
      }
    }
    expect(themeScope('dark', DEFAULT_SKIN)).not.toBe(themeScope('light', DEFAULT_SKIN));
    expect(TOKENS['--sw-map-bg'].light).not.toBe(TOKENS['--sw-map-bg'].dark); // the plan's backdrop really is theme dependent
    expect(themeScope('dark', DEFAULT_SKIN)).toBe(themeScope('dark', DEFAULT_SKIN)); // cached: the same string
  });

  test('skinOf reads data-skin and falls back to the default skin', () => {
    const el = (v: string | null) => ({ getAttribute: () => v });
    expect(skinOf(el('bubble'))).toBe('bubble');
    expect(skinOf(el('crystal'))).toBe('crystal');
    expect(skinOf(el('nope'))).toBe(DEFAULT_SKIN);
    expect(skinOf(el(null))).toBe(DEFAULT_SKIN);
  });
});
