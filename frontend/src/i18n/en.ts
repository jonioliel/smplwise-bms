// English UI strings for the sections that carry a catalogue (CARD1, 2026-10-07: the equipment cards of the activity window).
// Picked by `t()` when `<html lang>` starts with "en"; a key missing here falls back to the Hebrew in he.ts. Same shape, section by section.
// I18N-EN-SWITCH-2438: every section of he.ts now has its English; the Frigate section comes from frigate-en.ts (one source).
import type { PartialCatalogue } from './he';
import { frigateEn } from './frigate-en';
import { packTable, withEntries } from './lang-packs';

export const en = withEntries(packTable<typeof import('./lang/en/i18n/en').en>('en', 'i18n/en', 'en'), {
  frigate: frigateEn,
}) satisfies PartialCatalogue;
