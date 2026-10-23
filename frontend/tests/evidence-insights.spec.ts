import { test, expect, type Page, type Route } from '@playwright/test';

// CR-INSIGHT215 evidence + layout: סקירה ודוחות (the building report, doors, waste) and Settings › תשתיות › תובנות ודוחות from the REAL build against a
// mocked backend (fake, deterministic data only; the wire contract of routers/insights.py).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-insights.spec.ts --project=desktop
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, msg: string, details: Record<string, unknown> = {}) =>
  json(route, { code, user_message: msg, retryable: false, correlation_id: 'mock', details }, status);
const url = (hash: string, scheme: 'light' | 'dark' = 'light') => `/?design=a&skin=classic&scheme=${scheme}#${hash}`;

const ALL = ['reports.building', 'insights.read', 'insights.manage', 'system.configure', 'energy.view', 'devices.read', 'generator.view', 'events.read'];
const NOW = Date.parse('2026-10-23T10:00:00Z');
const at = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();

const SECS = ['summary', 'tickets', 'energy', 'elevators', 'generator', 'temperature', 'doors', 'cameras', 'waste'];
const model = (o: { lang?: string; month?: string; omitted?: { section: string; reason: string }[]; empty?: boolean } = {}) => {
  const omitted = o.omitted ?? [{ section: 'elevators', reason: 'module_off' }, { section: 'cameras', reason: 'not_permitted' }];
  const off = new Set(omitted.map((x) => x.section));
  const data: Record<string, unknown> = {
    summary: [{ section: 'tickets', title: 'בקשות שירות', text: '42 נפתחו' }],
    tickets: { opened: o.empty ? 0 : 42, closed: o.empty ? 0 : 38, open_end: o.empty ? 0 : 6, overdue: 2, median_close_h: 43.2, by_department: o.empty ? [] : [{ name: 'אחזקה', opened: 21, closed: 19 }, { name: 'חשמל', opened: 9, closed: 9 }], oldest_open: [{ number: 118, department: 'אחזקה', age_days: 12 }], truncated: false },
    energy: o.empty ? { available: false, meters: [] } : { available: true, meters: [{ name: 'מונה ראשי', kwh: 18420, prev_kwh: 19600, last_year_kwh: 17100, coverage: 1 }], total_kwh: 18420, prev_total_kwh: 19600, change_pct: -6 },
    elevators: { items: [], down_min: 0 },
    generator: { devices: [{ name: 'גנרטור ראשי', critical: 0, alert: 2, info: 1, total: 3, top: [] }], total: 3, critical: 0 },
    temperature: { units: [{ name: 'חדר שרתים', alarms: 3, warnings: 1, out_min: 160, offline: 0 }], alarms: 3, out_min: 160 },
    doors: { configured: true, total: { openings: 412, explained: 406, unexplained: 4, unverifiable: 2 }, ranking: [], doors: [{ name: 'דלת אחורית', openings: 64, unexplained: 3, unverifiable: 0 }, { name: 'יציאה לגג', openings: 38, unexplained: 0, unverifiable: 2 }] },
    cameras: { events: 1284, minutes: 90, top: [{ name: 'לובי', count: 311, minutes: 40 }] },
    waste: { minutes: { empty_room: 1110, after_hours: 850 }, top: [{ key: 'a', kind: 'empty_room', name: 'מזגן', area: 'חדר ישיבות', floor: 'קומה 2', domain: 'climate', minutes: 165, segments: 1, longest_min: 165, first_at: at(900), last_at: at(735) }], anomalies: 1, anomaly_top: [{ key: 'n', kind: 'energy', name: 'מונה ראשי', night: '2026-10-20', from: at(3000), to: at(2600), kwh: 14.2, baseline_kwh: 8.1, ratio: 1.75, baseline_nights: 4 }] },
  };
  const shown = SECS.filter((s) => !off.has(s));
  for (const s of off) delete data[s];
  if (o.empty) return { v: 1, lang: o.lang ?? 'he', month: o.month ?? '2026-09', zone: 'Asia/Jerusalem', from: 0, to: 1, generated: Math.floor(NOW / 1000), sections: [], omitted: [], data: {}, digest: 'e', filename: 'f.pdf' };
  return { v: 1, lang: o.lang ?? 'he', month: o.month ?? '2026-09', zone: 'Asia/Jerusalem', from: 0, to: 1, generated: Math.floor(NOW / 1000), sections: shown, omitted, data, digest: 'abc', filename: `building-report-${o.month ?? '2026-09'}.pdf` };
};

const door = (name: string, floor: string | null, area: string | null, o: Partial<Record<string, unknown>> = {}) => ({
  key: name, name, area, floor, openings: 100, explained: 98, unexplained: 1, unverifiable: 1, judgeable: true, items_more: 0,
  by_reason: { lock: 90, unlocked: 0, command: 5, rex: 3, window: 0 },
  items: [{ at: at(120), duration_s: 48, open_at_end: false, verdict: 'unexplained', why: null }, { at: at(900), duration_s: 62, open_at_end: false, verdict: 'unverifiable', why: 'lock_unknown' }], ...o,
});
const DOORS = {
  from: at(10000), to: at(0), window: { before_s: 30, after_s: 10 }, configured: true,
  doors: [door('דלת אחורית', 'קומת קרקע', 'אחורי'), door('יציאה לגג', 'גג', 'גג', { items: [] , unexplained: 0, unverifiable: 0 })],
  total: { openings: 200, explained: 196, unexplained: 2, unverifiable: 2 }, ranking: [],
};
const WASTE = {
  from: at(10000), to: at(0), zone: 'Asia/Jerusalem', night: { from: '22:00', to: '06:00' },
  devices: { items: [
    { key: 'a', kind: 'empty_room', name: 'מזגן', area: 'חדר ישיבות', floor: 'קומה 2', domain: 'climate', minutes: 165, segments: 1, longest_min: 165, first_at: at(900), last_at: at(735) },
    { key: 'b', kind: 'after_hours', name: 'תאורה', area: 'משרדים', floor: 'קומה 1', domain: 'light', minutes: 460, segments: 1, longest_min: 460, first_at: at(1800), last_at: at(1340) },
  ], items_more: 0, judged: 9, truncated: false, minutes: { empty_room: 165, after_hours: 460 } },
  energy: { available: true, meters: 1, items: [{ key: 'n', kind: 'energy', name: 'מונה ראשי', night: '2026-10-20', from: at(3000), to: at(2600), kwh: 14.2, baseline_kwh: 8.1, ratio: 1.75, baseline_nights: 4 }, { key: 'm', kind: 'energy', name: 'מונה ראשי', night: '2026-10-21', from: at(1500), to: at(1100), kwh: 9.1, baseline_kwh: 8.4, ratio: 1.1, baseline_nights: 4 }] },
};
const SETTINGS = {
  settings: { doors: { before_s: 30, after_s: 10, min_open_s: 2, pairs: [{ sensor_entity_id: 'binary_sensor.back', lock_entity_id: 'lock.back', rex_entity_ids: ['binary_sensor.back_exit'], invert: false }] },
    waste: { empty_after_min: 20, min_waste_min: 30, night_min_min: 60, energy_factor: 1.5, energy_min_kwh: 1, baseline_weeks: 4, baseline_min_coverage: 0.8, domains: ['light', 'climate'], night_from: '22:00', night_to: '06:00' },
    report: { sections: SECS } },
  switches: { 'insights.doors.enabled': true, 'insights.waste.enabled': false, 'reports.building.enabled': true }, can_switch: true, sections: SECS, domains: ['light', 'climate', 'fan', 'switch'],
};
const ent = (entity_id: string, name: string, domain: string, extra: Record<string, unknown> = {}) => ({ entity_id, name, original_name: name, domain, device_class: null, area_name: null, ...extra });
const ENTITIES = [ent('binary_sensor.back', 'דלת אחורית', 'binary_sensor', { device_class: 'door' }), ent('lock.back', 'מנעול אחורי', 'lock'), ent('binary_sensor.back_exit', 'לחצן אחורי', 'binary_sensor')];

interface Mock { calls: { method: string; path: string; body: unknown }[]; }
interface MockOpts { status?: Record<string, boolean>; report?: 'ok' | 'empty' | 'error' | 'off' | 'slow'; doors?: 'ok' | 'empty' | 'off'; saveError?: boolean; pdf?: number; perms?: string[] }

async function install(page: Page, o: MockOpts = {}): Promise<Mock> {
  const mock: Mock = { calls: [] };
  const perms = o.perms ?? ALL;
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    let body: unknown = null;
    if (method !== 'GET') { try { body = req.postDataJSON(); } catch { body = null; } }
    if (p === 'me') return json(route, { user: { id: 'u1', username: 'sam', display_name: 'דנה', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done' });
    if (p === 'me/prefs') return json(route, { prefs: { 'nav.order': [] }, stored: [], updated_at: null });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'tickets.enabled': 'true' }, can_edit: false });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'energy/meters') return json(route, { items: [], stale_after_minutes: 60 });
    if (p === 'devices/tree') return json(route, { floors: [], unassigned: { area_id: 'unassigned', name: 'ללא שיוך' }, scoped: false, can_bulk: false });
    if (p.startsWith('ha/entities')) return json(route, { entities: ENTITIES, domains: {}, areas: [], sync: {}, can_control: false });
    if (!p.startsWith('insights/') && !p.startsWith('reports/')) return err(route, 404, 'not_found', 'לא נמצא');
    mock.calls.push({ method, path: p + u.search, body });
    if (p === 'insights/status') return json(route, o.status ?? { doors: true, waste: true, report: true });
    if (p === 'insights/settings') {
      if (method === 'PUT' && o.saveError) return err(route, 422, 'validation', 'ערך לא תקין.', { fields: ['waste.min_waste_min'] });
      if (method === 'PUT') {
        const b = body as { settings?: typeof SETTINGS.settings; switches?: Record<string, boolean> };
        return json(route, { ...SETTINGS, settings: b.settings ?? SETTINGS.settings, switches: { ...SETTINGS.switches, ...(b.switches ?? {}) } });
      }
      return json(route, SETTINGS);
    }
    if (p === 'insights/doors') return o.doors === 'off' ? err(route, 404, 'not_found', 'הפריט לא נמצא.') : json(route, o.doors === 'empty' ? { ...DOORS, doors: DOORS.doors.map((d) => ({ ...d, items: [], unexplained: 0, unverifiable: 0 })), total: { ...DOORS.total, unexplained: 0, unverifiable: 0 } } : DOORS);
    if (p === 'insights/waste') return json(route, WASTE);
    if (p === 'reports/building/preview') {
      if (o.report === 'off') return err(route, 404, 'not_found', 'הפריט לא נמצא.');
      if (o.report === 'error') return err(route, 500, 'internal', 'שגיאה');
      if (o.report === 'slow') await new Promise((r) => setTimeout(r, 1500));
      const lang = u.searchParams.get('lang') ?? 'he';
      return json(route, model({ lang, month: u.searchParams.get('month') ?? '2026-09', empty: o.report === 'empty' }));
    }
    if (p === 'reports/building.pdf') {
      if (o.pdf) return err(route, o.pdf, 'pdf_render_failed', 'לא ניתן להפיק את הדוח כרגע.');
      return route.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'Content-Disposition': 'attachment; filename="building-report-2026-09.pdf"' }, body: '%PDF-1.4 fake' });
    }
    return err(route, 404, 'not_found', 'לא נמצא');
  });
  return mock;
}

test.describe('insights - the building report', () => {
  test('preview, picker, omitted list, language and PDF', async ({ page }) => {
    const m = await install(page);
    await page.goto(url('/tickets/reports/building'));
    const doc = page.locator('[data-report-doc]');
    await expect(doc).toBeVisible();
    await expect(page.locator('[data-kpis] .kpi')).toHaveCount(4);
    await expect(page.locator('h1[data-insight-title]')).toHaveText('דוחות בניין');
    // sections the server left out are listed with the reason, greyed in the picker, and not drawn
    await expect(page.locator('[data-omitted-row="elevators"]')).toContainText('המודול כבוי');
    await expect(page.locator('[data-omitted-row="cameras"]')).toContainText('אין הרשאה');
    await expect(page.locator('[data-pick-off="elevators"]')).toBeVisible();
    await expect(page.locator('[data-sec="elevators"]')).toHaveCount(0);
    await expect(page.locator('[data-sec="tickets"]')).toBeVisible();
    // unpicking a section hides it without a new request
    const before = m.calls.filter((c) => c.path.startsWith('reports/building/preview')).length;
    await page.locator('[data-pick="tickets"]').click();
    await expect(page.locator('[data-sec="tickets"]')).toHaveCount(0);
    expect(m.calls.filter((c) => c.path.startsWith('reports/building/preview')).length).toBe(before);
    // the previous month and the language reload the model
    await page.locator('[data-prev]').click();
    await expect.poll(() => m.calls.some((c) => c.path.includes('month=2026-08'))).toBe(true);
    await page.locator('[data-lang="en"]').click();
    await expect(doc).toHaveAttribute('dir', 'ltr');
    // the PDF asks for the picked sections only
    const dl = page.waitForEvent('download');
    await page.locator('[data-download]').click();
    expect((await dl).suggestedFilename()).toContain('building-report');
    const pdf = m.calls.find((c) => c.path.startsWith('reports/building.pdf'));
    expect(pdf?.path).toContain('lang=en');
    expect(decodeURIComponent(pdf?.path ?? '')).not.toContain('tickets');
  });

  test('empty, error, switched off', async ({ page }) => {
    await install(page, { report: 'empty' });
    await page.goto(url('/tickets/reports/building'));
    await expect(page.locator('[data-state="empty"]')).toBeVisible();
    await expect(page.locator('[data-download]')).toBeDisabled();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await install(page, { report: 'error' });
    await page.reload();
    await expect(page.locator('[data-state="error"]')).toBeVisible();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await install(page, { report: 'off', status: { doors: true, waste: true, report: true } });
    await page.reload();
    await expect(page.locator('[data-state="off"]')).toBeVisible();
  });

  test('a failed PDF keeps the report on screen and offers a retry', async ({ page }) => {
    await install(page, { pdf: 503 });
    await page.goto(url('/tickets/reports/building'));
    await expect(page.locator('[data-report-doc]')).toBeVisible();
    await page.locator('[data-download]').click();
    await expect(page.locator('[data-state="pdf-error"]')).toBeVisible();
    await expect(page.locator('[data-report-doc]')).toBeVisible();
    await expect(page.locator('[data-pdf-retry]')).toBeVisible();
  });

  test('loading skeleton', async ({ page }) => {
    await install(page, { report: 'slow' });
    await page.goto(url('/tickets/reports/building'));
    await expect(page.locator('[data-state="loading"]')).toBeVisible();
  });
});

test.describe('insights - doors and waste', () => {
  test('doors: verdict filters, tree, timeline, explained evidence', async ({ page }) => {
    await install(page);
    await page.goto(url('/tickets/reports/doors'));
    await expect(page.locator('[data-kpis] .kpi')).toHaveCount(4);
    await expect(page.locator('[data-door-row="unexplained"]')).toHaveCount(1);
    await expect(page.locator('[data-door-row="unverifiable"]')).toHaveCount(0);
    await page.locator('[data-kpi="all"]').click();
    await expect(page.locator('[data-door-row]')).toHaveCount(2);
    await page.locator('[data-door-row="unexplained"]').click();
    await expect(page.locator('.tl')).toBeVisible();
    await expect(page.locator('.evs .ev')).toHaveCount(4);
    await page.locator('[data-kpi="explained"]').click();
    await expect(page.locator('[data-door-explained]')).toHaveCount(2);
    await expect(page.locator('[data-door-explained]').first()).toContainText('מנעול נפתח');
    // the floors tree narrows the list
    await page.locator('[data-kpi="all"]').click();
    await page.locator('sw-place-tree [aria-current], sw-place-tree button').filter({ hasText: 'גג' }).first().click();
    await expect(page.locator('[data-door-row]')).toHaveCount(0);
    await expect(page.locator('[data-state="empty"]')).toBeVisible();
  });

  test('doors: switched off answers the screen-unavailable state', async ({ page }) => {
    await install(page, { doors: 'off' });
    await page.goto(url('/tickets/reports/doors'));
    await expect(page.locator('[data-state="off"]')).toBeVisible();
  });

  test('waste: rows, kind filter, night chart', async ({ page }) => {
    await install(page);
    await page.goto(url('/tickets/reports/waste'));
    await expect(page.locator('[data-waste-row]')).toHaveCount(2);
    await expect(page.locator('[data-night] .bars .col')).toHaveCount(2);
    await page.locator('[data-kpi="empty_room"]').click();
    await expect(page.locator('[data-waste-row]')).toHaveCount(1);
    await expect(page.locator('[data-waste-row]')).toContainText('חדר ריק');
  });
});

test.describe('insights - settings', () => {
  test('switches, pairs, thresholds and the 422 field error', async ({ page }) => {
    const m = await install(page, { saveError: true });
    await page.goto(url('/system/infra/insights'));
    await expect(page.locator('[data-switches]')).toBeVisible();
    await expect(page.locator('[data-pair-row]')).toHaveCount(1);
    await expect(page.locator('[data-pair-row]')).toContainText('דלת אחורית');
    await page.locator('[data-field="min_waste_min"]').fill('1');
    await page.locator('[data-save]').click();
    await expect(page.locator('[data-field-error="min_waste_min"]')).toContainText('5');
    await expect(page.locator('[data-note]')).toBeVisible();
    expect(m.calls.some((c) => c.method === 'PUT' && c.path === 'insights/settings')).toBe(true);
  });

  test('a switch is its own save and a pair is added through the dialog', async ({ page }) => {
    const m = await install(page);
    await page.goto(url('/system/infra/insights'));
    await page.locator('[data-switch="insights.waste.enabled"]').click();
    await expect.poll(() => m.calls.some((c) => c.method === 'PUT' && JSON.stringify(c.body).includes('insights.waste.enabled'))).toBe(true);
    await page.locator('[data-pair-new]').click();
    await page.locator('[data-pair-door]').selectOption('binary_sensor.back');
    await page.locator('[data-pair-ok]').click();
    await expect(page.locator('[data-pair-row]')).toHaveCount(2);
  });
});

// Screenshots for the visual review; skipped unless SW_SHOTS_DIR is set: SW_SHOTS_DIR=<dir> npx playwright test tests/evidence-insights.spec.ts -g shots
test('shots', async ({ page }) => {
  const dir = process.env.SW_SHOTS_DIR;
  test.skip(!dir, 'SW_SHOTS_DIR not set');
  await install(page);
  for (const [w, scheme, route, name] of [[1366, 'light', '/tickets/reports/building', 'report'], [1366, 'light', '/tickets/reports/doors', 'doors'], [375, 'dark', '/tickets/reports/building', 'report-m'], [1366, 'light', '/system/infra/insights', 'settings']] as const) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(url(route, scheme));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${dir}/shot-${name}.png` });
  }
});

test.describe('insights - layout', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const w of [1366, 375]) {
      test(`no horizontal overflow ${w}px ${scheme}`, async ({ page }) => {
        await install(page);
        await page.setViewportSize({ width: w, height: 800 });
        for (const route of ['/tickets/reports/building', '/tickets/reports/doors', '/tickets/reports/waste', '/system/infra/insights']) {
          await page.goto(url(route, scheme));
          await page.waitForSelector('[data-report-doc], [data-kpis], [data-switches]');
          const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(over, route).toBeLessThanOrEqual(1);
        }
      });
    }
  }
});
