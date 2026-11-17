// CR-I18N-API-2442: the English of the texts built in src/api/* - the client, the session and the small shared helpers: the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';

export const tr = msgCatalogue('msg/api-core', {
  // api/capabilities.ts
  'התקנה עם NVR אינה נתמכת בלי שרת המדיה (go2rtc): בלעדיו אין וידאו חי ואין ניגון הקלטות.': 'An installation with an NVR is not supported without the media server (go2rtc): without it there is no live video and no recording playback.',
  // api/client.ts
  'השרת דחה את הבקשה ({status})': 'The server refused the request ({status})',
  'אין חיבור לשרת.': 'No connection to the server.',
  // api/health.ts
  'תקין': 'OK',
  'לתשומת לב': 'Needs attention',
  'שגיאה': 'Error',
  'לא מוגדר': 'Not set',
  // api/prefs.ts
  'WebRTC בלבד': 'WebRTC only',
  'MSE בלבד': 'MSE only',
  'אוטומטי (WebRTC, ואם אינו זמין MSE)': 'Automatic (WebRTC, and MSE if it is unavailable)',
  // api/remote.ts
  'כתובת לא ידועה': 'Unknown address',
  // api/session.ts
  'חיבור ה־NVR מנוהל רק מהרשת המקומית': 'The NVR connection is managed only from the local network',
  'זמין רק מהרשת המקומית': 'Available only from the local network',
});
