// CR-UI-POLISH-2443: the English of the names built in src/api/plan-view.ts - the dials of the "3D map" settings card (DIAL_HE)
// and their choices (CHOICE_HE): the Hebrew text as written -> its English.
// Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English interface. Terms: docs/i18n/GLOSSARY_EN.md
// (walk, prepared picture, wall cut-away, the quality rungs). A table of its own, and a small one, because api/plan-view.ts is
// also read by the 3D view and the wall screen: the card's long explanations live in msg/plan-view-card.ts, with the card.
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/api-plan-view', packTable<typeof import('../lang/en/i18n/msg/api-plan-view').en>('en', 'i18n/msg/api-plan-view', 'en'));
