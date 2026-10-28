import { test, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installBubbleMock, tree } from './bubble-mocks';
import { LONG_HE, MIXED, UNBREAK } from './breakui-worst';

// R5-DEVICES-297 shoot harness, not a test: every screen of the DEVICES group (schedules, automations, scenes, scripts, scenarios,
// the bulk dialog, the tiles panel, the settings panels of the device area) through the demo mode or a mocked API boundary, every
// selectable skin, light + dark, desktop 1440x900 + phone 390x844. Nothing here touches a device.
//   R5_OUT=<dir> R5_SCREENS=sched-rows,auto-rows R5_SKINS=classic,domus SW_BASE_URL=http://127.0.0.1:4188/ npx playwright test tests/r5-devices-shoot.spec.ts --project=desktop --project=mobile
const OUT = process.env.R5_OUT ?? '';
const ALL = 'sched-rows,sched-cards,sched-table,sched-week,sched-drawer,sched-editor,sched-editor-table,sched-new,sched-trash,sched-empty,sched-unavailable,auto-rows,auto-cards,auto-drawer,auto-builder,auto-new,auto-trash,auto-empty,auto-offline,scenes,scene-editor,scripts,script-drawer,scenarios,scenario-new,bulk-menu,bulk-dialog,tiles-panel,area-cards,protected,theme,climate-kinds,device-types,sched-rows-worst,auto-rows-worst';
const SCREENS = (process.env.R5_SCREENS ?? ALL).split(',');
const SKINS = (process.env.R5_SKINS ?? 'classic,domus,tesla,crystal,infra,soft').split(',');
const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const PINNED_NOW = new Date('2026-10-05T09:00:00Z');

type Boot = 'demo' | 'bubble' | 'stage';
interface Screen {
  boot: Boot;
  hash?: string;
  q?: string;
  sched?: Record<string, unknown>;
  auto?: Record<string, unknown>;
  ls?: Record<string, string>;
  /** After the page settled: open a drawer / dialog / panel. */
  after?: (page: Page) => Promise<void>;
  /** stage: the element to mount, the routes it needs. */
  tag?: string;
  routes?: (page: Page) => Promise<void>;
  worst?: boolean;
}

const schedWorst = { persona: 'admin' };

/** Opens the first bulk menu of the building screen: the building / floor trigger button on a desktop, the floor card's "כבה קומה"
 * trigger (devices-bulk-menu[data-floor-menu]) on a phone, where the building trigger is not in the header. */
async function openBulk(page: Page) {
  const t = page.locator('devices-building sw-button[data-bulk-trigger="building"], devices-building sw-button[data-bulk-trigger="floor"]').first();
  if (await t.isVisible().catch(() => false)) {
    await t.click();
    return;
  }
  const m = page.locator('devices-building devices-bulk-menu[data-floor-menu]').first();
  await m.waitFor({ state: 'attached', timeout: 8000 });
  await m.scrollIntoViewIfNeeded();
  await m.locator('button, sw-button').first().click();
}
const DEF: Record<string, Screen> = {
  'sched-rows': { boot: 'demo', hash: '/devices/schedules', q: '&sched_view=rows', sched: { persona: 'admin' } },
  'sched-cards': { boot: 'demo', hash: '/devices/schedules', q: '&sched_view=cards', sched: { persona: 'admin' } },
  'sched-table': { boot: 'demo', hash: '/devices/schedules', q: '&sched_view=table', sched: { persona: 'admin' } },
  'sched-week': { boot: 'demo', hash: '/devices/schedules?view=week', sched: { persona: 'admin' } },
  'sched-drawer': { boot: 'demo', hash: '/devices/schedules/4d6e0a', q: '&sched_view=rows', sched: { persona: 'admin' } },
  'sched-editor': { boot: 'demo', hash: '/devices/schedules/4d6e0a/edit', sched: { persona: 'admin' } },
  'sched-editor-table': { boot: 'demo', hash: '/devices/schedules/4d6e0a/edit', sched: { persona: 'admin' }, ls: { 'sw.schedules.editor_view': 'table' } },
  'sched-new': { boot: 'demo', hash: '/devices/schedules/new/edit?template=weekly', sched: { persona: 'admin' } },
  'sched-trash': { boot: 'demo', hash: '/devices/schedules/trash', sched: { persona: 'admin' } },
  'sched-empty': { boot: 'demo', hash: '/devices/schedules', sched: { persona: 'admin', empty: true } },
  'sched-unavailable': { boot: 'demo', hash: '/devices/schedules', sched: { persona: 'admin', availability: 'component_missing' } },
  'sched-rows-worst': { boot: 'demo', hash: '/devices/schedules', q: '&sched_view=rows', sched: schedWorst, worst: true },
  'auto-rows': { boot: 'demo', hash: '/devices/automations', auto: { user: 'installer' }, ls: { 'sw.automations.view': 'rows' } },
  'auto-cards': { boot: 'demo', hash: '/devices/automations', auto: { user: 'installer' }, ls: { 'sw.automations.view': 'cards' } },
  'auto-drawer': { boot: 'demo', hash: '/devices/automations/1727700000001', auto: { user: 'installer' }, ls: { 'sw.automations.view': 'rows' } },
  'auto-builder': { boot: 'demo', hash: '/devices/automations/1727700000001/edit', auto: { user: 'installer' } },
  'auto-new': { boot: 'demo', hash: '/devices/automations/new/edit?kind=automation', auto: { user: 'installer' } },
  'auto-trash': { boot: 'demo', hash: '/devices/automations/trash', auto: { user: 'installer' }, ls: { 'sw.automations.view': 'rows' } },
  'auto-empty': { boot: 'demo', hash: '/devices/automations', auto: { user: 'installer', empty: true }, ls: { 'sw.automations.view': 'rows' } },
  'auto-offline': { boot: 'demo', hash: '/devices/automations', auto: { user: 'installer', offline: true }, ls: { 'sw.automations.view': 'rows' } },
  'auto-rows-worst': { boot: 'demo', hash: '/devices/automations', auto: { user: 'installer' }, ls: { 'sw.automations.view': 'rows' }, worst: true },
  scenes: { boot: 'demo', hash: '/devices/automations/scenes', auto: { user: 'installer' } },
  'scene-editor': { boot: 'demo', hash: '/devices/automations/scenes/1727700000200/edit', auto: { user: 'installer' } },
  scripts: { boot: 'demo', hash: '/devices/automations/scripts', auto: { user: 'installer' } },
  'script-drawer': { boot: 'demo', hash: '/devices/automations/scripts/1727700000100', auto: { user: 'installer' } },
  scenarios: { boot: 'demo', hash: '/devices/automations/scenarios', auto: { user: 'installer' } },
  'scenario-new': { boot: 'demo', hash: '/devices/automations/scenarios/new', auto: { user: 'installer' } },
  'bulk-menu': {
    boot: 'bubble', hash: '/devices/building',
    after: async (page) => {
      await openBulk(page);
      await page.waitForTimeout(500);
    },
  },
  'bulk-dialog': {
    boot: 'bubble', hash: '/devices/building',
    after: async (page) => {
      await openBulk(page);
      await page.waitForTimeout(300);
      const item = page.locator('devices-building devices-bulk-menu [data-bulk-kind="all_off"], devices-building devices-bulk-menu [data-bulk-kind]').first();
      await item.waitFor({ state: 'visible', timeout: 5000 });
      await item.click();
      await page.waitForTimeout(700);
    },
  },
  // the camera card and the media card live on the area screen (the bubble mock's living area has one camera and two players)
  'area-cards': { boot: 'bubble', hash: '/devices/areas/living' },
  'tiles-panel': {
    boot: 'bubble', hash: '/devices/building',
    after: async (page) => {
      const k = page.locator('devices-building sw-kpi').first();
      await k.waitFor({ state: 'visible', timeout: 8000 });
      await k.click();
      await page.waitForTimeout(900);
    },
  },
  protected: { boot: 'stage', tag: 'devices-protected-switches', routes: serveProtected },
  theme: { boot: 'stage', tag: 'devices-theme-picker' },
  'climate-kinds': { boot: 'stage', tag: 'devices-climate-kind-admin', routes: serveClimate },
  'device-types': { boot: 'stage', tag: 'devices-type-admin', routes: serveTypes },
};

// ---- the settings panels' mocked routes (synthetic names only) ----
async function serveProtected(page: Page) {
  const base = (id: string, name: string, floor: [string, string] | null, area: [string, string] | null, over: Record<string, unknown> = {}) => ({
    entity_id: `switch.${id}`, name, area_id: area?.[0] ?? null, area_name: area?.[1] ?? null, floor_id: floor?.[0] ?? null, floor_name: floor?.[1] ?? null,
    state: 'off', available: true, protected: false, suggested: false, source: null, category: null, category_label: null, rule: null, reviewed: null, included: true, reason: 'allowed',
    reason_label: null, alarm_managed: false, doors_layer: false, media_managed: false, marked_by: null, marked_at: null, reviewed_by: null, reviewed_at: null, ...over,
  });
  const AUTO = { suggested: true, source: 'auto', reviewed: false, marked_at: '2026-10-02T06:00:00Z' };
  const G: [string, string] = ['g', 'קרקע'];
  const U: [string, string] = ['u', 'קומה 1'];
  const rows = [
    base('pool_pump', 'משאבת בריכה', G, ['yard', 'חצר'], { ...AUTO, category: 'water_heating', category_label: 'משאבות ודודים', rule: 'name:משאבה' }),
    base('solar_boiler', 'דוד שמש', G, ['roof', 'גג'], { ...AUTO, category: 'water_heating', category_label: 'משאבות ודודים', rule: 'name:דוד' }),
    base('rack_router', 'ראוטר ארון תקשורת', G, ['tech', 'חדר תקשורת'], { ...AUTO, category: 'network', category_label: 'רשת, שרתים ואל־פסק', rule: 'name:router' }),
    base('fridge', 'מקרר מטבחון', U, ['kit', 'מטבחון'], { protected: true, source: 'manual', reviewed: true, included: false, reason: 'protected', marked_by: 'מנהל', marked_at: '2026-10-01T10:00:00Z', reviewed_by: 'מנהל', reviewed_at: '2026-10-01T10:00:00Z' }),
    base('lobby_sign', 'שלט לובי', G, ['lobby', 'לובי'], { state: 'on' }),
    base('hall_lights', 'תאורת מסדרון', U, ['hall', 'מסדרון']),
    base('office_fan', 'מאוורר משרד', U, ['office', 'משרד'], { state: 'on' }),
    base('garden_lights', 'תאורת גינה', G, ['yard', 'חצר']),
    base('zone9_bypass', 'עקיפת חיישן אזור 9', U, ['hall', 'מסדרון'], { alarm_managed: true, included: false, reason: 'alarm_managed' }),
    base('gate_relay', 'ממסר שער חניה', G, ['gate', 'כניסה'], { doors_layer: true, included: false, reason: 'doors_layer' }),
  ];
  const categories = [{ id: 'water_heating', label: 'משאבות ודודים' }, { id: 'network', label: 'רשת, שרתים ואל־פסק' }, { id: 'cold', label: 'מקררים ומקפיאים' }, { id: 'infrastructure', label: 'תשתית המערכת' }];
  await page.route('**/api/v1/devices/bulk-protected', (route) => json(route, {
    switches: rows, categories, note: '',
    summary: { switches: rows.length, protected: rows.filter((r) => r.protected).length, suggested: rows.filter((r) => r.suggested).length, unprotected: rows.filter((r) => !r.protected).length, gone_protected: 0 },
  }));
}
async function serveClimate(page: Page) {
  const r = (entity_id: string, name: string, area_name: string | null, state: string, kind: 'ac' | 'heating', set: 'ac' | 'heating' | null, auto: 'ac' | 'heating' = kind) =>
    ({ entity_id, name, area_name, state, available: state !== 'unavailable', hvac_modes: kind === 'ac' ? ['off', 'cool', 'heat', 'dry'] : ['off', 'heat'], kind, auto, set });
  await page.route('**/api/v1/devices/climate-kinds', (route) => json(route, { climate: [
    r('climate.living_ac', 'מזגן סלון', 'סלון', 'cool', 'ac', null),
    r('climate.parents_ac', 'מזגן חדר הורים', 'חדר שינה הורים', 'off', 'ac', null),
    r('climate.floor_heat', 'חימום תת-רצפתי', 'סלון', 'heat', 'heating', 'heating', 'ac'),
    r('climate.boiler', 'דוד חימום', null, 'unavailable', 'heating', null),
    r('climate.office_ac', LONG_HE, 'חדר עבודה', 'off', 'ac', 'ac'),
  ] }));
}
async function serveTypes(page: Page) {
  const r = (entity_id: string, name: string, area: [string, string] | null, floor: [string, string] | null, kind: string, auto: string, set: string | null, state = 'off', over: Record<string, unknown> = {}) =>
    ({ entity_id, name, domain: entity_id.split('.')[0], device_class: null, area_id: area?.[0] ?? null, area_name: area?.[1] ?? null, floor_id: floor?.[0] ?? null, floor_name: floor?.[1] ?? null, state, available: state !== 'unavailable', kind, auto, set, options: ['switch', 'outlet', 'light', 'fan', 'heater', 'water_heater', 'valve'], set_by: set ? 'מנהל' : null, set_at: set ? '2026-10-01T10:00:00Z' : null, ...over });
  const G: [string, string] = ['g', 'קומת קרקע'];
  await page.route('**/api/v1/devices/device-types', (route) => json(route, { devices: [
    r('switch.boiler', 'דוד שמש', ['roof', 'גג'], G, 'water_heater', 'water_heater', null, 'on'),
    r('switch.irrigation', 'השקיה', ['yard', 'חצר'], G, 'valve', 'switch', 'valve', 'off', { bulk_on_allowed: true }),
    r('switch.lobby_light', 'תאורת לובי', ['lobby', 'לובי'], G, 'light', 'light', null, 'on'),
    r('switch.office_fan', 'מאוורר משרד', ['office', 'משרד'], G, 'fan', 'switch', 'fan'),
    r('switch.plug_tv', MIXED, ['living', 'סלון'], G, 'outlet', 'outlet', null, 'unavailable'),
    r('switch.heater', UNBREAK, null, null, 'heater', 'heater', null),
  ] }));
}

// ---- the tiles panel's items (the bubble mock has no /devices/items) ----
function items() {
  const t = tree();
  const it = (entity_id: string, name: string, state: string, area_id: string, area_name: string, floor_id: string, floor_name: string, extra: Record<string, unknown> = {}) =>
    ({ entity_id, name, domain: 'light', device_class: null, state, available: state !== 'unavailable', fresh: true, active: state === 'on', icon: null, last_changed: '2026-10-02T09:40:00Z', can_control: true, area_id, area_name, floor_id, floor_name, brightness_pct: state === 'on' ? 60 : 0, ...extra });
  const floors = t.floors.map((f) => ({ floor_id: f.floor_id, name: f.name, level: f.level, areas: f.areas.slice(0, 3).map((a, i) => ({ area_id: a.area_id, name: a.name, items: [
    it(`light.${a.area_id}_main`, `תאורה ראשית ${a.name}`, i === 0 ? 'on' : 'off', a.area_id, a.name, f.floor_id, f.name),
    it(`light.${a.area_id}_spot`, i === 1 ? LONG_HE : `ספוטים ${a.name}`, 'on', a.area_id, a.name, f.floor_id, f.name),
    it(`light.${a.area_id}_out`, 'מנורת חוץ', i === 2 ? 'unavailable' : 'off', a.area_id, a.name, f.floor_id, f.name),
  ] })) }));
  const all = floors.flatMap((f) => f.areas.flatMap((a) => a.items));
  return { kind: 'lights', scope: 'building', id: '', name: 'המבנה', floor_name: null, counts: { total: all.length, active: all.filter((x) => x.active).length, inactive: all.filter((x) => !x.active && x.available).length, unavailable: all.filter((x) => !x.available).length }, floors, truncated: false, scoped: false, can_bulk: true };
}

const NAMES = [LONG_HE, UNBREAK, MIXED, 'א', 'ב'.repeat(70)];

// ---- the scenarios panel (no demo store of its own): a small synthetic list and catalogue ----
async function serveScenarios(page: Page) {
  const sc = (id: string, name: string, description: string, state: string, enabled: boolean, last_result: string | null, fires_today: number, modules: string[], over: Record<string, unknown> = {}) =>
    ({ id, name, description, enabled, version: 3, state, state_reason: null, state_reason_text: '', last_eval_at: '2026-10-05T08:58:00Z', last_result, last_fire_at: fires_today ? '2026-10-05T07:10:00Z' : null, fires_today, tickets_today: 0, owner: { id: 'u', name: 'יוני' }, service_identity: 'arx', redacted_leaves: [], warnings: [], modules, action_types: ['notify'], ...over });
  const list = [
    sc('s1', 'חדר שרתים חם מדי', 'טמפרטורה מעל 30 במשך 10 דקות', 'ok', true, 'FALSE', 0, ['temperature']),
    sc('s2', 'דלת חניה פתוחה בלילה', 'דלת פתוחה אחרי 23:00', 'active', true, 'TRUE', 2, ['doors', 'time']),
    sc('s3', LONG_HE, 'מעלית תקועה ואין תנועה', 'degraded', true, 'UNKNOWN', 0, ['elevators'], { warnings: [{ code: 'stale', message: 'אות ישן' }] }),
    sc('s4', 'צריכה חריגה בלובי', 'מעל 5 קוט"ש בשעה', 'suppressed', true, 'TRUE', 1, ['electricity']),
    sc('s5', 'מצלמת כניסה לא מגיבה', 'אין תמונה 5 דקות', 'off', false, null, 0, ['cameras']),
    sc('s6', MIXED, 'שתי דלתות פתוחות יחד', 'ok', true, 'FALSE', 0, ['doors']),
  ];
  const sig = (id: string, module: string, module_label: string, kind: string, label: string, unit: string, subjects: { id: string; name: string }[]) =>
    ({ id, module, module_label, kind, label, label_en: id, unit, max_age_s: 600, subject: subjects.length ? 'entity' : 'none', range: kind === 'number' ? [0, 100] : null, default_margin: 1, default_debounce_s: 30, subjects });
  const signals = [
    sig('temperature.value', 'temperature', 'טמפרטורה', 'number', 'טמפרטורה', '°C', [{ id: 'srv', name: 'חדר שרתים' }, { id: 'lobby', name: 'לובי' }]),
    sig('doors.open', 'doors', 'דלתות', 'bool', 'דלת פתוחה', '', [{ id: 'garage', name: 'חניה' }]),
    sig('electricity.power', 'electricity', 'חשמל', 'number', 'הספק', 'kW', [{ id: 'main', name: 'ראשי' }]),
  ];
  const cat = { signals, limits: { depth: 3, leaves: 12, actions: 4 }, actions: ['notify', 'ticket'], tickets_on: true, option_defaults: { cooldown_s: 300, clear_after_s: 60, for_s: 0, on_unknown: 'false', unknown_grace_s: 60 }, option_ranges: { cooldown_s: [0, 86400], clear_after_s: [0, 86400], for_s: [0, 86400], unknown_grace_s: [0, 3600] } };
  await page.route('**/api/v1/scenarios/status', (r) => json(r, { enabled: true, kill_switch: false, can: { view: true, manage: true, admin: true }, can_use: true, actions: { notify: true, create_service_request: true, set_flag: true }, tickets_on: true }));
  await page.route('**/api/v1/scenarios/signals', (r) => json(r, cat));
  await page.route('**/api/v1/scenarios/choices', (r) => json(r, { recipients: [{ id: 'u', name: 'יוני' }], channels: ['push'] }));
  await page.route('**/api/v1/scenarios/settings', (r) => json(r, { settings: {} }));
  await page.route('**/api/v1/scenarios', (r) => json(r, { scenarios: list, can_manage: true }));
  await page.route(/\/api\/v1\/scenarios\/s\d$/, (r) => json(r, { ...list[1], definition: { all: [{ signal: 'doors.open', subject: 'garage', op: 'is', value: true }], options: {} } }));
}

/** The bulk dialog's preview (the bubble mock answers 404 to everything it does not know). */
function bulkPreview(url: URL) {
  const kind = url.searchParams.get('kind') ?? 'lights_off';
  const t = (entity_id: string, name: string, domain: string, area_name: string) => ({ entity_id, name, domain, action_id: 'turn_off', state: 'on', area_id: area_name, area_name });
  const targets = [t('light.living_main', 'תאורה מרכזית', 'light', 'סלון'), t('light.living_spots', 'ספוטים קיר', 'light', 'סלון'), t('light.kitchen', 'תאורת מטבח', 'light', 'מטבח'), t('light.yard', LONG_HE, 'light', 'חצר'), t('switch.boiler', 'דוד שמש', 'switch', 'גג')];
  return { scope: url.searchParams.get('scope') ?? 'building', id: url.searchParams.get('id') ?? '', name: 'המבנה', floor_name: null, kind, kind_label: kind === 'all_off' ? 'כבה הכל' : 'כבה תאורה', count: targets.length, targets, by_domain: { light: 4, switch: 1 }, domain_labels: { light: 'תאורה', switch: 'מתגים' }, skipped: { already: 7, unavailable: 2, sensitive_type: 1 }, excluded: [{ entity_id: 'switch.fridge', name: 'מקרר מטבחון', domain: 'switch', reason: 'protected', reason_label: 'מתג מוגן' }], never_included: { alarm: 1, locks: 1 }, digest: 'd1', note: 'מתגים מוגנים ונעילות לעולם אינם חלק מפעולה מרוכזת.' };
}

async function boot(page: Page, s: Screen, skin: string, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  if (s.boot === 'demo') {
    await page.route('**/api/v1/**', (route) => route.abort());
    if (s.hash?.includes('/scenarios')) await serveScenarios(page);
    await page.clock.install({ time: PINNED_NOW });
    const ls = { ...(s.ls ?? {}) };
    if (s.sched) ls['sw.demo.schedules'] = JSON.stringify(s.sched);
    if (s.auto) ls['sw.demo.automations'] = JSON.stringify({ ...s.auto, scheme });
    await page.addInitScript((kv: Record<string, string>) => {
      try {
        localStorage.removeItem('sw.schedules.view'); localStorage.removeItem('sw.schedules.filters'); localStorage.removeItem('sw.schedules.editor_view'); localStorage.removeItem('sw.automations.view');
        for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
      } catch {}
    }, ls);
    if (s.worst) {
      // break-ui: the demo stores are in-page; rename every item after the page drew (names from tests/breakui-worst.ts)
      await page.addInitScript((names: string[]) => {
        (window as unknown as { __r5worst: string[] }).__r5worst = names;
      }, NAMES);
    }
    await page.goto('about:blank');
    await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}&fit=off${s.q ?? ''}#${s.hash}`);
  } else if (s.boot === 'bubble') {
    await installBubbleMock(page, {});
    await page.route('**/api/v1/settings', (r) => json(r, { settings: { 'ui.design': 'a', 'ui.skin': skin, 'ui.scheme': scheme, 'devices.style': 'smplwise', 'devices.area_design': 'tiles', 'home.info_style': 'cards', 'home.screen': { desktop_area: 'drawer', phone_area: 'sheet' } }, can_edit: false }));
    await page.route('**/api/v1/devices/items?*', (r) => json(r, items()));
    await page.route('**/api/v1/devices/actions/preview?*', (r) => json(r, bulkPreview(new URL(r.request().url()))));
    await page.addInitScript(() => { try { localStorage.setItem('sw.devices.layout', 'cards'); } catch {} });
    await page.goto('about:blank');
    await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}#${s.hash}`);
  } else {
    // the last route registered wins: the catch-all first, the panel's own routes after it
    await page.route('**/api/v1/**', (r) => json(r, { items: [] }));
    await page.route('**/api/v1/me', (r) => json(r, { user: { id: 'u', username: 'admin', display_name: 'יוני', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: ['system.configure', 'devices.read'], permissions_any: ['system.configure', 'devices.read'], has_access: true, permission_revision: 1, bootstrap_state: 'done' }));
    await page.route('**/api/v1/settings', (r) => json(r, { settings: { 'ui.design': 'a', 'ui.skin': skin, 'ui.scheme': scheme }, can_edit: true }));
    if (s.routes) await s.routes(page);
    await page.goto('about:blank');
    await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}#/system/diagnostics?tab=devices`);
    const tag = s.tag ?? '';
    await page.waitForFunction((t) => !!customElements.get(t), tag);
    await page.waitForTimeout(1200);
    await page.evaluate(({ tag }) => {
      document.querySelectorAll('#r5-stage').forEach((e) => e.remove());
      const st = document.createElement('div');
      st.id = 'r5-stage';
      st.style.cssText = 'position:fixed;inset:0;z-index:50;overflow:auto;padding:16px;background:var(--sw-bg);color:var(--sw-text);direction:rtl';
      st.innerHTML = `<${tag} data-section="${tag}"></${tag}>`;
      document.body.appendChild(st);
    }, { tag: s.tag });
  }
  await page.waitForSelector('sw-app', { state: 'attached' });
  await page.waitForTimeout(1800);
  await page.evaluate(() => document.fonts.ready);
  if (s.worst) {
    await page.evaluate(() => {
      const names = (window as unknown as { __r5worst: string[] }).__r5worst;
      let i = 0;
      const walk = (root: Document | ShadowRoot | Element) => {
        root.querySelectorAll('a.name, .lname .sub b, h3 a, .where b').forEach((el) => { if (el.textContent?.trim()) el.textContent = names[i++ % names.length]; });
        root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) walk(el.shadowRoot); });
      };
      walk(document);
    });
    await page.waitForTimeout(300);
  }
  if (s.after) await s.after(page);
}

test.describe('r5 devices shoot', () => {
  test.skip(!OUT, 'R5_OUT not set');
  test.beforeAll(() => { if (OUT) fs.mkdirSync(OUT, { recursive: true }); });
  for (const skin of SKINS) for (const scheme of ['light', 'dark'] as const) for (const id of SCREENS) {
    test(`${id} ${skin} ${scheme}`, async ({ page }, info) => {
      const vp = info.project.name === 'mobile' ? 'phone' : 'desktop';
      const s = DEF[id];
      if (!s) throw new Error(`unknown screen ${id}`);
      await boot(page, s, skin, scheme);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const file = path.join(OUT, `${id}-${skin}-${scheme}-${vp}.png`);
      await page.screenshot({ path: file, fullPage: false });
      if (over > 1) fs.appendFileSync(path.join(OUT, 'overflow.log'), `${path.basename(file)} sideways ${over}px\n`);
    });
  }
});
