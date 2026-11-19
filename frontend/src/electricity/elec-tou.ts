/**
 * EL5 time-of-use (תעו״ז): the definition shape of a TOU tariff version (docs/architecture/ELECTRICITY_TOU.md section 2), the
 * Israeli household template with EMPTY prices, the day grid the editor draws (the same rule as the server's `week_grid`: a band
 * range wins, every other minute is the default band; a range may cross midnight on its own date), and the small arithmetic the
 * demo backend uses to imitate a TOU bill. The server validates and computes; nothing here is the authority.
 */
import { tr } from '../i18n/msg/electricity';
import { docLang } from '../i18n/core';

export const WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type WeekDay = (typeof WEEK)[number];
export const WEEK_HE: Record<WeekDay, string> = { sun: tr('ראשון'), mon: tr('שני'), tue: tr('שלישי'), wed: tr('רביעי'), thu: tr('חמישי'), fri: tr('שישי'), sat: tr('שבת') };

interface TouNamed {
  id: string;
  name_he: string;
  /** CR-FE-LOGEXPORT-TARIFF-EN-2440: the optional English name (Latin text, up to 40 characters); absent = none */
  name_en?: string;
}
interface TouSeason extends TouNamed {
  /** inclusive MM-DD ranges, may wrap the year end */
  ranges: [string, string][];
}
/** [from "HH:MM", to "HH:MM" (24:00 allowed), band id] */
export type TouRange = [string, string, string];
export interface TouDefinition {
  seasons: TouSeason[];
  /** ascending "rest" order: a date that qualifies for several takes the last one */
  day_types: TouNamed[];
  week: Record<WeekDay, string>;
  holiday: string | null;
  holiday_eve: string | null;
  bands: TouNamed[];
  default_band: string;
  schedule: Record<string, Record<string, TouRange[]>>;
  /** price per season and band, as typed (the version's price_mode applies); null = not typed yet */
  prices: Record<string, Record<string, string | null>>;
}
interface TouGridCell {
  from: string;
  to: string;
  band: string;
}
type TouGrid = Record<string, Record<string, TouGridCell[]>>;
interface TouError {
  code: string;
  path: string;
  message: string;
}
export interface TouCheck {
  ok: boolean;
  errors: TouError[];
  definition: TouDefinition | null;
  definition_sha256: string | null;
  grid: TouGrid | null;
  /** CR-BE-SMALL-2440: the English names of the checked definition (saved, else the template's) */
  names_en?: TouNamesEn;
}
export interface TouTemplate {
  id: string;
  name_he: string;
  source_he: string;
  name_en?: string;
  source_en?: string;
  definition: TouDefinition;
}

/** The Israeli household structure of the NN3 research (secondary sources, not verified against the Authority's text), prices empty. */
export function israelTemplate(): TouDefinition {
  return {
    seasons: [
      { id: 'summer', name_he: 'קיץ', name_en: 'Summer', ranges: [['06-01', '09-30']] },
      { id: 'winter', name_he: 'חורף', name_en: 'Winter', ranges: [['12-01', '02-29']] },
      { id: 'transition', name_he: 'מעבר', name_en: 'Transition', ranges: [['03-01', '05-31'], ['10-01', '11-30']] },
    ],
    day_types: [
      { id: 'weekday', name_he: 'ימי חול', name_en: 'Weekdays' },
      { id: 'friday', name_he: 'שישי וערבי חג', name_en: 'Fridays and holiday eves' },
      { id: 'saturday', name_he: 'שבת וחג', name_en: 'Shabbat and holidays' },
    ],
    week: { sun: 'weekday', mon: 'weekday', tue: 'weekday', wed: 'weekday', thu: 'weekday', fri: 'friday', sat: 'saturday' },
    holiday: 'saturday',
    holiday_eve: 'friday',
    bands: [
      { id: 'offpeak', name_he: 'שפל', name_en: 'Off-peak' },
      { id: 'peak', name_he: 'פסגה', name_en: 'Peak' },
    ],
    default_band: 'offpeak',
    schedule: {
      summer: { weekday: [['17:00', '23:00', 'peak']] },
      winter: { weekday: [['17:00', '22:00', 'peak']], friday: [['17:00', '22:00', 'peak']], saturday: [['17:00', '22:00', 'peak']] },
      transition: { weekday: [['17:00', '22:00', 'peak']] },
    },
    prices: { summer: { offpeak: null, peak: null }, winter: { offpeak: null, peak: null }, transition: { offpeak: null, peak: null } },
  };
}

// ------------------------------------------------------------------ English names (CR-FE-LOGEXPORT-TARIFF-EN-2440)

/** The three named lists of a definition. */
export type TouKind = 'seasons' | 'day_types' | 'bands';
/** English names by list and id, as the server answers them (`names_en` of a version, a check or a bill snapshot). */
export type TouNamesEn = Partial<Record<TouKind, Record<string, string>>>;

/** The server's `name_en` rule (services/energy_tou.py `_named`): optional, up to 40 characters, no Hebrew letter. */
export const NAME_EN_MAX = 40;
const HEBREW = /[\u0590-\u05FF]/;
export const nameEnValid = (v: string): boolean => v.trim().length <= NAME_EN_MAX && !HEBREW.test(v);

/** The template's English for an entry that still has the template's id AND Hebrew name (the server's `known_name_en`), so a version
 * saved before English names existed shows them too; '' for anything else. */
let known: Map<string, string> | null = null;
function knownNameEn(kind: TouKind, id: string, nameHe: string): string {
  if (!known) {
    const t = israelTemplate();
    known = new Map((['seasons', 'day_types', 'bands'] as const).flatMap((k) => (t[k] as TouNamed[]).map((it) => [`${k}|${it.id}|${it.name_he}`, it.name_en ?? ''] as [string, string])));
  }
  return known.get(`${kind}|${id}|${nameHe}`) ?? '';
}

/** A server text with an optional English twin (a template's `name_en` / `source_en`): the English in the English interface, else the Hebrew. */
export const heOrEn = (he: string, en?: string | null): string => (en && docLang(['en']) === 'en' ? en : he);

/** The name the interface shows for a season / day type / band: in English its English name (the entry's own, else the server's
 * `names_en`, else the template's), else - and always in Hebrew - its Hebrew name. */
export function touName(kind: TouKind, it: { id: string; name_he: string; name_en?: string }, namesEn?: TouNamesEn | null): string {
  if (docLang(['en']) !== 'en') return it.name_he;
  return it.name_en?.trim() || namesEn?.[kind]?.[it.id] || knownNameEn(kind, it.id, it.name_he) || it.name_he;
}

export const cloneDef = (d: TouDefinition): TouDefinition => JSON.parse(JSON.stringify(d)) as TouDefinition;

export function toMin(hm: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(hm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}
export const fromMin = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** The ranges of one season and day type split at midnight: [from min, to min, band]. */
function parts(ranges: TouRange[] | undefined): [number, number, string][] {
  const out: [number, number, string][] = [];
  for (const [a, b, band] of ranges ?? []) {
    const x = toMin(a);
    const y = b === '24:00' ? 1440 : toMin(b);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x === y) continue;
    if (x < y) out.push([x, y, band]);
    else {
      out.push([x, 1440, band]);
      if (y > 0) out.push([0, y, band]);
    }
  }
  return out.sort((p, q) => p[0] - q[0]);
}

export function bandAt(d: TouDefinition, season: string, dayType: string, minute: number): string {
  for (const [a, b, band] of parts(d.schedule[season]?.[dayType])) if (a <= minute && minute < b) return band;
  return d.default_band;
}

/** Per season and day type, the day as consecutive [from, to, band] cells covering 00:00-24:00. */
export function weekGrid(d: TouDefinition): TouGrid {
  const out: TouGrid = {};
  for (const s of d.seasons) {
    out[s.id] = {};
    for (const t of d.day_types) {
      const cuts = new Set<number>([0, 1440]);
      for (const [a, b] of parts(d.schedule[s.id]?.[t.id])) {
        cuts.add(a);
        cuts.add(b);
      }
      const sorted = [...cuts].sort((a, b) => a - b);
      const cells: TouGridCell[] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const band = bandAt(d, s.id, t.id, sorted[i]);
        const last = cells[cells.length - 1];
        if (last && last.band === band) last.to = fromMin(sorted[i + 1]);
        else cells.push({ from: fromMin(sorted[i]), to: fromMin(sorted[i + 1]), band });
      }
      out[s.id][t.id] = cells;
    }
  }
  return out;
}

/** Bands that can occur in a season (the default band and the bands of its ranges): the prices the server requires. */
export function bandsUsed(d: TouDefinition, season: string): string[] {
  const used = new Set<string>([d.default_band]);
  for (const ranges of Object.values(d.schedule[season] ?? {})) for (const r of ranges) used.add(r[2]);
  return d.bands.map((b) => b.id).filter((b) => used.has(b));
}

const doy = (md: string): number => {
  const [m, dd] = md.split('-').map(Number);
  return Math.round((Date.UTC(2000, m - 1, dd) - Date.UTC(2000, 0, 1)) / 86400000);
};
export function seasonOf(d: TouDefinition, isoDate: string): string {
  const md = isoDate.slice(5);
  const x = doy(md === '02-29' ? '02-28' : md);
  for (const s of d.seasons)
    for (const [a, b] of s.ranges) {
      const p = doy(a);
      const q = doy(b === '02-29' ? '02-28' : b);
      if (p <= q ? p <= x && x <= q : x >= p || x <= q) return s.id;
    }
  return d.seasons[0]?.id ?? '';
}
export function dayTypeOf(d: TouDefinition, isoDate: string, special: 'holiday' | 'holiday_eve' | null): string {
  const wd = WEEK[new Date(`${isoDate}T12:00:00Z`).getUTCDay()];
  const cands = [d.week[wd]];
  if (special === 'holiday' && d.holiday) cands.push(d.holiday);
  if (special === 'holiday_eve' && d.holiday_eve) cands.push(d.holiday_eve);
  const order = d.day_types.map((t) => t.id);
  return cands.reduce((best, c) => (order.indexOf(c) > order.indexOf(best) ? c : best), cands[0]);
}

/** Demo arithmetic: hours per (season, band) of the local dates from..to (inclusive), 24-hour days (the server handles DST). */
export function hoursBySeasonBand(d: TouDefinition, from: string, to: string, special: (iso: string) => 'holiday' | 'holiday_eve' | null): Map<string, number> {
  const out = new Map<string, number>();
  const grid = weekGrid(d);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86400000) {
    const iso = new Date(t).toISOString().slice(0, 10);
    const season = seasonOf(d, iso);
    const dt = dayTypeOf(d, iso, special(iso));
    for (const c of grid[season]?.[dt] ?? []) {
      const k = `${season}|${c.band}`;
      out.set(k, (out.get(k) ?? 0) + (toMin(c.to) - toMin(c.from)) / 60);
    }
  }
  return out;
}

/** A band's colour token (the day bars and the legend): the first band is the calm one, the next ones step up. */
const BAND_TOKENS = ['var(--sw-surface-3)', 'var(--sw-accent)', 'var(--sw-warning)', 'var(--sw-danger)', 'var(--sw-success)', 'color-mix(in srgb, var(--sw-accent) 45%, var(--sw-surface-3))', 'var(--sw-text-3)', 'var(--sw-heading)'];
export const bandColor = (d: TouDefinition, band: string): string => BAND_TOKENS[Math.max(0, d.bands.findIndex((b) => b.id === band)) % BAND_TOKENS.length];

/** A new id for a band or season the manager adds (ids are internal; the manager types only Hebrew names). */
export function freshId(prefix: string, taken: string[]): string {
  for (let i = 1; i < 100; i++) if (!taken.includes(`${prefix}${i}`)) return `${prefix}${i}`;
  return `${prefix}${Date.now() % 10000}`;
}
