import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { DeviceAreaDetail, DeviceRow, DeviceTree, EntityRow } from '../src/api/devices';
import type { HaPush, HaSyncState } from '../src/api/ha';
import {
  areaEntityIds, areaIndex, findArea, fitStep, gridsKey, jsonClone, Memo2, NO_EXTRA, ReloadThrottle, routeDevicePush, rowIndexOf, sensorValueText, withConnected, type TimerEnv,
} from '../src/screens/devices-shared';

// CR-G1-HOME-AREA-2440 (code review 06, rows CR-HOME-MEMO and CR-AREA-LAYOUT): the home screen, the home widgets, the area quick sheet,
// the area screen and the layout controller. Node only: the shared pieces (devices-shared.ts) are run; how the Lit screens use them is
// checked in their source, as the other screen guards do (unit-fe-nits-2442, unit-home-reload-2436) - the screens need a browser to run.
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const DB = src('screens/devices-building.ts');
const HW = src('screens/home-widgets.ts');
const QS = src('screens/area-quick-sheet.ts');
const DA = src('screens/devices-area.ts');
const DL = src('screens/devices-layout.ts');

/** The body of a class member from its header to the next closing brace at the member indent (two spaces). */
function member(code: string, head: RegExp): string {
  const m = head.exec(code);
  if (!m) throw new Error(`member not found: ${head}`);
  const end = code.indexOf('\n  }\n', m.index);
  expect(end, `${head}: end`).toBeGreaterThan(m.index);
  return code.slice(m.index, end + 4);
}

function fakeTimers() {
  let now = 0;
  let seq = 0;
  const due = new Map<number, { at: number; run: () => void }>();
  const env: TimerEnv = {
    set: (run, ms) => {
      seq += 1;
      due.set(seq, { at: now + ms, run });
      return seq;
    },
    clear: (h) => void due.delete(h),
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const next = [...due.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      due.delete(next[0]);
      now = next[1].at;
      next[1].run();
    }
    now = end;
  };
  return { env, advance, pending: () => due.size };
}

const row = (id: string, extra: Partial<DeviceRow> = {}): DeviceRow => ({ entity_id: id, name: id, ...extra }) as DeviceRow;
const detail = (cards: Partial<Record<string, string[]>>): DeviceAreaDetail =>
  ({ area: { area_id: 'a1', name: 'A', icon: null, floor_id: null, floor_name: null, level: null }, floor_areas: [], cards: Object.fromEntries(Object.entries(cards).map(([k, ids]) => [k, { id: k, label: k, entities: (ids ?? []).map((i) => row(i)) }])) }) as unknown as DeviceAreaDetail;

// ------------------------------------------------------------------------------------------------ devices-shared.ts

test.describe('devices-shared: the fit step (06:DUP-10)', () => {
  const over = () => true;
  const fits = () => false;
  test('a changed key restarts a packed screen from 0; an unchanged one steps tighter while it overflows, at most to 2', () => {
    expect(fitStep(2, 'k2', 'k1', over)).toEqual({ fit: 0, lastKey: 'k2', settled: false });
    expect(fitStep(0, 'k2', 'k1', over)).toEqual({ fit: 1, lastKey: 'k2', settled: false }); // already loosest: measured at once
    expect(fitStep(1, 'k', 'k', over)).toEqual({ fit: 2, lastKey: 'k', settled: false });
    expect(fitStep(2, 'k', 'k', over)).toEqual({ fit: 2, lastKey: 'k', settled: true });
    expect(fitStep(1, 'k', 'k', fits)).toEqual({ fit: 1, lastKey: 'k', settled: true });
  });
  test('the overflow is not measured on a restart', () => {
    let reads = 0;
    fitStep(1, 'b', 'a', () => (reads++, true));
    expect(reads).toBe(0);
  });
});

test.describe('devices-shared: the refetch throttle (06:DUP-10)', () => {
  test('the first push opens the window, the others ride it; it never starves while pushes keep coming', () => {
    const t = fakeTimers();
    let runs = 0;
    const r = new ReloadThrottle(400, () => runs++, t.env);
    for (let i = 0; i < 50; i++) {
      r.schedule();
      t.advance(40);
    }
    expect(runs).toBeGreaterThanOrEqual(4); // 2 s of pushes, a 400 ms window
    expect(runs).toBeLessThanOrEqual(6);
    t.advance(1_000);
    expect(r.pending).toBe(false);
  });
  test('cancel drops the booked run and the throttle works again afterwards', () => {
    const t = fakeTimers();
    let runs = 0;
    const r = new ReloadThrottle(400, () => runs++, t.env);
    r.schedule();
    expect(r.pending).toBe(true);
    r.cancel();
    expect(t.pending()).toBe(0);
    t.advance(1_000);
    expect(runs).toBe(0);
    r.schedule();
    t.advance(400);
    expect(runs).toBe(1);
  });
});

test.describe('devices-shared: push routing and lookups', () => {
  test('each push kind reaches its handler; a missing handler ignores it', () => {
    const seen: string[] = [];
    const sync = { connected: true } as HaSyncState;
    const h = { entity: (id: string) => seen.push(`e:${id}`), structure: () => seen.push('s'), connected: (c: boolean) => seen.push(`c:${c}`), heartbeat: (s: HaSyncState) => seen.push(`h:${s === sync}`) };
    routeDevicePush({ type: 'entity_state_changed', entity: { entity_id: 'light.a' } } as HaPush, h);
    routeDevicePush({ type: 'structure_changed', reason: 'x', last_registry_at: null }, h);
    routeDevicePush({ type: 'ha_sync_state', connected: false }, h);
    routeDevicePush({ type: 'heartbeat', sync }, h);
    routeDevicePush({ type: 'schedules_changed' }, h);
    routeDevicePush({ type: 'heartbeat', sync }, {});
    expect(seen).toEqual(['e:light.a', 's', 'c:false', 'h:true']);
    expect(withConnected(null, true)).toBeNull();
    expect(withConnected(sync, false)).toEqual({ connected: false });
  });

  test('areaIndex is built once per tree and keeps the first area of an id (as find() did)', () => {
    const a1 = { area_id: 'x', name: 'first' };
    const a2 = { area_id: 'x', name: 'second' };
    const tree = { floors: [{ floor_id: 'f1', areas: [a1] }, { floor_id: 'f2', areas: [a2, { area_id: 'y', name: 'y' }] }] } as unknown as DeviceTree;
    expect(areaIndex(tree)).toBe(areaIndex(tree));
    expect(findArea(tree, 'x')?.name).toBe('first');
    expect(findArea(tree, 'y')?.name).toBe('y');
    expect(findArea(tree, 'none')).toBeUndefined();
    expect(findArea(null, 'x')).toBeUndefined();
  });

  test('the row index and the id set: a missing card is skipped, extra rows come after the area\'s own, one build per input pair', () => {
    const d = detail({ lighting: ['light.a'], sensors: ['sensor.t'] });
    const extra = new Map<string, EntityRow>([
      ['light.a', { ...row('light.a'), card: 'switches' } as EntityRow],
      ['switch.far', { ...row('switch.far'), card: 'switches' } as EntityRow],
    ]);
    const idx = rowIndexOf(d, extra);
    expect([...idx.keys()]).toEqual(['light.a', 'sensor.t', 'switch.far']);
    expect(idx.get('light.a')!.card).toBe('lighting'); // the area's own row wins
    expect(idx.get('switch.far')!.card).toBe('switches');
    expect(rowIndexOf(null, extra).size).toBe(0);
    expect([...areaEntityIds(d, extra)].sort()).toEqual(['light.a', 'sensor.t', 'switch.far']);
    expect(areaEntityIds(null, extra).size).toBe(0);
    let builds = 0;
    const memo = new Memo2((a: DeviceAreaDetail | null, b: ReadonlyMap<string, EntityRow>) => (builds++, rowIndexOf(a, b)));
    const first = memo.get(d, NO_EXTRA);
    expect(memo.get(d, NO_EXTRA)).toBe(first);
    expect(builds).toBe(1);
    memo.get(d, extra);
    memo.get(detail({ lighting: ['light.a'] }), extra);
    expect(builds).toBe(3);
  });
});

test.describe('devices-shared: text, keys and copies', () => {
  test('sensorValueText draws what each screen drew before (spaced, or tight before ° and %)', () => {
    // the expressions the three screens carried, kept here as the reference
    const old = (v: number, unit: string | null, tight: boolean) => `‎${Number.isInteger(v) ? v : v.toFixed(1)}${unit ? (tight && (unit.startsWith('°') || unit === '%') ? unit : ` ${unit}`) : ''}`;
    for (const [v, u] of [[21.46, '°C'], [40, '%'], [3, 'kWh'], [0.05, null], [12, ''], [-1.25, 'lx']] as [number, string | null][]) {
      expect(sensorValueText(v, u, 'spaced')).toBe(old(v, u, false));
      expect(sensorValueText(v, u, 'tight')).toBe(old(v, u, true));
    }
    expect(sensorValueText(21.46, '°C', 'tight')).toBe('‎21.5°C');
    expect(sensorValueText(3, 'kWh', 'tight')).toBe('‎3 kWh');
  });

  test('gridsKey changes with an id, a key or the order; jsonClone drops undefined as JSON does', () => {
    const g = [{ id: 'cards', keys: ['card:a', 'card:b'] }];
    expect(gridsKey(g)).toBe(gridsKey([{ id: 'cards', keys: ['card:a', 'card:b'] }]));
    expect(gridsKey(g)).not.toBe(gridsKey([{ id: 'cards', keys: ['card:b', 'card:a'] }]));
    expect(gridsKey(g)).not.toBe(gridsKey([{ id: 'other', keys: ['card:a', 'card:b'] }]));
    const v = { a: 1, b: undefined, c: { d: [1, 2] } };
    const c = jsonClone(v);
    expect(c).toEqual({ a: 1, c: { d: [1, 2] } });
    expect('b' in c).toBe(false);
    expect(c.c).not.toBe(v.c);
  });
});

// ------------------------------------------------------------------------------------------------ CR-HOME-MEMO (source guards)

test.describe('CR-HOME-MEMO: the home screen and its widgets', () => {
  test('PERF-6: no 15 s ticker re-renders the home screen; the refresh tooltip is written on hover / focus', () => {
    expect(DB).not.toMatch(/this\.tick\b/);
    expect(DB).not.toContain('tickTimer');
    // the one 15 s interval left is the quiet stale check: it redraws only when the dot has to change, and never while the page is hidden
    expect(DB.match(/setInterval\(/g)?.length).toBe(1);
    expect(DB).toContain('this.staleTimer = window.setInterval(this.checkStale, 15_000);');
    expect(DB).toMatch(/private checkStale = \(\) => \{\s*if \(!document\.hidden && this\.isStale\(\) !== this\.stale\) this\.stale = !this\.stale;\s*\};/);
    expect(member(DB, /\n {2}disconnectedCallback\(/)).toContain('window.clearInterval(this.staleTimer);');
    expect(member(DB, /\n {2}private renderRefresh\(/)).toContain('const stale = this.stale;');
    const refresh = member(DB, /\n  private renderRefresh\(/);
    expect(refresh).toMatch(/@pointerenter=\$\{this\.refreshHover\} @focusin=\$\{this\.refreshHover\}/);
    expect(refresh).toContain('label=${this.refreshTip(stale)}');
    expect(DB).toMatch(/private refreshHover = \(e: Event\) => \{[\s\S]{0,300}btn\.setAttribute\('label', tip\)/);
  });

  test('RENDER-1: the render no longer writes the site level, the scope fields or the "used" flags, nor starts the cross-section read', () => {
    const render = member(DB, /\n {2}render\(\) \{/);
    expect(render).not.toContain('this.ensureLevel(');
    expect(render).not.toMatch(/this\.(kpiTag|ctlBuilding|atSiteLevel|scopeAreas) = /);
    expect(render).toContain('const { site, inBuilding } = this.scope;');
    const will = member(DB, /\n {2}protected willUpdate\(/);
    expect(will).toContain('this.syncScope();');
    expect(will).toContain('void this.loadXsCatalog()');
    expect(will).toContain('if (this.panel) this.panelUsed = true;');
    expect(will).toContain('if (this.quick) this.quickUsed = true;');
    expect(member(DB, /\n {2}private syncScope\(/)).toContain('this.ensureLevel(site);');
    expect(member(DB, /\n {2}private xsOffered\(/)).not.toContain('loadXsCatalog');
    expect(member(DB, /\n {2}private renderTilesPanel\(/)).not.toContain('this.panelUsed = true');
    expect(member(DB, /\n {2}private renderQuickSheet\(/)).not.toContain('this.quickUsed = true');
  });

  test('DUP-10: the home screen uses the shared throttle, fit step, push routing, area index and copies', () => {
    expect(member(DB, /\n {2}private scheduleReload\(/)).toContain('this.reloads.schedule();');
    expect(DB).toContain('new ReloadThrottle(REFRESH_WINDOW_MS, () => void this.reloadTree())');
    expect(member(DB, /\n {2}disconnectedCallback\(/)).toContain('this.reloads.cancel();');
    expect(DB).toContain('fitStep(this.fit, key, this.fitKey,');
    expect(DB).toContain('routeDevicePush(m, {');
    expect(DB).not.toContain('JSON.parse(JSON.stringify(');
    expect(DB).not.toMatch(/floors\.flatMap\(\(f\) => f\.areas\)\.find\(/);
    // the five helpers the area screen used to import from here are still exported (one place: devices-shared.ts)
    expect(DB).toContain('export { alarmTone, FIT_MIN_WIDTH, REFRESH_WINDOW_MS, scrollParentOf, STRUCTURE_FLASH_MS };');
    expect(DB).not.toMatch(/export (function|const) (alarmTone|FIT_MIN_WIDTH|REFRESH_WINDOW_MS|scrollParentOf|STRUCTURE_FLASH_MS)\b/);
  });

  test('home widgets: the empty band hides its host in willUpdate; the launcher names map is kept per names object', () => {
    const render = member(HW, /\n {2}render\(\) \{/);
    expect(render).not.toContain('toggleAttribute');
    expect(member(HW, /\n {2}protected willUpdate\(/)).toContain("this.toggleAttribute('hidden', !this.items.length)");
    expect(HW).not.toContain('new Map(Object.entries(this.data.names');
    expect(HW).toContain('renderLauncher(this.bv1, it, this.launchSt, this.launcherNames(),');
  });

  test('the quick sheet: shared throttle, push routing, id set, sensor text and presence names', () => {
    expect(QS).toContain('new ReloadThrottle(SHEET_RELOAD_WINDOW_MS, () => void this.reloadQuiet())');
    expect(member(QS, /\n {2}private stopLive\(/)).toContain('this.reloads.cancel();');
    expect(member(QS, /\n {2}private get entityIds\(/)).toContain('this.idsMemo.get(this.detail, NO_EXTRA)');
    expect(QS).toContain("sensorValueText(r.value, r.unit, 'spaced')");
    expect(member(QS, /\n {2}private renderPresenceLine\(/)).toContain('const who = presenceWho(v);');
  });

  test('the loading skeleton blocks are one shared CSS fragment', () => {
    expect(src('screens/devices-building-css.ts')).toContain('${SKELETON_CSS}');
    expect(DA).toContain('${SKELETON_CSS}');
    expect(src('screens/devices-building-css.ts')).not.toContain('@keyframes skl-shine');
    expect(DA).not.toContain('@keyframes skl-shine');
    expect(src('screens/devices-shared.ts')).toContain('@keyframes skl-shine');
  });
});

// ------------------------------------------------------------------------------------------------ CR-AREA-LAYOUT (source guards)

test.describe('CR-AREA-LAYOUT: the area screen and the layout controller', () => {
  test('DUP-10: the area screen no longer imports the home module', () => {
    expect(DA).not.toMatch(/from '\.\/devices-building'/);
    expect(DA).toMatch(/from '\.\/devices-shared'/);
    expect(DA).not.toContain('Number.isInteger(r.value) ? r.value : r.value.toFixed(1)');
    expect(DA).toContain("sensorValueText(r.value, r.unit, 'tight')");
    expect(DA).toContain("sensorValueText(r.value, r.unit, 'spaced')");
    expect(member(DA, /\n {2}private scheduleReload\(/)).toContain('this.reloads.schedule();');
    expect(DA).toContain('routeDevicePush(m, {');
  });

  test('PERF-6: the row index and the push filter are memoised on the detail and the extra rows', () => {
    expect(member(DA, /\n {2}private rowIndex\(/)).toContain('this.rowsMemo.get(this.detail, this.extra)');
    expect(member(DA, /\n {2}private get entityIds\(/)).toContain('this.idsMemo.get(this.detail, this.extra)');
  });

  test('DA-1: another area resets every per-area state in one place', () => {
    expect(member(DA, /\n {2}protected willUpdate\(/)).toContain('this.resetAreaState();');
    const reset = member(DA, /\n {2}private resetAreaState\(/);
    for (const f of ['detail = null', 'presence = null', 'quick = null', 'sheet = null', 'assigning = null', 'assignAreas = null', 'mediaCount = new Map()', 'sensOpen = new Set()', 'extra = new Map()', "extraKey = ''", 'bandPage = 0'])
      expect(reset, f).toContain(`this.${f}`);
  });

  test('RACE-7: the failure paths check the id after the await, as the success paths did', () => {
    const load = member(DA, /\n {2}private async load\(/);
    expect(load).toMatch(/catch \(err\) \{[\s\S]{0,300}if \(id !== this\.areaId\) return;/);
    const extra = member(DA, /\n {2}private async loadExtra\(/);
    expect(extra).toMatch(/const r = await getEntityRows\(want\);\s*if \(area !== this\.areaId\) return;/);
    expect(extra).toMatch(/\} catch \{\s*if \(area !== this\.areaId\) return;/);
    const lay = member(DL, /\n {2}async load\(/);
    expect(lay).toMatch(/\} catch \{[\s\S]{0,300}if \(this\.opts\.id\(\) !== id\) return;/);
  });

  test('PERF-6: prepare() rebuilds the view only when one of its inputs changed; the dirty check serialises a draft once', () => {
    const prep = member(DL, /\n {2}prepare\(grids: LayoutGrid\[\]\) \{/);
    expect(prep).toContain('const gk = gridsKey(grids);');
    expect(prep).toMatch(/if \(p && p\.grids === gk && p\.editing === this\.editing && p\.draft === this\.draft && p\.record === this\.record && p\.variant === variant && p\.compact === compact\) return;/);
    // the tile-card check runs on every call (it reacts to a structure refresh), before the memo
    expect(prep.indexOf('this.tileCard && !this.gridOf.has(this.tileCard)')).toBeLessThan(prep.indexOf('const p = this.prepKey;'));
    const dirty = member(DL, /\n {2}private get layoutDirty\(/);
    expect(dirty).toMatch(/if \(m && m\.draft === d && m\.base === this\.base\) return m\.out;/);
    expect(DL).not.toContain('JSON.parse(JSON.stringify(');
  });
});
