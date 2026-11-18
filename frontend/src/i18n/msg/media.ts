// I18N-EN-SWITCH-2438: the English of the media, camera and map screens' texts (src/screens: nvr-*, multimedia-*, media-*, wall-*,
// camera-*, security-*, kiosk-*, protected-*, mapping-*, explore-*, plan-* and insights-*, except the files other branches hold):
// the Hebrew text as written -> its English. Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English
// interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/media', packTable<typeof import('../lang/en/i18n/msg/media').en>('en', 'i18n/msg/media', 'en'));
