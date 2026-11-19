/**
 * CR-CMP2-TABLES-CONSUMPTION-2450 (owner N10): the electricity and water tables are the shared `sw-table`, whose cells draw inside its
 * shadow root - the module's chip classes (`c-ok`, `c-warn`, ...) do not reach there. A cell's chip takes the shared status tones instead
 * (`<span class="chip" data-tone=...>`, the same meaning per colour across the product): this maps the module's chip class onto its tone,
 * so a screen keeps one status map for its cards / phone rows (module chips) and its table (shared chips).
 */
import { nothing } from 'lit';

type TableTone = 'ok' | 'warn' | 'bad' | 'info';

const TONE: Readonly<Record<string, TableTone>> = { 'c-ok': 'ok', 'c-warn': 'warn', 'c-err': 'bad', 'c-acc': 'info' };

/** The shared tone of a module chip class (`c-mut` and unknown classes: the neutral chip, no tone). */
export const toneOf = (chipClass: string): TableTone | typeof nothing => TONE[chipClass] ?? nothing;
