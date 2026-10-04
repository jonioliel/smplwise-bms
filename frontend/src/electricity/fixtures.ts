/**
 * Fake electricity data (invented building, no real device): the demo adapter of src/api/electricity-meters.ts (static preview, design review)
 * and the Playwright mock layer (tests/electricity-mocks.ts) share it. Values are kWh, times are UTC ISO strings.
 */
import type { Meter, MeterCandidate, MeterEpoch, EnergySettings } from '../api/electricity-meters';

/** 2026-10-04 22:00 UTC: the "now" of the fixtures, so screenshots do not drift. */
export const FIXTURE_NOW = '2026-10-04T18:49:00Z';

type Row = [id: string, name: string, area: string, floor: string, reading: number, today: number, month: number, status: Meter['status'], accounts: string[]];

const AREA_ID: Record<string, string> = { 'חדר חשמל': 'a-elec', לובי: 'a-lobby', 'מאפיית השקד': 'a-bakery', 'סטודיו אורן': 'a-studio', 'מסדרון קומה 1': 'a-hall1', 'משרדי גל-טק': 'a-galtech', חניון: 'a-parking' };
const FLOOR_ID: Record<string, string> = { 'קומת קרקע': 'f-0', 'קומה 1': 'f-1', 'קומה 2': 'f-2', חניון: 'f-p' };

const ROWS: Row[] = [
  ['m1', 'לוח ראשי - בניין', 'חדר חשמל', 'קומת קרקע', 248912.4, 612.3, 2410.7, 'reporting', ['שטחים משותפים']],
  ['m2', 'לוח סטודיו', 'סטודיו אורן', 'קומה 1', 13264.2, 24.6, 98.1, 'reporting', ['סטודיו אורן - קומה 1', 'שטחים משותפים']],
  ['m3', 'תאורת לובי', 'לובי', 'קומת קרקע', 4553.9, 10.1, 41.2, 'reporting', ['סטודיו אורן - קומה 1']],
  ['m4', 'מזגן משותף - קומה 1', 'מסדרון קומה 1', 'קומה 1', 9112.8, 31.4, 140.7, 'reporting', ['משרדי גל-טק - קומה 2']],
  ['m5', 'לוח גל-טק', 'משרדי גל-טק', 'קומה 2', 31770.25, 48.2, 181.6, 'reporting', ['משרדי גל-טק - קומה 2', 'שטחים משותפים']],
  ['m6', 'לוח מאפייה - פאזה 1', 'מאפיית השקד', 'קומת קרקע', 18402.11, 41.3, 152.4, 'reporting', ['מאפיית השקד']],
  ['m7', 'לוח מאפייה - פאזה 2', 'מאפיית השקד', 'קומת קרקע', 17995.4, 39.8, 146.9, 'reporting', ['מאפיית השקד']],
  ['m8', 'לוח מאפייה - פאזה 3', 'מאפיית השקד', 'קומת קרקע', 18120.07, 22.1, 129.5, 'stale', ['מאפיית השקד']],
  ['m9', 'מעלית', 'לובי', 'קומת קרקע', 6240.66, 7.2, 27.8, 'reporting', []],
  ['m10', 'חניון - תאורה', 'חניון', 'חניון', 3880.2, 0, 0, 'paused', []],
  ['m11', 'עמדת טעינה 1', 'חניון', 'חניון', 2104.9, 12.8, 46.3, 'reporting', ['גל-טק - עמדת טעינה']],
  ['m12', 'משאבות מים', 'חדר חשמל', 'קומת קרקע', 1560.33, 2.9, 11.6, 'reporting', []],
];

export function fixtureMeters(): Meter[] {
  return ROWS.map(([id, name, area, floor, reading, today, month, status, accounts]) => ({
    id,
    name,
    device_id: null,
    device_name: null,
    entity_name: null,
    area_id: AREA_ID[area],
    area_name: area,
    floor_id: FLOOR_ID[floor],
    floor_name: floor,
    status,
    reading_kwh: reading,
    last_report_at: status === 'stale' ? '2026-10-04T15:40:00Z' : status === 'paused' ? '2026-09-20T08:00:00Z' : FIXTURE_NOW,
    today_kwh: today,
    month_kwh: month,
    accounts,
    accounts_count: accounts.length,
    revision: 1,
  }));
}

export function fixtureEpochs(id: string): MeterEpoch[] {
  const base: MeterEpoch[] = [{ started_at: '2025-03-12T09:00:00Z', ended_at: null, start_reading_kwh: 0, reason: 'install', note: '' }];
  if (id === 'm2') base.push({ started_at: '2026-08-02T00:12:00Z', ended_at: null, start_reading_kwh: 0, reason: 'reset', note: 'נספר אוטומטית, ללא אובדן צריכה' });
  return base;
}

/** Daily consumption of the last 30 days (oldest first), deterministic. */
export function fixtureSeries(id: string, points: number, stepMs = 86_400_000): { t: string; kwh: number }[] {
  const seed = id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  const out: { t: string; kwh: number }[] = [];
  const end = Date.parse(FIXTURE_NOW);
  const scale = stepMs < 86_400_000 ? 1 / 24 : 1;
  for (let i = points - 1; i >= 0; i--) {
    const t = new Date(end - i * stepMs).toISOString();
    const weekend = [5, 6].includes(new Date(t).getUTCDay());
    out.push({ t, kwh: Math.round((18 + ((i * 7 + seed) % 11) * 1.1 + (weekend && scale === 1 ? -6 : 0)) * scale * 100) / 100 });
  }
  return out;
}

const REASONS: Record<string, MeterCandidate['reason_code']> = { kw: 'kw', unit: 'unit', total: 'total', returned: 'returned' };

export function fixtureCandidates(): MeterCandidate[] {
  const add = (entity_id: string, name: string, device_name: string | null, area_name: string, floor_name: string, value: string, verdict: MeterCandidate['verdict'], why: string | null, already = false): MeterCandidate => ({
    entity_id,
    name,
    device_id: device_name ? `dev_${entity_id}` : null,
    device_name,
    entity_name: name,
    area_id: AREA_ID[area_name] ?? null,
    area_name,
    floor_name,
    value,
    verdict,
    reason_code: why ? REASONS[why] : null,
    message: null,
    already_added: already,
  });
  return [
    add('sensor.gym_energy', 'לוח חדר כושר', 'מונה חכם חדר כושר', 'חניון', 'חניון', '1,204.50 kWh', 'ok', null),
    add('sensor.back_office_energy', 'לוח משרד אחורי', 'מונה חכם משרד אחורי', 'משרדי גל-טק', 'קומה 2', '3,310.20 kWh', 'ok', null),
    add('sensor.generator_energy', 'לוח גנרטור', null, 'חדר חשמל', 'קומת קרקע', '88.00 kWh', 'ok', null),
    add('sensor.m2_energy', 'לוח סטודיו', null, 'סטודיו אורן', 'קומה 1', '13,264.20 kWh', 'ok', null, true),
    add('sensor.bakery_daily', 'צריכה יומית - מאפייה', null, 'מאפיית השקד', 'קומת קרקע', '41.30 kWh', 'warn', 'total'),
    add('sensor.main_power', 'הספק לוח ראשי', null, 'חדר חשמל', 'קומת קרקע', '14.2 kW', 'rejected', 'kw'),
    add('sensor.hall_power', 'הספק מזגן משותף', null, 'מסדרון קומה 1', 'קומה 1', '2,310 W', 'rejected', 'kw'),
    add('sensor.roof_returned', 'אנרגיה מוחזרת - גג', null, 'חדר חשמל', 'קומת קרקע', '1,204.5 kWh', 'rejected', 'returned'),
    add('sensor.phase1_voltage', 'מתח פאזה 1', null, 'חדר חשמל', 'קומת קרקע', '231 V', 'rejected', 'unit'),
  ];
}

export function fixtureSettings(): EnergySettings {
  return {
    raw_retention_days: 90,
    interval_retention_months: 26,
    bill_retention_years: 7,
    draft_retention_days: 30,
    usage: { raw_bytes: 212 * 1_048_576, interval_bytes: 96 * 1_048_576, bill_bytes: 41 * 1_048_576, draft_bytes: 1_048_576 },
    meter_count: 12,
    editable: { raw_retention_days: true, interval_retention_months: true, bill_retention_years: true, draft_retention_days: true },
    ranges: { raw_retention_days: { min: 7, max: 366 }, interval_retention_months: { min: 3, max: 120 }, bill_retention_years: { min: 1, max: 15 }, draft_retention_days: { min: 7, max: 365 } },
  };
}
