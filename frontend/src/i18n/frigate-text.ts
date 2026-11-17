// FRGD: the Frigate screens' text in the document's language. Hebrew (`he.frigate`, the product language) by default, the English
// column (`frigate-en.ts`) when the document language is English - the announce.ts precedent. The pure helpers of api/frigate*.ts
// keep reading `he` directly (their wording is pinned by unit tests); the screens read `fx()` when they render.
import { he } from './he';
import { frigateEn, type FrigateText } from './frigate-en';
import { docLang } from './core';

export type { FrigateText };

export function frigateLang(): 'he' | 'en' {
  return docLang(['en']);
}

/** The catalogue in force when a screen renders. */
export function fx(): FrigateText {
  return frigateLang() === 'en' ? frigateEn : (he.frigate as FrigateText);
}

/** The BCP-47 tag for dates and numbers of the Frigate screens. */
export const frigateLocale = (): string => (frigateLang() === 'en' ? 'en-GB' : 'he-IL');
