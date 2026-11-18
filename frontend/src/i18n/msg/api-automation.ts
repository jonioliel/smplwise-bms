// CR-I18N-API-2442: the English of the texts built in src/api/* - automations, schedules and rules: the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/api-automation', packTable<typeof import('../lang/en/i18n/msg/api-automation').en>('en', 'i18n/msg/api-automation', 'en'));
