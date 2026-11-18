// I18N-EN-SWITCH-2438: the English of the electricity texts (src/electricity/*: meters, readings, accounts, bills, customers, tariffs,
// the time-of-use and formula editors, the bill pages): the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md
// (the shared billing words follow src/water/i18n.ts).
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/electricity', packTable<typeof import('../lang/en/i18n/msg/electricity').en>('en', 'i18n/msg/electricity', 'en'));
