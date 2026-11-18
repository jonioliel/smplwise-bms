// CR-UI-POLISH-2443: the English of the "3D map" settings card (owner round 32) - src/screens/system-plan-view.ts and the
// explanations and rows of src/screens/plan-view-dials.ts: the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md.
// The words the card shares with the look card (system-look.ts) and the plan wizard's settings dialog carry the same English as
// msg/system-b.ts and msg/plan-wizard.ts. The dial and choice names are in msg/api-plan-view.ts (api/plan-view.ts).
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/plan-view-card', packTable<typeof import('../lang/en/i18n/msg/plan-view-card').en>('en', 'i18n/msg/plan-view-card', 'en'));
