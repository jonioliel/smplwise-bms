import { test, expect } from '@playwright/test';
import { GEN_HOME_HREF, genDeviceHref, genHomeItem, genHomeView, generatorsAvailable, shownGenerators, valuesOf, STATE_KEY, SUPPLY_KEY } from '../src/generator/home-widget-model';
import { GWT_DEV_MARKED, GWT_KEYS, GWT_TABLES, gwt } from '../src/i18n/generator-widget';
import { configOf, defaultConfig, resolveWidgets, WIDGET_IDS, WIDGET_NAME, type HomeData } from '../src/api/home-config';
import { personalOf } from '../src/api/home';
import { INFRA_GENERATOR_HREF } from '../src/shell/nav';
import type { LiveSummaryItem } from '../src/api/generator';

// GENWIDGET 2.9.3: the generator home widget's pure logic - the state of each generator, the site's supply line (mains / generator / no mains /
// unknown) derived like the generator screen's power-flow, the widget gate (no generator = absent), the config plumbing and the strings.

type Sum = LiveSummaryItem['summary'];
const v = (value: number | string | boolean | null, unit = '') => ({ value, unit });
const gen = (id: string, summary: Sum, extra: Partial<LiveSummaryItem> = {}): LiveSummaryItem => ({
  id, name: `גנרטור ${id}`, area_id: null, status: 'detected', availability: 'online', stale: false, open_alerts: 0, open_critical: 0,
  roles: Object.keys(summary), summary, ...extra,
});
// the NMC-like controller: engine state, mains available, the transfer switch
const STANDBY: Sum = { engine_state: v('stopped'), mains_available: v(true), ats_position: v('mains'), fuel_pct: v(92, '%'), load_pct: v(0, '%') };
const RUNNING: Sum = { engine_state: v('running'), mains_available: v(false), ats_position: v('generator'), fuel_pct: v(71, '%'), load_pct: v(48, '%') };

test('normal: engine stopped, mains present -> standby, the site on mains', () => {
  const x = genHomeItem(gen('g1', STANDBY));
  expect([x.state, x.look, x.supply, x.mainsInferred]).toEqual(['standby', 'ok', 'mains', false]);
  expect(x.href).toBe('#/infra/generator/live?device=g1');
  expect(x.fuel).toBe(92);
});

test('running: engine running, transfer switch on the generator -> running, the site on the generator', () => {
  const x = genHomeItem(gen('g1', RUNNING));
  expect([x.state, x.look, x.supply]).toEqual(['running', 'run', 'generator']);
  expect(x.load).toBe(48);
});

test('a running test with the switch still on mains is running but the site stays on mains', () => {
  const x = genHomeItem(gen('g1', { engine_state: v('running'), mains_available: v(true), ats_position: v('mains') }));
  expect([x.state, x.supply]).toEqual(['running', 'mains']);
});

test('fault: an engine fault, or an open CRITICAL alert, is a fault; any other open alert is an alert', () => {
  expect(genHomeItem(gen('g1', { ...STANDBY, engine_state: v('fault') })).state).toBe('fault');
  expect(genHomeItem(gen('g1', STANDBY, { open_alerts: 1, open_critical: 1 })).state).toBe('fault');
  const warn = genHomeItem(gen('g1', STANDBY, { open_alerts: 1, open_critical: 0 }));
  expect([warn.state, warn.look, warn.supply]).toEqual(['alarm', 'warn', 'mains']);
  // a low-fuel alert while running: the chip says alert, the supply line still says the generator
  const runWarn = genHomeItem(gen('g1', RUNNING, { open_alerts: 1 }));
  expect([runWarn.state, runWarn.supply]).toEqual(['alarm', 'generator']);
  // an older server without open_critical: open alerts are still an alert
  const old = genHomeItem(gen('g1', STANDBY, { open_alerts: 2, open_critical: undefined }));
  expect(old.state).toBe('alarm');
});

test('unknown / offline: an offline or stale controller is unknown with an unknown supply', () => {
  for (const availability of ['offline', 'stale'] as const) {
    const x = genHomeItem(gen('g1', STANDBY, { availability, stale: true }));
    expect([x.state, x.look, x.supply]).toEqual(['unknown', 'unk', 'unknown']);
  }
  expect(genHomeItem(gen('g1', { mains_available: v(true) })).state).toBe('unknown'); // no engine state at all
});

test('starting and cooling are their own transitional states', () => {
  const s = genHomeItem(gen('g1', { ...STANDBY, engine_state: v('starting'), mains_available: v(false), ats_position: v('mains') }));
  expect([s.state, s.look, s.supply]).toEqual(['starting', 'trans', 'none']); // mains failed, the generator does not feed yet
  expect(genHomeItem(gen('g1', { ...STANDBY, engine_state: v('cooling') })).state).toBe('cooling');
});

test('mains presence comes from the same roles as the power-flow: voltages, then the mains breaker', () => {
  const byVolts = genHomeItem(gen('g1', { engine_state: v('stopped'), mains_v_l1: v(231, 'V'), mains_v_l2: v(229, 'V') }));
  expect([byVolts.supply, byVolts.mainsInferred]).toEqual(['mains', false]);
  const dead = genHomeItem(gen('g1', { engine_state: v('stopped'), mains_v_l1: v(0, 'V') }));
  expect(dead.supply).toBe('none');
  const breaker = genHomeItem(gen('g1', { engine_state: v('stopped'), mains_breaker_closed: v(true) }));
  expect(breaker.supply).toBe('mains');
});

test('no mains role at all: a stopped engine means the site is on mains (inferred, documented); a running one feeds its load', () => {
  const stopped = genHomeItem(gen('g1', { engine_state: v('stopped') }));
  expect([stopped.supply, stopped.mainsInferred]).toEqual(['mains', true]);
  const running = genHomeItem(gen('g1', { engine_state: v('running') }));
  expect([running.supply, running.mainsInferred]).toEqual(['generator', false]);
  // the running flag alone (no engine_state text) works like the screen
  expect(genHomeItem(gen('g1', { generator_running: v(true) })).state).toBe('running');
  // roles missing from the payload (an older server): the summary keys stand in for the capability set
  expect(genHomeItem(gen('g1', RUNNING, { roles: undefined })).supply).toBe('generator');
});

test('switch roles: supply_source, the on-load flag and load-on-mains decide like the power-flow', () => {
  expect(genHomeItem(gen('g1', { engine_state: v('running'), supply_source: v('generator') })).supply).toBe('generator');
  expect(genHomeItem(gen('g1', { engine_state: v('running'), mains_available: v(true), on_load: v(false) }, { roles: ['engine_state', 'mains_available', 'on_load', 'ats_position'] })).supply).toBe('mains');
});

test('two generators: the loudest first, the site on the generator when any feeds it, the counts', () => {
  const view = genHomeView([gen('a', STANDBY), gen('b', RUNNING)]);
  expect(view.items.map((x) => `${x.id}:${x.state}`)).toEqual(['b:running', 'a:standby']);
  expect([view.supply, view.total, view.running, view.faults]).toEqual(['generator', 2, 1, 0]);
  const withFault = genHomeView([gen('a', STANDBY), gen('b', RUNNING), gen('c', { ...STANDBY, engine_state: v('fault') })]);
  expect(withFault.loudest?.id).toBe('c');
  expect(withFault.faults).toBe(1);
  // equal rank keeps the server's (name) order
  expect(genHomeView([gen('a', STANDBY), gen('b', STANDBY)]).items.map((x) => x.id)).toEqual(['a', 'b']);
  // all unknown -> supply unknown; one says no mains -> no mains
  expect(genHomeView([gen('a', STANDBY, { availability: 'offline' })]).supply).toBe('unknown');
  expect(genHomeView([gen('a', STANDBY), gen('b', { engine_state: v('stopped'), mains_available: v(false) })]).supply).toBe('none');
  // inferred only when every mains generator is inferred
  expect(genHomeView([gen('a', { engine_state: v('stopped') })]).supplyInferred).toBe(true);
  expect(genHomeView([gen('a', { engine_state: v('stopped') }), gen('b', STANDBY)]).supplyInferred).toBe(false);
});

test('the widget gate: none, a partial (still being set up) one, or not read = absent', () => {
  expect(generatorsAvailable([])).toBe(false);
  expect(generatorsAvailable(null)).toBe(false);
  expect(generatorsAvailable([gen('a', STANDBY, { status: 'partial' })])).toBe(false);
  expect(generatorsAvailable([gen('a', STANDBY)])).toBe(true);
  expect(shownGenerators([gen('a', STANDBY, { status: 'partial' }), gen('b', STANDBY)]).map((x) => x.id)).toEqual(['b']);
  expect(genHomeView([]).loudest).toBeNull();
});

test('values: only what the server sent, marked available', () => {
  const vals = valuesOf(gen('g', { fuel_pct: v(50, '%') }));
  expect(vals.fuel_pct).toEqual({ value: 50, unit: '%', available: true, updated_at: null, label: '' });
  expect(valuesOf({ summary: {} } as LiveSummaryItem)).toEqual({});
});

test('links: the widget opens the generator screen (the nav route), a row its generator', () => {
  expect(GEN_HOME_HREF).toBe(INFRA_GENERATOR_HREF);
  expect(genDeviceHref('a b')).toBe('#/infra/generator/live?device=a%20b');
});

test('home config: generators is appended last, has no options, and is absent unless the viewer sees a generator (edit mode too)', () => {
  expect(WIDGET_IDS[WIDGET_IDS.length - 3]).toBe('generators'); // DOORWIN2-295 appended `doors` after it
  expect(WIDGET_NAME.generators).toBe('גנרטור');
  const d = defaultConfig();
  expect(d.order.slice(-6)).toEqual(['elevators', 'temperature', 'generators', 'doors', 'notices', 'presence']);
  expect(d.generators).toEqual({ on: true, sizes: { a: 'm', b: 's', c: 'm' }, label: '', phone_on: null, phone_size: null });
  const old = configOf({ order: ['quick', 'clock'] });
  expect(old.order.slice(-6)).toEqual(['elevators', 'temperature', 'generators', 'doors', 'notices', 'presence']);
  expect(configOf({ generators: { on: false, sizes: { a: 'l' } } }).generators.on).toBe(false);
  const data: HomeData = { weather: null, sensors: {}, alarm: null, forecast: [] } as unknown as HomeData;
  const ids = (o: Parameters<typeof resolveWidgets>[3]) => resolveWidgets(d, 'a', data, o).map((i) => i.id);
  expect(ids({ editing: true })).not.toContain('generators');
  expect(ids({ editing: true, generatorsAvailable: false })).not.toContain('generators');
  expect(ids({ generatorsAvailable: true })).toContain('generators');
  const off = configOf({ generators: { on: false } });
  expect(resolveWidgets(off, 'a', data, { generatorsAvailable: true }).map((i) => i.id)).not.toContain('generators');
  expect(resolveWidgets(off, 'a', data, { generatorsAvailable: true, editing: true }).find((i) => i.id === 'generators')?.avail).toBe('off');
  // the personal choice: on / off and size only
  const p = personalOf({ widgets: { generators: { on: false, size: 'l', mode: 'cards' } } });
  expect(p.widgets.generators).toEqual({ on: false, size: 'l' });
});

test('strings: every key in English, ar / ru dev-marked, every state and supply has words, never the platform name', () => {
  expect(GWT_KEYS.filter((k) => !GWT_TABLES.en[k])).toEqual([]);
  expect(GWT_KEYS.filter((k) => !GWT_TABLES.ar[k])).toEqual([]);
  expect(GWT_KEYS.filter((k) => !GWT_TABLES.ru[k])).toEqual([]);
  expect(GWT_DEV_MARKED).toEqual(['ar', 'ru']);
  for (const k of [...Object.values(STATE_KEY), ...Object.values(SUPPLY_KEY)]) expect(GWT_KEYS).toContain(k);
  expect(gwt('supplyGenerator', undefined, 'he')).toBe('על גנרטור');
  expect(gwt('supplyMains', undefined, 'en')).toBe('On mains');
  expect(gwt('summary', { n: 2 }, 'en')).toBe('2 generators');
  expect(gwt('fuel', { n: 71 }, 'ru')).toBe('Топливо 71%');
  // placeholders survive translation
  for (const lang of ['en', 'ar', 'ru'] as const) {
    for (const k of GWT_KEYS) {
      const want = (GWT_TABLES.he[k]!.match(/\{\w+\}/g) ?? []).sort();
      expect((GWT_TABLES[lang][k]!.match(/\{\w+\}/g) ?? []).sort(), `${lang}.${k}`).toEqual(want);
    }
  }
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const s of Object.values(GWT_TABLES[lang])) expect(s ?? '').not.toMatch(/Home Assistant|\bHA\b|Ingress|WisKey/);
  }
});
