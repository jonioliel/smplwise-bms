// I18N-EN-SWITCH-2438: the English of live texts (src/screens/live-*.ts: overview, all cameras wall, saved views, camera page):
// the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/live', packTable<typeof import('../lang/en/i18n/msg/live').en>('en', 'i18n/msg/live', 'en'));
