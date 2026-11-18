// CR-I18N-PLANWIZARD (code review 08:F11, plan wizard): the English of the texts written into src/plan-wizard/* (the seven
// steps of the new-plan wizard, its settings dialog and the labels of its model): the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
// Not here on purpose: the demo house's names (wizard-demo.ts: sample data, like names that come from the server), the room
// type keywords (`words`, matched against area names), the version note WIZARD_NOTE (an identifier stored on the server) and
// fallbackRoomName (the server gives the same name). No Arabic / Russian column (CR-I18N-LAZY-LANG owns those).
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/plan-wizard', packTable<typeof import('../lang/en/i18n/msg/plan-wizard').en>('en', 'i18n/msg/plan-wizard', 'en'));
