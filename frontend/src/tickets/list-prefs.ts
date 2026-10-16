/**
 * TKUI4 (release 2.6.0): the client-only choices of the list, kept per browser (never sent to the server, which knows nothing of them):
 * the table's "what is happening" column (default on) and whether the filter row of the cards is left open. Every read and write is
 * guarded - a private window or blocked site data must not break the screen.
 */
const SENTENCE_KEY = 'sw.tickets.table.sentence';

export function readSentenceOn(): boolean {
  try {
    return window.localStorage.getItem(SENTENCE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeSentenceOn(on: boolean): void {
  try {
    window.localStorage.setItem(SENTENCE_KEY, on ? '1' : '0');
  } catch {
    /* the choice holds on this screen only */
  }
}
