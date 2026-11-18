// CR-I18N-MAP (code review 08:F11, map text only): the English of the texts written into src/map/* (the 2D plan canvas, the 3D
// view and its walk, the room pills, the history layers, the prepared pictures and the pure label helpers beside them): the
// Hebrew text as written -> its English. Read through `tr()` (i18n/msg.ts); a text missing here stays Hebrew in the English
// interface. Terms: docs/i18n/GLOSSARY_EN.md. No Arabic / Russian column (CR-I18N-LAZY-LANG owns those).
import { msgCatalogue } from '../msg';
import { packTable } from '../lang-packs';

export const tr = msgCatalogue('msg/map', packTable<typeof import('../lang/en/i18n/msg/map').en>('en', 'i18n/msg/map', 'en'));
