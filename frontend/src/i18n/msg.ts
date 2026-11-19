/**
 * I18N-EN-SWITCH-2438 (owner round 32, Q-SYS-8): source-text catalogues for the texts that were written into the templates in
 * Hebrew. The Hebrew text itself is the key (`tr('מערכת')`), and each module's English sits in its own table under
 * `src/i18n/msg/<module>.ts` (Hebrew -> English). Hebrew screens are byte-for-byte unchanged: `tr` returns its argument, then
 * fills `{name}` placeholders. In English the table's text is used, and a text the table lacks stays Hebrew - the missing-keys
 * report (scripts/i18n_missing_keys.mjs) lists every `tr('...')` whose module table has no English.
 *
 * Rules (docs/i18n/GLOSSARY_EN.md): the first argument is a plain string literal (no `${}`), the same text in the same module
 * has one English, and run-time values go through `{name}` placeholders - `tr('עוד {n} פריטים', { n })`, never
 * `tr(\`עוד ${n} פריטים\`)`. The language is the document's (`<html lang>`, set before the first render by i18n/ui-lang.ts and
 * changed only by a reload), so a table may also be read while a module initialises (tab lists, option lists).
 */
import { docLang, fill, registerCatalogue, type Vars } from './core';

/** A module's translator: `tr(hebrew, vars?)`. */
export interface Translator {
  (he: string, vars?: Vars | null): string;
  /** The module's English table (Hebrew -> English). */
  readonly en: Readonly<Record<string, string>>;
}

/** The translator of one module. `name` is the table's module (`msg/shell` ...). */
export function msgCatalogue(name: string, en: Record<string, string>): Translator {
  // registered with an empty Hebrew table: the Hebrew keys are the `tr('...')` calls in the sources, collected by the report
  registerCatalogue(name, { he: {}, en });
  const tr = ((he: string, vars?: Vars | null) => fill(docLang(['en']) === 'en' ? (en[he] ?? he) : he, vars)) as Translator;
  Object.defineProperty(tr, 'en', { value: en });
  return tr;
}

