// HOME-V3-P3-2432: the pure logic of the home interface's phase 3 (mockup v3, round 27: music and screens, announcements, the electricity
// bill, water, the house systems, the home map). No DOM, no network; unit-tested in tests/unit-home-v3-p3-logic.spec.ts.
// Family words only: no platform, product or protocol names, no internal terms.

/** The six categories phase 3 adds (services/home_interface.MODULES_P3; an administrator can hide each per person). */
export const P3_MODULES = ['media', 'announce', 'bills', 'water', 'systems', 'map'] as const;
export type HomeModuleP3 = (typeof P3_MODULES)[number];
export const P3_MODULE_LABEL: Record<HomeModuleP3, string> = {
  media: 'מוזיקה ומסכים', announce: 'כריזה בבית', bills: 'חשבון חשמל', water: 'מים', systems: 'מערכות הבית', map: 'מפת הבית',
};
/** The screens phase 3 adds below #/home (the announcement is a sheet, not a screen). */
export const P3_SCREENS = ['media', 'bills', 'water', 'systems', 'map'] as const;
export type P3Screen = (typeof P3_SCREENS)[number];
export const isP3Screen = (name: string): name is P3Screen => (P3_SCREENS as readonly string[]).includes(name);

export const plural = (n: number, one: string, many: string): string => (n === 1 ? one : `${n} ${many}`);

// ---------------------------------------------------------------- music and screens

export type MediaLook = 'tv' | 'music';
/** A screen (and a receiver, which drives one) reads as a television; everything else as music. */
export const mediaLook = (kind: string): MediaLook => (kind === 'screen' ? 'tv' : 'music');

/** The playing line of a device, in plain words: the title (with the artist), the channel, or what the screen shows. */
export function nowLine(now: { title?: string | null; artist?: string | null; channel?: string | null; label?: string | null } | null | undefined): { title: string; by: string } {
  if (!now) return { title: '', by: '' };
  const title = (now.title || now.channel || now.label || '').trim();
  const by = (now.artist || (now.title && now.label && now.label !== now.title ? now.label : '') || '').trim();
  return { title, by };
}

/** Progress 0..1 of what plays, or null when it has no length (a station, a channel). */
export function progressOf(now: { position_s?: number | null; duration_s?: number | null } | null | undefined): number | null {
  const p = now?.position_s;
  const d = now?.duration_s;
  if (p == null || !d || d <= 0) return null;
  return Math.max(0, Math.min(1, p / d));
}

// ---------------------------------------------------------------- the electricity bill

/** Days into the period and its length (inclusive dates, ISO yyyy-mm-dd), and the straight-line estimate at its end. */
export function billForecast(soFar: number | null, from: string | null | undefined, to: string | null | undefined, today: Date = new Date()): { day: number; of: number; forecast: number | null } | null {
  if (!from || !to) return null;
  const a = Date.parse(from + 'T00:00:00Z');
  const b = Date.parse(to + 'T00:00:00Z');
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  const of = Math.round((b - a) / 86_400_000) + 1;
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const day = Math.max(1, Math.min(of, Math.round((t - a) / 86_400_000) + 1));
  const forecast = soFar != null && Number.isFinite(soFar) && day >= 3 ? (soFar / day) * of : null; // under three days the estimate says nothing
  return { day, of, forecast };
}

export const money = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** "1,234" - whole shekels, Latin digits (the product's number rule). */
export const ils = (n: number): string => Math.round(n).toLocaleString('en-US');

/** HOME-V3-AUDITFIX-2437 (audit item 17): a reading for people - thousands separated, at most one decimal ("12,480.5", "98,000"). */
const NUM1 = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1 });
export const num1 = (n: number): string => NUM1.format(n);

/** Today against a usual day in words; past 999 % a percentage says nothing, so "הרבה יותר" (audit item 17). `d` = whole percent. */
export function diffWords(d: number, than: string): { pct: string | null; words: string } {
  if (d > 999) return { pct: null, words: `הרבה יותר ${than}` };
  return { pct: `${num1(Math.abs(d))}%`, words: `${d < 0 ? 'פחות' : 'יותר'} ${than}` };
}

/** The difference between the estimate and the last bill, in words. */
export function vsLast(forecast: number | null, last: number | null): string {
  if (forecast == null || last == null) return '';
  const d = forecast - last;
  if (Math.abs(d) < Math.max(10, last * 0.03)) return 'כמו בחשבון הקודם';
  return `${ils(Math.abs(d))} ₪ ${d > 0 ? 'יותר' : 'פחות'} מהחשבון הקודם`;
}

export const BILL_STATE: Record<string, [string, string]> = {
  draft: ['בהכנה', 'neutral'], issued: ['לתשלום', 'warn'], sent: ['לתשלום', 'warn'], paid: ['שולם', 'ok'], void: ['בוטל', 'neutral'],
};

export const HE_MONTH = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' });
/** "אוקטובר 2026" for a period that is one calendar month, else "1.9 - 30.9". */
export function periodName(from: string, to: string): string {
  const a = new Date(from + 'T00:00:00Z');
  const b = new Date(to + 'T00:00:00Z');
  if (a.getUTCDate() === 1 && a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) return HE_MONTH.format(a);
  return `${a.getUTCDate()}.${a.getUTCMonth() + 1} - ${b.getUTCDate()}.${b.getUTCMonth() + 1}`;
}

// ---------------------------------------------------------------- water

const HE_DAY = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
/** The week's bars: seven local days ending today, each with its litres (null = no reading). */
export function weekBars(series: { start: string; litres: number | null }[] | null | undefined, today: Date = new Date()): [string, number | null][] {
  const out: [string, number | null][] = [];
  const by = new Map<string, number | null>();
  for (const s of series ?? []) {
    const d = new Date(s.start);
    by.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, s.litres == null ? null : Math.round(s.litres));
  }
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    out.push([i === 0 ? 'היום' : HE_DAY[d.getDay()], by.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) ?? null]);
  }
  return out;
}

/** Today against the mean of the other days that have a reading, as a whole percent (null without a usual day). */
export function vsUsual(bars: [string, number | null][]): number | null {
  const today = bars[bars.length - 1]?.[1];
  const rest = bars.slice(0, -1).map((b) => b[1]).filter((v): v is number => v != null && v > 0);
  if (today == null || !rest.length) return null;
  const usual = rest.reduce((a, b) => a + b, 0) / rest.length;
  return usual > 0 ? Math.round(((today - usual) / usual) * 100) : null;
}

// ---------------------------------------------------------------- house systems (view only)

export const TEMP_OK = new Set(['ok', 'off']);
export const ELEVATOR_WORD: Record<string, [string, string]> = {
  active: ['פועלת', 'ok'], moving_up: ['פועלת', 'ok'], moving_down: ['פועלת', 'ok'], travelling: ['בנסיעה', 'ok'], waiting: ['ממתינה', 'ok'], door_open: ['דלת פתוחה', 'ok'],
  out_of_service: ['לא בשימוש כרגע', 'warn'], fault: ['תקלה', 'warn'], fire_service: ['מצב חירום', 'warn'], unknown: ['אין מידע עכשיו', 'neutral'],
};
export const GEN_WORD: Record<string, [string, string]> = {
  standby: ['מוכן', 'ok'], running: ['פועל', 'warn'], starting: ['מתניע', 'warn'], cooling: ['מתקרר', 'warn'], alarm: ['יש התראה', 'warn'], fault: ['תקלה', 'warn'],
  unknown: ['אין מידע עכשיו', 'neutral'],
};
export const SUPPLY_WORD: Record<string, [string, string, string]> = {
  mains: ['חשמל מהרשת', 'תקין', 'ok'], generator: ['על גנרטור', 'אין חשמל מהרשת', 'warn'], none: ['אין חשמל מהרשת', 'כדאי לבדוק', 'warn'], unknown: ['אין מידע על החשמל', 'נבדוק שוב בקרוב', 'neutral'],
};

// ---------------------------------------------------------------- the home map (a schematic plan, drawn from the rooms; never mirrored)

export interface PlanBox { id: string; x: number; y: number; w: number; h: number }

/** A treemap of the floor's rooms in a 100 x 100 field, each room's area by its weight (its devices, at least 1), the heaviest first:
 * the field is split along its longer side into two groups of about equal weight, recursively. Deterministic; boxes never overlap. */
export function planBoxes(rooms: { id: string; weight: number }[], aspect = 1.6): PlanBox[] {
  const items = rooms.map((r) => ({ id: r.id, w: Math.max(1, r.weight) })).sort((a, b) => b.w - a.w || a.id.localeCompare(b.id));
  const out: PlanBox[] = [];
  const split = (list: typeof items, x: number, y: number, w: number, h: number) => {
    if (!list.length) return;
    if (list.length === 1) { out.push({ id: list[0].id, x, y, w, h }); return; }
    const total = list.reduce((a, b) => a + b.w, 0);
    let acc = 0;
    let k = 0;
    while (k < list.length - 1 && acc + list[k].w <= total / 2) acc += list[k++].w;
    if (k === 0) acc = list[k++].w;
    const f = acc / total;
    if (w * aspect >= h) { split(list.slice(0, k), x, y, w * f, h); split(list.slice(k), x + w * f, y, w * (1 - f), h); }
    else { split(list.slice(0, k), x, y, w, h * f); split(list.slice(k), x, y + h * f, w, h * (1 - f)); }
  };
  split(items, 0, 0, 100, 100);
  return out;
}
