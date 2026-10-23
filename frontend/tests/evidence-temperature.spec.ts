import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, url } from './generator-mocks';

// CR-INFRA-TEMPERATURE 2.9.1 evidence: תשתיות › טמפרטורות (grid, detail, wizard, alert log, empty, stale) from the REAL build against fake data
// (the generator mock layer serves the session; the temperature routes are layered on top). Fake, deterministic data only.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-temperature.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/temperature');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOW_S = Math.floor(Date.now() / 1000);
const iso = (minAgo: number) => new Date((NOW_S - minAgo * 60) * 1000).toISOString();
const RULES = { warn_on_excursion: true, high_alarm: true, high_alarm_min: 10, low_alarm: true, low_alarm_min: 15, door_alarm: true, door_alarm_min: 10, offline_warn: true, offline_min: 15,
  quiet_enabled: false, quiet_from: '23:00', quiet_to: '06:00', exclude_defrost_stats: true, setpoint_tolerance: 2, alert_when_off: false, learn_min_repeats: 3, learn_days: 7 };

function series(seed: number, low: number, high: number, opts: { defrost?: boolean; rise?: number; offlineMin?: number; sp?: number } = {}) {
  const r = rng(seed);
  const mid = (low + high) / 2;
  const amp = (high - low) / 2;
  const pts: (number | null)[][] = [];
  const defrost: [number, number][] = [];
  for (let k = 0; k <= 288; k++) {
    const t = NOW_S - 86400 + k * 300;
    let v = mid + Math.sin((t / 3600) * (2 * Math.PI / 2.5) + seed) * amp * 0.35 + (r() - 0.5) * 0.3;
    const h = ((t / 3600) % 6 + 6) % 6;
    if (opts.defrost && h >= 3 && h < 3.47) v += 4.5 * Math.sin(((h - 3) / 0.47) * Math.PI);
    if (opts.rise && k > 288 - 36) v += opts.rise * ((k - 252) / 36) ** 2;
    if (opts.offlineMin && t > NOW_S - opts.offlineMin * 60) continue;
    pts.push(opts.sp !== undefined ? [t, Math.round(v * 100) / 100, opts.sp] : [t, Math.round(v * 100) / 100]);
  }
  if (opts.defrost) for (let t = NOW_S - 86400 - (NOW_S % 21600) + 10800; t < NOW_S; t += 21600) if (t > NOW_S - 86400) defrost.push([t, t + 1680]);
  return { pts, defrost };
}

function unit(id: string, name: string, area: string, kind: string, low: number, high: number, value: number | null, status: string, extra: Record<string, unknown> = {}, s = series(id.charCodeAt(1), low, high)) {
  return {
    id, name, kind, area_id: null, area_name: area, low, high, hard_max: high + 5, band_mode: 'fixed', source: 'sensor', hvac: null, status, value, value_last: null, updated_at: iso(1),
    trend: status === 'ok' ? 'flat' : 'up', temp_sensor_name: `טמפרטורה ${name}`, door: { open: false, since: iso(38), sensor_name: `דלת ${name}` }, events: [],
    defrost: { mode: 'none', in_window: false, next_at: null, state: 'none', days: 0, windows: [] }, muted_until: null, rules: RULES,
    stats_24h: { min: low + 0.4, max: high + 0.6, avg: (low + high) / 2, out_min: status === 'ok' ? 0 : 40, out_min_raw: status === 'ok' ? 0 : 40, door_opens: 6, door_total_min: 45, door_longest_min: 14, alarms: status === 'alarm' ? 2 : 0, warnings: 1 },
    stale: false, spark: s.pts, doors_24h: [[NOW_S - 30000, NOW_S - 29600], [NOW_S - 12000, NOW_S - 11500]], defrost_24h: s.defrost, ...extra,
  };
}

const ev = (id: string, unitId: string, kind: string, severity: string, minAgo: number, value: number | null, threshold: number | null, open = true, extra: Record<string, unknown> = {}) => ({
  id, unit_id: unitId, kind, severity, started_at: iso(minAgo), warned_at: iso(minAgo), alarmed_at: severity === 'alarm' ? iso(minAgo - 5) : null, ended_at: open ? null : iso(minAgo - 9),
  value, peak: value, threshold, suppressed: null, ack_at: null, ack_by_name: null, notified: true, alarm_at: severity === 'warning' && open ? iso(-4) : null, detail: {}, ...extra,
});

function units() {
  const freezer = series(23, -22, -16, { defrost: true });
  const server = series(41, 18, 24, { rise: 2.6, sp: 21 });
  const med = series(53, 2, 8, { offlineMin: 42 });
  return [
    unit('u1', 'מקרר מטבח', 'מטבח · קומה 0', 'fridge', 2, 6, 4.1, 'ok'),
    unit('u2', 'מקפיא תפעולי', 'מחסן · קומה −1', 'freezer', -22, -16, -18.4, 'ok', {
      defrost: { mode: 'learn', in_window: false, next_at: new Date((NOW_S + 4800) * 1000).toISOString(), state: 'learned', days: 7,
        windows: [{ start_min: 175, minutes: 40, status: 'confirmed', repeats: 7 }, { start_min: 535, minutes: 40, status: 'learned', repeats: 6 }, { start_min: 895, minutes: 40, status: 'learned', repeats: 5 }] },
    }, freezer),
    unit('u3', 'חדר קירור בשר', 'מטבח · קומה −1', 'coldroom', 0, 4, 6.8, 'alarm', {
      door: { open: true, since: iso(14), sensor_name: 'דלת חדר קירור בשר' },
      events: [ev('e1', 'u3', 'high', 'alarm', 9, 6.8, 4), ev('e2', 'u3', 'door', 'alarm', 14, null, 10)],
    }),
    unit('u4', 'חדר שרתים', 'משרדים · קומה 2', 'server', 19, 23, 24.6, 'warning', {
      source: 'climate', band_mode: 'setpoint', door: null, hvac: { setpoint: 21, setpoint_low: null, setpoint_high: null, hvac_mode: 'cool', hvac_action: 'cooling' },
      events: [ev('e3', 'u4', 'high', 'warning', 6, 24.6, 23)],
    }, server),
    unit('u5', 'מקרר תרופות', 'מרפאה · קומה 1', 'pharma', 2, 8, null, 'offline', {
      door: { open: null, since: null, sensor_name: 'דלת מקרר תרופות' }, updated_at: iso(42), events: [ev('e4', 'u5', 'offline', 'warning', 42, 5.2, null)],
    }, med),
  ];
}

const LOG = [ev('e1', 'u3', 'high', 'alarm', 9, 6.8, 4), ev('e2', 'u3', 'door', 'alarm', 14, null, 10), ev('e3', 'u4', 'high', 'warning', 6, 24.6, 23),
  ev('e5', 'u3', 'high', 'warning', 260, 4.2, 4, false), ev('e4', 'u5', 'offline', 'warning', 42, 5.2, null), ev('e6', 'u2', 'defrost', 'info', 131, -12.1, -16, false),
  ev('e7', 'u1', 'ack', 'info', 258, null, null, false, { ack_by_name: 'יוני', ack_at: iso(258) }), ev('e8', 'u1', 'high', 'alarm', 266, 7.4, 6, false, { ack_at: iso(258), ack_by_name: 'יוני' }),
].map((e) => ({ ...e, unit_name: units().find((u) => u.id === e.unit_id)!.name }));

/** TEMPREP-295: what the server does with the range and the samples switch, on top of the base preview. The module is new: a previous-month range holds
 * no sample at all (an honest empty report); a month holds more samples than one PDF carries (the cap), the dialog's preview only the first rows. */
const SAMPLES_CAP = 5000;
function reportVariant(body: Record<string, unknown>, q: URLSearchParams) {
  const empty = q.get('range') === 'prev_month';
  const total = empty ? 0 : q.get('range') === 'month' ? 43_200 : 24;
  const units = (body.units as Record<string, unknown>[]).map((u) => {
    const base = empty ? { ...u, has_data: false, stats: { ...(u.stats as object), min: null, max: null, avg: null, out_min: 0, alarms: 0, warnings: 0, door_opens: 0, door_total_min: 0 }, points: [], doors: [], defrost: [], events: [],
      ...(u.daily ? { daily: (u.daily as Record<string, unknown>[]).map((d) => ({ ...d, min: null, max: null, avg: null, out_min: 0, alarms: 0, coverage: 0, verdict: 'none' })) } : {}) } : { ...u, has_data: true };
    if (q.get('samples') !== '1') return base;
    const shown = Math.min(total, SAMPLES_CAP);
    const rows = Array.from({ length: Math.min(total, 8) }, (_x, i) => [NOW_S - 86400 + i * 60, 4 + (i % 3) * 0.1 + (i === 3 ? 3 : 0), i === 3 ? 8 : i === 5 ? 1 : 0]);
    return { ...base, samples: { rows, total, shown, capped: total > shown, cap: SAMPLES_CAP } };
  });
  return { ...body, units, samples: q.get('samples') === '1', signature: q.get('signature') === '0' ? null : body.signature };
}

async function install(page: Page, list: ReturnType<typeof units>, o: { stale?: boolean; perms?: string[]; tickets?: boolean } = {}) {
  await installGeneratorMock(page, { perms: o.perms ?? ['devices.read', 'infra.temperature.manage', 'infra.temperature.ack', 'system.configure'], count: 0, modules: o.tickets ? { tickets: true } : undefined });
  await page.route('**/api/v1/infra/temperature**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    const shown = o.stale ? list.map((u) => ({ ...u, stale: true, status: 'unknown', value: null, value_last: u.value })) : list;
    if (p === 'infra/temperature') return json(route, { units: shown, summary: {}, stale: !!o.stale, at: new Date().toISOString(), can_manage: true, can_ack: true });
    if (p === 'infra/temperature/events') return json(route, { events: LOG, total: LOG.length });
    if (p === 'infra/temperature/manage') {
      return json(route, { units: [], defaults: { ...RULES, defrost_hard_margin: 5, retention_days: 400 }, rule_specs: {}, kinds: ['fridge', 'freezer', 'coldroom', 'pharma', 'server', 'room'],
        templates: { fridge: [2, 6], freezer: [-22, -16], pharma: [2, 8], server: [18, 24], coldroom: [0, 4] }, areas: [{ area_id: 'a1', name: 'מטבח', floor_name: 'קומה 0' }, { area_id: 'a2', name: 'לובי', floor_name: 'קומה 0' }] });
    }
    if (p === 'infra/temperature/candidates') {
      const kind = new URL(route.request().url()).searchParams.get('kind');
      if (kind === 'power') return json(route, { items: [{ entity_id: 'sensor.bar_fridge_plug_power', name: 'שקע חכם מקרר בר קפה', area_name: 'לובי', device_class: 'power', value: null, state: null, group: 'power', setpoint: null, hvac_mode: null, watts: 96 }] }); // phase 3
      return json(route, kind === 'door'
        ? { items: [{ entity_id: 'binary_sensor.bar_fridge_door', name: 'דלת מקרר בר קפה', area_name: 'לובי', device_class: 'door', value: null, state: 'off', group: 'door', setpoint: null, hvac_mode: null },
          { entity_id: 'binary_sensor.meat_coldroom_door', name: 'דלת חדר קירור בשר', area_name: 'מטבח', device_class: 'door', value: null, state: 'on', group: 'door', setpoint: null, hvac_mode: null }] }
        : { items: [{ entity_id: 'sensor.bar_fridge_temp', name: 'טמפרטורה מקרר בר קפה', area_name: 'לובי', device_class: 'temperature', value: 5.6, state: null, group: 'sensor', setpoint: null, hvac_mode: null },
          { entity_id: 'sensor.wine_cellar_temp', name: 'טמפרטורה מרתף יין', area_name: 'מסעדה', device_class: 'temperature', value: 13.4, state: null, group: 'sensor', setpoint: null, hvac_mode: null },
          { entity_id: 'climate.lobby_ac', name: 'מזגן לובי', area_name: 'לובי', device_class: null, value: 23.4, state: null, group: 'climate', setpoint: 22, hvac_mode: 'cool' }] });
    }
    if (p === 'infra/temperature/report/preview') {
      const ids = (new URL(route.request().url()).searchParams.get('units') ?? '').split(',');
      const us = list.filter((u) => ids.includes(u.id)).map((u) => ({ id: u.id, name: u.name, area: u.area_name, low: u.low, high: u.high, band_mode: u.band_mode, tolerance: 2, source: u.source,
        sensor: u.temp_sensor_name, door: u.door?.sensor_name ?? null, excl_defrost: true, stats: u.stats_24h, points: u.spark.map((q) => [q[0], q[1], q[2] ?? null]), doors: u.doors_24h,
        defrost: u.defrost_24h, events: LOG.filter((e) => e.unit_id === u.id).map((e) => ({ kind: e.kind, severity: e.severity, started_at: e.started_at, ended_at: e.ended_at, value: e.value, peak: e.peak, threshold: e.threshold })), events_more: 0 }));
      const body: Record<string, unknown> = { v: 1, lang: 'he', from: NOW_S - 86400, to: NOW_S, zone: 'Asia/Jerusalem', generated: NOW_S, units: us, chart: true, events: true, signature: { mode: 'line' },
        digest: '3f9a1c0d5e7b2a4c'.repeat(4), range_text: '19.10.2026 13:42 – 20.10.2026 13:42', filename: 'temperature-report-20261020.pdf',
        layout: new URL(route.request().url()).searchParams.get('layout') === 'haccp' ? 'haccp' : 'standard',
        ...(new URL(route.request().url()).searchParams.get('layout') === 'haccp' ? { units: us.map((u, i) => ({ ...u, daily: Array.from({ length: 30 }, (_x, d) => ({
          day: `2026-09-${String(d + 1).padStart(2, '0')}`, min: u.low + 0.3, max: d === 11 + i ? u.high + 2.1 : u.high - 0.2, avg: (u.low + u.high) / 2, out_min: d === 11 + i ? 34 : 0, out_min_raw: d === 11 + i ? 34 : 0,
          alarms: d === 11 + i ? 1 : 0, door_opens: 18, coverage: d === 20 ? 62 : 99.8, verdict: d === 11 + i ? 'exc' : 'ok' })) })) } : {}),
        text_summary: `Arx · דוח טמפרטורות
19.10.2026 13:42 – 20.10.2026 13:42
${us.map((u) => `${u.name}: מינ׳ ${u.stats.min}° · מקס׳ ${u.stats.max}° · מחוץ לטווח ${u.stats.out_min} דק׳ · התראות ${u.stats.alarms + u.stats.warnings}`).join(String.fromCharCode(10))}
הדוח המלא (PDF) זמין במערכת.
הודעה אוטומטית - אין להשיב.` };
      return json(route, reportVariant(body, new URL(route.request().url()).searchParams));
    }
    if (p === 'infra/temperature/report/recipients') {
      return json(route, { users: [{ id: 'p1', name: 'יוני אוליאל', reach: 'ok', selectable: true }, { id: 'p2', name: 'דנה לוי', reach: 'ok', selectable: true },
        { id: 'p3', name: 'משמרת מטבח', reach: 'no_address', selectable: true }, { id: 'p4', name: 'אורי כהן', reach: 'no_consent', selectable: true }],
        vendors: [{ id: 'v1', name: 'קירור הצפון', company: 'קירור הצפון בע"מ', has_phone: true, selectable: false, reason: 'coming_later' }],
        send_hours: { from: '08:00', to: '20:00' }, attachment: 'none', attachment_modes: ['none'] });
    }
    if (p === 'infra/temperature/report/schedules') return json(route, { schedules: [] });
    // phase 3: the ticket dialog's draft and the opened ticket, the maintenance window
    const tk = /^infra\/temperature\/([^/]+)\/ticket(\/draft)?$/.exec(p);
    if (tk && tk[2]) {
      return json(route, { title: 'חדר קירור בשר: טמפרטורה מעל 4°', description: ['יחידה: חדר קירור בשר · אזור: מטבח', 'אירוע: טמפרטורה מעל 4° · מאז 20.10.2026 13:33', 'ערך נוכחי: 6.8° · טווח יעד: 0.0°–4.0°',
        'פרטי היחידה במערכת: #/infra/temperature?unit=u3'].join(String.fromCharCode(10)),
        departments: [{ id: 'dept-maintenance', name: 'אחזקה' }, { id: 'dept-kitchen', name: 'מטבח' }], department_id: 'dept-maintenance', attach_chart: true });
    }
    if (tk) return json(route, { ticket_id: 't-41', number: 41, result: 'created', chart_attached: true }, 201);
    if (/^infra\/temperature\/[^/]+\/maintenance$/.test(p)) return json(route, { maintenance: { until: new Date((NOW_S + 3600) * 1000).toISOString(), reason: 'ניקוי', by_name: 'יוני' } });
    // TEMPEXPLAIN093-295: the rule-based "why?" of an excursion (fake factors)
    const why = /^infra\/temperature\/([^/]+)\/explain$/.exec(p);
    if (why) return json(route, { unit_id: why[1], event_id: new URL(route.request().url()).searchParams.get('event_id'), kind: 'high', started_at: iso(9), ended_at: null, peak: 6.8,
      factors: [{ key: 'door', score: 92, vars: { count: 2, total_min: 7.5, lead_min: 12, open_at_start: true } }, { key: 'local', score: 35, vars: { n_total: 3 } }],
      primary: 'door', confidence: 'high', reason: null, profile: { rate_h: 5.2, duration_min: 9, ongoing: true }, generated_at: iso(0) });
    if (p === 'infra/temperature/settings') return json(route, { rules: { ...RULES, defrost_hard_margin: 5, retention_days: 400 }, code_defaults: {}, row_version: 1, rule_specs: {} });
    if (p === 'infra/temperature/alerts') return json(route, { kinds: {}, row_version: 1, roles: [], channels: [], kinds_order: [], can_edit: true });
    const m = /^infra\/temperature\/([^/]+)\/history$/.exec(p);
    if (m) {
      const u = list.find((x) => x.id === m[1])!;
      return json(route, { from: NOW_S - 86400, to: NOW_S, step: 300, source: 'raw', points: u.spark.map((q) => [q[0], q[1], q[1], q[1], 0, q[2] ?? null]), low: u.low, high: u.high,
        doors: u.doors_24h, defrost: u.defrost_24h, stats: u.stats_24h, zone: 'Asia/Jerusalem' });
    }
    return json(route, { code: 'unit_not_found', user_message: 'היחידה לא נמצאה.', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
}

/** Phase 3 (CR section 11): the same units placed in areas and floors, with sensor health, insights, a projection, a maintenance window, an
 * escalated alarm with its ticket and a smart plug - all fake, deterministic. */
function phase3Units() {
  const okHealth = { battery: 88, battery_low: false, signal: -61, signal_unit: 'dBm', signal_weak: false, age_min: 3, frozen_since: null, issues: [] as string[] };
  const doorOk = { opens: 21, avg_rise: 1.4, max_rise: 2.6, median_recovery_min: 9, unrecovered: 0, slow: false,
    last: [0, 1, 2, 3, 4].map((k) => ({ opened: NOW_S - 3600 * (k + 1), closed: NOW_S - 3600 * (k + 1) + 60, open_min: 1, base: 3.6, peak: 5 + k * 0.2, rise: 1.4 + k * 0.2, recovery_min: 8 + k, interrupted: false })) };
  const days = Array.from({ length: 7 }, (_x, k) => ({ day: `2026-10-${String(13 + k).padStart(2, '0')}`, pct: k < 4 ? 41 + k : 58 + k * 2, minutes: k === 6 ? 700 : 1440 }));
  const place = { kitchen: ['kitchen', 'מטבח', 'f0', 'קומה 0', 0], store: ['store', 'מחסן', 'fm1', 'קומה −1', -1], offices: ['offices', 'משרדים', 'f2', 'קומה 2', 2], clinic: ['clinic', 'מרפאה', 'f1', 'קומה 1', 1] } as const;
  const at = (k: keyof typeof place) => ({ area_id: place[k][0], area_name: place[k][1], floor_id: place[k][2], floor_name: place[k][3], floor_level: place[k][4] });
  const base = units();
  const ins = (door: unknown, duty: unknown = null) => ({ door, duty, computed_at: iso(20) });
  return [
    { ...base[0], ...at('kitchen'), health: okHealth, insights: ins(doorOk), prediction: { side: 'high', threshold: 6, eta_min: 18, rate_h: 4.2 }, power: null, maintenance: null, tickets: [] },
    { ...base[1], ...at('store'), health: { ...okHealth, battery: 14, battery_low: true, issues: ['battery', 'duty'] }, insights: ins({ ...doorOk, opens: 9 }, { recent: 62.7, before: 42.5, rising: true, today: 64, pct_24h: 63.1, days }),
      prediction: null, power: { w: 182, on: true, sensor_name: 'שקע חכם מקפיא' }, maintenance: null, tickets: [] },
    { ...base[2], ...at('kitchen'), events: [ev('e1', 'u3', 'high', 'alarm', 31, 6.8, 4, true, { escalation_level: 1 }), ev('e2', 'u3', 'door', 'alarm', 14, null, 10)],
      health: { ...okHealth, issues: ['recovery'] }, insights: ins({ ...doorOk, median_recovery_min: 47, slow: true }), prediction: null, power: null, maintenance: null,
      tickets: [{ ticket_id: 't-40', number: 40, event_id: 'e9', status: 'in_progress', created_at: iso(2000) }] },
    { ...base[3], ...at('offices'), health: { ...okHealth, battery: null, signal: null, signal_unit: null }, insights: ins(null), prediction: null, power: null, maintenance: null, tickets: [] },
    { ...base[4], ...at('clinic'), health: { ...okHealth, signal: -92, signal_weak: true, issues: ['signal'] }, insights: ins({ ...doorOk, opens: 1, median_recovery_min: null, last: [] }), prediction: null,
      power: null, maintenance: { until: new Date((NOW_S + 2700) * 1000).toISOString(), reason: 'ניקוי שבועי', by_name: 'דנה לוי' }, tickets: [] },
  ];
}

/**
 * TESTDEBT4-295: a full-page screenshot resizes the viewport to the document height and captures; if the layout is still moving at that moment
 * (a font swap, a finishing transition, the shell's late re-render) Chromium answers "Protocol error (Page.captureScreenshot): Unable to capture
 * screenshot" - seen once in the 2.11.1 targeted run on the stale-infrastructure test and never again in isolation. So the page is taken only when
 * it is settled: fonts loaded, no finite animation or transition running, and the document height identical over four consecutive frames.
 * (Bounded by the test timeout; a page that never settles fails loudly instead of being shot mid-move.)
 */
async function shotFull(page: Page, file: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const running = () => document.getAnimations().some((a) => a.playState === 'running' && Number.isFinite(a.effect?.getComputedTiming().endTime as number));
    let last = -1;
    let same = 0;
    while (same < 4) {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const h = document.documentElement.scrollHeight;
      same = h === last && !running() ? same + 1 : 0;
      last = h;
    }
  });
  await page.screenshot({ path: file, fullPage: true });
}

const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test.describe('temperature evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

  for (const scheme of ['light', 'dark'] as const) {
    test(`grid (${scheme})`, async ({ page }) => {
      await install(page, units());
      await page.goto('about:blank');
      await page.goto(url('/infra/temperature', 'classic', scheme));
      const cards = page.locator('sw-app infra-temperature [data-temp-unit]');
      await expect(cards).toHaveCount(5);
      await expect(page.locator('sw-app infra-temperature [data-temp-unit="u3"]')).toHaveAttribute('data-status', 'alarm');
      await expect(page.locator('sw-app infra-temperature [data-temp-unit="u5"]')).toHaveAttribute('data-status', 'offline');
      await expect(page.locator('sw-app infra-temperature [data-temp-kpi="alarm"] b')).toHaveText('1');
      await expect(page.locator('sw-app infra-temperature [data-temp-kpi="door"] b')).toHaveText('1');
      await expect(page.locator('sw-app infra-temperature [data-temp-unit="u4"] [data-chip="setpoint"]')).toBeVisible(); // a climate unit
      await expect(page.locator('sw-app infra-temperature [data-temp-new]')).toHaveCount(0); // add only in page edit mode
      await expect(page.locator('sw-app infra-temperature')).not.toContainText('sensor.'); // no technical ids on the operator screen
      await noOverflow(page);
      await shotFull(page, path.join(OUT, `grid-${test.info().project.name}-${scheme}.png`));
    });
  }

  test('detail of an alarm unit, then the climate unit (expanded)', async ({ page }) => {
    await install(page, units());
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    await page.locator('sw-app infra-temperature [data-temp-unit="u3"]').click();
    const d = page.locator('sw-app infra-temperature temp-detail');
    await expect(d.locator('[data-temp-detail="u3"]')).toBeVisible();
    await expect(d.locator('[data-temp-chart] svg')).toBeVisible();
    await expect(d.locator('[data-temp-ring]')).toBeVisible();
    await expect(d.locator('[data-temp-ack]')).toBeEnabled();
    await page.screenshot({ path: path.join(OUT, `detail-${test.info().project.name}.png`) });
    await d.locator('[data-compare="u4"]').click();
    await expect(d.locator('[data-temp-detail="u4"]')).toBeVisible();
    if (test.info().project.name === 'desktop') await d.locator('[data-temp-wide]').click();
    await expect(d.locator('[data-temp-chart] path.c-sp')).toHaveCount(1); // the setpoint step line
    await page.screenshot({ path: path.join(OUT, `detail-climate-${test.info().project.name}.png`) });
    await page.keyboard.press('Escape');
    await expect(d).toHaveCount(0);
  });

  test('TEMPEXPLAIN093-295: "why?" on an excursion row opens the rule-based explanation', async ({ page }) => {
    await install(page, units());
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    await page.locator('sw-app infra-temperature [data-temp-unit="u3"]').click();
    const d = page.locator('sw-app infra-temperature temp-detail');
    await expect(d.locator('[data-temp-why-btn="e1"]')).toBeVisible();
    await expect(d.locator('[data-temp-why-btn="e2"]')).toHaveCount(0); // a door row has no "why?"
    await d.locator('[data-temp-why-btn="e1"]').click();
    const w = d.locator('temp-explain [data-temp-why="high"]');
    await expect(w).toBeVisible();
    await expect(w.locator('[data-factor="door"][data-primary]')).toContainText('הדלת הייתה פתוחה');
    await expect(w.locator('[data-factor="local"]')).toBeVisible();
    await expect(w).not.toContainText('sensor.');
    await noOverflow(page);
    await page.screenshot({ path: path.join(OUT, `explain-${test.info().project.name}.png`) });
    await w.locator('[data-why-close]').click();
    await expect(d.locator('temp-explain')).toHaveCount(0);
  });

  test('page edit mode and the wizard (four steps)', async ({ page }) => {
    await install(page, units());
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    await page.locator('sw-app').getByRole('button', { name: /תפריט המשתמש/ }).click();
    await page.locator('[data-menu-screen-edit="temperature-edit"]').click();
    await expect(page.locator('sw-app infra-temperature [data-temp-add]')).toBeVisible();
    await shotFull(page, path.join(OUT, `edit-mode-${test.info().project.name}.png`));
    await page.locator('sw-app infra-temperature [data-temp-new]').click();
    const w = page.locator('sw-app infra-temperature temp-wizard');
    await expect(w.locator('[data-grp="climate"]')).toBeVisible(); // sensors AND climate entities, grouped
    await w.locator('[data-temp-list] [data-cand="sensor.bar_fridge_temp"]').click();
    await w.locator('[data-door-list] [data-cand="binary_sensor.bar_fridge_door"]').click();
    await page.screenshot({ path: path.join(OUT, `wizard-1-${test.info().project.name}.png`) });
    await w.locator('[data-w-next]').click();
    await expect(w.locator('[data-rule="door_alarm"]')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `wizard-2-${test.info().project.name}.png`) });
    await w.locator('[data-w-next]').click();
    await expect(w.locator('[data-w-defrost] [data-mode="learn"]')).toHaveAttribute('aria-pressed', 'true'); // learn is the default
    await page.screenshot({ path: path.join(OUT, `wizard-3-${test.info().project.name}.png`) });
    await w.locator('[data-w-next]').click();
    await expect(w.locator('[data-w-summary]')).toContainText('טמפרטורה מקרר בר קפה');
    await page.screenshot({ path: path.join(OUT, `wizard-4-${test.info().project.name}.png`) });
  });

  test('PDF report dialog and the WhatsApp text-summary dialog', async ({ page }) => {
    await install(page, units());
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    await page.locator('sw-app infra-temperature [data-temp-unit="u3"]').click();
    await page.locator('sw-app infra-temperature temp-detail [data-temp-report]').click();
    const r = page.locator('sw-app infra-temperature temp-report');
    await expect(r.locator('[data-rep-paper] .sig')).toBeVisible(); // a signature LINE only
    await expect(r.locator('[data-rep-unit="u3"]')).toBeChecked();
    await page.screenshot({ path: path.join(OUT, `report-${test.info().project.name}.png`) });
    await r.locator('[data-rep-wa]').click();
    const w = page.locator('sw-app infra-temperature temp-wa');
    await expect(w.locator('[data-kind="vendor"] input')).toBeDisabled(); // vendors: coming later
    await w.locator('[data-person="p1"] input').check();
    await w.locator('[data-person="p3"] input').check(); // no number: warned, still selectable
    await expect(w.locator('[data-wa-warn]')).toBeVisible();
    await expect(w.locator('[data-wa-text]')).toContainText('דוח טמפרטורות');
    await page.screenshot({ path: path.join(OUT, `whatsapp-${test.info().project.name}.png`) });
  });

  // TEMPVENDOR-295: vendors in the report dialog - off (the default), on with a channel per vendor, e-mail switched off
  const TV_OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/TEMPVENDOR-295');
  const TV_USERS = [{ id: 'p1', name: 'יוני אוליאל', reach: 'ok', selectable: true }, { id: 'p3', name: 'משמרת מטבח', reach: 'no_address', selectable: true }];
  const tvVendors = (email: boolean) => [
    { id: 'v1', name: 'קירור הצפון', company: 'קירור הצפון בע"מ', has_phone: true, selectable: true, reason: null, channel: 'whatsapp', channels: { whatsapp: 'ok', email: email ? 'ok' : 'reports_email_off' } },
    { id: 'v2', name: 'מיזוג דרום', company: 'מיזוג דרום בע"מ', has_phone: false, selectable: email, reason: email ? null : 'no_whatsapp', channel: 'email',
      channels: { whatsapp: 'no_whatsapp', email: email ? 'ok' : 'reports_email_off' } },
    { id: 'v3', name: 'שירותי קור', company: null, has_phone: false, selectable: false, reason: 'no_whatsapp', channel: 'whatsapp', channels: { whatsapp: 'no_whatsapp', email: 'no_email' } },
  ];
  async function openDialog(page: Page, email: boolean | null) {
    await install(page, units());
    if (email !== null) {
      await page.route('**/api/v1/infra/temperature/report/recipients', (route) => json(route, { users: TV_USERS, vendors: tvVendors(email), send_hours: { from: '07:00', to: '21:00' },
        attachment: 'link', attachment_modes: ['none', 'link'], vendor_reports: { enabled: true, email } }));
      await page.route('**/api/v1/infra/temperature/report/send', (route) => json(route, { batch_id: 'b1', queued: 2, vendors: 2, sends: [
        { id: 's1', name: 'קירור הצפון', kind: 'vendor', channel: 'whatsapp', status: 'handed', reason: null, not_before: iso(0), finished_at: null },
        { id: 's2', name: 'מיזוג דרום', kind: 'vendor', channel: 'email', status: 'skipped', reason: 'no_email', not_before: iso(0), finished_at: iso(0) }] }, 202));
    }
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    await page.locator('sw-app infra-temperature [data-temp-unit="u3"]').click();
    await page.locator('sw-app infra-temperature temp-detail [data-temp-report]').click();
    await page.locator('sw-app infra-temperature temp-report [data-rep-wa]').click();
    const w = page.locator('sw-app infra-temperature temp-wa');
    await expect(w.locator('[data-wa-list] [data-person="p1"]')).toBeVisible();
    return w;
  }

  test('TEMPVENDOR-295: vendors stay disabled while vendor reports are off', async ({ page }) => {
    fs.mkdirSync(TV_OUT, { recursive: true });
    const w = await openDialog(page, null);
    await expect(w.locator('[data-kind="vendor"] input')).toBeDisabled();
    await expect(w.locator('[data-wa-channels]')).toHaveCount(0);
    await page.screenshot({ path: path.join(TV_OUT, `vendors-off-${test.info().project.name}.png`) });
  });

  test('TEMPVENDOR-295: a channel per vendor, the reason when a channel is unavailable, e-mail only when its switch is on', async ({ page }) => {
    fs.mkdirSync(TV_OUT, { recursive: true });
    const w = await openDialog(page, true);
    await expect(w.locator('[data-person="v1"] input')).toBeEnabled();
    await expect(w.locator('[data-person="v3"] input')).toBeDisabled();
    await expect(w.locator('[data-person="v1"] [data-wa-channel]')).toHaveCount(2);
    await expect(w.locator('[data-person="v2"] [data-wa-channel="whatsapp"]')).toBeDisabled(); // no number: the reason is on the button
    await expect(w.locator('[data-person="v2"] [data-wa-channel="email"]')).toHaveAttribute('aria-pressed', 'true'); // started on the first channel that works
    await expect(w.locator('[data-person="v3"] [data-wa-reason]')).toBeVisible();
    await w.locator('[data-person="v1"] input').check();
    await w.locator('[data-person="v1"] [data-wa-channel="email"]').click();
    await expect(w.locator('[data-person="v1"] [data-wa-channel="email"]')).toHaveAttribute('aria-pressed', 'true');
    await w.locator('[data-person="v2"] input').check();
    await page.screenshot({ path: path.join(TV_OUT, `vendors-on-${test.info().project.name}.png`) });
    const sent = page.waitForRequest((r) => r.url().endsWith('/report/send') && r.method() === 'POST');
    await w.locator('[data-wa-send]').click();
    const body = (await sent).postDataJSON();
    expect(body.recipients).toEqual([{ kind: 'vendor', id: 'v1', channel: 'email' }, { kind: 'vendor', id: 'v2', channel: 'email' }]);
    await expect(w.locator('[data-wa-status]')).toContainText('הועבר לתור ההודעות');
    await expect(w.locator('[data-wa-status]')).toContainText('אין כתובת דוא״ל לספק');
    await page.screenshot({ path: path.join(TV_OUT, `vendors-sent-${test.info().project.name}.png`) });
  });

  test('TEMPVENDOR-295: with the e-mail switch off only WhatsApp is offered', async ({ page }) => {
    fs.mkdirSync(TV_OUT, { recursive: true });
    const w = await openDialog(page, false);
    await expect(w.locator('[data-person="v1"] [data-wa-channel]')).toHaveCount(1);
    await expect(w.locator('[data-person="v1"] [data-wa-channel="whatsapp"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(w.locator('[data-person="v2"] input')).toBeDisabled(); // its only usable channel is e-mail, which is off
    await expect(w.locator('[data-person="v2"] [data-wa-reason]')).toBeVisible();
    await page.screenshot({ path: path.join(TV_OUT, `vendors-email-off-${test.info().project.name}.png`) });
  });

  test('alert log', async ({ page }) => {
    await install(page, units());
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature/log'));
    await expect(page.locator('sw-app temp-log [data-temp-log-table] tbody tr')).toHaveCount(LOG.length);
    await expect(page.locator('sw-app temp-log [data-temp-csv]')).toBeVisible();
    await noOverflow(page);
    await shotFull(page, path.join(OUT, `log-${test.info().project.name}.png`));
  });

  test('stale infrastructure: grey values, a banner, nothing claimed healthy', async ({ page }) => {
    await install(page, units(), { stale: true });
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    await expect(page.locator('sw-app infra-temperature [data-temp-stale]')).toBeVisible();
    await expect(page.locator('sw-app infra-temperature [data-temp-kpi="ok"] b')).toHaveText('0');
    await shotFull(page, path.join(OUT, `stale-${test.info().project.name}.png`));
  });

  test('empty: a manager sees the hint; edit mode offers the first unit', async ({ page }) => {
    await install(page, []);
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    await expect(page.locator('sw-app infra-temperature [data-state="empty"]')).toBeVisible();
    await expect(page.locator('sw-app infra-temperature [data-temp-add-first]')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, `empty-${test.info().project.name}.png`) });
  });

  test('phase 3: the grid grouped by area and floor, the floor filter and the sensor-health tile', async ({ page }) => {
    await install(page, phase3Units() as never);
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    const s = page.locator('sw-app infra-temperature');
    await expect(s.locator('[data-temp-group]')).toHaveCount(4);
    await expect(s.locator('[data-temp-group="store"] .ghead small')).toContainText('קומה −1');
    await expect(s.locator('[data-temp-kpi="health"] b')).toHaveText('2'); // a low battery and a weak signal
    await expect(s.locator('[data-temp-unit="u1"] [data-chip="predict"]')).toBeVisible();
    await expect(s.locator('[data-temp-unit="u5"] [data-chip="maint"]')).toBeVisible();
    await expect(s.locator('[data-temp-unit="u3"] [data-chip="esc-e1"]')).toBeVisible();
    await noOverflow(page);
    await shotFull(page, path.join(OUT, `p3-grid-groups-${test.info().project.name}.png`));
    await s.locator('[data-temp-floor="fm1"]').click();
    await expect(s.locator('[data-temp-unit]')).toHaveCount(1);
    await s.locator('[data-temp-floor=""]').click();
    await s.locator('[data-temp-group-toggle="kitchen"]').click();
    await expect(s.locator('[data-temp-group="kitchen"] [data-temp-unit]')).toHaveCount(0);
    await s.locator('[data-temp-group-toggle="kitchen"]').click();
  });

  test('phase 3: the detail panels - health, duty cycle, door correlation, maintenance, comparison', async ({ page }) => {
    await install(page, phase3Units() as never);
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    await page.locator('sw-app infra-temperature [data-temp-unit="u2"]').click();
    const d = page.locator('sw-app infra-temperature temp-detail');
    if (test.info().project.name === 'desktop') await d.locator('[data-temp-wide]').click();
    await expect(d.locator('[data-temp-health]')).toContainText('14%');
    await expect(d.locator('[data-temp-duty]')).toHaveAttribute('data-rising', 'true');
    await expect(d.locator('[data-temp-doorfx]')).toBeVisible();
    await expect(d).not.toContainText('sensor.');
    await page.screenshot({ path: path.join(OUT, `p3-detail-${test.info().project.name}.png`) });
    await d.locator('[data-temp-maint]').click();
    await expect(d.locator('[data-temp-maintpop]')).toBeVisible();
    await d.locator('[data-maint-reason]').fill('ניקוי');
    await page.screenshot({ path: path.join(OUT, `p3-maintenance-${test.info().project.name}.png`) });
    await page.keyboard.press('Escape');
    await d.locator('[data-cmp-pick="u1"]').check();
    await d.locator('[data-cmp-pick="u3"]').check();
    await expect(d.locator('[data-temp-chart] path.c-ov')).toHaveCount(2);
    await d.locator('[data-cmp-scale="norm"]').click();
    await expect(d.locator('[data-cmp-pick="u4"]')).toBeDisabled(); // at most 2 more units
    await d.locator('[data-temp-chart]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `p3-compare-${test.info().project.name}.png`) });
  });

  test('phase 3: a service ticket from the alarm (draft, chart, opened)', async ({ page }) => {
    await install(page, phase3Units() as never, { tickets: true }); // TICKGATE-295: the ticket actions exist only while the tickets module is on
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    await page.locator('sw-app infra-temperature [data-temp-unit="u3"]').click();
    const d = page.locator('sw-app infra-temperature temp-detail');
    await expect(d.locator('[data-temp-tickets] [data-ticket-link="t-40"]')).toBeVisible(); // the two-way link
    await d.locator('[data-temp-ticket-btn]').click();
    const t = d.locator('temp-ticket');
    await expect(t.locator('[data-ticket-dept]')).toHaveValue('dept-maintenance');
    await expect(t.locator('[data-ticket-chart]')).toBeChecked();
    await page.screenshot({ path: path.join(OUT, `p3-ticket-${test.info().project.name}.png`) });
    await t.locator('[data-ticket-open]').click();
    await expect(page.locator('sw-app infra-temperature .toast')).toContainText('#41');
  });

  test('phase 3: the HACCP compliance report (daily table)', async ({ page }) => {
    await install(page, phase3Units() as never);
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    await page.locator('sw-app infra-temperature [data-temp-unit="u3"]').click();
    await page.locator('sw-app infra-temperature temp-detail [data-temp-report]').click();
    const r = page.locator('sw-app infra-temperature temp-report');
    await r.locator('[data-rep-layout-btn="haccp"]').click();
    await expect(r.locator('[data-rep-daily] tbody tr[data-verdict]')).toHaveCount(8);
    await expect(r.locator('[data-rep-paper] .sig > div')).toHaveCount(3); // manager name, signature, date
    await page.screenshot({ path: path.join(OUT, `p3-report-haccp-${test.info().project.name}.png`) });
  });

  // TEMPREP-295: the report dialog - the type switches freely both ways, an empty range is a plain state, the "every sample" switch.
  async function openReport(page: Page) {
    await install(page, phase3Units() as never);
    const asked: URL[] = [];
    page.on('request', (r) => { if (r.url().includes('/report/preview')) asked.push(new URL(r.url())); });
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    await page.locator('sw-app infra-temperature [data-temp-unit="u3"]').click();
    await page.locator('sw-app infra-temperature temp-detail [data-temp-report]').click();
    const r = page.locator('sw-app infra-temperature temp-report');
    await expect(r.locator('[data-rep-paper] .sig')).toBeVisible();
    return { r, asked };
  }
  const pressed = (r: ReturnType<Page['locator']>, sel: string) => r.locator(sel).getAttribute('aria-pressed');

  test('TEMPREP-295: the report type switches both ways and gives back the range and the signature it changed', async ({ page }) => {
    const { r, asked } = await openReport(page);
    const sig = r.locator('[data-rep-sig]');
    await sig.uncheck();
    await expect(r.locator('[data-rep-paper] .sig')).toHaveCount(0);
    for (let round = 0; round < 2; round++) { // back and forth, twice
      await r.locator('[data-rep-layout-btn="haccp"]').click();
      await expect(r.locator('[data-rep-daily] tbody tr[data-verdict]')).toHaveCount(8);
      await expect(r.locator('[data-rep-paper] h3')).toContainText('HACCP');
      expect(await pressed(r, '[data-rep-range="month"]')).toBe('true'); // the month so far: it has data, last month may not
      expect(await pressed(r, '[data-rep-range="24h"]')).toBe('false');
      await expect(sig).toBeChecked(); // a compliance report always has the signature line
      await expect(r.locator('[data-rep-paper] .sig > div')).toHaveCount(3);
      await r.locator('[data-rep-layout-btn="standard"]').click();
      await expect(r.locator('[data-rep-daily]')).toHaveCount(0);
      await expect(r.locator('[data-rep-paper] h3')).not.toContainText('HACCP');
      expect(await pressed(r, '[data-rep-layout-btn="standard"]')).toBe('true');
      expect(await pressed(r, '[data-rep-range="24h"]')).toBe('true'); // what HACCP changed is given back
      await expect(sig).not.toBeChecked();
      await expect(r.locator('[data-rep-paper] .sig')).toHaveCount(0);
    }
    const last = asked[asked.length - 1];
    expect(last.searchParams.get('layout')).toBeNull();
    expect(last.searchParams.get('range')).toBe('24h');
    expect(asked.some((u) => u.searchParams.get('layout') === 'haccp' && u.searchParams.get('range') === 'month')).toBe(true);
  });

  test('TEMPREP-295: a range the user chose inside HACCP is kept when he goes back to the regular report', async ({ page }) => {
    const { r } = await openReport(page);
    await r.locator('[data-rep-layout-btn="haccp"]').click();
    await r.locator('[data-rep-range="prev_week"]').click();
    await r.locator('[data-rep-layout-btn="standard"]').click();
    expect(await pressed(r, '[data-rep-range="prev_week"]')).toBe('true');
    await expect(r.locator('[data-rep-paper] h3')).not.toContainText('HACCP');
  });

  test('TEMPREP-295: a range with no data is one plain state for both types, never a table of dashes', async ({ page }) => {
    const { r } = await openReport(page);
    await r.locator('[data-rep-range="prev_month"]').click();
    const empty = r.locator('[data-rep-paper] [data-rep-empty]');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('אין נתונים בטווח הזה');
    await expect(r.locator('[data-rep-paper] .st')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, `temprep-empty-${test.info().project.name}.png`) });
    await r.locator('[data-rep-layout-btn="haccp"]').click();
    await expect(empty).toBeVisible();
    await expect(r.locator('[data-rep-daily]')).toHaveCount(0);
    await expect(r.locator('[data-rep-paper] .foot')).toContainText('sha256'); // still a signed, dated document
    await expect(r.locator('[data-rep-export]')).toBeEnabled();
    await r.locator('[data-rep-layout-btn="standard"]').click();
    await r.locator('[data-rep-range="24h"]').click();
    await expect(r.locator('[data-rep-paper] [data-rep-empty]')).toHaveCount(0);
    await expect(r.locator('[data-rep-paper] .st')).toBeVisible();
  });

  test('TEMPREP-295: the "every sample" switch - off by default, a preview, the size guard, both types, in the export', async ({ page }) => {
    const { r, asked } = await openReport(page);
    const sw = r.locator('[data-rep-samples]');
    await expect(sw).not.toBeChecked();
    await expect(r.locator('[data-rep-samples-block]')).toHaveCount(0);
    expect(asked.every((u) => u.searchParams.get('samples') === null)).toBe(true);
    await sw.check();
    await expect(r.locator('[data-rep-samples-table] tbody tr[data-out]')).toHaveCount(1);
    await expect(r.locator('[data-rep-samples-table] tbody tr').first()).toContainText('4°');
    await expect(r.locator('[data-rep-samples-block]')).toContainText('24');
    await expect(r.locator('[data-rep-samples-cap]')).toHaveCount(0); // 24 samples: nothing capped
    expect(asked[asked.length - 1].searchParams.get('samples')).toBe('1');
    await r.locator('[data-rep-range="month"]').click(); // 43,200 samples: the PDF lists the first 5,000 and says so; the preview holds eight rows
    await expect(r.locator('[data-rep-samples-cap]')).toContainText('5000');
    await expect(r.locator('[data-rep-samples-cap]')).toContainText('43200');
    expect(await r.locator('[data-rep-samples-table] tbody tr').count()).toBeLessThanOrEqual(9);
    await r.locator('[data-rep-layout-btn="haccp"]').click(); // available for the compliance type too, with its signature line
    await expect(r.locator('[data-rep-samples-table]')).toBeVisible();
    await expect(r.locator('[data-rep-daily]')).toBeVisible();
    await expect(r.locator('[data-rep-paper] .sig > div')).toHaveCount(3);
    await r.locator('[data-rep-samples-block]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `temprep-samples-${test.info().project.name}.png`) });
    const pdf = page.waitForRequest((q) => q.url().includes('/report.pdf'));
    await page.route('**/api/v1/infra/temperature/report.pdf**', (route) => route.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'Content-Disposition': 'attachment; filename="temperature-haccp-20261021.pdf"' }, body: '%PDF-1.7 fake' }));
    await r.locator('[data-rep-export]').click();
    const q = new URL((await pdf).url()).searchParams;
    expect(q.get('samples')).toBe('1');
    expect(q.get('layout')).toBe('haccp');
    await sw.uncheck();
    await expect(r.locator('[data-rep-samples-block]')).toHaveCount(0);
    expect(asked[asked.length - 1].searchParams.get('samples')).toBeNull();
    if (test.info().project.name === 'mobile') { // 44px targets on a phone only
      for (const sel of ['[data-rep-samples]', '[data-rep-sig]', '[data-rep-layout-btn="haccp"]', '[data-rep-range="month"]']) {
        const box = await (sel.startsWith('[data-rep-samples') || sel === '[data-rep-sig]' ? r.locator(sel).locator('xpath=..') : r.locator(sel)).boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(43.5);
      }
    }
  });

  test('TEMPREP-295: a custom range goes to the server as the installation\'s local time (no browser offset)', async ({ page }) => {
    const { r, asked } = await openReport(page);
    await r.locator('[data-rep-range="custom"]').click();
    await r.locator('[data-rep-from]').fill('2026-10-01T00:00');
    await r.locator('[data-rep-from]').dispatchEvent('change');
    await r.locator('[data-rep-to]').fill('2026-10-21T00:00');
    await r.locator('[data-rep-to]').dispatchEvent('change');
    await expect.poll(() => asked.some((u) => u.searchParams.get('from') === '2026-10-01T00:00' && u.searchParams.get('to') === '2026-10-21T00:00')).toBe(true);
  });

  // owner 2026-10-20 (TEMPFIX): the detail drawer shows friendly sensor names only and never scrolls sideways, whatever the name lengths.
  const LONG_HE = 'טמפרטורה חדר קירור קרוב לדלת האחורית של המטבח המרכזי ליד מחסן הירקות הקפואים בקומת המרתף';
  const LONG_EN = 'ShellyPlusUni-A0DD6C4B8E54-Temperature-Cold-Room-Near-The-Back-Door-Of-The-Main-Kitchen-Unbroken-String-Without-Spaces';
  const RAW = /(^|[\s(])(sensor|binary_sensor|climate|switch)\.[a-z0-9_]+/;
  for (const scheme of ['light', 'dark'] as const) {
    test(`the drawer: friendly names only, no horizontal overflow at 390 / 768 / 1024 / 1440 (${scheme})`, async ({ page }) => {
      test.skip(test.info().project.name !== 'desktop', 'sets its own viewports');
      test.setTimeout(240_000);
      const list = phase3Units().map((u) => u.id === 'u2' ? {
        ...u, name: `${LONG_HE} - מקפיא`, temp_sensor_name: LONG_EN, door: { open: false, since: iso(38), sensor_name: LONG_HE },
        power: { w: 182, on: true, sensor_name: LONG_EN },
        temp_entity_id: 'sensor.shellyplusuni_a0dd6c4b8e54_tmprtvrt_khdr_qyrvr_temperature', door_entity_id: 'binary_sensor.shellyplusuni_a0dd6c4b8e54_input_0', power_entity_id: 'switch.shellyplusuni_a0dd6c4b8e54_power',
      } : u);
      await install(page, list as never);
      await page.goto('about:blank');
      for (const width of [390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(url('/infra/temperature', 'classic', scheme));
        await page.locator('sw-app infra-temperature [data-temp-unit="u2"]').click();
        const d = page.locator('sw-app infra-temperature temp-detail');
        await expect(d.locator('[data-temp-detail="u2"]')).toBeVisible();
        await expect(d.locator('[data-temp-chart] svg')).toBeVisible();
        for (const wide of width >= 768 ? [false, true] : [false]) {
          if (wide) await d.locator('[data-temp-wide]').click();
          const m = await d.evaluate((host) => {
            const root = (host as HTMLElement).shadowRoot!;
            const drawer = root.querySelector('.drawer') as HTMLElement;
            const body = root.querySelector('.db') as HTMLElement;
            const dr = drawer.getBoundingClientRect();
            const clipped = Array.from(root.querySelectorAll('.drawer *')).filter((el) => {
              const r = el.getBoundingClientRect();
              if (!r.width || el.closest('svg')) return false;
              const dir = getComputedStyle(drawer).direction;
              return dir === 'rtl' ? r.left < dr.left - 1 || r.right > dr.right + 1 : r.left < dr.left - 1 || r.right > dr.right + 1;
            }).map((el) => el.className || el.tagName).slice(0, 5);
            const texts: string[] = [];
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push((n.textContent ?? '').trim());
            const attrs = Array.from(root.querySelectorAll('[title],[aria-label],[data-cand]')).flatMap((el) => [el.getAttribute('title') ?? '', el.getAttribute('aria-label') ?? '']);
            return { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, drawer: drawer.scrollWidth - drawer.clientWidth, body: body.scrollWidth - body.clientWidth, clipped,
              text: texts.concat(attrs).filter(Boolean) };
          });
          expect(m.doc, `document scrollWidth @${width}${wide ? ' wide' : ''}`).toBeLessThanOrEqual(1);
          expect(m.drawer, `drawer scrollWidth @${width}${wide ? ' wide' : ''}`).toBeLessThanOrEqual(1);
          expect(m.body, `drawer body scrollWidth @${width}${wide ? ' wide' : ''}`).toBeLessThanOrEqual(1);
          expect(m.clipped, `children outside the drawer @${width}${wide ? ' wide' : ''}`).toEqual([]);
          expect(m.text.filter((t) => RAW.test(t) || /^(sensor|binary_sensor|climate|switch)\./.test(t))).toEqual([]);
          expect(await d.getByText(LONG_EN).count()).toBeGreaterThan(0); // the friendly name is there
          if (scheme === 'light' && !process.env.SW_NO_SHOTS) await page.screenshot({ path: path.join(OUT, `drawer-longnames-${width}${wide ? '-wide' : ''}.png`) });
        }
        await page.keyboard.press('Escape');
        await expect(d).toHaveCount(0);
      }
    });
  }
  test('TICKGATE-295: tickets module OFF - the drawer offers no service request and no linked tickets', async ({ page }) => {
    await install(page, phase3Units() as never); // no modules.tickets in the session = the module is off
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    await page.locator('sw-app infra-temperature [data-temp-unit="u3"]').click();
    const d = page.locator('sw-app infra-temperature temp-detail');
    await expect(d.locator('[data-temp-detail="u3"]')).toBeVisible();
    await expect(d.locator('[data-temp-ack]')).toBeEnabled(); // the rest of the drawer is as before
    await expect(d.locator('[data-temp-ticket-btn]')).toHaveCount(0);
    await expect(d.locator('[data-temp-tickets]')).toHaveCount(0);
    await expect(d.locator('[data-ticket-link]')).toHaveCount(0);
    await expect(d.locator('temp-ticket')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, `tickets-off-drawer-${test.info().project.name}.png`) });
  });
});
