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

async function install(page: Page, list: ReturnType<typeof units>, o: { stale?: boolean; perms?: string[] } = {}) {
  await installGeneratorMock(page, { perms: o.perms ?? ['devices.read', 'infra.temperature.manage', 'infra.temperature.ack', 'system.configure'], count: 0 });
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
      return json(route, { v: 1, lang: 'he', from: NOW_S - 86400, to: NOW_S, zone: 'Asia/Jerusalem', generated: NOW_S, units: us, chart: true, events: true, signature: { mode: 'line' },
        digest: '3f9a1c0d5e7b2a4c'.repeat(4), range_text: '19.10.2026 13:42 – 20.10.2026 13:42', filename: 'temperature-report-20261020.pdf',
        text_summary: `Arx · דוח טמפרטורות
19.10.2026 13:42 – 20.10.2026 13:42
${us.map((u) => `${u.name}: מינ׳ ${u.stats.min}° · מקס׳ ${u.stats.max}° · מחוץ לטווח ${u.stats.out_min} דק׳ · התראות ${u.stats.alarms + u.stats.warnings}`).join(String.fromCharCode(10))}
הדוח המלא (PDF) זמין במערכת.
הודעה אוטומטית - אין להשיב.` });
    }
    if (p === 'infra/temperature/report/recipients') {
      return json(route, { users: [{ id: 'p1', name: 'יוני אוליאל', reach: 'ok', selectable: true }, { id: 'p2', name: 'דנה לוי', reach: 'ok', selectable: true },
        { id: 'p3', name: 'משמרת מטבח', reach: 'no_address', selectable: true }, { id: 'p4', name: 'אורי כהן', reach: 'no_consent', selectable: true }],
        vendors: [{ id: 'v1', name: 'קירור הצפון', company: 'קירור הצפון בע"מ', has_phone: true, selectable: false, reason: 'coming_later' }],
        send_hours: { from: '08:00', to: '20:00' }, attachment: 'none', attachment_modes: ['none'] });
    }
    if (p === 'infra/temperature/report/schedules') return json(route, { schedules: [] });
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
      await page.screenshot({ path: path.join(OUT, `grid-${test.info().project.name}-${scheme}.png`), fullPage: true });
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

  test('page edit mode and the wizard (four steps)', async ({ page }) => {
    await install(page, units());
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    await page.locator('sw-app').getByRole('button', { name: /תפריט המשתמש/ }).click();
    await page.locator('[data-menu-screen-edit="temperature-edit"]').click();
    await expect(page.locator('sw-app infra-temperature [data-temp-add]')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `edit-mode-${test.info().project.name}.png`), fullPage: true });
    await page.locator('sw-app infra-temperature [data-temp-new]').click();
    const w = page.locator('sw-app infra-temperature temp-wizard');
    await expect(w.locator('[data-grp="climate"]')).toBeVisible(); // sensors AND climate entities, grouped
    await w.locator('[data-cand="sensor.bar_fridge_temp"]').click();
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

  test('alert log', async ({ page }) => {
    await install(page, units());
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature/log'));
    await expect(page.locator('sw-app temp-log [data-temp-log-table] tbody tr')).toHaveCount(LOG.length);
    await expect(page.locator('sw-app temp-log [data-temp-csv]')).toBeVisible();
    await noOverflow(page);
    await page.screenshot({ path: path.join(OUT, `log-${test.info().project.name}.png`), fullPage: true });
  });

  test('stale infrastructure: grey values, a banner, nothing claimed healthy', async ({ page }) => {
    await install(page, units(), { stale: true });
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    await expect(page.locator('sw-app infra-temperature [data-temp-stale]')).toBeVisible();
    await expect(page.locator('sw-app infra-temperature [data-temp-kpi="ok"] b')).toHaveText('0');
    await page.screenshot({ path: path.join(OUT, `stale-${test.info().project.name}.png`), fullPage: true });
  });

  test('empty: a manager sees the hint; edit mode offers the first unit', async ({ page }) => {
    await install(page, []);
    await page.goto('about:blank');
    await page.goto(url('/infra/temperature'));
    await expect(page.locator('sw-app infra-temperature [data-state="empty"]')).toBeVisible();
    await expect(page.locator('sw-app infra-temperature [data-temp-add-first]')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, `empty-${test.info().project.name}.png`) });
  });
});
