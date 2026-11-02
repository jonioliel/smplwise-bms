/**
 * CALCONNECT-2330: the pure rules of the connect dialogs (Node-testable: tests/unit-calendars-connect-2330.spec.ts). The server decides
 * every one of them again; these only keep the screen from offering what the server would refuse.
 */
import { cardOf, type Connection, type Feed, type ProviderCard } from '../api/calendars';

const GOOGLE_CLIENT = /^[0-9]{1,30}-[a-z0-9]{1,64}\.apps\.googleusercontent\.com$/;
const MS_CLIENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Google's installed-app flow lands the browser here after the approval (nothing listens there; the owner pastes the address). */
export const GOOGLE_LOOPBACK = 'http://127.0.0.1:8749/';

/** The directions a binding of this connection may take (iCal IN reads only; a read connection only imports). */
export function directionsFor(conn: Pick<Connection, 'provider' | 'scope'>): ('import' | 'export' | 'two_way')[] {
  if (cardOf(conn.provider) === 'ical') return ['import'];
  return conn.scope === 'read_write' ? ['export', 'import', 'two_way'] : ['import'];
}

/** The step a connect dialog opens on: the client (or the feed address) until it is set, then the provider's approval. */
export function firstStep(card: ProviderCard, conn: Pick<Connection, 'setup'> | null): 'client' | 'feed' | 'auth' {
  if (card === 'ical') return 'feed';
  return conn?.setup?.client_id_set ? 'auth' : 'client';
}

/** A client id that looks like the provider's own format (the server checks again). */
export function clientIdOk(card: ProviderCard, id: string): boolean {
  return card === 'google' ? GOOGLE_CLIENT.test(id.trim()) : card === 'microsoft' ? MS_CLIENT.test(id.trim()) : false;
}

/** Whether a pasted address can be Google's loopback answer (the server checks the state and the code). */
export function pasteLooksRight(text: string): boolean {
  const t = text.trim();
  return t.startsWith(GOOGLE_LOOPBACK) && /[?&]state=/.test(t) && /[?&](code|error)=/.test(t);
}

// ---------------------------------------------------------------- CAL-FEED-REVIEW-2351, owner decisions round 14 (02.11)

/** 2A: what turning a feed's remote access ON means - the confirmation names the consequence before anything changes. */
export const FEED_REMOTE_CONFIRM_HE =
  'הקישור של הפיד יעבוד גם מחוץ לרשת של הבניין: כל מי שמחזיק בקישור יוכל לקרוא את הפיד מכל מקום. בפיד שפתוח מבחוץ עוברים רק משבצות "תפוס", בלי כותרות.';
/** The server refuses the switch on the remote channel (local sessions only); the screen says so instead of failing on a click. */
export const FEED_REMOTE_LOCAL_ONLY_HE = 'פתיחה או סגירה של פיד לגישה מרחוק אפשרית רק מתוך הרשת של הבניין. נכנסת עכשיו מרחוק, ולכן המתג נעול.';

export type FeedRemoteView = { show: false } | { show: true; on: boolean; locked: boolean };

/** 2A: the remote toggle of one feed - shown only to whom the server lets change it (`can_remote`: an administrator, or the creator who
 * manages every calendar of the feed), locked on the remote channel (`local` false). A live feed only. */
export function feedRemoteView(f: Pick<Feed, 'remote' | 'can_remote' | 'revoked'>, local: boolean): FeedRemoteView {
  if (f.revoked || !f.can_remote) return { show: false };
  return { show: true, on: !!f.remote, locked: !local };
}

/** Only turning access ON asks first (it widens who can reach the address); turning it off narrows it and applies at once. */
export function feedRemoteNeedsConfirm(next: boolean): boolean {
  return next;
}

/** 4A: the feed's content chip - a feed open from outside is busy-only whatever its own choice, and says so. */
export function feedDetailHe(f: Pick<Feed, 'detail' | 'detail_effective' | 'remote'>): string {
  if (f.remote) return '"תפוס" בלבד · פתוח מבחוץ';
  return (f.detail_effective ?? f.detail) === 'titles' ? 'כותרות' : '"תפוס" בלבד';
}

function dayHe(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** 3C: the expiry of the feed's current address (fixed when it was issued; "חידוש קישור" issues a new address with the current default). */
export function feedExpiry(expiresAt: string | null | undefined, now: Date = new Date()): { text: string; expired: boolean } {
  if (!expiresAt) return { text: 'ללא תאריך תפוגה', expired: false };
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return { text: 'פג תוקף', expired: true };
  if (t <= now.getTime()) return { text: `פג תוקף ב־${dayHe(expiresAt)} · צריך לחדש קישור`, expired: true };
  return { text: `בתוקף עד ${dayHe(expiresAt)}`, expired: false };
}

/** 3C: the default expiry of a new or renewed address, in words (the calendars setting `feed_max_age_days`). */
export function feedMaxAgeHe(days: number | null | undefined): string {
  return !days ? 'ללא הגבלה' : `${days} יום`;
}
