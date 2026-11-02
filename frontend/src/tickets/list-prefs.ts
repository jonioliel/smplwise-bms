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

/**
 * TICKETS-1440-COLUMN-SETTING-2360: whether the viewer ever chose for the sentence column. `on` / `off` = the tick in the column chooser was
 * used in this browser (the choice wins over the installation's "medium width" default); `default` = never touched, the default (shown) applies.
 */
export function readSentenceChoice(): 'on' | 'off' | 'default' {
  try {
    const v = window.localStorage.getItem(SENTENCE_KEY);
    return v === '0' ? 'off' : v === '1' ? 'on' : 'default';
  } catch {
    return 'default';
  }
}

export function writeSentenceOn(on: boolean): void {
  try {
    window.localStorage.setItem(SENTENCE_KEY, on ? '1' : '0');
  } catch {
    /* the choice holds on this screen only */
  }
}
