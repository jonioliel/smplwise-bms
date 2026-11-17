// CR-I18N-DATES-2442: the English of the hand-written time words - "5 minutes ago" helpers and weekday names - of the modules
// that had no source-text table of their own (api/automations, api/notifications, api/remote, api/schedules, api/home-config,
// screens/system-wall, screens/devices-building): the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); Hebrew screens get the Hebrew argument back unchanged. Terms: docs/i18n/GLOSSARY_EN.md
// (weekdays "Sun" / "Sunday", "{n} min ago", "{n} h ago" as in msg/screens.ts and msg/investigate.ts).
// Dates, clock times and numbers are not text: their locale comes from i18n/locale.ts.
import { msgCatalogue } from '../msg';

export const tr = msgCatalogue('msg/time', {
  // relative time
  'עכשיו': 'Now',
  'הרגע': 'Just now',
  'רץ עכשיו': 'Running now',
  'לפני {n} דק׳': '{n} min ago',
  'לפני שעה': 'An hour ago',
  'לפני {n} שע׳': '{n} h ago',
  'לפני {n} ימים': '{n} days ago',
  'היום': 'Today',
  'אתמול': 'Yesterday',
  'היום {time}': 'Today {time}',
  'מחר {time}': 'Tomorrow {time}',
  'אתמול {time}': 'Yesterday {time}',
  'יום {day} {time}': '{day} {time}',
  'יום {day} {date}': '{day} {date}',
  // "<what> ... ago" (devices-building agoHe: `what` is the caller's word, "updated" / "checked")
  '{what} עכשיו': '{what} just now',
  '{what} לפני {n} שניות': '{what} {n} seconds ago',
  '{what} לפני דקה': '{what} a minute ago',
  '{what} לפני {n} דקות': '{what} {n} minutes ago',
  '{what} לפני שעה': '{what} an hour ago',
  '{what} לפני {n} שעות': '{what} {n} hours ago',
  '{what} ב־{at}': '{what} on {at}',
  // "changed ... ago" (api/home-config sinceText)
  'שונה עכשיו': 'Changed just now',
  'שונה לפני {n} דקות': 'Changed {n} minutes ago',
  'שונה לפני שעה': 'Changed an hour ago',
  'שונה לפני {n} שעות': 'Changed {n} hours ago',
  'שונה אתמול': 'Changed yesterday',
  'שונה לפני {n} ימים': 'Changed {n} days ago',
  // weekdays
  'א׳': 'Sun',
  'ב׳': 'Mon',
  'ג׳': 'Tue',
  'ד׳': 'Wed',
  'ה׳': 'Thu',
  'ו׳': 'Fri',
  'ש׳': 'Sat',
  'ראשון': 'Sunday',
  'שני': 'Monday',
  'שלישי': 'Tuesday',
  'רביעי': 'Wednesday',
  'חמישי': 'Thursday',
  'שישי': 'Friday',
  'שבת': 'Saturday',
});
