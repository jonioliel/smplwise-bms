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
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/time', packTable<typeof import('../lang/en/i18n/msg/time').en>('en', 'i18n/msg/time', 'en'));
