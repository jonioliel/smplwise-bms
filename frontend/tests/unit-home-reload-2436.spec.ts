import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { LiveEnv } from '../src/api/live-refresh';
import { PollController } from '../src/components/poll-controller';

// CR-HOME-RELOAD-2436 (review 06:HOME-1, 06:DB-1, the home part of D2): the home screen's media poll, the area quick sheet's reloads and
// the plan view's catalogue loader. The Lit elements themselves are not loaded in node (their imports reach the DOM); each fix is checked
// in its source, and the parts that carry the behaviour - the poll registration and the reload throttle - are driven with a fake clock.
const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const HW = src('screens/home-widgets.ts');
const QS = src('screens/area-quick-sheet.ts');
const DB = src('screens/devices-building.ts');

/** The body of a class member `name(`...`) {` up to its closing brace at the same indent (two spaces). */
function member(text: string, head: RegExp): string {
  const m = head.exec(text);
  if (!m) throw new Error(`member not found: ${head}`);
  const start = m.index;
  const end = text.indexOf('\n  }\n', start);
  return text.slice(start, end + 4);
}

function fakeEnv() {
  let now = 1_000_000;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const state = { visible: true, online: true };
  let onResume: () => void = () => undefined;
  const env: Partial<LiveEnv> = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = ++seq;
      timers.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
    visible: () => state.visible,
    online: () => state.online,
    onResume: (a) => {
      onResume = a;
      return () => (onResume = () => undefined);
    },
  };
  const flush = async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };
  const advance = async (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      now = due[1].at;
      timers.delete(due[0]);
      due[1].fn();
      await flush();
    }
    now = end;
    await flush();
  };
  return { env, state, advance, flush, resume: () => onResume() };
}

function fakeHost() {
  const controllers: { hostConnected?: () => void; hostDisconnected?: () => void }[] = [];
  return {
    addController: (c: { hostConnected?: () => void; hostDisconnected?: () => void }) => void controllers.push(c),
    removeController: () => undefined,
    requestUpdate: () => undefined,
    updateComplete: Promise.resolve(true),
    connect: () => controllers.forEach((c) => c.hostConnected?.()),
    disconnect: () => controllers.forEach((c) => c.hostDisconnected?.()),
  };
}

test.describe('HOME-1 (a): the home media poll', () => {
  test('home-widgets polls through PollController, not a bare interval', () => {
    expect(HW).toContain("from '../components/poll-controller'");
    expect(HW).toMatch(/new PollController\(this\)/);
    expect(HW).not.toMatch(/setInterval\(/);
    expect(HW).not.toMatch(/mediaTimer/);
  });

  test('the poll is registered only while a media widget is placed, and dropped when it goes', () => {
    const sync = member(HW, /\n  private syncMediaPoll\(/);
    expect(sync).toMatch(/this\.items\.some\(\(i\) => i\.id === 'media'\)/);
    expect(sync).toMatch(/this\.poll\.every\('media', MEDIA_POLL_MS/);
    expect(sync).toMatch(/this\.poll\.cancel\('media'\)/);
    expect(HW).toMatch(/const MEDIA_POLL_MS = 10_000;/);
    // started where the items arrive (willUpdate), not on connect regardless of the items
    const will = member(HW, /\n  protected willUpdate\(/);
    expect(will).toMatch(/changed\.has\('items'\)/);
    expect(will).toMatch(/this\.syncMediaPoll\(\)/);
    const conn = member(HW, /\n  connectedCallback\(\) \{/);
    expect(conn).not.toMatch(/loadScreens/);
  });

  test('a read in flight is never doubled: a second ask while one runs is folded into one more read', () => {
    const load = member(HW, /\n  private async loadScreens\(/);
    expect(load).toMatch(/if \(this\.mediaBusy\)/);
    expect(load).toMatch(/this\.mediaAgain = true/);
    expect(load).toMatch(/finally/);
  });

  test('request counts: no media widget = no media request; a placed widget = one read per 10 s while visible, none while hidden', async () => {
    // the same registration the element makes (syncMediaPoll), driven by a fake clock; `reads` stands for status + list + players.list
    const f = fakeEnv();
    const host = fakeHost();
    const poll = new PollController(host, { env: f.env });
    let reads = 0;
    let items: { id: string }[] = [{ id: 'clock' }];
    const sync = () => {
      if (items.some((i) => i.id === 'media')) {
        if (!poll.has('media')) {
          reads++; // the element's first read when the widget appears
          poll.every('media', 10_000, async () => void reads++);
        }
      } else poll.cancel('media');
    };
    host.connect();
    sync();
    await f.advance(60_000);
    expect(reads).toBe(0); // no media widget: no media request at all (was 6 cycles of 3 requests per minute)

    items = [{ id: 'clock' }, { id: 'media' }];
    sync();
    expect(reads).toBe(1);
    await f.advance(30_000);
    expect(reads).toBe(4);
    sync(); // a re-render with the same widgets does not restart nor add a read
    await f.advance(10_000);
    expect(reads).toBe(5);

    f.state.visible = false;
    await f.advance(60_000);
    expect(reads).toBe(5);
    f.state.visible = true;
    f.resume();
    await f.flush();
    expect(reads).toBe(6); // one catch-up read on resume

    items = [{ id: 'clock' }];
    sync();
    await f.advance(60_000);
    expect(reads).toBe(6); // the widget removed: the poll stops
    host.disconnect();
  });
});

test.describe('HOME-1 (b): the area quick sheet reloads', () => {
  test('a fresh area object with the same area_id does not reload the sheet; another area does', () => {
    const upd = member(QS, /\n  protected updated\(/);
    expect(upd).toMatch(/areaSwitched/);
    expect(upd).toMatch(/\(changed\.get\('area'\) as DeviceArea \| null \| undefined\)\?\.area_id !== this\.area\?\.area_id/);
    expect(upd).toMatch(/changed\.has\('open'\) \|\| \(areaSwitched && this\.open\)/);
    expect(upd).not.toMatch(/changed\.has\('area'\) && this\.open\)/);
  });

  test('pushes are filtered to the area\'s own entities (a structure change still reloads)', () => {
    const live = member(QS, /\n  private startLive\(/);
    expect(live).toMatch(/m\.type === 'entity_state_changed'/);
    expect(live).toMatch(/!this\.detail \|\| this\.entityIds\.has\(m\.entity\.entity_id\)/);
    expect(live).toMatch(/m\.type === 'structure_changed'\) this\.scheduleReload\(\)/);
    const ids = member(QS, /\n  private get entityIds\(/);
    expect(ids).toMatch(/Object\.values\(this\.detail\.cards\)/);
  });

  test('scheduleReload is a throttle (the first push opens a window), not a resetting debounce', () => {
    const sch = member(QS, /\n  private scheduleReload\(/);
    expect(sch).toMatch(/if \(this\.reloadTimer\) return;/);
    expect(sch).not.toMatch(/clearTimeout/);
    expect(QS).toMatch(/export const SHEET_RELOAD_WINDOW_MS = 400;/);
    const quiet = member(QS, /\n  private async reloadQuiet\(/);
    expect(quiet).toMatch(/this\.reloadAgain = true/);
    const stop = member(QS, /\n  private stopLive\(/);
    expect(stop).toMatch(/this\.reloadTimer = 0;/);
    expect(stop).toMatch(/this\.reloadAgain = false;/);
  });

  test('N pushes -> bounded reloads: 50 pushes over 2 s make at most 2 s / 400 ms + 1 reloads (a debounce would make none until they stop)', async () => {
    // the sheet's throttle (scheduleReload + reloadQuiet) replayed on a fake clock, with a reload that takes 150 ms
    const f = fakeEnv();
    const set = f.env.setTimeout!;
    let timer = 0;
    let busy = false;
    let again = false;
    let reloads = 0;
    const schedule = () => {
      if (timer) return;
      timer = set(() => {
        timer = 0;
        void quiet();
      }, 400) as number;
    };
    const quiet = async () => {
      if (busy) {
        again = true;
        return;
      }
      busy = true;
      reloads++;
      await new Promise<void>((r) => set(r, 150));
      busy = false;
      if (again) {
        again = false;
        schedule();
      }
    };
    for (let i = 0; i < 50; i++) {
      schedule();
      await f.advance(40);
    }
    expect(reloads).toBeGreaterThanOrEqual(4); // never starves while pushes keep coming
    expect(reloads).toBeLessThanOrEqual(6);
    await f.advance(2_000);
    expect(reloads).toBeLessThanOrEqual(7); // the last push is still read once
  });
});

test.describe('HOME-1 (c): a closed sheet lets go of its body', () => {
  test('hideTimer is set on close and clears the area body after CLOSE_MS', () => {
    const close = member(QS, /\n  private onClose\(/);
    expect(close).toMatch(/this\.hideTimer = window\.setTimeout\(/);
    expect(close).toMatch(/CLOSE_MS\)/);
    const drop = member(QS, /\n  private dropBody\(/);
    for (const f of ['detail = null', 'scenes = []', 'schedules = []', 'events = []', '++this.loadSeq']) expect(drop).toContain(f);
    expect(drop).toMatch(/if \(this\.open\) return;/);
    // a reopen before the timer fires keeps the body (onOpen clears the timer, as before)
    expect(member(QS, /\n  private onOpen\(/)).toMatch(/window\.clearTimeout\(this\.hideTimer\)/);
  });
});

test.describe('DB-1: the plan view catalogue loader', () => {
  test('the catalogue read is not started inside render and has no swallowed failure', () => {
    const plan = member(DB, /\n  private renderPlan\(/);
    expect(plan).not.toMatch(/loadCatalogTree/);
    expect(plan).not.toMatch(/\.catch\(\(\) => \{\}\)/);
    expect(DB).not.toMatch(/planFloorsLoaded/);
  });

  test('one loader with an error state and a retry, started from willUpdate when the plan view shows', () => {
    const load = member(DB, /\n  private async loadPlanFloors\(/);
    expect(load).toMatch(/this\.planState = 'loading'/);
    expect(load).toMatch(/this\.planState = 'ready'/);
    expect(load).toMatch(/this\.planState = 'error'/);
    expect(load).toMatch(/loadCatalogTree\(\)/);
    const will = member(DB, /\n  protected willUpdate\(/);
    expect(will).toMatch(/this\.layout === 'plan' && this\.planState === 'idle'/);
    expect(will).toMatch(/void this\.loadPlanFloors\(\)/);
    const plan = member(DB, /\n  private renderPlan\(/);
    expect(plan).toMatch(/this\.planState === 'error'/);
    expect(plan).toMatch(/data-plan-state="error"[^`]*state="error"[^`]*actionLabel="נסה שוב"[^`]*@action=\$\{\(\) => void this\.loadPlanFloors\(\)\}/);
    // the ready answers stay as they were: a floor with a plan -> the map; floors but none with a plan -> the empty panel
    expect(plan).toMatch(/this\.planState === 'ready' && this\.planFloors\.length/);
  });
});
