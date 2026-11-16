/**
 * CR-POLL-SCREENS-B-2440 (review 06:ALARM-1 and the RACE findings of the same report): "the newest read wins".
 *
 * A screen that reads the same thing from several places - a poll, a push-driven refetch, a read after a command, a filter the
 * person just changed - has several answers in flight, and they do not come back in the order they were asked. Without a guard an
 * older answer that arrives last overwrites the newer one (the alarm shows the state before the command; a list shows the previous
 * filter's rows). The guard is one counter:
 *
 *     private reads = new Latest();
 *     ...
 *     const current = this.reads.begin();     // this read is now the newest
 *     const data = await fetchIt();
 *     if (!current()) return;                  // a newer read began meanwhile (or the screen left): drop this answer
 *     this.data = data;
 *
 * `cancel()` (the screen disconnected, the subject changed) makes every answer still in flight stale without starting a read.
 * An answer is dropped only when a NEWER read began: the newest one is always applied, however late it arrives.
 */
export class Latest {
  private seq = 0;

  /** Start a read. The returned function says whether it is still the newest one. */
  begin(): () => boolean {
    const mine = ++this.seq;
    return () => mine === this.seq;
  }

  /** Every read in flight becomes stale (nothing new starts). */
  cancel(): void {
    this.seq += 1;
  }
}
