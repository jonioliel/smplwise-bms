/**
 * 2.6.0 TKWIZHINT - the user's own dismissal of the shell's setup hint, kept on the server in /me/prefs `setup.hint`
 * ({dismissed: true, failed: [ids]} or null) so it survives a refresh, a new login and another device. The wizard screen
 * and the shell share this one store; rules (what a dismissal covers) are in shell/setup-hint.ts.
 * Without a backend (the static demo) the store lives in memory for the page only. A failed write keeps the choice for the page.
 */
import { getMyPrefs, putMyPrefs } from './me-prefs';
import { isApi } from './session';
import { dismissalFor, parseDismissal, type SetupDismissal, type SetupSummary } from '../shell/setup-hint';

let current: SetupDismissal | null = null;
let loaded = false;
const listeners = new Set<(d: SetupDismissal | null) => void>();

function emit() {
  for (const l of listeners) l(current);
}

export const currentDismissal = (): SetupDismissal | null => current;
export const dismissalLoaded = (): boolean => loaded;

export function onDismissal(l: (d: SetupDismissal | null) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Reads the stored dismissal once (a failed read leaves the hint un-dismissed - it is only a hint). */
export async function loadDismissal(): Promise<SetupDismissal | null> {
  if (loaded) return current;
  if (isApi()) {
    try {
      current = parseDismissal((await getMyPrefs()).prefs['setup.hint']);
    } catch {
      current = null;
    }
  }
  loaded = true;
  emit();
  return current;
}

async function store(next: SetupDismissal | null): Promise<void> {
  current = next;
  loaded = true;
  emit();
  if (!isApi()) return;
  try {
    await putMyPrefs({ 'setup.hint': next });
  } catch {
    /* refused or offline: hidden / shown for this page only */
  }
}

/** Hide the hint now; remembers which required steps were failing so a newly failed one brings it back. */
export const dismissHint = (sum: SetupSummary | null): Promise<void> => store(dismissalFor(sum));
/** "הצג שוב את ההתראה" */
export const restoreHint = (): Promise<void> => store(null);
