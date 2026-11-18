// FRGD: the English column of the Frigate screens (review, control, the management card). Same keys as `he.frigate`; the document
// language picks the column (i18n/frigate-text.ts, the announce.ts precedent). No infrastructure product names (UI_COPY_RULES).
import type { he } from './he';
import { packTable } from './lang-packs';

/** The shape of a catalogue: every leaf a string (the Hebrew source is `as const`). */
export type Text<T> = { [K in keyof T]: T[K] extends string ? string : Text<T[K]> };
export type FrigateText = Text<typeof he.frigate>;

export const frigateEn: FrigateText = packTable<typeof import('./lang/en/i18n/frigate-en').frigateEn>('en', 'i18n/frigate-en', 'frigateEn');
