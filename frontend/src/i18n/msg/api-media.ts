// CR-I18N-API-2442: the English of the texts built in src/api/* - screens, players and the media admin: the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/api-media', packTable<typeof import('../lang/en/i18n/msg/api-media').en>('en', 'i18n/msg/api-media', 'en'));
