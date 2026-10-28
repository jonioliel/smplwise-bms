import { test, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installGeneratorMock } from './generator-mocks';
import { LONG_HE, MIXED, UNBREAK } from './breakui-worst';

// R5-MEDIA-ENERGY-297 shoot harness, not a test (skipped without R5_OUT): every screen of the media / energy group through the mocked API
// boundary or the static demo mode, every selectable skin, light + dark, desktop 1440x900 + phone 390x844. Fake data only; no device is touched.
//   R5_OUT=<dir> R5_SCREENS=temp,elev R5_SKINS=classic,domus SW_BASE_URL=http://127.0.0.1:4188/ npx playwright test tests/r5-media-energy-shoot.spec.ts --project=desktop --project=mobile
const OUT = process.env.R5_OUT ?? '';
const SKINS = (process.env.R5_SKINS ?? 'classic,domus,tesla,crystal,infra,soft').split(',');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

interface Screen {
  hash: string;
  /** 'demo' = the static preview answers (multimedia + electricity have in-memory demos); 'infra' = the generator mock + temperature + elevator routes */
  mode: 'demo' | 'infra';
  /** a click to open a dialog / drawer, after the page settled (selectors pierce the open shadow roots) */
  click?: string[];
  worst?: boolean;
  fullPage?: boolean;
}

export const SCREENS: Record<string, Screen> = {
  'mm-screens': { hash: '/multimedia/screens', mode: 'demo' },
  'mm-screens-edit': { hash: '/multimedia/screens?edit=1', mode: 'demo' },
  'mm-remote': { hash: '/multimedia/screens?remote=md-living', mode: 'demo' },
  'mm-players': { hash: '/multimedia/players', mode: 'demo' },
  'mm-player': { hash: '/multimedia/players?player=mp-per', mode: 'demo' },
  'mm-groups': { hash: '/multimedia/groups', mode: 'demo' },
  'sys-mm': { hash: '/system/multimedia', mode: 'demo', fullPage: true },
  'el-meters': { hash: '/infra/electricity/meters', mode: 'demo' },
  'el-meter': { hash: '/infra/electricity/meters?meter=m1', mode: 'demo' },
  'el-add': { hash: '/infra/electricity/meters?add=1', mode: 'demo' },
  'el-accounts': { hash: '/infra/electricity/accounts', mode: 'demo' },
  'el-account': { hash: '/infra/electricity/accounts/a1', mode: 'demo' },
  'el-bills': { hash: '/infra/electricity/bills', mode: 'demo' },
  'el-bill': { hash: '/infra/electricity/bills/b104', mode: 'demo' },
  'el-customers': { hash: '/infra/electricity/customers', mode: 'demo' },
  'el-wizard': { hash: '/infra/electricity/accounts/new', mode: 'demo' },
  'sys-prices': { hash: '/system/infra/prices', mode: 'demo' },
  'sys-calendar': { hash: '/system/infra/calendar', mode: 'demo' },
  'sys-business': { hash: '/system/infra/business', mode: 'demo' },
  'sys-retention': { hash: '/system/infra/retention', mode: 'demo' },
  temp: { hash: '/infra/temperature', mode: 'infra' },
  'temp-worst': { hash: '/infra/temperature', mode: 'infra', worst: true },
  'temp-detail': { hash: '/infra/temperature?unit=u3', mode: 'infra' },
  'temp-log': { hash: '/infra/temperature/log', mode: 'infra' },
  'temp-wizard': { hash: '/infra/temperature?unit=u3', mode: 'infra', click: ['temp-detail [data-temp-detail-edit]'] },
  'temp-report': { hash: '/infra/temperature?unit=u3', mode: 'infra', click: ['temp-detail [data-temp-report]'] },
  elev: { hash: '/infra/elevators', mode: 'infra' },
  'elev-worst': { hash: '/infra/elevators', mode: 'infra', worst: true },
  'elev-history': { hash: '/infra/elevators', mode: 'infra', click: ['infra-elevators .hbtn'] },
  'sys-elev': { hash: '/system/infra/elevators', mode: 'infra' },
  'sys-temp': { hash: '/system/infra/temperature', mode: 'infra' },
};
const WANT = (process.env.R5_SCREENS ?? Object.keys(SCREENS).join(',')).split(',');

// ---------------------------------------------------------------------------------------------------- the infra data (fake, deterministic)
const NOW_S = Math.floor(Date.now() / 1000);
const iso = (minAgo: number) => new Date((NOW_S - minAgo * 60) * 1000).toISOString();
const RULES = { warn_on_excursion: true, high_alarm: true, high_alarm_min: 10, low_alarm: true, low_alarm_min: 15, door_alarm: true, door_alarm_min: 10, offline_warn: true, offline_min: 15,
  quiet_enabled: false, quiet_from: '23:00', quiet_to: '06:00', exclude_defrost_stats: true, setpoint_tolerance: 2, alert_when_off: false, learn_min_repeats: 3, learn_days: 7 };

function series(seed: number, low: number, high: number, opts: { defrost?: boolean; rise?: number; offlineMin?: number; sp?: number } = {}) {
  const mid = (low + high) / 2;
  const amp = (high - low) / 2;
  const pts: (number | null)[][] = [];
  const defrost: [number, number][] = [];
  for (let k = 0; k <= 288; k++) {
    const t = NOW_S - 86400 + k * 300;
    let v = mid + Math.sin((t / 3600) * ((2 * Math.PI) / 2.5) + seed) * amp * 0.35 + ((Math.sin(k * 12.9898 + seed) * 43758.5453) % 1) * 0.3;
    const h = (((t / 3600) % 6) + 6) % 6;
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
function units(worst = false) {
  const list = [
    unit('u1', 'מקרר מטבח', 'מטבח · קומה 0', 'fridge', 2, 6, 4.1, 'ok'),
    unit('u2', 'מקפיא תפעולי', 'מחסן · קומה −1', 'freezer', -22, -16, -18.4, 'ok', {
      defrost: { mode: 'learn', in_window: false, next_at: new Date((NOW_S + 4800) * 1000).toISOString(), state: 'learned', days: 7, windows: [{ start_min: 175, minutes: 40, status: 'confirmed', repeats: 7 }] },
    }, series(23, -22, -16, { defrost: true })),
    unit('u3', 'חדר קירור בשר', 'מטבח · קומה −1', 'coldroom', 0, 4, 6.8, 'alarm', {
      door: { open: true, since: iso(14), sensor_name: 'דלת חדר קירור בשר' },
      events: [ev('e1', 'u3', 'high', 'alarm', 9, 6.8, 4), ev('e2', 'u3', 'door', 'alarm', 14, null, 10)],
    }),
    unit('u4', 'חדר שרתים', 'משרדים · קומה 2', 'server', 19, 23, 24.6, 'warning', {
      source: 'climate', band_mode: 'setpoint', door: null, hvac: { setpoint: 21, setpoint_low: null, setpoint_high: null, hvac_mode: 'cool', hvac_action: 'cooling' },
      events: [ev('e3', 'u4', 'high', 'warning', 6, 24.6, 23)],
    }, series(41, 18, 24, { rise: 2.6, sp: 21 })),
    unit('u5', 'מקרר תרופות', 'מרפאה · קומה 1', 'pharma', 2, 8, null, 'offline', {
      door: { open: null, since: null, sensor_name: 'דלת מקרר תרופות' }, updated_at: iso(42), events: [ev('e4', 'u5', 'offline', 'warning', 42, 5.2, null)],
    }, series(53, 2, 8, { offlineMin: 42 })),
  ];
  if (!worst) return list;
  const names = [LONG_HE, UNBREAK, MIXED, 'ב'.repeat(60), 'Freezer 2 · מקפיא'];
  return [...list, ...list].map((u, i) => ({ ...u, id: `u${i + 1}`, name: names[i % names.length], area_name: i % 2 ? LONG_HE : u.area_name, value: i === 2 ? 12345.6 : u.value, stats_24h: { ...u.stats_24h, out_min: 99999, alarms: 1234 } }));
}
const LOG = (list: ReturnType<typeof units>) => [ev('e1', 'u3', 'high', 'alarm', 9, 6.8, 4), ev('e2', 'u3', 'door', 'alarm', 14, null, 10), ev('e3', 'u4', 'high', 'warning', 6, 24.6, 23),
  ev('e5', 'u3', 'high', 'warning', 260, 4.2, 4, false), ev('e4', 'u5', 'offline', 'warning', 42, 5.2, null), ev('e6', 'u2', 'defrost', 'info', 131, -12.1, -16, false),
  ev('e7', 'u1', 'ack', 'info', 258, null, null, false, { ack_by_name: 'יוני', ack_at: iso(258) })].map((e) => ({ ...e, unit_name: list.find((u) => u.id === e.unit_id)?.name ?? '' }));

const NOW = '2026-10-18T09:00:00Z';
const ROLES = ['fault', 'fire_service', 'out_of_service', 'waiting'];
const live = (state: string) => ({
  state, reason: state, partial: false, stale: false, since: state === 'unknown' ? null : NOW, roles: ROLES, extras: [],
  flags: { fault: state === 'fault', fire_service: state === 'fire_service', out_of_service: state === 'out_of_service', waiting: state === 'waiting' },
  history: [{ state: 'waiting', from: '2026-10-17T09:00:00Z', to: '2026-10-18T06:00:00Z' }, { state, from: '2026-10-18T06:00:00Z', to: NOW }],
});
function elevators(worst = false) {
  const list = [
    { id: 'e1', name: 'מעלית צפונית', area_id: null, area_name: 'לובי', ...live('active') },
    { id: 'e2', name: 'מעלית דרומית', area_id: null, area_name: 'לובי', ...live('fault') },
    { id: 'e4', name: 'מעלית משא', area_id: null, area_name: 'בניין B', ...live('out_of_service') },
    { id: 'e5', name: 'מעלית דרום', area_id: null, area_name: 'בניין A', ...live('fire_service') },
    { id: 'e3', name: 'מעלית שירות', area_id: null, area_name: null, ...live('unknown') },
  ];
  if (!worst) return list;
  const names = [LONG_HE, UNBREAK, MIXED, 'ב'.repeat(60), 'Lift B2 · מעלית'];
  return [...list, ...list].map((e, i) => ({ ...e, id: `e${i + 1}`, name: names[i % names.length], area_name: i % 2 ? LONG_HE : e.area_name }));
}

async function installInfra(page: Page, worst: boolean) {
  await installGeneratorMock(page, { perms: ['devices.read', 'infra.temperature.manage', 'infra.temperature.ack', 'infra.elevators.manage', 'system.configure', 'energy.view', 'energy.manage', 'energy.bills'], count: 0 });
  const list = units(worst);
  await page.route('**/api/v1/infra/temperature**', async (route) => {
    const u = new URL(route.request().url());
    const p = u.pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'infra/temperature') return json(route, { units: list, summary: {}, stale: false, at: new Date().toISOString(), can_manage: true, can_ack: true });
    if (p === 'infra/temperature/events') return json(route, { events: LOG(list), total: 7 });
    if (p === 'infra/temperature/manage') {
      return json(route, { units: [], defaults: { ...RULES, defrost_hard_margin: 5, retention_days: 400 }, rule_specs: {}, kinds: ['fridge', 'freezer', 'coldroom', 'pharma', 'server', 'room'],
        templates: { fridge: [2, 6], freezer: [-22, -16], pharma: [2, 8], server: [18, 24], coldroom: [0, 4] }, areas: [{ area_id: 'a1', name: 'מטבח', floor_name: 'קומה 0' }, { area_id: 'a2', name: 'לובי', floor_name: 'קומה 0' }] });
    }
    if (p === 'infra/temperature/candidates') {
      return json(route, { items: [{ entity_id: 'sensor.bar_fridge_temp', name: 'טמפרטורה מקרר בר קפה', area_name: 'לובי', device_class: 'temperature', value: 5.6, state: null, group: 'sensor', setpoint: null, hvac_mode: null },
        { entity_id: 'binary_sensor.bar_fridge_door', name: 'דלת מקרר בר קפה', area_name: 'לובי', device_class: 'door', value: null, state: 'off', group: 'door', setpoint: null, hvac_mode: null }] });
    }
    if (p === 'infra/temperature/report/preview') {
      const ids = (u.searchParams.get('units') ?? '').split(',');
      const us = list.filter((x) => ids.includes(x.id)).map((x) => ({ id: x.id, name: x.name, area: x.area_name, low: x.low, high: x.high, band_mode: x.band_mode, tolerance: 2, source: x.source,
        sensor: x.temp_sensor_name, door: x.door?.sensor_name ?? null, excl_defrost: true, stats: x.stats_24h, points: x.spark.map((q) => [q[0], q[1], q[2] ?? null]), doors: x.doors_24h,
        defrost: x.defrost_24h, events: [], events_more: 0, has_data: true }));
      return json(route, { v: 1, lang: 'he', from: NOW_S - 86400, to: NOW_S, zone: 'Asia/Jerusalem', generated: NOW_S, units: us, chart: true, events: true, signature: { mode: 'line' },
        digest: '3f9a1c0d5e7b2a4c'.repeat(4), range_text: '19.10.2026 13:42 – 20.10.2026 13:42', filename: 'temperature-report-20261020.pdf', layout: 'standard', samples: false, text_summary: 'Arx · דוח טמפרטורות' });
    }
    if (p === 'infra/temperature/report/recipients') return json(route, { users: [{ id: 'p1', name: 'יוני אוליאל', reach: 'ok', selectable: true }], vendors: [], send_hours: { from: '08:00', to: '20:00' }, attachment: 'none', attachment_modes: ['none'] });
    if (p === 'infra/temperature/report/schedules') return json(route, { schedules: [] });
    if (p === 'infra/temperature/settings') return json(route, { rules: { ...RULES, defrost_hard_margin: 5, retention_days: 400 }, code_defaults: {}, row_version: 1, rule_specs: {} });
    if (p === 'infra/temperature/alerts') return json(route, { kinds: {}, row_version: 1, roles: [], channels: [], kinds_order: [], can_edit: true });
    const m = /^infra\/temperature\/([^/]+)\/history$/.exec(p);
    if (m) {
      const x = list.find((y) => y.id === m[1]) ?? list[0];
      return json(route, { from: NOW_S - 86400, to: NOW_S, step: 300, source: 'raw', points: x.spark.map((q) => [q[0], q[1], q[1], q[1], 0, q[2] ?? null]), low: x.low, high: x.high, doors: x.doors_24h, defrost: x.defrost_24h, stats: x.stats_24h, zone: 'Asia/Jerusalem' });
    }
    if (/\/explain$/.test(p)) return json(route, { unit_id: 'u3', event_id: 'e1', kind: 'high', started_at: iso(9), ended_at: null, peak: 6.8, factors: [{ key: 'door', score: 92, vars: { count: 2, total_min: 7.5, lead_min: 12, open_at_start: true } }], primary: 'door', confidence: 'high', reason: null, profile: { rate_h: 5.2, duration_min: 9, ongoing: true }, generated_at: iso(0) });
    return json(route, { code: 'unit_not_found', user_message: 'היחידה לא נמצאה.', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  const el = elevators(worst);
  await page.route('**/api/v1/infra/elevators**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'infra/elevators') return json(route, { elevators: el, summary: {}, stale: false, at: NOW });
    if (p === 'infra/elevators/manage') return json(route, { roles: [], max_extras: 4, elevators: el.map((e, i) => ({ ...e, enabled: true, sort_order: i, revision: 1, extras: [], sensors: { fault: { entity_id: `binary_sensor.${e.id}_fault`, entity_name: `${e.name} תקלה`, missing: false } } })) });
    if (p === 'infra/elevators/candidates') return json(route, { items: [{ entity_id: 'binary_sensor.e1_fault', name: 'מעלית צפונית תקלה', device_class: 'problem', area_name: 'לובי' }] });
    return json(route, { code: 'elevator_not_found', user_message: 'המעלית לא נמצאה.', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
}

/** Finds the first element matching `sel` through every open shadow root and clicks it. */
async function deepClick(page: Page, sel: string): Promise<boolean> {
  return page.evaluate((s) => {
    const walk = (root: ParentNode): Element | null => {
      const hit = root.querySelector(s);
      if (hit) return hit;
      for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { const h = walk(el.shadowRoot); if (h) return h; }
      return null;
    };
    const hit = walk(document) as HTMLElement | null;
    if (!hit) return false;
    hit.click();
    return true;
  }, sel);
}

test.describe('R5 media / energy shoot', () => {
  test.skip(!OUT, 'R5_OUT not set');
  test.setTimeout(240_000);
  for (const id of WANT) for (const skin of SKINS) for (const scheme of ['light', 'dark'] as const) {
    test(`${id} ${skin} ${scheme}`, async ({ page }, info) => {
      const s = SCREENS[id];
      const vp = info.project.name === 'mobile' ? 'phone' : 'desktop';
      fs.mkdirSync(OUT, { recursive: true });
      if (s.mode === 'infra') await installInfra(page, !!s.worst);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('about:blank');
      await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}#${s.hash}`);
      await page.waitForSelector('sw-app', { state: 'attached' });
      await page.waitForTimeout(2000);
      await page.evaluate(() => document.fonts.ready);
      for (const c of s.click ?? []) {
        const l = page.locator(`sw-app ${c}`).first();
        try {
          await l.waitFor({ state: 'attached', timeout: 10_000 });
          await l.click({ force: true, timeout: 5_000 });
        } catch {
          if (!(await deepClick(page, c))) fs.appendFileSync(path.join(OUT, '_errors.txt'), `${id}-${skin}-${scheme}-${vp}: click ${c} failed\n`);
        }
        await page.waitForTimeout(1000);
      }
      await page.waitForTimeout(400);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await page.screenshot({ path: path.join(OUT, `${id}-${skin}-${scheme}-${vp}.png`), fullPage: !!s.fullPage && vp === 'phone' });
      if (over > 1) fs.appendFileSync(path.join(OUT, '_overflow.txt'), `${id}-${skin}-${scheme}-${vp}: ${over}px\n`);
    });
  }
});
