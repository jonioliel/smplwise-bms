// FIX-MAPS2-2570 (deep review 2.57 MH2-02): the site-wide "turn off" of several buildings (home-site-off.ts) - starting the runs and
// the result's headline, out of the dialog so they run in node (tests/unit-fix-maps2-2570.spec.ts).
import type { BulkPreview, BulkRecord } from '../api/device-bulk';
import { ltrNum } from '../i18n/bidi';
import { tr } from '../i18n/msg/screens';

/** One request of the dialog: the building it belongs to and the server's preview of it. */
export interface SitePreview {
  b: string;
  p: BulkPreview;
}

/**
 * Start the runs of the chosen buildings, one after another, each with its own preview's digest. `onStarted` receives the runs that
 * were started.
 */
export async function startSiteRuns(previews: readonly SitePreview[], start: (p: BulkPreview) => Promise<BulkRecord>, onStarted: (records: BulkRecord[]) => void): Promise<BulkRecord[]> {
  const first: BulkRecord[] = [];
  for (const x of previews) first.push(await start(x.p));
  onStarted(first);
  return first;
}

/** The result's headline over the runs of every building (`done`: every run reached its end). */
export function siteOffHeadline(records: readonly BulkRecord[], done: boolean): { tone: 'ok' | 'partial' | 'none' | 'running'; text: string } {
  const total = records.reduce((s, r) => s + r.counts.total, 0);
  const ok = records.reduce((s, r) => s + r.counts.confirmed + (r.counts.sent ?? 0), 0);
  if (!done) return { tone: 'running', text: tr('{ok} מתוך {total} אושרו', { ok: ltrNum(ok), total: ltrNum(total) }) };
  return ok === total ? { tone: 'ok', text: tr('בוצע') } : { tone: 'partial', text: tr('בוצע חלקית: {n} לא אושרו', { n: ltrNum(total - ok) }) };
}
