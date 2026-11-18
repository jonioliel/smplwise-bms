// CR-I18N-API-2442: the English of the texts built in src/api/* - cameras, recorders, events, cases and the video services: the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/api-video', packTable<typeof import('../lang/en/i18n/msg/api-video').en>('en', 'i18n/msg/api-video', 'en'));
