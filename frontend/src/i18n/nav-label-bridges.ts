/**
 * CR-NAV-LABELS-2436: the two shell labels whose dictionaries are held by other branches - the generator's page names
 * (`i18n/he.ts`, the base dictionary, held by AUDIT30) and the requests-for-quotation tab (`tickets/rfq-text.ts`, moved by
 * SHELL-LAZY). Read from there unchanged, so no string exists twice; both modules are in the entry chunk through other importers today.
 *
 * Kept apart from i18n/nav-labels.ts on purpose: the dictionaries import nav-labels, and rfq-text imports tickets/text.ts, so
 * importing rfq-text from nav-labels would close a cycle (text.ts -> text-s4.ts -> nav-labels -> rfq-text -> text.ts) in which a
 * table is read before it exists. When SHELL-LAZY gives the RFQ tab label its own small module, the getter below points there.
 *
 * CR-SHELL-LAZY-2436: it did - the RFQ tab label is read from tickets/nav-text.ts (a leaf: tickets/naming.ts + i18n/nav-labels.ts),
 * which rfq-text.ts itself reads, so the RFQ dictionary is no longer reached from here.
 */
import { he } from './he';
import { nt } from '../tickets/nav-text';

/** The generator's page names (the registry's `infra.generator` section), as `he.generator.pages[id]`. */
export const navGeneratorPage = (id: keyof typeof he.generator.pages): string => he.generator.pages[id];
/** TKRFQ2: the requests-for-quotation tab, as `rt('navTitle')` (the word lives in tickets/nav-text.ts since CR-SHELL-LAZY-2436). */
export const navRfqTitle = (): string => nt('navTitle');
