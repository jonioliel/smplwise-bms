/**
 * ANNOUNCEB-295 (voice announcements, stage B): the pure rules of the announcement overlay drawn on a screen (a notice TV board, a wall display).
 * No DOM and no network: unit specs run it in Node, and the TV page (a separate bundle) imports it too. The server decides what a screen may show
 * and until when; this only decides how the text is laid out so it fits the viewport without scrolling, and when the overlay is visible.
 */
export type ScreenLang = 'he' | 'en' | 'ru' | 'ar';

export interface ScreenAnnouncement {
  id: string;
  critical: boolean;
  /** ISO instant the screen stops showing it */
  until: string;
  /** one block per spoken language, in the order they were announced; no translation is ever added */
  texts: { language: ScreenLang; text: string }[];
}

export type OverlaySize = 'xl' | 'l' | 'm' | 's';

const RTL: ScreenLang[] = ['he', 'ar'];
export const dirOf = (l: ScreenLang): 'rtl' | 'ltr' => (RTL.includes(l) ? 'rtl' : 'ltr');

/** The fastest and the slowest a screen may ask the server for an announcement (seconds); anything else is clamped. 0 = this screen is not an announcement screen. */
export const POLL_MIN_S = 2;
export const POLL_MAX_S = 30;
export function pollMs(pollS: number | undefined | null, fallbackMs: number): number {
  if (typeof pollS !== 'number' || !Number.isFinite(pollS) || pollS <= 0) return fallbackMs;
  return Math.round(Math.min(POLL_MAX_S, Math.max(POLL_MIN_S, pollS)) * 1000);
}

export function endsAt(a: ScreenAnnouncement | null | undefined): number {
  if (!a) return 0;
  const t = Date.parse(a.until);
  return Number.isFinite(t) ? t : 0;
}

/** Visible while its end is in the future. A dismissed id (a person pressed close on this screen) stays hidden. */
export function visibleNow(a: ScreenAnnouncement | null | undefined, nowMs: number, dismissed = ''): boolean {
  return !!a && a.texts.length > 0 && a.id !== dismissed && endsAt(a) > nowMs;
}

/** The type size class from the amount of text: short single lines are huge, a long multi-language notice is smaller, so everything fits one screen. */
export function sizeOf(a: ScreenAnnouncement): OverlaySize {
  const n = a.texts.length;
  const longest = Math.max(0, ...a.texts.map((t) => t.text.length));
  const total = a.texts.reduce((s, t) => s + t.text.length, 0);
  if (n === 1 && longest <= 40) return 'xl';
  if (total <= 120 && n <= 2) return 'l';
  if (total <= 320) return 'm';
  return 's';
}

/** A stable key of what is drawn: the overlay is rebuilt only when it changes. */
export function overlayKey(a: ScreenAnnouncement | null | undefined): string {
  return a ? `${a.id}|${a.critical ? 1 : 0}` : '';
}

const STRINGS: Record<'he' | 'en' | 'ru' | 'ar', { title: string; critical: string; close: string }> = {
  he: { title: 'הכרזה', critical: 'הודעת חירום', close: 'סגירה' },
  en: { title: 'Announcement', critical: 'Emergency notice', close: 'Close' },
  ru: { title: 'Объявление', critical: 'Экстренное сообщение', close: 'Закрыть' },
  ar: { title: 'إعلان', critical: 'إشعار طارئ', close: 'إغلاق' },
};

/** The heading above the text, in the language of the screen (the board's or the app's), not in the announcement's. */
export function headingOf(a: ScreenAnnouncement, uiLang: string): string {
  const s = STRINGS[(uiLang in STRINGS ? uiLang : 'he') as keyof typeof STRINGS];
  return a.critical ? s.critical : s.title;
}
export function closeLabel(uiLang: string): string {
  return STRINGS[(uiLang in STRINGS ? uiLang : 'he') as keyof typeof STRINGS].close;
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** The overlay's inner HTML for the TV page (no inline style: its CSP forbids style attributes). The text is escaped; each language is its own block with its own direction. */
export function overlayHtml(a: ScreenAnnouncement, uiLang: string): string {
  const blocks = a.texts.map((t) => `<p class="ann-t" lang="${t.language}" dir="${dirOf(t.language)}">${esc(t.text)}</p>`).join('');
  return `<div class="ann-in" data-size="${sizeOf(a)}"><span class="ann-tag">${esc(headingOf(a, uiLang))}</span><div class="ann-body">${blocks}</div></div>`;
}
