import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { NavOverlay, type NavOverlayEnv } from '../src/shell/overlay-history';
import { PermissionsNotice, type PermissionsEnv } from '../src/shell/permissions-notice';

// CR-SHELL-EXTRACT-B-2450 (owner N5, the follow-up of CR-SHELL-EXTRACT-2440): two more parts of shell/sw-app.ts as controllers,
// behaviour unchanged - the overlays' history entry and the Back button (shell/overlay-history.ts, NavOverlay) and the "your
// permissions were updated" wiring (shell/permissions-notice.ts, PermissionsNotice); plus the first-load note of a failing /me in
// the interface language and the permissions notice centred in a left-to-right interface.
// Node only: a fake Lit host, a fake history / window and fake session calls; the shell's use of the controllers is checked in the source.
//   npx playwright test -c playwright.unit.config.ts tests/unit-shell-extract-b-2450.spec.ts
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

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

/** A browser history: a stack of states; back() pops and fires popstate with the state now on top (as the browser does, later). */
function fakeWindow() {
  const log: string[] = [];
  const stack: unknown[] = [{ route: 1 }];
  const listeners = new Set<(e: PopStateEvent) => void>();
  const history = {
    get state() {
      return stack[stack.length - 1] ?? null;
    },
    pushState(data: unknown) {
      if (fail.push) throw new Error('SecurityError');
      stack.push(data);
      log.push('push');
    },
    back() {
      log.push('back');
      queued = true;
    },
  };
  const fail = { push: false };
  let queued = false;
  const target = {
    addEventListener: (type: string, fn: (e: PopStateEvent) => void) => {
      if (type === 'popstate') listeners.add(fn);
    },
    removeEventListener: (type: string, fn: (e: PopStateEvent) => void) => {
      if (type === 'popstate') listeners.delete(fn);
    },
  };
  /** The browser delivers the popstate of a back() (or of the user's Back button when `user`). */
  const settle = (user = false) => {
    if (!queued && !user) return;
    queued = false;
    if (stack.length > 1) stack.pop();
    const e = { state: history.state } as PopStateEvent;
    listeners.forEach((fn) => fn(e));
  };
  return { history, target, log, stack, fail, listeners, settle };
}

function setupOverlay() {
  const host = fakeHost();
  const w = fakeWindow();
  const backs: string[] = [];
  const env: NavOverlayEnv = {
    history: w.history as unknown as NavOverlayEnv['history'],
    target: w.target as unknown as NavOverlayEnv['target'],
    onBack: () => void backs.push('closed'),
  };
  const o = new NavOverlay(host as unknown as ReactiveControllerHost, env);
  host.connect();
  return { host, o, w, backs };
}

test.describe('NavOverlay (shell/overlay-history.ts)', () => {
  test('connect listens to popstate, disconnect stops; nothing here asks the host to render', () => {
    const { host, o, w } = setupOverlay();
    expect(w.listeners.size).toBe(1);
    o.push();
    o.pop();
    w.settle();
    expect(host.updates).toBe(0);
    host.disconnect();
    expect(w.listeners.size).toBe(0);
  });

  test('push adds ONE entry with the same state plus swOverlay; a second overlay taking over keeps it', () => {
    const { o, w } = setupOverlay();
    o.push();
    o.push();
    expect(w.log).toEqual(['push']);
    expect(w.stack).toEqual([{ route: 1 }, { route: 1, swOverlay: true }]);
  });

  test('a pushState that throws leaves no entry (pop then does nothing)', () => {
    const { o, w } = setupOverlay();
    w.fail.push = true;
    o.push();
    o.pop();
    expect(w.log).toEqual([]);
  });

  test('pop (✕, Esc, save) goes back once, only while its own entry is on top; the popstate it causes closes nothing', () => {
    const { o, w, backs } = setupOverlay();
    o.pop(); // nothing pushed
    expect(w.log).toEqual([]);
    o.push();
    o.pop();
    o.pop();
    expect(w.log).toEqual(['push', 'back']);
    w.settle();
    expect(backs).toEqual([]);
    // the entry is no longer on top (a navigation pushed past it): no back
    o.push();
    w.stack.push({ route: 2 });
    o.pop();
    expect(w.log).toEqual(['push', 'back', 'push']);
  });

  test('the Back button on the entry closes the overlays once; Back elsewhere does nothing', () => {
    const { o, w, backs } = setupOverlay();
    w.stack.push({ route: 0 }); // a screen behind the current one
    w.settle(true); // Back with no overlay open
    expect(backs).toEqual([]);
    o.push();
    w.settle(true); // the user's Back takes the overlay entry away
    expect(backs).toEqual(['closed']);
    o.push();
    w.stack.push({ route: 5 }); // an entry after the overlay's (pushed by someone else)
    w.settle(true); // Back lands on the overlay's own entry: the overlay still stands
    expect(backs).toEqual(['closed']);
    w.settle(true); // Back takes the overlay entry away
    expect(backs).toEqual(['closed', 'closed']);
  });

  test('leave: with its own entry on top the run waits for the popstate of back(), and Back closes nothing', () => {
    const { o, w, backs } = setupOverlay();
    const ran: string[] = [];
    o.push();
    o.leave(() => void ran.push('go'));
    expect(ran).toEqual([]);
    expect(w.log).toEqual(['push', 'back']);
    w.settle();
    expect(ran).toEqual(['go']);
    expect(backs).toEqual([]);
    expect(w.stack).toEqual([{ route: 1 }]);
  });

  test('leave without an entry (a wide screen: the menu is not a sheet) runs at once; after forget() too', () => {
    const { o, w } = setupOverlay();
    const ran: string[] = [];
    o.leave(() => void ran.push('a'));
    o.push();
    o.forget(); // a navigation moved past the entry: it stays in the history, no longer the overlay's
    o.leave(() => void ran.push('b'));
    o.pop();
    expect(ran).toEqual(['a', 'b']);
    expect(w.log).toEqual(['push']);
  });
});

function setupPerm() {
  const host = fakeHost();
  const log: string[] = [];
  const timers = new Map<number, () => void>();
  let seq = 0;
  let notify: (() => void) | null = null;
  const env: PermissionsEnv = {
    watch(fn) {
      notify = fn;
      log.push('watch');
      return () => void log.push('unwatch');
    },
    reload: async () => void log.push('reload'),
    afterReload: () => void log.push('reset-alarm'),
    text: () => 'ההרשאות שלך עודכנו',
    announce: () => void log.push('announce'),
    setTimer(fn, ms) {
      seq += 1;
      timers.set(seq, fn);
      log.push(`timer ${ms}`);
      return seq;
    },
    clearTimer(id) {
      timers.delete(id);
      log.push(`clear ${id}`);
    },
  };
  const p = new PermissionsNotice(host as unknown as ReactiveControllerHost, env);
  host.connect();
  const fire = async () => {
    notify?.();
    await new Promise((r) => setTimeout(r, 0));
  };
  return { host, p, log, timers, fire };
}

test.describe('PermissionsNotice (shell/permissions-notice.ts)', () => {
  test('follow: api and no_access open the access channel once; the other modes do not', () => {
    const { p, log } = setupPerm();
    p.follow('loading');
    p.follow('demo');
    p.follow('unauthenticated');
    expect(log).toEqual([]);
    p.follow('no_access');
    p.follow('api');
    expect(log).toEqual(['watch']);
  });

  test('a change: /me again, the alarm reset, a new epoch, the notice for 5 s, then the page is told - in that order', async () => {
    const { host, p, log, timers, fire } = setupPerm();
    p.follow('api');
    expect([p.epoch, p.text]).toEqual([0, '']);
    await fire();
    expect(log).toEqual(['watch', 'reload', 'reset-alarm', 'clear 0', 'timer 5000', 'announce']);
    expect(p.epoch).toBe(1);
    expect(p.text).toBe('ההרשאות שלך עודכנו');
    expect(host.updates).toBe(2); // the epoch and the text
    timers.get(1)?.();
    expect(p.text).toBe('');
    expect(host.updates).toBe(3);
  });

  test('a second change while the notice shows: the epoch moves, the timer restarts, the same text asks no render', async () => {
    const { host, p, log, timers, fire } = setupPerm();
    p.follow('api');
    await fire();
    const u = host.updates;
    await fire();
    expect(p.epoch).toBe(2);
    expect(host.updates).toBe(u + 1); // the epoch only
    expect(log.slice(-3)).toEqual(['clear 1', 'timer 5000', 'announce']);
    expect([...timers.keys()]).toEqual([2]);
  });

  test('disconnect ends the channel and the timer; a later session opens the channel again', async () => {
    const { host, p, log, fire } = setupPerm();
    p.follow('api');
    await fire();
    host.disconnect();
    expect(log.slice(-2)).toEqual(['unwatch', 'clear 1']);
    p.follow('api');
    expect(log.at(-1)).toBe('watch');
  });
});

test.describe('the shell wiring (shell/sw-app.ts)', () => {
  const app = src('shell/sw-app.ts');

  test('the overlay entry lives in NavOverlay; the shell says what Back closes and keeps the menu items\' order', () => {
    expect(app).toContain("import { NavOverlay } from './overlay-history';");
    expect(app).toMatch(/private overlay = new NavOverlay\(this, \{\s*history: window\.history,\s*target: window,/);
    expect(app).toMatch(/onBack: \(\) => \{\s*this\.orderOpen = false;\s*this\.notify\.dismiss\(\);\s*this\.closeMenu\(true, false\);/);
    expect(app).not.toMatch(/overlayEntry|pendingRun|onPopState|'popstate'|swOverlay|pushOverlay|popOverlay/);
    expect(app).toMatch(/private navigateFromOverlay\(href: string\) \{[\s\S]{0,300}?this\.dismissOverlays\(\);\s*this\.overlay\.leave\(\(\) => \(window\.location\.hash = href\)\);/);
    expect(app).toMatch(/private runFromOverlay\(run: \(\) => void\) \{\s*this\.dismissOverlays\(\);\s*this\.overlay\.leave\(run\);/);
    // CR-013: a navigation that is not the program's own move forgets the entry before the overlays close
    expect(app).toMatch(/if \(!replaced\) \{[\s\S]{0,400}this\.overlay\.forget\(\);\s*this\.closeMenu\(false, false\);/);
    expect(app.match(/this\.overlay\.push\(\);/g)?.length).toBe(3); // the phone sheet, the tab-order dialog, the center
    expect(app.match(/this\.overlay\.pop\(\);/g)?.length).toBe(3);
  });

  test('the permissions notice lives in PermissionsNotice; the shell passes the session calls and keys the screen on its epoch', () => {
    expect(app).toContain("import { PermissionsNotice } from './permissions-notice';");
    expect(app).toMatch(/private perm = new PermissionsNotice\(this, \{\s*watch: \(onChanged\) => watchPermissions\(onChanged\),\s*reload: \(\) => loadSession\(\),\s*afterReload: \(\) => resetAlarmPresence\(\),/);
    expect(app).toContain("text: () => tr('ההרשאות שלך עודכנו'),");
    expect(app).toContain("new CustomEvent('sw-permissions-changed')");
    expect(app).toContain('this.perm.follow(s.mode);');
    expect(app).toContain('keyed(this.perm.epoch, view)');
    expect(app).not.toMatch(/permEpoch|permToast|stopPermissions|onPermissionsChanged/);
  });

  test('the first-load note of a failing /me reads through tr(), and its words are in the English pack', () => {
    const body = app.slice(app.indexOf('private renderRetry()'), app.indexOf('private renderRetry()') + 600);
    expect(body).toContain("heading=${tr('אין חיבור לשרת')}");
    expect(body).toContain("${tr('מנסה להתחבר שוב…')}");
    expect(body).toContain("actionLabel=${tr('נסה עכשיו')}");
    const en = src('i18n/lang/en/i18n/msg/shell.ts');
    expect(en).toContain("'אין חיבור לשרת': 'No connection to the server',");
    expect(en).toContain("'מנסה להתחבר שוב…': 'Trying to reconnect…',");
    expect(en).toContain("'נסה עכשיו': 'Try now',");
  });

  test('the permissions notice is centred by logical insets (no physical translate that pushed it aside left-to-right)', () => {
    const css = app.slice(app.indexOf('.perm-toast {'), app.indexOf('@starting-style', app.indexOf('.perm-toast {')));
    expect(css).toContain('inset-inline: 0;');
    expect(css).toContain('margin-inline: auto;');
    expect(css).toContain('inline-size: fit-content;');
    expect(css).not.toMatch(/translateX|inset-inline-start: 50%/);
  });
});
