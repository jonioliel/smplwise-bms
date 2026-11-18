// I18N-EN-SWITCH-2438: the English of the calendars module's texts (src/calendars/*: calendar views, event and maintenance drawers,
// attendee picker, calendar management, sync and feeds): the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/calendars', packTable<typeof import('../lang/en/i18n/msg/calendars').en>('en', 'i18n/msg/calendars', 'en'));
