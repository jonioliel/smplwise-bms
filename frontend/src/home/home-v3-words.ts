// HOME-V3-P1-2430: the family words of the phase-1 screens (no platform names, no technical terms) and the small pure helpers behind
// them, kept apart from the screens so the unit spec can check them without a browser page.
import { uiLocale } from '../i18n/locale';
import { tr } from '../i18n/msg/home';

/** An event of the home diary in simple words, or null when it is technical (system, storage, coverage) and stays in the full interface. */
export function diaryWord(type: string, camera: string | null): { text: string; icon: string; kind: 'cam' | 'door' } | null {
  const at = camera ? tr(' ב{camera}', { camera }) : '';
  switch (type) {
    case 'motion': return { text: tr('תנועה{at}', { at }), icon: 'cam', kind: 'cam' };
    case 'person': return { text: tr('מישהו עבר{at}', { at }), icon: 'user', kind: 'cam' };
    case 'vehicle': return { text: tr('רכב{at}', { at }), icon: 'cam', kind: 'cam' };
    case 'line':
    case 'field': return { text: tr('מישהו נכנס לאזור שמור{at}', { at }), icon: 'shield', kind: 'cam' };
    case 'door':
    case 'io': return { text: camera ? tr('דלת נפתחה ליד {camera}', { camera }) : tr('דלת נפתחה'), icon: 'door', kind: 'door' };
    case 'manual': return { text: tr('הקלטה{at}', { at }), icon: 'film', kind: 'cam' };
    default: return null;
  }
}

export type CallTone = 'ok' | 'warn' | 'neutral';

/** The result of one doorbell call in words: who opened, who answered, or that nobody did. HOME-V3-AUDITFIX-2437 (audit item 12): no
 * gendered slash - the sentence is about the call / the door, the person's name follows it. */
export function callResult(v: { outcome: string | null; answered_by_name: string | null; door_opened_by_name: string | null; door_opened_at: string | null }): { text: string; tone: CallTone } {
  if (v.door_opened_by_name) return { text: tr('הדלת נפתחה · {door_opened_by_name}', { door_opened_by_name: v.door_opened_by_name }), tone: 'ok' };
  if (v.door_opened_at) return { text: tr('הדלת נפתחה'), tone: 'ok' };
  if (v.outcome === 'answered') return { text: v.answered_by_name ? tr('נענתה · {answered_by_name}', { answered_by_name: v.answered_by_name }) : tr('נענתה'), tone: 'ok' };
  if (v.outcome === 'missed') return { text: tr('לא נענתה'), tone: 'warn' };
  if (v.outcome === 'rejected') return { text: tr('נדחתה'), tone: 'neutral' };
  return { text: tr('הסתיימה'), tone: 'neutral' };
}

export type GuestTone = 'ok' | 'warn' | 'neutral' | 'info';

/** A guest invitation's state in words (the server never gives the code to the host: it goes to the guest's phone). */
export function guestState(g: { state: string | null; confirmed: boolean; valid_from: string | null; valid_until: string | null; end_reason?: string | null }, now = Date.now()): { text: string; tone: GuestTone; live: boolean } {
  const from = g.valid_from ? Date.parse(g.valid_from) : NaN;
  const until = g.valid_until ? Date.parse(g.valid_until) : NaN;
  if (g.end_reason || ['revoked', 'cancelled', 'expired', 'ended', 'refused', 'rejected'].includes(g.state ?? '') || (Number.isFinite(until) && until <= now)) return { text: tr('הסתיימה'), tone: 'neutral', live: false };
  if (g.state === 'requested') return { text: tr('מחכה לאישור של מנהל הבית'), tone: 'warn', live: true };
  if (!g.confirmed) return { text: tr('צריך לאמת את הטלפון של האורח'), tone: 'warn', live: true };
  if (Number.isFinite(from) && from > now) return { text: tr('עוד לא התחיל'), tone: 'neutral', live: true };
  return { text: tr('בתוקף עכשיו'), tone: 'ok', live: true };
}

/** The alarm panel's state in words and its tone (green only for an armed, quiet house). */
export function alarmWord(state: string | null, available = true): { text: string; tone: 'ok' | 'neutral' | 'danger' | 'warn' } {
  if (!available) return { text: tr('לא זמינה כרגע'), tone: 'warn' };
  switch (state) {
    case 'disarmed': return { text: tr('מנוטרלת'), tone: 'neutral' };
    case 'armed_home': return { text: tr('דרוכה: בבית'), tone: 'ok' };
    case 'armed_away': return { text: tr('דרוכה: מלאה'), tone: 'ok' };
    case 'armed_night': return { text: tr('דרוכה: לילה'), tone: 'ok' };
    case 'armed_vacation': return { text: tr('דרוכה: חופשה'), tone: 'ok' };
    case 'armed_custom_bypass': return { text: tr('דרוכה חלקית'), tone: 'ok' };
    case 'arming': return { text: tr('נדרכת…'), tone: 'warn' };
    case 'pending': return { text: tr('ממתינה לקוד'), tone: 'warn' };
    case 'disarming': return { text: tr('מנטרלת…'), tone: 'warn' };
    case 'triggered': return { text: tr('אזעקה פעילה'), tone: 'danger' };
    default: return { text: tr('לא ידוע'), tone: 'neutral' };
  }
}

export const ARM_WORD: Record<string, string> = { arm_away: tr('דריכה מלאה'), arm_home: tr('דריכה: בבית'), arm_night: tr('דריכת לילה') };

/** "היום" / "אתמול" / "שלשום" / a short date, for a day `back` days before today. */
export function dayWord(back: number, now = new Date()): string {
  if (back === 0) return tr('היום');
  if (back === 1) return tr('אתמול');
  if (back === 2) return tr('שלשום');
  const d = new Date(now.getTime() - back * 86_400_000);
  return d.toLocaleDateString(uiLocale(), { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'Asia/Jerusalem' });
}

/** hh:mm:ss of a minute of the day (fractional). */
export function clockOf(minute: number): string {
  const x = Math.max(0, Math.round(minute * 60));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(x / 3600) % 24)}:${p(Math.floor(x / 60) % 60)}:${p(x % 60)}`;
}

/** Recording segments of a local day as [start, end] minutes (0..1440), clipped to the day; the timeline draws them left to right. */
export function daySpans(segs: { startMin: number; endMin: number }[]): [number, number][] {
  return segs.map((s) => [Math.max(0, s.startMin), Math.min(1440, s.endMin)] as [number, number]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
}

export function inSpans(spans: [number, number][], m: number): boolean {
  return spans.some(([a, b]) => m >= a && m < b);
}

/** The playback errors in family words (never the server's technical text). */
export function playbackError(code: string | undefined): string {
  switch (code) {
    case 'no_recording': return tr('אין הקלטה בשעה הזו.');
    case 'forbidden': return tr('אין הרשאה לצפות בהקלטות של המצלמה הזו.');
    case 'playback_limit':
    case 'too_many_sessions': return tr('יותר מדי צפיות פתוחות כרגע. נסו שוב בעוד רגע.');
    default: return tr('ההקלטות לא זמינות כרגע. נסו שוב מאוחר יותר.');
  }
}
