import type { Page, Route } from '@playwright/test';

// WKWATER-POLISH-2331: a mock backend for the water module pages (תשתיות › מים) - invented meters, accounts, bills and customers of an
// invented building, no real device. It answers the WIRE shapes of src/api/water.ts and src/api/water-billing.ts through page.route, so the
// shell, the water tab, the access gate and every page are the real ones. Used by the evidence spec of the polish wave
// (tests/evidence-wkwater-2331.spec.ts); `opts` switch the screen states (empty / error / slow / reduced rights).

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string, user_message: string) => json(route, { code, user_message, retryable: false, correlation_id: 'mock', details: {} }, status);

export interface WaterMockOptions {
  /** the meters list (and so the usage and accounts data): ready, empty, error (500), slow (answers after 20 s - the loading state) */
  data?: 'ready' | 'empty' | 'error' | 'slow';
  /** the viewer's water rights; default: all */
  rights?: Partial<{ can_view: boolean; can_manage: boolean; can_configure: boolean; can_ack: boolean; can_bills: boolean }>;
}

const PERMS = ['water.view', 'water.manage', 'water.ack', 'water.bills', 'system.configure', 'energy.view', 'map.read'];

function me(perms: string[]) {
  return {
    user: { id: 'u-water', username: 'water', display_name: 'דנה', source: 'ingress' }, channel: 'local', remote: null, bindings: [],
    permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
  };
}

const NOW = Date.now();
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const H = 3_600_000;
const D = 86_400_000;

const FLOORS = [
  { id: 'f0', name: 'קומת קרקע', areas: [{ id: 'a-lobby', name: 'לובי' }, { id: 'a-kitchen', name: 'מטבח מסעדה' }] },
  { id: 'f1', name: 'קומה 1', areas: [{ id: 'a-off1', name: 'משרדים צפון' }, { id: 'a-off2', name: 'משרדים דרום' }] },
  { id: 'fr', name: 'גג', areas: [{ id: 'a-roof', name: 'מערכות גג' }] },
];

interface M {
  id: string;
  name: string;
  kind: 'main' | 'sub' | 'irrigation' | 'cooling' | 'pool' | 'other';
  area: string;
  state: 'reporting' | 'not_reporting' | 'paused';
  value: number;
  today: number;
  month: number;
}
const METERS: M[] = [
  { id: 'w1', name: 'מונה ראשי עירוני', kind: 'main', area: 'a-lobby', state: 'reporting', value: 48_213_400, today: 9_840, month: 214_300 },
  { id: 'w2', name: 'מסעדה - מים קרים', kind: 'sub', area: 'a-kitchen', state: 'reporting', value: 12_904_100, today: 3_120, month: 71_450 },
  { id: 'w3', name: 'משרדים צפון', kind: 'sub', area: 'a-off1', state: 'reporting', value: 6_401_220, today: 1_410, month: 30_880 },
  { id: 'w4', name: 'משרדים דרום', kind: 'sub', area: 'a-off2', state: 'not_reporting', value: 5_118_700, today: 0, month: 18_020 },
  { id: 'w5', name: 'מגדל קירור', kind: 'cooling', area: 'a-roof', state: 'reporting', value: 9_870_010, today: 2_960, month: 63_400 },
  { id: 'w6', name: 'השקיה גינה', kind: 'irrigation', area: 'a-lobby', state: 'paused', value: 1_204_500, today: 0, month: 4_210 },
];
const floorOf = (area: string) => FLOORS.find((f) => f.areas.some((a) => a.id === area))!;
const areaName = (area: string) => floorOf(area).areas.find((a) => a.id === area)!.name;

const wireMeter = (m: M) => ({
  id: m.id, display_name: m.name, medium: 'water', kind: m.kind, unit: 'L', device_name: `${m.name} (מונה פולסים)`, area_id: m.area, area_name: areaName(m.area),
  floor_id: floorOf(m.area).id, floor_name: floorOf(m.area).name, status: m.state === 'paused' ? 'paused' : 'active', status_reason: null, max_flow_lph: 4000, revision: 1,
  created_at: iso(200 * D), retired_at: null, muted_until: null, state: m.state, last_report_at: m.state === 'not_reporting' ? iso(9 * H) : iso(4 * 60_000),
  value_l: m.value, today_l: m.today, month_l: m.month, source_ref: `sensor.${m.id}_water`,
});

const EVENTS = [
  { id: 'e1', meter_id: 'w2', kind: 'night_flow', severity: 'alarm', opened_at: iso(6 * H), closed_at: null, value: { lph: 42 }, ack_at: null },
  { id: 'e2', meter_id: 'w4', kind: 'offline', severity: 'warning', opened_at: iso(9 * H), closed_at: null, value: {}, ack_at: iso(2 * H) },
  { id: 'e3', meter_id: 'w5', kind: 'abnormal', severity: 'warning', opened_at: iso(3 * D), closed_at: iso(2 * D), value: { litres: 6200, baseline: 2900 }, ack_at: iso(3 * D) },
  { id: 'e4', meter_id: 'w1', kind: 'burst', severity: 'alarm', opened_at: iso(5 * D), closed_at: iso(5 * D - 2 * H), value: { lph: 3100 }, ack_at: iso(5 * D) },
].map((e) => {
  const m = METERS.find((x) => x.id === e.meter_id)!;
  return { ...e, meter_name: m.name, meter_kind: m.kind, area_name: areaName(m.area), floor_name: floorOf(m.area).name, close_reason: e.closed_at ? 'recovered' : null, suppressed: null, ack_by_display: e.ack_at ? 'דנה' : null, can_ack: !e.ack_at && !e.closed_at, snoozed_until: null, can_snooze: !e.closed_at };
});

const RULES = { night_from: '01:00', night_to: '05:00', night_min_lph: 6, night_min_intervals: 8 };
const SNOOZE = { durations: [15, 60, 240, 1440], default: 60, max: 10080 };

const CUSTOMERS = [
  { id: 'c1', customer_number: '1001', name: 'מסעדת הגן בע״מ', revision: 1, account_count: 1, energy_account_count: 1, address: 'קומת קרקע, יחידה 3', phone: '03-5550101', email: 'office@gan.example', open_balance: '1284.60' },
  { id: 'c2', customer_number: '1002', name: 'אורן ייעוץ הנדסי', revision: 1, account_count: 1, energy_account_count: 0, address: 'קומה 1, צפון', phone: '03-5550102', email: 'oren@oren.example', open_balance: '0.00' },
  { id: 'c3', customer_number: '1003', name: 'סטודיו תכלת', revision: 1, account_count: 1, energy_account_count: 1, address: 'קומה 1, דרום', phone: '054-5550103', email: 'hello@tchelet.example', open_balance: '412.30' },
];

const TARIFF = {
  id: 't1', name: 'תעריף עסקי 2026', currency: 'ILS', used_by: 3, vat_rate_percent: '18',
  versions: [
    { id: 'v2', effective_from: '2026-07-01', water_price: '9.4200', sewage_price: '4.1100', price_mode: 'ex_vat', price_inc_vat: '15.97', locked: false },
    { id: 'v1', effective_from: '2026-01-01', water_price: '9.1000', sewage_price: '3.9800', price_mode: 'ex_vat', price_inc_vat: '15.43', locked: true },
  ],
};
const TARIFF_FULL = { ...TARIFF, current: TARIFF.versions[0] };

const PERIOD = { from: '2026-10-01', to: '2026-10-31' };
const ACCOUNTS = [
  { id: 'ac1', name: 'מסעדה - מים', cust: 'c1', meters: ['w2'], sentence: 'מסעדה - מים קרים', m3: '71.45', amt: '1141.06', last: 'b1' },
  { id: 'ac2', name: 'משרדים צפון', cust: 'c2', meters: ['w3'], sentence: 'משרדים צפון', m3: '30.88', amt: '493.15', last: 'b2' },
  { id: 'ac3', name: 'משרדים דרום', cust: 'c3', meters: ['w4'], sentence: 'משרדים דרום', m3: '18.02', amt: '287.78', last: 'b3' },
  { id: 'ac4', name: 'פחת בניין', cust: 'c1', meters: ['w1', 'w2', 'w3', 'w4', 'w5'], sentence: 'מונה ראשי עירוני פחות כל מוני המשנה', m3: '30.55', amt: '487.88', last: null },
];

const BILLS = [
  { id: 'b1', acc: 'ac1', number: 'W-2026-0031', state: 'issued', m3: '68.20', total: '1284.60', due: '2026-11-15', period: { from: '2026-09-01', to: '2026-09-30' } },
  { id: 'b2', acc: 'ac2', number: 'W-2026-0032', state: 'paid', m3: '29.10', total: '548.21', due: '2026-11-15', period: { from: '2026-09-01', to: '2026-09-30' } },
  { id: 'b3', acc: 'ac3', number: 'W-2026-0033', state: 'sent', m3: '21.90', total: '412.30', due: '2026-10-20', period: { from: '2026-09-01', to: '2026-09-30' } },
  { id: 'b4', acc: 'ac1', number: null, state: 'draft', m3: '71.45', total: '1346.40', due: null, period: PERIOD },
  { id: 'b5', acc: 'ac2', number: 'W-2026-0027', state: 'void', m3: '27.40', total: '516.10', due: '2026-10-15', period: { from: '2026-08-01', to: '2026-08-31' } },
];

function billSummary(b: (typeof BILLS)[number]) {
  const a = ACCOUNTS.find((x) => x.id === b.acc)!;
  const c = CUSTOMERS.find((x) => x.id === a.cust)!;
  return {
    id: b.id, account_id: a.id, account_name: a.name, customer: { id: c.id, customer_number: c.customer_number, name: c.name }, number: b.number, revision: 1, state: b.state, origin: 'manual',
    period: b.period, issue_date: b.number ? '2026-10-01' : null, due_date: b.due, m3: b.m3, total: b.total, replaces_bill_id: null, replaced_by_bill_id: null, row_version: 1,
  };
}

function account(a: (typeof ACCOUNTS)[number]) {
  const c = CUSTOMERS.find((x) => x.id === a.cust)!;
  const last = BILLS.find((b) => b.id === a.last);
  return {
    id: a.id, name: a.name, customer: { id: c.id, customer_number: c.customer_number, name: c.name, address: c.address },
    formula: { ast: a.meters.length === 1 ? { m: a.meters[0] } : { op: '-', args: [{ m: a.meters[0] }, ...a.meters.slice(1).map((m) => ({ m }))] }, text: '', sentence_he: a.sentence, meter_ids: a.meters },
    tariff: { id: TARIFF.id, name: TARIFF.name, water_price: '9.4200', sewage_price: '4.1100', price_mode: 'ex_vat', vat_rate_percent: '18', price_inc_vat: '15.97' },
    period_months: 1, period_anchor_day: 1, period_anchor_month: 1, first_period_start: '2026-01-01', timezone: 'Asia/Jerusalem', auto_mode: 'draft', status: 'active', revision: 1,
    next_period: { from: '2026-11-01', to: '2026-11-30' }, last_bill: last ? billSummary(last) : null, stale_meters: a.meters.includes('w4') ? [{ meter_id: 'w4', name: 'משרדים דרום' }] : [],
  };
}

function status(a: (typeof ACCOUNTS)[number]) {
  return {
    period: PERIOD, day_of_period: 18, days: 31, m3_so_far: a.m3, m3_forecast: (Number(a.m3) * 1.7).toFixed(2), amount_so_far: a.amt,
    meters: a.meters.map((id, i) => {
      const m = METERS.find((x) => x.id === id)!;
      return { meter_id: id, name: m.name, coefficient: i === 0 ? '1' : '-1', start_m3: ((m.value - m.month) / 1000).toFixed(2), current_m3: (m.value / 1000).toFixed(2), consumption_m3: (m.month / 1000).toFixed(2), contribution_m3: ((i === 0 ? 1 : -1) * m.month / 1000).toFixed(2), reporting: m.state === 'reporting', last_report_at: iso(4 * 60_000) };
    }),
    stale: a.meters.includes('w4') ? [{ meter_id: 'w4', name: 'משרדים דרום', since: iso(9 * H) }] : [],
  };
}

function bill(b: (typeof BILLS)[number]) {
  const s = billSummary(b);
  const a = ACCOUNTS.find((x) => x.id === b.acc)!;
  const c = CUSTOMERS.find((x) => x.id === a.cust)!;
  const m3 = Number(b.m3);
  const w = (m3 * 9.42).toFixed(2);
  const sw = (m3 * 4.11).toFixed(2);
  const ex = (Number(w) + Number(sw)).toFixed(2);
  const vat = (Number(ex) * 0.18).toFixed(2);
  const line = (component: 'water' | 'sewage', price: string, amount: string) => ({ component, label_he: component === 'water' ? 'מים' : 'ביוב', from: b.period.from, to: b.period.to, m3: b.m3, price_entered: price, price_mode: 'ex_vat', unit_price_ex_vat: price, amount_ex_vat: amount, vat_rate_percent: '18', vat_amount: (Number(amount) * 0.18).toFixed(2), total: (Number(amount) * 1.18).toFixed(2) });
  return {
    ...s, total: (Number(ex) + Number(vat)).toFixed(2),
    snapshot: {
      schema: 'water-bill/1', business: { name: 'ניהול מגדל הים בע״מ', registration_no: '515550001', address: 'רחוב הדוגמה 1, תל אביב', phone: '03-5550000', email: 'billing@tower.example' },
      customer: { customer_number: c.customer_number, name: c.name, address: c.address, phone: c.phone, email: c.email }, account: { name: a.name, tariff: { name: TARIFF.name }, formula: { sentence_he: a.sentence } },
      lines: [line('water', '9.4200', w), line('sewage', '4.1100', sw)], totals: { m3: b.m3, amount_ex_vat: ex, vat_amount: vat, total: (Number(ex) + Number(vat)).toFixed(2), by_component_ex_vat: { water: w, sewage: sw } },
      notes: [], bill: { replaces: null, expected_due_date: '2026-11-15' },
    },
    sent: b.state === 'sent' || b.state === 'paid' ? { at: '2026-10-02', how: 'email', note: '' } : null,
    paid: b.state === 'paid' ? { at: '2026-10-12', reference: '88412' } : null,
    void: b.state === 'void' ? { at: '2026-09-05', reason: 'קריאת מונה שגויה' } : null,
    actions: b.state === 'draft' ? ['recalculate', 'issue', 'delete'] : b.state === 'issued' ? ['sent', 'paid', 'correct', 'void'] : b.state === 'sent' ? ['paid', 'correct', 'void'] : b.state === 'paid' ? ['correct'] : [],
  };
}

export async function installWaterMock(page: Page, opts: WaterMockOptions = {}): Promise<void> {
  const rights = { can_view: true, can_manage: true, can_configure: true, can_ack: true, can_bills: true, ...opts.rights };
  const empty = opts.data === 'empty';
  const perms = PERMS.filter((p) => (p !== 'water.view' || rights.can_view) && (p !== 'water.manage' || rights.can_manage) && (p !== 'water.bills' || rights.can_bills) && (p !== 'water.ack' || rights.can_ack) && (p !== 'system.configure' || rights.can_configure));
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') return json(route, me(perms));
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'infra.water.enabled': true }, can_edit: false });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'devices/tree') return json(route, { floors: FLOORS.map((f, i) => ({ floor_id: f.id, name: f.name, level: i, icon: null, areas: f.areas.map((a) => ({ area_id: a.id, name: a.name })) })), unassigned: { area_id: 'unassigned', name: 'ללא שיוך' }, scoped: false, can_bulk: false });
    if (!p.startsWith('infra/water/')) return err(route, 404, 'not_found', 'לא נמצא');
    const w = p.slice('infra/water/'.length);
    if (w === 'status') return json(route, { enabled: true, ...rights, meters: empty ? 0 : METERS.length });
    if (opts.data === 'slow') await new Promise((r) => setTimeout(r, 20_000));
    if (opts.data === 'error' && !['alerts'].includes(w)) return err(route, 500, 'internal', 'השרת לא ענה');
    if (w === 'meters') return json(route, { items: empty ? [] : METERS.map(wireMeter) });
    const one = /^meters\/([^/]+)(?:\/(series|manual-readings))?$/.exec(w);
    if (one) {
      const m = METERS.find((x) => x.id === one[1]);
      if (!m) return err(route, 404, 'not_found', 'המונה לא נמצא');
      if (one[2] === 'series') {
        const from = Date.parse(url.searchParams.get('from') ?? iso(D));
        const to = Date.parse(url.searchParams.get('to') ?? iso(0));
        const items = [];
        for (let t = from; t < to && items.length < 800; t += H) items.push({ start: new Date(t).toISOString(), end: new Date(t + H).toISOString(), litres: m.id === 'w2' ? 42 : 3 + ((t / H) % 5) });
        return json(route, { items });
      }
      if (one[2] === 'manual-readings') return json(route, { items: [] });
      return json(route, { ...wireMeter(m), epochs: [{ id: 'ep1', started_at: iso(200 * D), ended_at: null, start_reading_l: 0, end_reading_l: null, reason: 'first', note: null }] });
    }
    if (w === 'consumption') {
      const from = Date.parse(url.searchParams.get('from') ?? iso(30 * D));
      const to = Date.parse(url.searchParams.get('to') ?? iso(0));
      const series = [];
      for (let t = from; t < to && series.length < 800; t += H) {
        const hr = new Date(t).getHours();
        const day = Math.floor(t / D);
        series.push({ start: new Date(t).toISOString(), end: new Date(t + H).toISOString(), litres: empty ? null : Math.round((hr >= 1 && hr < 5 ? 60 : 380 + (hr % 7) * 55) * (1 + ((day * 7) % 5) / 10)) });
      }
      const total = series.reduce((s, x) => s + (x.litres ?? 0), 0);
      const sum = METERS.reduce((s, m) => s + m.month, 0);
      return json(route, {
        from: new Date(from).toISOString(), to: new Date(to).toISOString(), bucket: '1h', series, total_litres: empty ? null : total, previous_total_litres: empty ? null : Math.round(total * 0.92),
        items: empty ? [] : METERS.map((m) => ({ meter_id: m.id, display_name: m.name, kind: m.kind, area_name: areaName(m.area), floor_name: floorOf(m.area).name, litres: Math.round((total * m.month) / sum), previous_litres: Math.round(((total * m.month) / sum) * (0.8 + (m.id.charCodeAt(1) % 4) / 10)), share: m.month / sum, coverage: m.state === 'not_reporting' ? 'partial' : 'full' })),
      });
    }
    if (w.startsWith('events')) {
      const items = empty ? [] : EVENTS;
      const open = items.filter((e) => !e.closed_at);
      return json(route, { items: url.searchParams.get('state') === 'open' ? open : items, summary: { open: open.length, acked: open.filter((e) => e.ack_at).length, last_7d: items.length, open_leaks: open.filter((e) => e.kind === 'night_flow').length, snoozed: 0 } });
    }
    if (w === 'alerts') return rights.can_manage || rights.can_configure ? json(route, { rules: RULES, snooze: SNOOZE, snooze_limits: { min: 5, max: 43200, count: 12 }, row_version: 3, can_edit: rights.can_configure }) : err(route, 403, 'forbidden', 'אין הרשאה');
    if (w === 'candidates' || w.startsWith('candidates')) return json(route, { items: [] });
    if (w === 'billing/shared') return json(route, { vat: { current: { effective_from: '2025-01-01', rate_percent: '18' }, items: [] }, payment_terms: { mode: 'net_days', days: 30, day_of_month: 10 }, numbering: { customer_digits: 4, format: 'W-{yyyy}-{n}' }, default_price_mode: 'ex_vat', business: { name: 'ניהול מגדל הים בע״מ', registration_no: '515550001' }, retention: { draft_days: 30, bill_years: 7 }, edit_link: '#/system/settings?tab=infra', can_edit: true });
    if (w === 'tariffs') return json(route, { items: empty ? [] : [TARIFF_FULL] });
    if (w === 'customers/next-number') return json(route, { customer_number: '1004' });
    if (w === 'customers') return json(route, { items: empty ? [] : CUSTOMERS, total: empty ? 0 : CUSTOMERS.length });
    const cu = /^customers\/([^/]+)$/.exec(w);
    if (cu) {
      const c = CUSTOMERS.find((x) => x.id === cu[1]);
      if (!c) return err(route, 404, 'not_found', 'לא נמצא');
      return json(route, { ...c, tax_id: '515550101', notes: '', accounts: ACCOUNTS.filter((a) => a.cust === c.id).map((a) => ({ id: a.id, name: a.name, status: 'active' })), bills: BILLS.filter((b) => ACCOUNTS.find((a) => a.id === b.acc)?.cust === c.id).map(billSummary) });
    }
    if (w === 'accounts') return json(route, { items: empty ? [] : ACCOUNTS.map(account), summary: { active: ACCOUNTS.length, drafts: 1 } });
    const ac = /^accounts\/([^/]+)(?:\/(status|history|bills))?$/.exec(w);
    if (ac) {
      const a = ACCOUNTS.find((x) => x.id === ac[1]);
      if (!a) return err(route, 404, 'not_found', 'לא נמצא');
      if (ac[2] === 'status') return json(route, status(a));
      if (ac[2] === 'history') return json(route, { periods: [{ ...PERIOD, m3: a.m3, status: 'open', source: 'readings', bill: null }, ...[9, 8, 7, 6, 5].map((mo) => ({ from: `2026-${String(mo).padStart(2, '0')}-01`, to: `2026-${String(mo).padStart(2, '0')}-28`, m3: (Number(a.m3) * (0.85 + mo / 40)).toFixed(2), status: 'measured', source: 'bill', bill: null }))] });
      if (ac[2] === 'bills') return json(route, { items: BILLS.filter((b) => b.acc === a.id).map(billSummary) });
      return json(route, account(a));
    }
    if (w === 'bills' || w.startsWith('bills?')) {
      const items = empty ? [] : BILLS.map(billSummary);
      return json(route, { items, total: items.length, counts: { draft: 1, issued: 1, sent: 1, paid: 1, void: 1 }, sums: { open: '1696.90', paid: '548.21' } });
    }
    const bi = /^bills\/([^/]+)(?:\/(events))?$/.exec(w);
    if (bi) {
      const b = BILLS.find((x) => x.id === bi[1]);
      if (!b) return err(route, 404, 'not_found', 'לא נמצא');
      if (bi[2] === 'events') return json(route, { items: [{ at: '2026-10-01T09:12:00Z', action: 'created', actor: { kind: 'user', display_name: 'דנה' }, details: null }, ...(b.number ? [{ at: '2026-10-01T09:20:00Z', action: 'issued', actor: { kind: 'user', display_name: 'דנה' }, details: null }] : [])] });
      return json(route, bill(b));
    }
    return err(route, 404, 'not_found', 'לא נמצא');
  });
}

/** The URL of a water page: the classic skin, light, the route as the hash. */
export const waterUrl = (hash: string, skin = 'classic', scheme: 'light' | 'dark' = 'light') => `/?design=a&skin=${skin}&scheme=${scheme}#${hash}`;
