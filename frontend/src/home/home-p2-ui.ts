// HOME-V3-P2-2431: the shared pieces of the family and building screens - what the person may see (one GET /home/family per home load,
// refreshed every few minutes), the switch, the time stepper, the week picker, Hebrew counts and times. No screen of its own.
import { uiLocale } from '../i18n/locale';
import { html, nothing } from 'lit';
import { describeError } from '../api/client';
import type { HomeHost } from './home-ext';
import { getFamily, type FamilyInfo } from './home-p2-api';
import { moreTiles } from './more-registry';
import { tr } from '../i18n/msg/home';

const P2_TILES = new Set(['presence', 'calendar', 'notices', 'tickets', 'schedules', 'weather', 'notif']);

export type P2Mod = 'presence' | 'calendar' | 'booking' | 'notices' | 'transit' | 'tickets' | 'schedules' | 'sceneNew' | 'weather' | 'notif';

const fam: { info: FamilyInfo | null; at: number; loading: boolean; failedAt: number } = { info: null, at: 0, loading: false, failedAt: 0 };

/** Load (or refresh after 3 minutes) what the person may see; redraws the host when it arrives. */
export function warmFamily(h: HomeHost, force = false): void {
  // RELEASE-2437-TRAIN gate (home-leave-2435 :87 mobile): a render queued before the home left the page still runs on the detached
  // host (Lit updates a disconnected element) and asked for /home/family again - a detached home starts no read
  if (!h.isConnected) return;
  if (fam.loading || (!force && fam.info && Date.now() - fam.at < 180_000)) return;
  // FE-LEAK-TEXTKEY-2435: a failed read is retried after 30 s, not on the next render - the redraw below renders again, and every
  // render asked again (a request loop while the read kept failing, which also ran on after the home left the page)
  if (!force && !fam.info && Date.now() - fam.failedAt < 30_000) return;
  fam.loading = true;
  const first = !fam.info;
  void getFamily().then((f) => { fam.info = f; fam.at = Date.now(); fam.failedAt = 0; }).catch(() => { fam.failedAt = Date.now(); }).finally(() => {
    fam.loading = false;
    if (!h.isConnected) return; // the home left the page meanwhile: nothing to redraw or warm
    // the hub warmed its tiles before this person's features were known: warm the family tiles now (each load is throttled)
    if (first && fam.info) for (const t of moreTiles(h)) if (P2_TILES.has(t.id)) t.warm?.(h);
    h.requestUpdate();
  });
}

/** The person's home category is on (the administrator's page; `null` = every category). */
const cat = (m: string) => { const mods = fam.info?.modules; return mods == null || mods.includes(m); };

/** A capability is shown only when its module is on, the person holds its permission and the person's category is on. */
export function has(m: P2Mod): boolean {
  const f = fam.info?.features;
  if (!f) return false;
  switch (m) {
    case 'presence': return cat('presence') && f.presence.on && f.presence.can;
    case 'calendar': return cat('calendar') && f.calendar.on && f.calendar.view;
    case 'booking': return cat('calendar') && f.calendar.on && f.calendar.book;
    case 'notices': return cat('notices') && f.notices.on && f.notices.can;
    case 'transit': return cat('notices') && f.transit.on;
    case 'tickets': return cat('tickets') && f.tickets.on && (f.tickets.create || f.tickets.view);
    case 'schedules': return cat('schedules') && f.schedules.on && (f.schedules.view || f.schedules.manage);
    case 'sceneNew': return cat('scenes') && f.scenes.capture;
    case 'weather': return f.weather;
    case 'notif': return true;
  }
}
export const canManageSchedules = () => !!fam.info?.features.schedules.manage;
export const familyKnown = () => fam.info != null;
/** Tests and a sign-out: forget what was loaded. */
export function resetFamily(): void { fam.info = null; fam.at = 0; }

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}

export function sw(on: boolean, act: string, label: string, attrs: Record<string, string> = {}, disabled = false) {
  return html`<button class="hsw" role="switch" aria-checked=${String(on)} data-act=${act} data-id=${attrs.id ?? ''} data-k=${attrs.k ?? nothing} ?disabled=${disabled} aria-label=${label}><i></i></button>`;
}

export const hm = (mins: number) => `${String(Math.floor(((mins % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String((((mins % 1440) + 1440) % 1440) % 60).padStart(2, '0')}`;

export function stepper(act: string, key: string, mins: number, label: string) {
  return html`<span class="stp" role="group" aria-label=${label}><button class="rb" data-act=${act} data-k=${key} data-d="-1" aria-label=${label + tr(': פחות')}>${minus}</button><b class="num" data-stp=${key}>${hm(mins)}</b><button class="rb" data-act=${act} data-k=${key} data-d="1" aria-label=${label + tr(': יותר')}>${plus}</button></span>`;
}
const minus = html`<svg class="hi" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const plus = html`<svg class="hi" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

export const DAY_LETTER = [tr('א׳'), tr('ב׳'), tr('ג׳'), tr('ד׳'), tr('ה׳'), tr('ו׳'), tr('ש׳')];
export const DAY_NAME = [tr('ראשון'), tr('שני'), tr('שלישי'), tr('רביעי'), tr('חמישי'), tr('שישי'), tr('שבת')];
export const DAY_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const TZ = 'Asia/Jerusalem';
const F_HM = new Intl.DateTimeFormat(uiLocale(), { hour: '2-digit', minute: '2-digit', timeZone: TZ, hourCycle: 'h23' });
const F_DM = new Intl.DateTimeFormat(uiLocale(), { day: 'numeric', month: 'numeric', timeZone: TZ });
const F_YMD = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ });
const F_WD = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TZ });

export const timeOf = (iso: string) => F_HM.format(new Date(iso));
export const dayMonth = (d: Date) => F_DM.format(d);
/** The local date (YYYY-MM-DD) of an instant in the installation's zone. */
export const ymd = (d: Date) => F_YMD.format(d);
export const weekdayIx = (d: Date) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(F_WD.format(d));

/** "today" / "yesterday" / a weekday and date + time, in simple words. */
export function whenText(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const days = Math.round((Date.parse(ymd(now)) - Date.parse(ymd(d))) / 86_400_000);
  const t = timeOf(iso);
  if (days === 0) return tr('היום {t}', { t });
  if (days === 1) return tr('אתמול {t}', { t });
  if (days === -1) return tr('מחר {t}', { t });
  return `${DAY_NAME[weekdayIx(d)]} ${dayMonth(d)}, ${t}`;
}

/** The UTC instant of a local wall time (date YYYY-MM-DD + minutes after midnight) in the installation's zone (DST-safe: two passes). */
export function localInstant(date: string, mins: number): Date {
  const [y, m, d] = date.split('-').map(Number);
  let t = Date.UTC(y, m - 1, d, Math.floor(mins / 60), mins % 60);
  for (let i = 0; i < 2; i++) {
    const shown = F_HM.format(new Date(t)).split(':').map(Number);
    const sd = ymd(new Date(t));
    const diff = (Date.parse(date) - Date.parse(sd)) / 60_000 + (Math.floor(mins / 60) - shown[0]) * 60 + (mins % 60 - shown[1]);
    t += diff * 60_000;
  }
  return new Date(t);
}

/** The next seven local days, starting today: [letter, day-of-month, YYYY-MM-DD]. */
export function weekDays(now = new Date()): [string, number, string][] {
  const out: [string, number, string][] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const s = ymd(d);
    out.push([DAY_LETTER[weekdayIx(d)], Number(s.slice(8)), s]);
  }
  return out;
}

/** HOME-R32-ANSWERS-2438 (owner round 32 Q-HOME-2): this week from its first day (Sunday) to Saturday, same shape as weekDays. Counted
 * from local noon, so a daylight-saving night never repeats or skips a day. */
export function thisWeekDays(now = new Date()): [string, number, string][] {
  const noon = localInstant(ymd(now), 720);
  return weekDays(new Date(noon.getTime() - weekdayIx(noon) * 86_400_000));
}

export function errText(e: unknown): string {
  return describeError(e);
}

export function iso(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** For the hub tiles' `visible`: starts loading what the person may see (once) and answers true, so `seen(h) && has(...)` reads well. */
export function seen(h: HomeHost): boolean {
  warmFamily(h);
  return true;
}

/** A family screen the person may not see: "loading" until the feature map is known, then the "not switched on for you" panel. */
export function offScreen(h: HomeHost, title: string) {
  if (!familyKnown()) { warmFamily(h); return html`${h.head(title, '')}${h.empty('home', tr('טוענים…'), '')}`; }
  return html`${h.head(title, '')}${h.empty('lock', tr('המסך הזה לא זמין'), tr('מנהל הבית לא הפעיל אותו עבורך. אפשר לבקש ממנו.'))}`;
}
