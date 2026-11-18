// I18N-EN-SWITCH-2438: the English of investigate texts (src/screens/investigate-*.ts: event centre, recordings and playback,
// synced playback, history map, search, cases, rules and alerts, exports, incidents): the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/investigate', packTable<typeof import('../lang/en/i18n/msg/investigate').en>('en', 'i18n/msg/investigate', 'en'));
