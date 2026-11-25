import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildChecklist, checklistProgress, onboardingActive, parseEnabled, READINESS_STEPS, SUPPORT_HREF } from '../src/api/onboarding';
import { demoReadiness, type ReadinessReport } from '../src/api/readiness';
import type { SetupSummary } from '../src/shell/setup-hint';

// DOCS-ONBOARDING-2530 (T071): the first-run getting-started checklist is built from what the setup wizard and the installation
// readiness already measure (nothing ticked by hand), in the order a new installation is set up; the shell shows it only while the
// installation's switch is on, this user has not hidden it and the user configures the system.

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');

const sum = (o: Partial<SetupSummary>): SetupSummary => ({ ready: false, done: 2, total: 4, failed: [], next: 'ha', ...o });

test.describe('the checklist', () => {
  test('wizard first, then the readiness checks in set-up order, then the support page; not-applicable checks are left out', () => {
    const items = buildChecklist(sum({}), demoReadiness());
    expect(items[0]).toMatchObject({ id: 'connect', state: 'open', href: '#/system/wizard', optional: false });
    expect(items.at(-1)).toMatchObject({ id: 'support', state: 'info', href: SUPPORT_HREF, optional: true });
    const middle = items.slice(1, -1).map((i) => i.id);
    // the demo report: remote and modules are not applicable
    expect(middle).toEqual(['time', 'places', 'people', 'notifications', 'backup', 'handover']);
    expect(middle).toEqual(READINESS_STEPS.filter((id) => middle.includes(id))); // the fixed order
    // the camera / connection checks are the wizard's own steps: never repeated
    expect(items.some((i) => ['cameras_connected', 'cameras_verified', 'integrations'].includes(i.id))).toBe(false);
  });

  test('a check that is fine is done; anything else is open; the check\'s own link wins over the fallback', () => {
    const items = buildChecklist(sum({ ready: true, done: 4, total: 4, next: null }), demoReadiness());
    const by = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(by.connect.state).toBe('done');
    expect(by.time.state).toBe('done');
    expect(by.backup).toMatchObject({ state: 'open', href: '#/system/diagnostics?tab=backup' });
    expect(by.notifications).toMatchObject({ state: 'open', href: '#/system/notifications' });
    expect(by.people).toMatchObject({ state: 'done', href: '#/system/access' }); // no `next` on a fine check: the fallback
    expect(by.handover).toMatchObject({ optional: true, state: 'open', href: '#/system/readiness' });
  });

  test('progress counts the required items only (the hand-over and the support page never block)', () => {
    const items = buildChecklist(sum({ ready: true, done: 4, total: 4, next: null }), demoReadiness());
    const p = checklistProgress(items);
    expect(p).toMatchObject({ done: 4, total: 6 }); // connect, time, places, people done; notifications, backup open
    expect(p.next?.id).toBe('notifications');
    const all = buildChecklist(sum({ ready: true, done: 4, total: 4, next: null }), {
      ...demoReadiness(),
      checks: demoReadiness().checks.map((c) => (c.status === 'not_applicable' ? c : { ...c, status: 'ok' as const })),
    } satisfies ReadinessReport);
    expect(checklistProgress(all)).toMatchObject({ done: 6, total: 6, next: null });
  });

  test('without the readiness report: the wizard and the support page only; without the wizard state the first item stays open', () => {
    expect(buildChecklist(sum({ ready: true }), null).map((i) => i.id)).toEqual(['connect', 'support']);
    expect(buildChecklist(null, null)[0]).toMatchObject({ id: 'connect', state: 'open' });
    expect(buildChecklist(sum({ total: 0, done: 0 }), null)[0].state).toBe('done'); // NVR-less with nothing required left
  });
});

test.describe('when the shell shows it', () => {
  test('the setting reads "true" only; the row needs the switch, no dismissal and system.configure', () => {
    expect([parseEnabled('true'), parseEnabled('false'), parseEnabled(undefined), parseEnabled('yes'), parseEnabled(true)]).toEqual([true, false, false, false, true]);
    expect(onboardingActive(true, false, true)).toBe(true);
    expect(onboardingActive(false, false, true)).toBe(false);
    expect(onboardingActive(true, true, true)).toBe(false);
    expect(onboardingActive(true, false, false)).toBe(false);
  });

  test('the route, its permission and its lazy chunk are wired; the landing only moves a DEFAULT landing, once per tab session', () => {
    const app = read('shell/sw-app.ts');
    expect(app).toContain("if (s[1] === 'onboarding') return html`<system-onboarding></system-onboarding>`;");
    expect(app).toContain('if (firstLanding) void this.landOnOnboarding(target);');
    expect(app).toContain("window.sessionStorage.getItem('arx.onboarding.landed') === '1'");
    expect(app).toContain('window.location.hash !== `#${target}`');
    expect(app).toContain('if (this.onboardingRow) return this.renderOnboardingRow();');
    const nav = read('shell/nav.ts');
    expect(nav).toContain("'#/system/onboarding': ['system.configure']");
    expect(nav).toMatch(/INSTALLATION_ONLY_HREFS = new Set<string>\(\[[^\]]*'#\/system\/onboarding'/);
    expect(read('shell/lazy-screens.ts')).toContain("'system-onboarding': () => import('../screens/system-onboarding')");
  });

  test('the support tab no longer carries the placeholder bundle (its button was "later" and its switches did nothing)', () => {
    const d = read('screens/system-diagnostics.ts');
    const body = d.slice(d.indexOf('private renderSupport()'), d.indexOf("/** The open tab's body."));
    expect(body).not.toContain('(בהמשך)');
    expect(body).toContain('<health-log-export></health-log-export>');
    expect(body).toContain('data-set-onboarding');
    expect(body).toContain('data-support-versions');
    expect(body).toContain('data-support-report');
  });
});
