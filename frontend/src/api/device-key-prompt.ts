/**
 * FIX-PHONEKEY-2570 (second deep review SA2-02): the words the phone shows when the phone key signs - taken from the SIGNED payload
 * itself, never from a text the page makes up. The server builds the payload (smplwise/services/device_keys.payload):
 * `arx-device-key|v1|<purpose>|<origin>|<user or ->|<key id or ->|<action or ->|<nonce>`. What the key signs is the purpose and the
 * action (for a phone approval `auth.push_approval.n<NN>`, the number the person typed); this module turns exactly those into a short line.
 *
 * The Android app (mobile/android-shell DeviceKeyPolicy.promptOf, version PHONE_KEY_APP_VERSION and later) builds the same line itself
 * from the payload and ignores the page's text; the page sends this line as well, so an older app shows the signed action too.
 */
import { tr } from '../i18n/msg/mfa';

const PREFIX = 'arx-device-key';
const VERSION = 'v1';
const ACTION_RE = /^[a-z][a-z0-9_.]{0,63}$/;
const APPROVAL_RE = /^auth\.push_approval\.n(\d{2})$/;

/** The signed fields that matter for the prompt, or null when the text is not a server payload of this version. */
function payloadFields(payload: string): { purpose: string; action: string | null } | null {
  const f = typeof payload === 'string' && payload.length <= 400 ? payload.split('|') : [];
  if (f.length !== 8 || f[0] !== PREFIX || f[1] !== VERSION || f.some((x) => !x)) return null;
  const [, , purpose, , , , action] = f;
  if (!['register', 'step_up', 'sign_in'].includes(purpose)) return null;
  if (action !== '-' && !ACTION_RE.test(action)) return null;
  return { purpose, action: action === '-' ? null : action };
}

/** The line the phone's prompt shows for `payload` (the server's text, as signed). */
export function signedPromptText(payload: string): string {
  const p = payloadFields(payload);
  if (!p) return tr('אישור הפעולה ב־SmplWise Arx');
  if (p.purpose === 'register') return tr('רישום מפתח הטלפון לחשבון');
  if (p.purpose === 'sign_in') return tr('כניסה לחשבון');
  const a = p.action;
  if (!a) return tr('אישור הזהות שלך');
  const n = APPROVAL_RE.exec(a);
  if (n) return tr('אישור בקשה ממסך אחר · מספר {n}', { n: n[1] });
  if (a === 'alarm.disarm') return tr('נטרול האזעקה');
  if (a === 'alarm.bypass') return tr('עקיפת חיישן באזעקה');
  if (a.startsWith('alarm.')) return tr('פעולה באזעקה');
  if (a.startsWith('door.') || a.startsWith('access.')) return tr('פתיחת דלת');
  if (a.startsWith('rbac.')) return tr('שינוי הרשאות');
  if (a.startsWith('identity.') || a.startsWith('users.')) return tr('שינוי משתמשים');
  if (a.startsWith('auth.')) return tr('שינוי דרכי האימות');
  if (a.startsWith('backup.')) return tr('שחזור גיבוי');
  if (a.startsWith('bridge.')) return tr('קוד חדש למפתח הגשר');
  if (a.startsWith('system.') || a.endsWith('.configure')) return tr('שינוי הגדרות');
  return tr('פעולה רגישה · {action}', { action: a });
}
