/**
 * CR-018: the pure parser of a push message, shared by the service worker (sw.ts, which inlines it) and the specs - never imported by the app bundle.
 *
 * The wire is the backend's `payload_v2` (services/notify_channels.py): `{v:2, id, title, body, url:'#/notifications/<id>', category, severity, tag, ts,
 * renotify?, resolved?, actions?: [{a:'ack'|'snooze', title, t:<single-use token>} | {a:'open_door', title, url:'#/doors/<id>?confirm=<notification id>'}]}`.
 * The tokens are PER ACTION; the door button carries a deep link and no token. A v1 message (`{title, body, url, event_id, alert_id, tag}`) parses to the same shape
 * without actions. Everything is validated here: a link is an in-app hash route or nothing, a token is a bounded string, an unknown action is dropped.
 * Nothing in this file calls the network: the worker posts a token to the action endpoint, and the door button only ever opens the app.
 *
 * I18N-RUNTIME-ERRORS-2520: the buttons' words come from a small Hebrew / English table, chosen by the user's interface language that the
 * app tells the worker (`swLang`): Hebrew = the server's title (the table only when it sent none), as before; English = the table's English
 * for the three known buttons (the server words them in Hebrew).
 */

const HASH_ROUTE = /^#\/(?!\/)[A-Za-z0-9/_\-.~%?=&]*$/;
const DOOR_ROUTE = /^#\/doors\/[A-Za-z0-9_\-.~%]+\?confirm=[A-Za-z0-9_\-.~%]+$/;
const TOKEN = /^[A-Za-z0-9_\-.~=]{8,256}$/;

type PushActionId = 'ack' | 'snooze' | 'open_door';
interface ParsedAction {
  action: PushActionId;
  title: string;
  /** ack / snooze: the single-use token of THIS action (posted to the action endpoint). */
  token?: string;
  /** open_door: the in-app confirmation route (a deep link: opening it sends nothing). */
  url?: string;
}
interface ParsedPush {
  v: number;
  id: string | null;
  title: string;
  body: string;
  /** An in-app hash route or null. */
  url: string | null;
  tag: string | null;
  severity: string | null;
  renotify: boolean;
  /** The condition ended: the notification shown under this tag is replaced by a quiet "ended" one, with no buttons. */
  resolved: boolean;
  /** The unread count, when the message carries one; null = the badge falls back to the notifications shown. */
  unread: number | null;
  actions: ParsedAction[];
  event_id: string | null;
  alert_id: string | null;
}

/** The worker's interface languages (the user's `ui.lang`; Hebrew when the app never said). */
export type SwLang = 'he' | 'en';
export function swLang(v: unknown): SwLang {
  return v === 'en' ? 'en' : 'he';
}
export const LABELS: Record<SwLang, Record<PushActionId, string>> = {
  // i18n-keep: the Hebrew side of the worker's own he/en table (service-worker bundle, inlined: no language packs); English beside it
  he: { ack: 'אישור', snooze: 'השתק לשעה', open_door: 'פתח דלת' },
  en: { ack: 'Acknowledge', snooze: 'Mute for an hour', open_door: 'Open the door' },
};
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const route = (v: unknown): string | null => (typeof v === 'string' && v.length < 300 && HASH_ROUTE.test(v) ? v : null);

/** The message of a push event, normalised; `maxActions` is the browser's `Notification.maxActions` (default 2), `lang` the user's interface
 * language (the buttons' words). Never throws. */
export function parsePush(raw: unknown, maxActions = 2, lang: SwLang = 'he'): ParsedPush {
  const label = (id: PushActionId, title: unknown): string => (lang === 'he' ? str(title, 40) || LABELS.he[id] : LABELS[lang][id]);
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const resolved = d.resolved === true;
  const seen = new Set<string>();
  const actions: ParsedAction[] = [];
  if (!resolved && Array.isArray(d.actions)) {
    for (const x of d.actions) {
      const a = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
      const id = a.a;
      if ((id !== 'ack' && id !== 'snooze' && id !== 'open_door') || seen.has(id)) continue;
      if (id === 'open_door') {
        const url = typeof a.url === 'string' && DOOR_ROUTE.test(a.url) ? a.url : null;
        if (!url) continue;
        seen.add(id);
        actions.push({ action: id, title: label(id, a.title), url });
      } else {
        if (typeof a.t !== 'string' || !TOKEN.test(a.t)) continue;
        seen.add(id);
        actions.push({ action: id, title: label(id, a.title), token: a.t });
      }
    }
  }
  return {
    v: typeof d.v === 'number' ? d.v : 1,
    id: str(d.id, 80) || null,
    title: str(d.title, 120),
    body: str(d.body, 240),
    url: route(d.url),
    tag: str(d.tag, 120) || null,
    severity: str(d.severity, 20) || null,
    renotify: d.renotify === true,
    resolved,
    unread: typeof d.unread === 'number' && Number.isFinite(d.unread) && d.unread >= 0 ? Math.floor(d.unread) : null,
    actions: actions.slice(0, Math.max(0, maxActions)),
    event_id: str(d.event_id, 80) || null,
    alert_id: str(d.alert_id, 80) || null,
  };
}

/** The `data` a shown notification keeps for its click: the open link, and the token / link of each action. */
export interface NotificationData {
  url: string | null;
  id: string | null;
  event_id: string | null;
  alert_id: string | null;
  tokens: { ack?: string; snooze?: string };
  door_url: string | null;
}
export function dataOf(p: ParsedPush): NotificationData {
  return {
    url: p.url, id: p.id, event_id: p.event_id, alert_id: p.alert_id,
    tokens: { ack: p.actions.find((a) => a.action === 'ack')?.token, snooze: p.actions.find((a) => a.action === 'snooze')?.token },
    door_url: p.actions.find((a) => a.action === 'open_door')?.url ?? null,
  };
}

/** What a click on a button does, decided from the stored data only: post a token, open the app on the door confirmation, or open the row. */
type ClickPlan = { kind: 'post'; token: string; action: 'ack' | 'snooze' } | { kind: 'open'; url: string | null };
export function planClick(data: Partial<NotificationData> | null, action: string): ClickPlan {
  if ((action === 'ack' || action === 'snooze') && typeof data?.tokens?.[action] === 'string') return { kind: 'post', token: data.tokens[action] as string, action };
  if (action === 'open_door' && typeof data?.door_url === 'string' && DOOR_ROUTE.test(data.door_url)) return { kind: 'open', url: data.door_url };
  return { kind: 'open', url: data?.url ?? null };
}
