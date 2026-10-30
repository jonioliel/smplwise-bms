import { test, expect } from '@playwright/test';
import type { TemplateResult } from 'lit';
import type { EmergencyState, Incident, Occurrence, WindowsState } from '../src/api/door-windows';
import { configOf, defaultConfig, resolveWidgets, WIDGET_IDS, WIDGET_NAME, type HomeData, type WidgetItem } from '../src/api/home-config';
import { DOORS_HOME_HREF, doorsHomeView, doorsWidgetAvailable, emergencyEntry, liveIncident, type DoorsWidgetData } from '../src/door-windows/home-widget-model';
import { renderDoors, type DoorsWidgetHost } from '../src/door-windows/home-widget';
import { DWWT_DEV_MARKED, DWWT_KEYS, DWWT_TABLES, dwwt } from '../src/i18n/door-windows-widget';

// DOORWIN2-295: the doors home widget - what it shows from the two server answers, who gets the emergency entry, that it is ABSENT unless the doors
// tab is on and a door is visible, the four languages, and that the card carries no service-request action and no platform name (tickets module off AND on).

const NOW = new Date('2026-11-02T05:00:00Z');
const occ = (over: Partial<Occurrence>): Occurrence => ({
  id: 'o1', door: 's1:1', label: 'כניסה ראשית', rule_id: 'r1', rule_name: 'בוקר', start_at: '2026-11-02T06:00:00Z', end_at: '2026-11-02T09:00:00Z', zone: 'Asia/Jerusalem',
  state: 'armed', tier: 'program', retries: 0, unconfirmed_at: null, last_reason: null, resolution: null, resolved_at: null, ...over,
});
const windows = (occurrences: Occurrence[], extra: Partial<WindowsState> = {}): WindowsState => ({
  enabled: true, tier: 'prepared', go_live_permitted: false, settings: {}, can: { manage: true, cancel: true, configure: false },
  doors: [{ key: 's1:1', station_id: 's1', relay: 1, label: 'כניסה ראשית', station_name: 'לובי', name: 'כניסה', zone: 'Asia/Jerusalem', manage: true, cancel: true, exterior: false }],
  rules: [], occurrences, now: '2026-11-02T05:00:00Z', foreign_paused: [], ...extra,
});
const incident = (over: Partial<Incident> = {}): Incident => ({
  id: 'i1', kind: 'lock_secure', kind_label: 'נעילת כל הדלתות', drill: false, state: 'in_effect', scope_type: 'installation', scope_id: '*', scope_name: 'כל המקום',
  requested_at: '2026-11-02T05:00:00Z', released_at: null, reason: '', counts: { total: 1, ok: 1, failed: 0, unknown: 0 }, first_sent_ms: 10, last_sent_ms: 10, superseded_by: null, ...over,
});
const emergency = (over: Partial<EmergencyState> = {}): EmergencyState => ({ enabled: false, open_enabled: false, hold_ms: 1500, can: { lock: true, open: false }, active: null, home_widget: true, ...over });
const data = (o: Occurrence[] = [], em: EmergencyState | null = emergency(), w: Partial<WindowsState> = {}): DoorsWidgetData => ({ windows: windows(o, w), emergency: em });

test('absent unless the doors tab is on and the viewer sees a door (no ghost)', () => {
  expect(doorsWidgetAvailable(data(), true)).toBe(true);
  expect(doorsWidgetAvailable(data(), false)).toBe(false);                                   // both master switches off: the shipped default
  expect(doorsWidgetAvailable({ windows: null, emergency: null }, true)).toBe(false);          // 403 / not read
  expect(doorsWidgetAvailable({ windows: windows([], { doors: [] }), emergency: null }, true)).toBe(false);
});

test('the emergency entry is only for the holders of an emergency permission, and only when the installation switched it on', () => {
  expect(emergencyEntry(emergency())).toBe(true);
  expect(emergencyEntry(emergency({ can: { lock: false, open: true } }))).toBe(true);
  expect(emergencyEntry(emergency({ can: { lock: false, open: false } }))).toBe(false);
  expect(emergencyEntry(emergency({ home_widget: false }))).toBe(false);
  expect(emergencyEntry(emergency({ home_widget: undefined }))).toBe(false);
  expect(emergencyEntry(null)).toBe(false);
});

test('the headline follows the loudest fact: incident > relock not confirmed > not started > foreign paused > open now > next > none', () => {
  expect(doorsHomeView(data(), NOW).headline).toEqual({ key: 'none', vars: {} });
  const next = doorsHomeView(data([occ({})]), NOW);
  expect(next.headline).toEqual({ key: 'next', vars: { name: 'כניסה ראשית', t: '08:00' } }); // 06:00Z is 08:00 in Jerusalem (UTC+2)
  expect(next.look).toBe('off');
  const open = doorsHomeView(data([occ({ state: 'active', start_at: '2026-11-02T04:00:00Z' })]), NOW);
  expect([open.headline.key, open.look, open.counts.active]).toEqual(['openNow', 'ok', 1]);
  expect(open.rows[0]).toMatchObject({ kind: 'active', time: '11:00' });
  const foreign = doorsHomeView(data([occ({ state: 'active' })], emergency(), { foreign_paused: [{ door: 's1:1', station_id: 's1', relay: 1, label: 'דלת צד', incident_id: 'i1', paused_at: 'x' }] }), NOW);
  expect([foreign.headline.key, foreign.look]).toEqual(['foreign', 'warn']);
  const notStarted = doorsHomeView(data([occ({ state: 'not_started' })]), NOW);
  expect([notStarted.headline.key, notStarted.look]).toEqual(['notStarted', 'warn']);
  const unconfirmed = doorsHomeView(data([occ({ state: 'relock_unconfirmed' }), occ({ id: 'o2', state: 'not_started' })]), NOW);
  expect([unconfirmed.headline.key, unconfirmed.look, unconfirmed.rows[0].kind]).toEqual(['unconfirmed', 'err', 'unconfirmed']);
  const live = doorsHomeView(data([occ({ state: 'relock_unconfirmed' })], emergency({ active: incident() })), NOW);
  expect([live.headline.key, live.look, live.incident?.id]).toEqual(['incident', 'err', 'i1']);
  const drill = doorsHomeView(data([], emergency({ drill: incident({ drill: true }) })), NOW);
  expect(drill.headline.key).toBe('drill');
});

test('a released or finished incident is not live; past and cancelled windows are not "next"', () => {
  expect(liveIncident(emergency({ active: incident({ state: 'released' }) }))).toBeNull();
  expect(liveIncident(emergency({ active: incident({ state: 'in_effect_partial' }) }))?.id).toBe('i1');
  const v = doorsHomeView(data([occ({ state: 'cancelled' }), occ({ id: 'o3', state: 'closed_confirmed' }), occ({ id: 'o4', start_at: '2026-11-02T04:00:00Z', end_at: '2026-11-02T04:30:00Z' })]), NOW);
  expect(v.headline.key).toBe('none');
});

test('times are shown in the door\'s own zone, never a fixed offset', () => {
  const w = windows([occ({ start_at: '2026-07-02T06:00:00Z', end_at: '2026-07-02T09:00:00Z', zone: 'Asia/Jerusalem' })]);
  expect(doorsHomeView({ windows: w, emergency: null }, new Date('2026-07-02T05:00:00Z')).headline.vars).toEqual({ name: 'כניסה ראשית', t: '09:00' }); // summer: UTC+3
});

// ---------------------------------------------------------------- rendering (no DOM: the template's static text and values)

function flat(t: unknown): string {
  if (t === null || t === undefined || typeof t === 'boolean') return '';
  if (typeof t === 'string' || typeof t === 'number') return String(t);
  if (Array.isArray(t)) return t.map(flat).join('');
  const r = t as TemplateResult;
  if (r.strings) return r.strings.reduce((acc, s, i) => acc + s + flat(r.values[i]), '');
  return '';
}
const item = (size: WidgetItem['size']): WidgetItem => ({ id: 'doors', title: 'דלתות', size, avail: 'ok' } as WidgetItem);
const host = (d: DoorsWidgetData, over: Partial<DoorsWidgetHost> = {}): DoorsWidgetHost => ({
  data: d, editing: false, now: NOW, openEmergency: () => undefined, shell: (_it, cls, extra, body) => ({ strings: [`<section class="${cls}" data-tone="${extra.tone}">`, '</section>'], values: [body] } as unknown as TemplateResult), ...over,
});

test('the card: a link to the screen, the emergency button only for a holder, rows by size', () => {
  const d = data([occ({ state: 'relock_unconfirmed' }), occ({ id: 'o2', door: 's1:1', state: 'active', end_at: '2026-11-02T09:00:00Z' })]);
  const small = flat(renderDoors(host(d), item('s')));
  expect(small).toContain(DOORS_HOME_HREF);
  expect(small).toContain('data-home-door-emergency');
  expect(small).not.toContain('data-home-doors-list');
  const med = flat(renderDoors(host(d), item('m')));
  expect(med).toContain('data-home-doors-list');
  expect(med).toContain('data-home-door-row');
  const plain = flat(renderDoors(host(data([occ({})], emergency({ home_widget: false }))), item('m')));
  expect(plain).not.toContain('data-home-door-emergency');
  expect(flat(renderDoors(host(d, { editing: true }), item('s')))).toContain('aria-disabled=');
});

test('no ticket action, no platform name on the card - tickets module off and on, every state', () => {
  const states = [data(), data([occ({ state: 'relock_unconfirmed' })]), data([occ({ state: 'active' })], emergency({ active: incident() })), data([occ({})], emergency({ can: { lock: false, open: true } }))];
  for (const tickets of ['off', 'on']) {
    for (const d of states) {
      for (const size of ['s', 'm', 'l'] as const) {
        const html = flat(renderDoors(host(d), item(size)));
        // the card never consults the tickets module because it offers no service-request action: the same markup with the module off and on
        expect(html, `tickets ${tickets}`).not.toMatch(/ticket|service[-_ ]?request|#\/tickets|קריאת שירות|פתיחת קריאה/i);
        expect(html).not.toMatch(/home assistant|ingress|\bha\b/i);
      }
    }
  }
});

// ---------------------------------------------------------------- the four languages

test('he / en / ar / ru carry the same keys; the Arabic and Russian columns are marked for review', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of DWWT_KEYS) expect(DWWT_TABLES[lang][k], `${lang}.${k}`).toBeTruthy();
  }
  expect([...DWWT_DEV_MARKED]).toEqual(['ar', 'ru']);
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
  for (const k of DWWT_KEYS) for (const lang of ['en', 'ar', 'ru'] as const) expect(placeholders(DWWT_TABLES[lang][k] as string), `${lang}.${k}`).toBe(placeholders(DWWT_TABLES.he[k] as string));
});

test('no explaining sentence and no platform name in any language', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of DWWT_KEYS) {
      const s = DWWT_TABLES[lang][k] as string;
      expect(s, `${lang}.${k}`).not.toMatch(/home assistant|ingress|wiskey|ויסקי|הום אסיסטנט|אינטרקום|ticket|service request|קריאת שירות|\.\s+\S/i);
      expect(s.length, `${lang}.${k}`).toBeLessThan(48);
    }
  }
  expect(dwwt('openUntil', { name: 'דלת', t: '17:00' }, 'he')).toBe('דלת · עד 17:00');
  expect(dwwt('next', { name: 'A', t: '08:00' }, 'en')).toBe('Next: A · 08:00');
});

// ---------------------------------------------------------------- the config plumbing

// PRESENCE-2280 (db39f1e7c): the building presence widget is appended after notices, so doors is third from the end now
test('the doors widget is appended last, absent unless offered, and its config is the common one', () => {
  expect(WIDGET_IDS[WIDGET_IDS.length - 3]).toBe('doors');
  expect(WIDGET_NAME.doors).toBe('דלתות');
  const cfg = defaultConfig();
  expect(cfg.order.at(-3)).toBe('doors');
  expect(cfg.doors.on).toBe(true);
  const old = configOf({ order: ['quick', 'clock'] });
  expect(old.order.at(-3)).toBe('doors');
  const hd: HomeData = { weather: null, sensors: {}, alarm: null, forecast: [] } as unknown as HomeData;
  const ids = (o: Parameters<typeof resolveWidgets>[3]) => resolveWidgets(cfg, 'a', hd, o).map((i) => i.id);
  expect(ids({ editing: true })).not.toContain('doors');
  expect(ids({ editing: true, doorsAvailable: false })).not.toContain('doors');
  expect(ids({ doorsAvailable: true })).toContain('doors');
});
