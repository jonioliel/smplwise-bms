/**
 * DOCS-ONBOARDING-2530 (T071): the first-run "getting started" checklist (#/system/onboarding, screens/system-onboarding.ts) and the
 * shell's row that leads to it.
 *
 * Nothing new is measured here: the checklist is the setup wizard's REQUIRED steps (GET /setup/state, summarised by shell/setup-hint.ts)
 * followed by the installation-readiness checks (GET /readiness) in the order a new installation is set up, each with the link the
 * check itself names. Both reads need system.configure at the installation, like the screen.
 *
 * Two switches, both kept on the server:
 *  - the installation's `onboarding.enabled` setting (Settings › Support; "true" only on a FRESH installation, startup_steps.py) -
 *    shared here so the shell's row follows a change made on the support tab at once;
 *  - the user's own `onboarding.dismissed` (/me/prefs; true or null): "Hide the checklist" for this user only.
 * Without a backend (the static demo) both live in memory for the page.
 */
import { getMyPrefs, putMyPrefs } from './me-prefs';
import { isApi } from './session';
import type { ReadinessReport } from './readiness';
import type { SetupSummary } from '../shell/setup-hint';
import { tr } from '../i18n/msg/api-system';

export const ONBOARDING_HREF = '#/system/onboarding';
export const SUPPORT_HREF = '#/system/diagnostics?tab=support';

// ---------------------------------------------------------------- the installation switch (setting onboarding.enabled)

let enabled = false;
const enabledListeners = new Set<(on: boolean) => void>();

/** The stored setting as GET /settings answers it ("true" / "false"; anything else = off, the default). */
export const parseEnabled = (v: unknown): boolean => String(v ?? 'false') === 'true';

export function setOnboardingEnabled(on: boolean): void {
  if (on === enabled) return;
  enabled = on;
  for (const l of enabledListeners) l(on);
}

export const onboardingEnabled = (): boolean => enabled;

export function onOnboardingEnabled(l: (on: boolean) => void): () => void {
  enabledListeners.add(l);
  return () => enabledListeners.delete(l);
}

// ---------------------------------------------------------------- the user's own dismissal (/me/prefs onboarding.dismissed)

let dismissed = false;
let loaded = false;
let owner: string | null = null;
const listeners = new Set<(d: boolean) => void>();

function emit() {
  for (const l of listeners) l(dismissed);
}

/** The cache is per USER (the setup hint's rule, TKFIX260): another user on the same tab starts clean. Returns whether it was reset. */
export function resetOnboardingFor(userId: string | null): boolean {
  if (userId === owner) return false;
  owner = userId;
  dismissed = false;
  loaded = false;
  emit();
  return true;
}

export const onboardingDismissed = (): boolean => dismissed;
export const onboardingLoaded = (): boolean => loaded;

export function onOnboardingDismissed(l: (d: boolean) => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Reads the stored dismissal once (a failed read leaves the checklist shown - it is only a guide). */
export async function loadOnboardingDismissal(): Promise<boolean> {
  if (loaded) return dismissed;
  if (isApi()) {
    try {
      dismissed = (await getMyPrefs()).prefs['onboarding.dismissed'] === true;
    } catch {
      dismissed = false;
    }
  }
  loaded = true;
  emit();
  return dismissed;
}

async function store(next: boolean): Promise<void> {
  dismissed = next;
  loaded = true;
  emit();
  if (!isApi()) return;
  try {
    await putMyPrefs({ 'onboarding.dismissed': next ? true : null });
  } catch {
    /* refused or offline: hidden / shown for this page only */
  }
}

/** "הסתר את רשימת תחילת העבודה" - for this user only. */
export const dismissOnboarding = (): Promise<void> => store(true);
/** "הצג שוב את רשימת תחילת העבודה" */
export const restoreOnboarding = (): Promise<void> => store(false);

/** The shell's rule: the row (and the first landing) appear while the installation's switch is on and this user has not hidden it. */
export const onboardingActive = (on: boolean, hidden: boolean, mayConfigure: boolean): boolean => on && !hidden && mayConfigure;

// ---------------------------------------------------------------- the checklist (pure)

type OnboardingState = 'done' | 'open' | 'info';

export interface OnboardingItem {
  id: string;
  title: string;
  detail: string;
  state: OnboardingState;
  /** Never counted in the progress (the hand-over to the customer, the support page). */
  optional: boolean;
  href: string;
  linkLabel: string;
}

/** The readiness checks a new installation goes through after the wizard, in that order. The camera and connection checks are the
 * wizard's own steps (the first item), so they are not repeated. */
export const READINESS_STEPS = ['time', 'places', 'people', 'notifications', 'backup', 'remote', 'modules', 'handover'] as const;

/** Where a check leads when it names no link of its own (a check that is fine has none). */
const FALLBACK: Record<(typeof READINESS_STEPS)[number], { href: string; label: () => string }> = {
  time: { href: '#/system/wizard', label: () => tr('לאשף ההתקנה') },
  places: { href: '#/explore/sites', label: () => tr('לאתרים ולמבנים') },
  people: { href: '#/system/access', label: () => tr('למשתמשים והרשאות') },
  notifications: { href: '#/system/notifications', label: () => tr('להגדרות ההתראות') },
  backup: { href: '#/system/diagnostics?tab=backup', label: () => tr('לגיבוי ושחזור') },
  remote: { href: '#/system/diagnostics?tab=remote', label: () => tr('לגישה מרחוק') },
  modules: { href: '#/system/diagnostics?tab=tabs', label: () => tr('ללשוניות ולמודולים') },
  handover: { href: '#/system/readiness', label: () => tr('למוכנות ההתקנה') },
};

/**
 * The checklist from what the wizard and the readiness report say right now. `setup` null = the wizard's state was not read (the
 * item stays open and leads to the wizard); `readiness` null = the report was not read (only the wizard item and the support item).
 * A check the installation does not need (`not_applicable`) is left out.
 */
export function buildChecklist(setup: SetupSummary | null, readiness: ReadinessReport | null): OnboardingItem[] {
  const items: OnboardingItem[] = [{
    id: 'connect',
    title: tr('חיבור המערכת'),
    detail: !setup
      ? tr('מצב ההתקנה לא נקרא. אשף ההתקנה בודק את החיבורים אחד אחד.')
      : setup.total === 0 || setup.ready
        ? tr('כל השלבים הנדרשים של אשף ההתקנה הושלמו.')
        : tr('{done} מתוך {total} השלבים הנדרשים של אשף ההתקנה הושלמו.', { done: setup.done, total: setup.total }),
    state: setup && (setup.ready || setup.total === 0) ? 'done' : 'open',
    optional: false,
    href: '#/system/wizard',
    linkLabel: tr('לאשף ההתקנה'),
  }];
  for (const id of READINESS_STEPS) {
    const c = readiness?.checks.find((x) => x.id === id);
    if (!c || c.status === 'not_applicable' || c.applicable === false) continue;
    items.push({
      id,
      title: c.title,
      detail: c.summary,
      state: c.status === 'ok' ? 'done' : 'open',
      optional: id === 'handover',
      href: c.next?.href ?? FALLBACK[id].href,
      linkLabel: c.next?.label ?? FALLBACK[id].label(),
    });
  }
  items.push({
    id: 'support',
    title: tr('תפעול יומיומי ותמיכה'),
    detail: tr('איפה רואים את הגרסאות, איך מורידים יומן מצונזר ואיך מדווחים על תקלה.'),
    state: 'info',
    optional: true,
    href: SUPPORT_HREF,
    linkLabel: tr('לדף התמיכה'),
  });
  return items;
}

/** Done / counted: every item but the optional ones. */
export function checklistProgress(items: OnboardingItem[]): { done: number; total: number; next: OnboardingItem | null } {
  const counted = items.filter((i) => !i.optional && i.state !== 'info');
  return { done: counted.filter((i) => i.state === 'done').length, total: counted.length, next: counted.find((i) => i.state !== 'done') ?? null };
}
