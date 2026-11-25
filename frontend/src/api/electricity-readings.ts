/**
 * EL6 electricity meters: manual readings of the physical meter and calibration of the system counter against it - the ONLY module of the
 * frontend that talks to `/api/v1/energy/meters/{id}/manual-readings` and `/calibrations` (docs/changes/EL6-MANUAL-READING-CALIBRATION.md).
 * With a backend the HTTP adapter calls the routes; without one (static preview, design review) an in-memory demo answers from fixed fake data.
 * The wire shapes are used as they are (snake_case); energy is kWh. Money never appears here.
 */
import { ApiError, get, post } from './client';
import { isApi } from './session';
import { FIXTURE_NOW } from '../electricity/fixtures';
import { tr } from '../i18n/msg/api-electricity';
import type * as Wire from './generated/wire-consumption';

export type ReadingUnit = 'kWh' | 'Wh' | 'MWh';
/** allocation: the reading closed or re-split a reporting gap; record: kept for comparison only. */
type ReadingEffect = 'allocation' | 'record';
type EffectReason = 'open_gap' | 'closed_gap' | 'head_gap' | 'reported' | 'outside_counter' | 'no_counter_data' | 'counter_events' | 'implausible' | 'billed';

/* The shapes below are the backend's response models (smplwise_vms/backend/smplwise/wire/energy_meters.py, generated into
 * ./generated/wire-consumption.ts), narrowed to what the screens and the demo use: a field the server renames or drops is a compile
 * error here (code review 07:F8 step 2). Narrowed on purpose: a stored reading always has its kWh (`value_wh` is NOT NULL) and one of
 * the known effect reasons; the calibration in force always has an offset. */

/** A typed reading of the physical meter. `id` is null in a dry-run answer (nothing saved yet); `system_kwh` = what the system counter
 * showed at that instant on the physical scale (null = no value then); `deviation_kwh` = value - system; `message` = the server's short
 * operator sentence for the effect. */
export type ManualReading = Pick<
  Wire.EnergyManualReading,
  | 'id' | 'read_at' | 'value_wh' | 'typed_value' | 'typed_unit' | 'system_kwh' | 'system_exact' | 'deviation_kwh' | 'effect' | 'message' | 'note'
  | 'created_at' | 'created_by_name' | 'voided_at' | 'voided_by_name' | 'void_reason' | 'can_undo' | 'undo_until'
> & { value_kwh: number; effect_reason: EffectReason };

/** A calibration from a date on: physical = factor x counter + offset (`factor` is decimal text). */
export type Calibration = Pick<
  Wire.EnergyCalibration,
  | 'id' | 'effective_date' | 'effective_from' | 'factor' | 'anchor_reading_id' | 'note' | 'in_force' | 'created_at' | 'created_by_name' | 'voided_at'
  | 'voided_by_name' | 'void_reason' | 'can_undo' | 'undo_until'
> & { offset_kwh: number };

/** The meter's log: readings newest first (undone ones included, marked), the calibrations, the calibration in force, a suggested factor
 * (a hint only), and the end of the last issued bill with the meter (UTC) - a calibration may start on `first_calibration_date` at the earliest. */
export type ReadingLog = Pick<Wire.EnergyReadingLog, 'meter_id' | 'suggestion' | 'billed_until' | 'first_calibration_date' | 'undo_window_hours'> & {
  items: ManualReading[];
  calibrations: Calibration[];
  calibration: Omit<Wire.EnergyCalibrationCurrent, 'offset_kwh'> & { offset_kwh: number };
};

interface ReadingBody {
  read_at: string;
  value: string;
  unit: ReadingUnit;
  note?: string;
  dry_run?: boolean;
}
interface CalibrationBody {
  effective_date: string;
  factor: string;
  offset_kwh?: string;
  anchor_reading_id?: string;
  note?: string;
  dry_run?: boolean;
}

interface ReadingsAdapter {
  log(meterId: string): Promise<ReadingLog>;
  addReading(meterId: string, body: ReadingBody): Promise<{ reading: ManualReading; log: ReadingLog | null }>;
  undoReading(meterId: string, id: string, reason?: string): Promise<ReadingLog>;
  addCalibration(meterId: string, body: CalibrationBody): Promise<{ calibration: Calibration; log: ReadingLog | null }>;
  undoCalibration(meterId: string, id: string, reason?: string): Promise<ReadingLog>;
}

const base = (id: string) => `energy/meters/${encodeURIComponent(id)}`;

const http: ReadingsAdapter = {
  log: (id) => get<ReadingLog>(`${base(id)}/manual-readings`),
  async addReading(id, body) {
    const r = await post<{ reading: ManualReading; log?: ReadingLog }>(`${base(id)}/manual-readings`, body);
    return { reading: r.reading, log: r.log ?? null };
  },
  undoReading: (id, rid, reason) => post<ReadingLog>(`${base(id)}/manual-readings/${encodeURIComponent(rid)}/undo`, reason ? { reason } : {}),
  async addCalibration(id, body) {
    const r = await post<{ calibration: Calibration; log?: ReadingLog }>(`${base(id)}/calibrations`, body);
    return { calibration: r.calibration, log: r.log ?? null };
  },
  undoCalibration: (id, cid, reason) => post<ReadingLog>(`${base(id)}/calibrations/${encodeURIComponent(cid)}/undo`, reason ? { reason } : {}),
};

// ------------------------------------------------------------------------------------------------ demo adapter (no backend; fake data)

const UNIT_WH: Record<ReadingUnit, number> = { kWh: 1000, Wh: 1, MWh: 1_000_000 };
const TEXT: Record<EffectReason, string> = {
  open_gap: tr('הקריאה השלימה את הפער מאז הדיווח האחרון. הצריכה עד הקריאה חולקה לפי זמן.'),
  closed_gap: tr('הקריאה חילקה מחדש את הצריכה בפער הדיווח. הסכום הכולל לא השתנה.'),
  head_gap: tr('הקריאה נקבעה כקריאת פתיחה לפני הקריאה הראשונה של המונה. הצריכה עד הקריאה הראשונה חולקה לפי זמן.'),
  reported: tr('המונה דיווח בזמן הזה. הקריאה נשמרה להשוואה בלבד.'),
  outside_counter: tr('הקריאה שונה מערך המונה במערכת. היא נשמרה להשוואה; לתיקון קבוע אפשר להגדיר כיול.'),
  no_counter_data: tr('אין במערכת קריאות סביב הזמן הזה. הקריאה נשמרה להשוואה בלבד.'),
  counter_events: tr('בזמן הזה היה איפוס או קפיצה במונה. הקריאה נשמרה להשוואה בלבד.'),
  implausible: tr('הקריאה גבוהה מהסביר להספק המרבי של המונה. היא נשמרה להשוואה בלבד.'),
  billed: tr('התקופה הזו כבר חויבה. הקריאה נשמרה להשוואה בלבד.'),
};

/** The fixed fake log of a meter: m1 has two compared readings and a calibration, m8 (not reporting) one reading that closed its gap. */
export function fixtureReadingLog(meterId: string, systemKwh = 0): ReadingLog {
  const identity = { factor: '1.0', offset_kwh: 0, calibration_id: null, effective_date: null, identity: true };
  const log: ReadingLog = { meter_id: meterId, items: [], calibrations: [], calibration: identity, suggestion: null, billed_until: '2026-09-30T21:00:00Z', first_calibration_date: '2026-10-01', undo_window_hours: 24 };
  const rd = (id: string, at: string, kwh: number, sys: number | null, effect: ReadingEffect, reason: EffectReason, extra: Partial<ManualReading> = {}): ManualReading => ({
    id, read_at: at, value_kwh: kwh, value_wh: Math.round(kwh * 1000), typed_value: String(kwh), typed_unit: 'kWh', system_kwh: sys, system_exact: sys != null,
    deviation_kwh: sys == null ? null : Math.round((kwh - sys) * 1000) / 1000, effect, effect_reason: reason, message: TEXT[reason], note: null,
    // i18n-keep: demo data: invented names, as the api demo stores
    created_at: at, created_by_name: 'דנה', voided_at: null, voided_by_name: null, void_reason: null, can_undo: false, undo_until: null, ...extra,
  });
  if (meterId === 'm1') {
    log.items = [
      rd('r2', '2026-10-01T06:10:00Z', 247215.6, 245830.1, 'record', 'reported'),
      // i18n-keep: demo data: invented names, as the api demo stores
      rd('r1', '2026-09-01T06:05:00Z', 230981.0, 229712.4, 'record', 'reported', { note: 'קריאה בלוח הראשי' }),
    ];
    log.calibrations = [{ id: 'c1', effective_date: '2026-10-02', effective_from: '2026-10-01T21:00:00Z', factor: '1.0', offset_kwh: 1385.5, anchor_reading_id: 'r2', note: null, in_force: true,
      // i18n-keep: demo data: invented names, as the api demo stores
      created_at: '2026-10-01T06:20:00Z', created_by_name: 'דנה', voided_at: null, voided_by_name: null, void_reason: null, can_undo: false, undo_until: null }];
    log.calibration = { factor: '1.0', offset_kwh: 1385.5, calibration_id: 'c1', effective_date: '2026-10-02', identity: false };
    log.suggestion = { factor: '1.0073', from_reading_id: 'r1', to_reading_id: 'r2', anchor_reading_id: 'r2' };
  }
  if (meterId === 'm8') log.items = [rd('r3', '2026-10-04T17:30:00Z', systemKwh || 18131.4, null, 'allocation', 'open_gap', { created_at: FIXTURE_NOW, can_undo: true, undo_until: '2026-10-05T18:49:00Z' })];
  return log;
}

const demoLogs = new Map<string, ReadingLog>();
const delay = <T>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), 60));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
function demoError(status: number, code: string, user_message: string, details: Record<string, unknown> = {}): never {
  throw new ApiError(status, { code, user_message, retryable: false, correlation_id: 'demo', details });
}
const dlog = (id: string) => {
  if (!demoLogs.has(id)) demoLogs.set(id, fixtureReadingLog(id));
  return demoLogs.get(id)!;
};

const demo: ReadingsAdapter = {
  log: (id) => delay(clone(dlog(id))),
  addReading(id, body) {
    const log = dlog(id);
    const kwh = (Number(body.value) * UNIT_WH[body.unit]) / 1000;
    if (!Number.isFinite(kwh) || kwh < 0) return demoError(422, 'validation', tr('הערך אינו מספר.'), { fields: ['value'] });
    if (Date.parse(body.read_at) > Date.now() + 300_000) return demoError(422, 'validation', tr('זמן הקריאה בעתיד.'), { fields: ['read_at'] });
    const live = log.items.filter((r) => !r.voided_at);
    const before = live.filter((r) => r.read_at < body.read_at).sort((a, b) => (a.read_at < b.read_at ? 1 : -1))[0];
    if (before && kwh < before.value_kwh) return demoError(422, 'reading_not_monotonic', tr('הקריאה נמוכה מקריאה ידנית קודמת של אותו מונה.'), { fields: ['value'] });
    const sys = id === 'm8' ? null : 1000;
    const reason: EffectReason = id === 'm8' ? 'open_gap' : 'reported';
    const r: ManualReading = {
      id: body.dry_run ? null : `r${Date.now()}`, read_at: body.read_at, value_kwh: kwh, value_wh: Math.round(kwh * 1000), typed_value: body.value, typed_unit: body.unit, system_kwh: sys,
      system_exact: sys != null, deviation_kwh: sys == null ? null : Math.round((kwh - sys) * 1000) / 1000, effect: id === 'm8' ? 'allocation' : 'record', effect_reason: reason,
      // i18n-keep: demo data: invented names, as the api demo stores
      message: TEXT[reason], note: body.note ?? null, created_at: new Date().toISOString(), created_by_name: 'דנה', voided_at: null, voided_by_name: null, void_reason: null,
      can_undo: true, undo_until: new Date(Date.now() + 86_400_000).toISOString(),
    };
    if (body.dry_run) return delay({ reading: r, log: null });
    log.items = [r, ...log.items].sort((a, b) => (a.read_at < b.read_at ? 1 : -1));
    return delay({ reading: clone(r), log: clone(log) });
  },
  undoReading(id, rid, reason) {
    const log = dlog(id);
    const r = log.items.find((x) => x.id === rid);
    if (!r) return demoError(404, 'not_found', tr('הקריאה לא נמצאה.'));
    if (!r.can_undo) return demoError(409, 'undo_window_passed', tr('עבר הזמן שבו אפשר לבטל את הקריאה (24 שעות).'));
    // i18n-keep: demo data: invented names, as the api demo stores
    Object.assign(r, { voided_at: new Date().toISOString(), voided_by_name: 'דנה', void_reason: reason ?? null, can_undo: false });
    return delay(clone(log));
  },
  addCalibration(id, body) {
    const log = dlog(id);
    const f = Number(body.factor);
    if (!Number.isFinite(f) || f < 0.5 || f > 2) return demoError(422, 'validation', tr('המקדם חייב להיות בין 0.5 ל-2.'), { fields: ['factor'] });
    if (log.first_calibration_date && body.effective_date < log.first_calibration_date) return demoError(409, 'calibration_billed', tr('התקופה הזו כבר חויבה. אפשר לכייל רק מ-{date} והלאה.', { date: log.first_calibration_date.split('-').reverse().join('.') }));
    const anchor = log.items.find((r) => r.id === body.anchor_reading_id);
    const offset = anchor && anchor.system_kwh != null ? Math.round((anchor.value_kwh - f * anchor.system_kwh) * 1000) / 1000 : Number(body.offset_kwh ?? 0);
    const c: Calibration = {
      id: body.dry_run ? null : `c${Date.now()}`, effective_date: body.effective_date, effective_from: `${body.effective_date}T00:00:00Z`, factor: String(f), offset_kwh: offset,
      // i18n-keep: demo data: invented names, as the api demo stores
      anchor_reading_id: body.anchor_reading_id ?? null, note: body.note ?? null, in_force: false, created_at: new Date().toISOString(), created_by_name: 'דנה',
      voided_at: null, voided_by_name: null, void_reason: null, can_undo: true, undo_until: new Date(Date.now() + 86_400_000).toISOString(),
    };
    if (body.dry_run) return delay({ calibration: c, log: null });
    log.calibrations = [c, ...log.calibrations];
    return delay({ calibration: clone(c), log: clone(log) });
  },
  undoCalibration(id, cid, reason) {
    const log = dlog(id);
    const c = log.calibrations.find((x) => x.id === cid);
    if (!c) return demoError(404, 'not_found', tr('הכיול לא נמצא.'));
    // i18n-keep: demo data: invented names, as the api demo stores
    Object.assign(c, { voided_at: new Date().toISOString(), voided_by_name: 'דנה', void_reason: reason ?? null, can_undo: false, in_force: false });
    return delay(clone(log));
  },
};

export const readings = (): ReadingsAdapter => (isApi() ? http : demo);
export const getReadingLog = (meterId: string) => readings().log(meterId);
export const addManualReading = (meterId: string, body: ReadingBody) => readings().addReading(meterId, body);
export const undoManualReading = (meterId: string, id: string, reason?: string) => readings().undoReading(meterId, id, reason);
export const addCalibration = (meterId: string, body: CalibrationBody) => readings().addCalibration(meterId, body);
export const undoCalibration = (meterId: string, id: string, reason?: string) => readings().undoCalibration(meterId, id, reason);

// ------------------------------------------------------------------------------------------------ pure helpers (unit-tested)

/** A typed number: Western digits, one decimal point (a comma accepted as the decimal mark), no sign. null = not a valid reading. */
export function parseReading(text: string): string | null {
  const t = text.trim().replace(/[\s ]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? t : null;
}

/** A calibration factor: 0.5 - 2, at most 6 decimals. null = invalid. */
export function parseFactor(text: string): string | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,6})?$/.test(t)) return null;
  const f = Number(t);
  return f >= 0.5 && f <= 2 ? t : null;
}

/** `datetime-local` value (local wall clock) -> UTC ISO; null when empty or invalid. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** A Date as the value of an `<input type="datetime-local" lang=${dateInputLang()}>` (local wall clock, minutes). */
export function isoToLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** The short label of what a reading did. */
export const EFFECT_LABEL: Record<EffectReason, string> = {
  open_gap: tr('השלימה פער'),
  closed_gap: tr('חילקה פער'),
  head_gap: tr('קריאת פתיחה'),
  reported: tr('להשוואה'),
  outside_counter: tr('להשוואה'),
  no_counter_data: tr('להשוואה'),
  counter_events: tr('להשוואה'),
  implausible: tr('להשוואה'),
  billed: tr('להשוואה'),
};
