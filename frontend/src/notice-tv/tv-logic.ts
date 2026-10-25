/**
 * CR-NOTICE106 - the TV board's pure logic (no DOM): the feed's shape, the playlist and its dwell, the hold, the "all together"
 * grid plan, the automatic day / night switch, the late-night dim, the window wording, the network state machine (live / stale /
 * offline / gone) and the UI strings. The rules are the approved mock-up's (docs/design/mockups/notice-106/tv.html), unchanged.
 */

export type Severity = 'info' | 'alert' | 'critical';
export type Mode = 'rotation' | 'all' | 'focus';
export type Urgent = 'stage' | 'stay' | 'full' | 'band';
export type Net = 'live' | 'stale' | 'offline' | 'gone';

export interface FeedNotice {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  starts_at: string;
  ends_at: string | null;
  pinned?: boolean;
  published_at?: string | null;
  dwell_s?: number;
  when?: string;
}

export interface FeedSlide {
  id: string;
  title: string;
  text: string;
  seconds?: number;
  image?: string;
}

export interface Display {
  template: 1 | 2 | 3;
  lang: 'he' | 'en';
  theme: 'day' | 'night' | 'auto';
  day_hours: string;
  layout: 'auto' | 'landscape' | 'portrait';
  urgent: Urgent;
  mode: Mode;
  rotate_s: number;
  hold: string;
  font_size: 's' | 'm' | 'l';
  font_scale: number;
  place: string;
  blocks: { clock: boolean; hebdate: boolean; welcome: boolean; weather: boolean; info: string[]; info_show?: boolean; promo: boolean; news: boolean; company_logo: boolean };
  weather: { hours: number };
  news: { feeds: { id?: string; name: string; url: string }[]; speed: 'slow' | 'normal' | 'fast' };
  night: { enabled: boolean; from: string; to: string; dim: number };
  burn_in: { shift: boolean };
  /** NOTICESAVER-295: the screen saver and the logo layout (absent on a board saved before 2.17.1 = off / 'a') */
  saver?: Saver;
  logos?: LogoLayout;
  /** TVOPT-295: the header, the "updated" line, the freed height and the company logo at night. In a board's stored settings a key is
   * present only when the board chose its own value (absent / null = the installation default); the TV feed always carries the
   * effective value. */
  header?: HeaderLayout | null;
  updated?: UpdatedLine | null;
  space?: SpaceUse | null;
  night_logo?: NightLogo | null;
  /** TVOPT-295 (owner 2026-10-25): the forecast row - 0 = as before (the entity's forecast entries), 1 = today only, 2..5 = days */
  weather_days?: number | null;
  /** NOTICESLIDES-295: the building photo of template 2 (a URL the feed adds only when one is uploaded) */
  photo?: string;
}

export type Saver = 'off' | 'wash' | 'cycle' | 'wave' | 'ambient';
export type LogoLayout = 'a' | 'b' | 'c';
export const SAVERS: Saver[] = ['off', 'wash', 'cycle', 'wave', 'ambient'];

/** The saver of a display: an unknown value reads as off. */
export function saverOf(d: Pick<Display, 'saver'>): Saver {
  return SAVERS.includes(d.saver as Saver) ? (d.saver as Saver) : 'off';
}

/** The logo layout of a display: an unknown value reads as the v4 layout 'a'. */
export function logoLayoutOf(d: Pick<Display, 'logos'>): LogoLayout {
  return d.logos === 'b' || d.logos === 'c' ? d.logos : 'a';
}

// ---------------------------------------------------------------- TVOPT-295: the one-row header and its companions

/** a = the company logo and the greeting together, SmplWise and the status at the other end of the same row; b = the greeting
 * centred in that row; c = the header as before (the separate bottom row stays). */
export type HeaderLayout = 'a' | 'b' | 'c';
/** full = "updated HH:MM · board name"; time = the time and the green dot; issues = nothing while live (the stale / offline notes still show). */
export type UpdatedLine = 'full' | 'time' | 'issues';
/** What the height freed by a one-row header goes to. */
export type SpaceUse = 'bigger' | 'more' | 'mix';
/** The company logo on a dark surface: auto = the system logo settings, plate = always the white plate, invert = invert when possible. */
export type NightLogo = 'auto' | 'plate' | 'invert';
export const HEADERS: HeaderLayout[] = ['a', 'b', 'c'];
export const UPDATED_LINES: UpdatedLine[] = ['full', 'time', 'issues'];
export const SPACE_USES: SpaceUse[] = ['bigger', 'more', 'mix'];
export const NIGHT_LOGOS: NightLogo[] = ['auto', 'plate', 'invert'];
export const WEATHER_DAYS = [0, 1, 2, 3, 4, 5] as const;

const pick = <T extends string>(v: unknown, all: readonly T[], dflt: T): T => (all.includes(v as T) ? (v as T) : dflt);
export const headerOf = (d: Pick<Display, 'header'>): HeaderLayout => pick(d.header, HEADERS, 'c');
export const updatedOf = (d: Pick<Display, 'updated'>): UpdatedLine => pick(d.updated, UPDATED_LINES, 'full');
export const spaceOf = (d: Pick<Display, 'space'>): SpaceUse => pick(d.space, SPACE_USES, 'bigger');
export const nightLogoOf = (d: Pick<Display, 'night_logo'>): NightLogo => pick(d.night_logo, NIGHT_LOGOS, 'auto');
export const weatherDaysOf = (d: Pick<Display, 'weather_days'>): number => (typeof d.weather_days === 'number' && (WEATHER_DAYS as readonly number[]).includes(d.weather_days) ? d.weather_days : 0);

/** TVOPT-295: the installation defaults of the four options (`notices.tv.*`); the factory values are the screen as it was. */
export interface TvDefaults { header: HeaderLayout; updated: UpdatedLine; space: SpaceUse; night_logo: NightLogo; weather_days: number }
export const TV_FACTORY: TvDefaults = { header: 'c', updated: 'full', space: 'bigger', night_logo: 'auto', weather_days: 0 };
export const TV_KEYS = ['header', 'updated', 'space', 'night_logo', 'weather_days'] as const;

/** The defaults as the API sent them, each value checked (a missing or unknown one reads as the factory value). */
export function tvDefaultsOf(raw: Partial<Record<keyof TvDefaults, unknown>> | null | undefined): TvDefaults {
  const r = raw ?? {};
  return { header: headerOf({ header: r.header as HeaderLayout }), updated: updatedOf({ updated: r.updated as UpdatedLine }), space: spaceOf({ space: r.space as SpaceUse }), night_logo: nightLogoOf({ night_logo: r.night_logo as NightLogo }), weather_days: weatherDaysOf({ weather_days: r.weather_days as number }) };
}

/** A board's display with the four options resolved: its own value, else the installation default (the backend's effective_display). */
export function effectiveTv<D extends Partial<Pick<Display, (typeof TV_KEYS)[number]>>>(d: D, defaults: TvDefaults): Omit<D, (typeof TV_KEYS)[number]> & TvDefaults {
  return { ...d, header: d.header || defaults.header, updated: d.updated || defaults.updated, space: d.space || defaults.space, night_logo: d.night_logo || defaults.night_logo, weather_days: d.weather_days ?? defaults.weather_days };
}

/** The text scale of the body (clock, date, weather, notices) under a one-row header: the freed height makes them larger
 * (bigger 1.16, mix 1.08); the header as before (c) and `more` keep the sizes. */
export function spaceGrow(header: HeaderLayout, space: SpaceUse): number {
  if (header === 'c') return 1;
  return space === 'bigger' ? 1.16 : space === 'mix' ? 1.08 : 1;
}

/** One more card / row of notices under a one-row header (more, mix); never with the header as before. */
export function spaceExtra(header: HeaderLayout, space: SpaceUse): boolean {
  return header !== 'c' && (space === 'more' || space === 'mix');
}

/** How many other notices the focus mode lists next to the current one (3, one more with the extra card). */
export function othersMax(extra: boolean): number {
  return extra ? 4 : 3;
}

/** The "all together" page plan with the extra row: one more row of cells per page (the columns stay). */
export function gridPlanExtra(n: number, wide: boolean, portrait: boolean, extra: boolean): { per: number; cols: number; rows: number; pages: number } {
  const p = gridPlan(n, wide, portrait);
  if (!extra) return p;
  const basePer = portrait ? 4 : wide ? 6 : 4;
  const cap = basePer + p.cols;
  const per = Math.max(1, Math.min(cap, n));
  const rows = Math.max(1, Math.ceil(per / p.cols));
  return { per, cols: p.cols, rows, pages: Math.max(1, Math.ceil(n / per)) };
}

/** The dark-surface mode the TV hands to chooseCompanyLogo: the board's night_logo over the system logo setting. `invert` uses the
 * dark file when there is one, else the CSS invert only when the light file has a transparent background (an opaque logo would
 * become a dark box), else the plate. */
export function nightLogoMode(choice: NightLogo, system: 'plate' | 'file' | 'invert', hasDark: boolean, lightTransparent: boolean): 'plate' | 'file' | 'invert' {
  if (choice === 'auto') return system;
  if (choice === 'plate') return 'plate';
  if (hasDark) return 'file';
  return lightTransparent ? 'invert' : 'plate';
}

/** The burn-in drift (mock-up v4 + saver): 8 positions of at most 12 px, one step per 45 s, eased over 8 s. `cycle` replaces it by a CSS orbit. */
export const DRIFT: readonly (readonly [number, number])[] = [[0, 0], [10, 5], [3, 11], [-8, 8], [-12, 0], [-7, -9], [2, -12], [10, -6]];
export const DRIFT_MS = 45_000;
/** The `cycle` saver runs the wash once per this interval (10 minutes). */
export const CYCLE_WASH_MS = 600_000;
/** The `ambient` saver moves the dim clock between these positions (percent of the canvas), one step per 30 s. */
export const AMBIENT_SPOTS: readonly (readonly [number, number])[] = [[10, 14], [52, 8], [62, 46], [36, 62], [12, 40], [48, 26], [24, 64], [58, 20]];

export interface Feed {
  board: { name: string; slug: string; version: number; display: Display; building: string; tz: string; logos: { company?: string; company_dark?: string }; /** CR-LOGOS295: how the TV draws the company logo (absent without one) */ brand?: { size: 's' | 'm' | 'l' | 'xl'; company_size?: 's' | 'm' | 'l' | 'xl'; dark_mode: 'plate' | 'file' | 'invert'; name: string } };
  now: string;
  notices: FeedNotice[];
  /** TVOPT-295: days (today first, one per local day, lo when known) only while the board's weather_days is 2..5 */
  weather?: { now: { t: number; condition: string; text: string }; hours: { at: string; t: number; condition: string }[]; days?: { date: string; t: number; lo?: number; condition: string }[] };
  /** NOTICESLIDES-295: the promo / info slides (only while the board's `promo` block is on and there is at least one) */
  slides?: FeedSlide[];
  info?: { kind: string; label: string; state: 'ok' | 'warn' | 'alarm' | 'off'; text: string }[];
  news?: { source: string; title: string; /** NOTICERSS-295: the source's logo (a URL read with the board token) */ logo?: string }[];
  sun?: { rise: string; set: string; candles?: string };
  control?: { seq: number; cmd: 'next' | 'prev' | 'pause' | 'play' };
}

export const SIZES: Record<Display['font_size'], number> = { s: 0.78, m: 0.9, l: 1 };
export const SEV_LOOK: Record<Severity, 'alarm' | 'warn' | 'acc'> = { critical: 'alarm', alert: 'warn', info: 'acc' };
export const NEWS_SPEED: Record<Display['news']['speed'], number> = { slow: 80, normal: 120, fast: 170 };
export const POLL_MS = 30_000;
export const TAKEOVER_MS = 60_000;

const STRINGS = {
  he: {
    welcome: 'ברוכים הבאים', urgent: 'הודעה דחופה', alert: 'חשוב', paused: 'מושהה', news: 'חדשות', empty: 'אין הודעות כרגע', niceDay: 'יום נעים',
    gone: 'הלוח אינו פעיל', goneHint: 'פנו להנהלת הבניין', offline: 'הלוח מנותק מהמערכת · מוצגות ההודעות האחרונות', staleFrom: 'לא מעודכן מ-{t}',
    updated: 'עודכן', more: 'ועוד {n} הודעות', permanent: 'קבוע', until: 'עד {d}', today: 'היום', tomorrow: 'מחר', candles: 'כניסת שבת {t}', poweredBy: 'מופעל על ידי SmplWise Arx',
  },
  en: {
    welcome: 'Welcome', urgent: 'Urgent notice', alert: 'Important', paused: 'Paused', news: 'News', empty: 'No notices right now', niceDay: 'Have a nice day',
    gone: 'This board is not active', goneHint: 'Please contact the building management', offline: 'The board is offline · showing the last notices',
    staleFrom: 'Not updated since {t}', updated: 'Updated', more: '{n} more notices', permanent: 'Ongoing', until: 'Until {d}', today: 'today',
    tomorrow: 'tomorrow', candles: 'Candle lighting {t}', poweredBy: 'Powered by SmplWise Arx',
  },
};
export type StrKey = keyof typeof STRINGS.he;

export function str(lang: 'he' | 'en', key: StrKey, vars?: Record<string, string | number>): string {
  const raw = (STRINGS[lang] ?? STRINGS.he)[key];
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

export function sevLabel(lang: 'he' | 'en', s: Severity): string {
  return s === 'critical' ? str(lang, 'urgent') : s === 'alert' ? str(lang, 'alert') : '';
}

// ---------------------------------------------------------------- the playlist (section 8.5 / 8.6)

export interface Item {
  n: FeedNotice;
  dwell: number;
  /** NOTICESLIDES-295: set when the item is a promo slide (`n` is then a stand-in with the id `slide:<id>`) */
  slide?: FeedSlide;
}

/** Ticks of the board's interval: a notice's own dwell_s wins, else x2 for the urgent one and for a long body (> 110 characters). */
export function ticks(n: FeedNotice, rotateS: number): number {
  if (n.dwell_s) return Math.max(1, Math.round(n.dwell_s / rotateS));
  return n.severity === 'critical' || (n.body || '').length > 110 ? 2 : 1;
}

/** The playlist: the urgent notice(s) first (the feed's own order: pinned, severity, newest), then the rest. With `band` the urgent
 * notice lives in the strip and leaves the rotation (the v3 comparison layout). */
export function playlist(notices: FeedNotice[], d: Pick<Display, 'urgent' | 'rotate_s'>): Item[] {
  const list = d.urgent === 'band' ? notices.filter((n) => n.severity !== 'critical') : notices.slice();
  list.sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1));
  return list.map((n) => ({ n, dwell: ticks(n, d.rotate_s) }));
}

/** NOTICESLIDES-295: the promo slides after the notices, in the rotation only (the mock-up's rule: "all together" and "focus" never show them).
 * A slide stays `seconds` on the screen (the board's interval when it names none), in ticks of the board's interval. */
export function withSlides(list: Item[], slides: FeedSlide[] | undefined, d: Pick<Display, 'mode' | 'rotate_s' | 'blocks'>): Item[] {
  if (d.mode !== 'rotation' || !d.blocks?.promo || !slides?.length) return list;
  const rot = Math.max(1, d.rotate_s || 12);
  const cards = slides.map((slide) => ({
    n: { id: 'slide:' + slide.id, title: slide.title, body: slide.text, severity: 'info' as Severity, starts_at: '', ends_at: null },
    dwell: Math.max(1, Math.round((slide.seconds || rot) / rot)),
    slide,
  }));
  return [...list, ...cards];
}

export function bandNotice(notices: FeedNotice[], d: Pick<Display, 'urgent'>): FeedNotice | null {
  return d.urgent === 'band' ? notices.find((n) => n.severity === 'critical') ?? null : null;
}

/** The held item: an explicit hold from the display tab, or the urgent notice when the rule is "stays". -1 = none. */
export function heldIndex(list: Item[], d: Pick<Display, 'hold' | 'urgent'>): number {
  if (d.hold) {
    const i = list.findIndex((x) => x.n.id === d.hold);
    if (i >= 0) return i;
  }
  if (d.urgent === 'stay') return list.findIndex((x) => x.n.severity === 'critical');
  return -1;
}

/** How many cells of "all together" fit a page, by the stage's width and orientation (readable from 4 m first). */
export function gridPlan(n: number, wide: boolean, portrait: boolean): { per: number; cols: number; rows: number; pages: number } {
  let per = portrait ? 4 : wide ? 6 : 4;
  let cols: number;
  if (portrait) cols = 1;
  else if (wide) cols = n <= 3 ? n : n === 4 ? 2 : 3;
  else cols = n <= 1 ? 1 : 2;
  cols = Math.max(1, cols);
  per = Math.max(1, Math.min(per, n));
  const rows = Math.max(1, Math.ceil(per / cols));
  return { per, cols, rows, pages: Math.max(1, Math.ceil(n / per)) };
}

/** The urgent takeover: a critical notice in its first minute after publication, unless the rule is the band. */
export function takeoverNotice(notices: FeedNotice[], d: Pick<Display, 'urgent'>, nowMs: number): FeedNotice | null {
  if (d.urgent === 'band') return null;
  for (const n of notices) {
    if (n.severity !== 'critical' || !n.published_at) continue;
    const at = Date.parse(n.published_at);
    if (Number.isFinite(at) && nowMs - at >= 0 && nowMs - at < TAKEOVER_MS) return n;
  }
  return null;
}

// ---------------------------------------------------------------- time, day / night

export interface Clock {
  h: number;
  m: number;
  weekday: number; // 0 = Sunday
  y: number;
  mo: number;
  d: number;
}

/** Wall-clock fields of an instant in the board's zone (Intl; a broken zone falls back to the TV's own). */
export function clockIn(tz: string, at: Date): Clock {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(at);
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'));
    return { h: +g('hour') % 24, m: +g('minute'), weekday: wd < 0 ? at.getDay() : wd, y: +g('year'), mo: +g('month'), d: +g('day') };
  } catch {
    return { h: at.getHours(), m: at.getMinutes(), weekday: at.getDay(), y: at.getFullYear(), mo: at.getMonth() + 1, d: at.getDate() };
  }
}

export function hm(s: string | undefined | null): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s || '');
  return m ? +m[1] + +m[2] / 60 : null;
}

/** day | night: configured hours (`HH:MM-HH:MM`), else the sun (sunrise + 15 min -> day, sunset - 15 min -> night), else 07:00-19:00. */
export function autoTheme(c: Clock, dayHours: string, sun?: { rise: string; set: string }): 'day' | 'night' {
  const h = c.h + c.m / 60;
  let from: number | null = null;
  let to: number | null = null;
  const parts = (dayHours || '').split('-');
  if (parts.length === 2) {
    from = hm(parts[0]);
    to = hm(parts[1]);
  }
  if (from === null || to === null) {
    const r = hm(sun?.rise);
    const s = hm(sun?.set);
    if (r !== null && s !== null) {
      from = r + 0.25;
      to = s - 0.25;
    } else {
      from = 7;
      to = 19;
    }
  }
  return h >= from && h < to ? 'day' : 'night';
}

export function themeOf(d: Pick<Display, 'theme' | 'day_hours'>, c: Clock, sun?: { rise: string; set: string }): 'day' | 'night' {
  return d.theme === 'day' || d.theme === 'night' ? d.theme : autoTheme(c, d.day_hours, sun);
}

/** The late-night dim window (it may cross midnight); a critical notice wakes the screen. */
export function nightDim(d: Pick<Display, 'night'>, c: Clock, anyCritical: boolean): boolean {
  if (!d.night.enabled || anyCritical) return false;
  const h = c.h + c.m / 60;
  const f = hm(d.night.from);
  const t = hm(d.night.to);
  if (f === null || t === null || f === t) return false;
  return f < t ? h >= f && h < t : h >= f || h < t;
}

/** The brightness of the late-night dim: `night.dim` 0.5 -> .58 (the mock-up's value), 1 -> 1. */
export function dimBrightness(dim: number): number {
  return Math.round((1 - (1 - Math.max(0.3, Math.min(1, dim))) * 0.84) * 100) / 100;
}

const two = (n: number) => ('0' + n).slice(-2);

export function timeText(c: Clock): string {
  return two(c.h) + ':' + two(c.m);
}

/** The window line of a notice: its own wording (when_text), else derived in the board's zone. */
export function whenText(n: FeedNotice, tz: string, now: Date, lang: 'he' | 'en'): string {
  if (n.when) return n.when;
  const end = n.ends_at ? new Date(n.ends_at) : null;
  const start = new Date(n.starts_at);
  if (!end || Number.isNaN(end.getTime())) return str(lang, 'permanent');
  const ce = clockIn(tz, end);
  const cs = clockIn(tz, start);
  const cn = clockIn(tz, now);
  const dm = (c: Clock) => two(c.d) + '.' + two(c.mo);
  const dayKey = (c: Clock) => c.y * 10000 + c.mo * 100 + c.d;
  const tomorrow = clockIn(tz, new Date(now.getTime() + 86_400_000));
  if (n.severity === 'critical') {
    const day = dayKey(ce) === dayKey(cn) ? str(lang, 'today') : dayKey(ce) === dayKey(tomorrow) ? str(lang, 'tomorrow') : dm(ce);
    return str(lang, 'until', { d: day + ' ' + timeText(ce) });
  }
  if (dayKey(cs) === dayKey(ce)) {
    let wd = '';
    try {
      wd = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'he-IL', { weekday: 'long', timeZone: tz }).format(start);
    } catch {
      wd = '';
    }
    return (wd ? wd + ' ' : '') + dm(cs) + ' · ' + timeText(cs) + '–' + timeText(ce);
  }
  return dm(cs) + ' – ' + dm(ce);
}

// ---------------------------------------------------------------- the network state machine (section 8.5)

export interface NetState {
  lastOk: number; // ms of the last good poll
  misses: number;
  gone: boolean;
}

export function netOf(s: NetState, nowMs: number): Net {
  if (s.gone) return 'gone';
  if (s.lastOk && nowMs - s.lastOk >= 10 * 60_000) return 'offline';
  if (s.misses >= 3) return 'stale';
  return 'live';
}

export function onPoll(s: NetState, status: number, nowMs: number): NetState {
  if (status === 200 || status === 304) return { lastOk: nowMs, misses: 0, gone: false };
  if (status === 404) return { ...s, gone: true };
  return { ...s, misses: s.misses + 1 };
}

// ---------------------------------------------------------------- text helpers

export function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * NOTICERSS-295: one ticker item - the headline, then the source: its logo (a light chip behind it, so a dark logo reads on the dark theme
 * too) and its NAME, never the address. `logoSrc` is the blob URL the page loaded for `n.logo` ('' = not loaded / no logo: the name alone,
 * exactly the markup of 2.19.0). The name is cut by CSS (`max-inline-size`, ellipsis) and isolated (`dir="auto"`) so an Arabic / Hebrew /
 * Latin name does not reorder the headline next to it.
 */
export function tickerItemHtml(n: { source: string; title: string; logo?: string }, logoSrc: string): string {
  const lg = n.logo && logoSrc ? '<span class="slg" aria-hidden="true"><img alt="" src="' + esc(logoSrc) + '"></span>' : '';
  return '<span class="h" dir="rtl">' + tx(n.title) + '</span>' + lg + '<em dir="auto" title="' + esc(n.source) + '">' + esc(n.source) + '</em><i class="sep" aria-hidden="true"></i>';
}

/** A numeric range ('10:00–12:00', '02.11 – 05.11') becomes one left-to-right run inside the Hebrew line. */
export function tx(s: string): string {
  return esc(s).replace(/(\d[\d:.]*\s*[–-]\s*\d[\d:.]*)/g, '<bdi dir="ltr" class="num">$1</bdi>');
}

/** The token of the TV link: `#t=<token>` in the fragment (never sent to a server). */
export function tokenFrom(hash: string): string {
  const m = /(?:^#|&)t=([A-Za-z0-9_-]{20,128})/.exec(hash || '');
  return m ? m[1] : '';
}

/** The board's slug: `/b/<slug>` (the product), else `?board=` (development and the tests). */
export function slugFrom(pathname: string, search: string): string {
  const m = /\/b\/([a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?)\/?$/.exec(pathname || '');
  if (m) return m[1];
  const q = new URLSearchParams(search).get('board') || '';
  return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(q) ? q : '';
}

export function remoteKey(key: string): 'next' | 'prev' | 'toggle' | null {
  const map: Record<string, 'next' | 'prev' | 'toggle'> = { ArrowLeft: 'next', ArrowRight: 'prev', MediaTrackNext: 'next', MediaTrackPrevious: 'prev', MediaPlayPause: 'toggle', ' ': 'toggle', Enter: 'toggle', p: 'toggle' };
  return map[key] ?? null;
}
