// FIX-MAPS2-2570 (deep review 2.57 MH2-02): the site-wide "turn off" of several buildings (home-site-off.ts) - starting the runs and
// the result's headline, out of the dialog so they run in node (tests/unit-fix-maps2-2570.spec.ts).
import { bulkHeadline, type BulkPreview, type BulkRecord } from '../api/device-bulk';

/** One request of the dialog: the building it belongs to and the server's preview of it. */
export interface SitePreview {
  b: string;
  p: BulkPreview;
}

/** MH2-02: the run of one building could not be started. The runs of the buildings before it were started (they go on on the server); for
 *  this building and the ones after it nothing was sent - no retry, no queue. */
export class SiteRunError extends Error {
  constructor(readonly building: string, readonly started: BulkRecord[], readonly notSent: string[], readonly reason: unknown) {
    super(reason instanceof Error ? reason.message : String(reason));
  }
}

/**
 * Start the runs of the chosen buildings, one after another, each with its own preview's digest. `onStarted` receives the runs started
 * so far after each start (MH2-02: the dialog follows a building's run as soon as it is on its way, so a later building's failure never
 * hides it). A failure stops here with a `SiteRunError`: what was started, the building that failed and the buildings not sent to.
 */
export async function startSiteRuns(previews: readonly SitePreview[], start: (p: BulkPreview) => Promise<BulkRecord>, onStarted: (records: BulkRecord[]) => void): Promise<BulkRecord[]> {
  const first: BulkRecord[] = [];
  for (let i = 0; i < previews.length; i++) {
    const x = previews[i];
    try {
      first.push(await start(x.p));
    } catch (err) {
      const notSent = [...new Set(previews.slice(i).map((y) => y.b))];
      throw new SiteRunError(x.b, [...first], notSent, err);
    }
    onStarted([...first]);
  }
  return first;
}

/**
 * The result's headline over the runs of every building (`done`: every run reached its end) - the single-scope dialog's own words
 * (api/device-bulk.ts bulkHeadline) over the summed counts: a device that was only sent is "נשלח", never "בוצע", and the running count
 * is of confirmed devices.
 */
export function siteOffHeadline(records: readonly BulkRecord[], done: boolean): { tone: 'ok' | 'partial' | 'none' | 'running'; text: string } {
  const counts = { queued: 0, accepted: 0, confirmed: 0, sent: 0, not_confirmed: 0, refused: 0, unknown: 0, total: 0 };
  for (const r of records) for (const k of Object.keys(counts) as (keyof typeof counts)[]) counts[k] += r.counts[k] ?? 0;
  return bulkHeadline({ ...(records[0] ?? {}), done, counts } as BulkRecord);
}
