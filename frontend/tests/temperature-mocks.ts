import type { Page, Route } from '@playwright/test';
import { installGeneratorMock } from './generator-mocks';

// A11YFIX-297: the fake temperature units of evidence-temperature.spec.ts (lines 11-91 there, copied with three `export`s; a spec file cannot be
// imported by another spec) and a minimal install, so a contrast probe can open the unit detail in every status. Fake, deterministic data only.
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

export const NOW_S = Math.floor(Date.now() / 1000);
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

export function units() {
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

export const LOG = [ev('e1', 'u3', 'high', 'alarm', 9, 6.8, 4), ev('e2', 'u3', 'door', 'alarm', 14, null, 10), ev('e3', 'u4', 'high', 'warning', 6, 24.6, 23),
  ev('e5', 'u3', 'high', 'warning', 260, 4.2, 4, false), ev('e4', 'u5', 'offline', 'warning', 42, 5.2, null), ev('e6', 'u2', 'defrost', 'info', 131, -12.1, -16, false),
  ev('e7', 'u1', 'ack', 'info', 258, null, null, false, { ack_by_name: 'יוני', ack_at: iso(258) }), ev('e8', 'u1', 'high', 'alarm', 266, 7.4, 6, false, { ack_at: iso(258), ack_by_name: 'יוני' }),
].map((e) => ({ ...e, unit_name: units().find((u) => u.id === e.unit_id)!.name }));

export async function installTemperature(page: Page, list: ReturnType<typeof units>) {
  await installGeneratorMock(page, { perms: ['devices.read', 'infra.temperature.manage', 'infra.temperature.ack', 'system.configure'], count: 0 });
  await page.route('**/api/v1/infra/temperature**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'infra/temperature') return json(route, { units: list, summary: {}, stale: false, at: new Date().toISOString(), can_manage: true, can_ack: true });
    if (p === 'infra/temperature/events') return json(route, { events: LOG, total: LOG.length });
    return json(route, {});
  });
}
