// CR-I18N-DATES-2442: the English of the hand-written time words - "5 minutes ago" helpers and weekday names - of the modules
// that had no source-text table of their own (api/automations, api/notifications, api/remote, api/schedules, api/home-config,
// screens/system-wall, screens/devices-building): the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); Hebrew screens get the Hebrew argument back unchanged. Terms: docs/i18n/GLOSSARY_EN.md
// (weekdays "Sun" / "Sunday", "{n} min ago", "{n} h ago" as in msg/screens.ts and msg/investigate.ts).
// Dates, clock times and numbers are not text: their locale comes from i18n/locale.ts.
// CR-I18N-UNITS-2442: also the durations ("5 דקות", "2 דק׳ 5 שנ׳", "עוד יומיים"), the weekday letters and the weather units of
// src/api/* (automations, frigate, health, home-config, notifications, rules). The Hebrew forms are the ones the sources wrote
// (singular / dual / plural are separate entries: "שעה", "שעתיים", "{n} שעות"); Intl is not used for them because its Hebrew is
// not these texts ("1 שעה", "שניה", "בעוד 45 דקות", "5 ימ׳" - docs/changes/CR-I18N-UNITS-2442.md). A number that can be 1 next to
// a fixed plural word has an abbreviation in English ("In {n} min", "{d} d {h} h"), so no English text reads "1 minutes".
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
  // weekday letters of the day toggles (api/notifications WEEKDAY_LETTER)
  'א': 'S',
  'ב': 'M',
  'ג': 'T',
  'ד': 'W',
  'ה': 'T',
  'ו': 'F',
  'ש': 'S',
  // durations in words (api/automations durationText: "Wait 5 minutes", "for 1 hour and 30 minutes"; api/home-config untilText)
  'שעה': '1 hour',
  'שעתיים': '2 hours',
  '{n} שעות': '{n} hours',
  'דקה': '1 minute',
  'שתי דקות': '2 minutes',
  '{n} דקות': '{n} minutes',
  'שנייה': '1 second',
  'שתי שניות': '2 seconds',
  '{n} שניות': '{n} seconds',
  'יום': '1 day',
  'יומיים': '2 days',
  '{n} ימים': '{n} days',
  ' ו': ' and ',
  // "in ..." (api/home-config untilText: "עוד יומיים ו־12 שעות")
  'עוד {n} דקות': 'In {n} min',
  'עוד {v}': 'In {v}',
  'עוד {v} ו־{v2}': 'In {v} and {v2}',
  // short durations (api/automations formatDuration, api/frigate spanText, api/health fmtUptime)
  '{n} מ״ש': '{n} ms',
  '{n} שנ׳': '{n} s',
  '{n} דק׳': '{n} min',
  '{m} דק׳ {s} שנ׳': '{m} min {s} s',
  '{n} שע׳': '{n} h',
  '{h} שע׳ {m} דק׳': '{h} h {m} min',
  '{d} ימים {h} שע׳': '{d} d {h} h',
  // agenda (api/home-config agendaWhen; "היום" is above)
  'מחר': 'Tomorrow',
  'כל היום': 'All day',
  // weather units (api/home-config valueText)
  'קמ״ש': 'km/h',
  'מ׳/שנ׳': 'm/s',
  'ק״מ': 'km',
  'מ׳': 'm',
  'מ״מ': 'mm',
  'הקטופסקל': 'hPa',
  'מ״ב': 'mbar',
});
