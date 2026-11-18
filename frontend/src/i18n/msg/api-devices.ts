// CR-I18N-API-2442: the English of the texts built in src/api/* - devices, the alarm, access and WisKey: the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/api-devices', packTable<typeof import('../lang/en/i18n/msg/api-devices').en>('en', 'i18n/msg/api-devices', 'en'));
