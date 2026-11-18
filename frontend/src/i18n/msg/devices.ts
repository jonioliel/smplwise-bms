// I18N-EN-SWITCH-2438: the English of the devices area texts (src/screens/devices-*, area-*, door-*, building-*, floor-*,
// device-*, lock-*, cast-*, presence-*, tree-*: building overview, rooms and areas, lights, climate, locks, presence, casting):
// the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/devices', packTable<typeof import('../lang/en/i18n/msg/devices').en>('en', 'i18n/msg/devices', 'en'));
