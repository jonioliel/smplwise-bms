import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { NotifySummary } from '../src/api/notifications';
import { ShellNotify, type NotifyEnv } from '../src/shell/notify-wiring';

// CR-SHELL-EXTRACT-2440 (code review 07:F24, 07:F23): the shell's notification wiring moved out of shell/sw-app.ts into
// shell/notify-wiring.ts (ShellNotify), behaviour unchanged; and router.ts's doc comment had lost its first letter to a carriage return.
// Node only: a fake Lit host and a fake notification store / rules API; the shell's use of the controller is checked in the source.
//   npx playwright test -c playwright.unit.config.ts tests/unit-shell-extract-2440.spec.ts
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

const SUM = (unread: number, critical = 0): NotifySummary => ({ unread, open_critical: critical, by_category: {} });

function fakeHost() {
  const controllers: ReactiveController[] = [];
  const host = {
    updates: 0,
    addController: (c: ReactiveController) => void controllers.push(c),
    removeController: () => undefined,
    requestUpdate() {
      host.updates++;
    },
    updateComplete: Promise.resolve(true),
    connect: () => controllers.forEach((c) => c.hostConnected?.()),
    disconnect: () => controllers.forEach((c) => c.hostDisconnected?.()),
  };
  return host;
}

function fakeEnv() {
  const log: string[] = [];
  let listener: ((s: NotifySummary | null) => void) | null = null;
  const st = { summaryOnRefresh: null as NotifySummary | null, alerts: 3 as number | Error, mayRead: true };
  const env: NotifyEnv = {
    subscribe(fn) {
      listener = fn;
      log.push('subscribe');
      return () => {
        listener = null;
        log.push('unsubscribe');
      };
    },
    start: async () => void log.push('start'),
    stop: () => void log.push('stop'),
    refreshSummary: async () => {
      log.push('refresh');
      listener?.(st.summaryOnRefresh);
    },
    unackedAlerts: async () => {
      log.push('alerts');
      if (st.alerts instanceof Error) throw st.alerts;
      return st.alerts;
    },
    mayReadAlerts: () => st.mayRead,
  };
  return { env, log, st, emit: (s: NotifySummary | null) => listener?.(s) };
}

function setup() {
  const host = fakeHost();
  const e = fakeEnv();
  const n = new ShellNotify(host as unknown as ReactiveControllerHost, e.env);
  host.connect();
  return { host, n, ...e };
}

test.describe('ShellNotify (shell/notify-wiring.ts)', () => {
  test('the store summary follows while connected; a render is asked only when it changed; disconnect unsubscribes and stops the live events', () => {
    const { host, n, log, emit } = setup();
    expect(log).toEqual(['subscribe']);
    const a = SUM(2, 1);
    emit(a);
    expect(n.summary).toBe(a);
    expect(host.updates).toBe(1);
    emit(a); // the store changed something else (rows, clock): the same summary object
    expect(host.updates).toBe(1);
    emit(null);
    expect(n.summary).toBeNull();
    expect(host.updates).toBe(2);
    host.disconnect();
    expect(log).toEqual(['subscribe', 'unsubscribe', 'stop']);
    emit(SUM(5)); // nothing listens any more
    expect(n.summary).toBeNull();
  });

  test('startLive: api and demo start the store, the Lovelace card view and the other modes do not', () => {
    const { n, log } = setup();
    n.startLive('loading', false);
    n.startLive('unauthenticated', false);
    n.startLive('no_access', false);
    n.startLive('api', true);
    expect(log).toEqual(['subscribe']);
    n.startLive('api', false);
    n.startLive('demo', false);
    expect(log).toEqual(['subscribe', 'start', 'start']);
  });

  test('poll: kiosk / embed nothing, demo 0, no session null, the summary first and the rule alerts only when it does not answer', async () => {
    const { n, log, st } = setup();
    await n.poll('api', true);
    expect(log).toEqual(['subscribe']);
    expect(n.alertCount).toBeNull();
    await n.poll('demo', false);
    expect(n.alertCount).toBe(0);
    await n.poll('unauthenticated', false);
    expect(n.alertCount).toBeNull();
    // the summary answers: no rule-alert read
    st.summaryOnRefresh = SUM(1);
    await n.poll('api', false);
    expect(log).toEqual(['subscribe', 'refresh']);
    expect(n.alertCount).toBeNull();
    // an older backend: the rule alerts stand in
    st.summaryOnRefresh = null;
    await n.poll('api', false);
    expect(n.alertCount).toBe(3);
    expect(log.slice(-2)).toEqual(['refresh', 'alerts']);
    // a failed read keeps the last known count
    st.alerts = new Error('503');
    await n.poll('api', false);
    expect(n.alertCount).toBe(3);
    // a user who may not read alerts: null, no request
    st.mayRead = false;
    const before = log.length;
    await n.poll('api', false);
    expect(n.alertCount).toBeNull();
    expect(log.slice(before)).toEqual(['refresh']);
  });

  test('badge: the summary when it answers, the rule alerts otherwise, nothing for a gated user', () => {
    const { n, emit } = setup();
    expect(n.badge(false)).toEqual({ count: 0, dot: false, item: false });
    emit(SUM(4, 1));
    expect(n.badge(false)).toEqual({ count: 4, dot: true, item: true });
    expect(n.badge(true)).toEqual({ count: 0, dot: false, item: false });
  });

  test('a push row link: the center is pending on that row until the session is known, and survives the next route change once', () => {
    const { n } = setup();
    expect(n.takeLink('#/devices/building')).toBe(false);
    expect(n.takeLink('#/notifications/n%201')).toBe(true);
    expect(n.focusId).toBe('n 1');
    expect(n.confirmDoor).toBe(false);
    expect(n.takePending('loading')).toBe(false); // still pending
    expect(n.takePending('api')).toBe(true);
    expect(n.takePending('api')).toBe(false); // taken
    n.show();
    expect(n.open).toBe(true);
    n.routeChanged(); // the shell's own fallback to the home screen
    expect(n.open).toBe(true);
    n.routeChanged(); // a real navigation
    expect(n.open).toBe(false);
    expect(n.focusId).toBe('n 1'); // dismiss keeps the focus (as before)
  });

  test('a push door link asks for the in-app confirmation; a signed-out or gated session never opens it', () => {
    const { n } = setup();
    expect(n.takeLink('#/doors/d1?confirm=n9')).toBe(true);
    expect(n.focusId).toBe('n9');
    expect(n.confirmDoor).toBe(true);
    expect(n.takePending('unauthenticated')).toBe(false);
    expect(n.takePending('demo')).toBe(false); // the pending link was used up by the known session
  });

  test('hide forgets the focus and the confirmation and says whether anything was open; show / dismiss ask a render only on a change', () => {
    const { host, n } = setup();
    expect(n.hide()).toBe(false);
    expect(host.updates).toBe(0);
    n.takeLink('#/doors/d1?confirm=n9');
    n.show();
    const u = host.updates;
    n.show();
    expect(host.updates).toBe(u);
    expect(n.hide()).toBe(true);
    expect([n.open, n.focusId, n.confirmDoor]).toEqual([false, '', false]);
    const v = host.updates;
    n.dismiss();
    expect(host.updates).toBe(v);
  });
});

test.describe('the shell wiring (shell/sw-app.ts, router.ts)', () => {
  const app = src('shell/sw-app.ts');

  test('the notification state lives in ShellNotify; the shell keeps the overlays and passes the store and the rules API', () => {
    expect(app).toContain("import { ShellNotify } from './notify-wiring';");
    expect(app).toMatch(/private notify = new ShellNotify\(this, \{/);
    expect(app).not.toMatch(/centerOpen|centerFocus|centerConfirm|notifySummary|pendingCenter|keepCenterOnce|stopNotify|alertCount =/);
    expect(app).not.toMatch(/parseDoorConfirmLink|parseNotificationLink|badgeOf\(/);
    // the 60 s poll still reads the alerts through the shell's own method (unit-shell-timers.spec.ts pins that line)
    expect(app).toMatch(/private pollAlerts\(\) \{\s*return this\.notify\.poll\(this\.session\.mode, this\.route\?\.segments\[0\] === 'kiosk' \|\| this\.embedded\(\)\);/);
  });

  test('router.ts: the onRouteChange doc comment is whole again (07:F23)', () => {
    const r = src('router.ts');
    expect(r).toContain('/** `replaced` is true for replaceRoute / pushRoute');
    expect(r).not.toMatch(/\r/);
    expect(r).not.toMatch(/^eplaced/m);
  });
});
