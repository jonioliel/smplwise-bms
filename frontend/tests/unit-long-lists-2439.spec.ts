import { test, expect } from '@playwright/test';
import { LongListsController, ensureLongLists, isLongLists, longListsFromUrl, longListsMode, onLongLists, pagesFor, perPageFor, resetLongListsForTest, setLongListsMode } from '../src/api/long-lists';
import { LONG_LISTS_DEFAULT, clampPage, pageCount, pageSlice, screenDisplayOf } from '../src/api/screen-display';
import { en } from '../src/i18n/en';
import { he } from '../src/i18n/he';

// PAGING-SETTING-2439 (owner round 32, Q-SYS-4 a + Q-SYS-5 a): the long lists of the control screens page by default; the system
// administrator can switch them back to scrolling (`ui.long_lists`, הגדרות › כללי › עיצוב הממשק). One module (api/long-lists.ts) carries
// the mode to every paged list.
//   npx playwright test -c playwright.unit.config.ts tests/unit-long-lists-2439.spec.ts --workers=1

test.beforeEach(() => resetLongListsForTest());

test('the default is pages, and the server value is read tolerantly', () => {
  expect(LONG_LISTS_DEFAULT).toBe('paged');
  expect(longListsMode()).toBe('paged');
  expect(screenDisplayOf(null).longLists).toBe('paged');
  expect(screenDisplayOf({ 'ui.long_lists': 'scroll' }).longLists).toBe('scroll');
  expect(screenDisplayOf({ 'ui.long_lists': 'endless' }).longLists).toBe('paged');
  expect(isLongLists('scroll')).toBe(true);
  expect(isLongLists('Scroll')).toBe(false);
  expect(isLongLists(undefined)).toBe(false);
});

test('perPageFor: the screen\'s own page size while paged, every item on one page while the lists scroll', () => {
  expect(perPageFor(true, 10, 57)).toBe(10);
  expect(perPageFor(true, 0, 57)).toBe(1); // never a page of nothing
  expect(perPageFor(false, 10, 57)).toBe(57);
  expect(perPageFor(false, 10, 3)).toBe(10); // a short list: one page either way
  expect(perPageFor(false, 10, 0)).toBe(10);
  // the existing page helpers need no second path: one page that holds everything
  const items = Array.from({ length: 57 }, (_, i) => i);
  const per = perPageFor(false, 10, items.length);
  expect(pageCount(items.length, per)).toBe(1);
  expect(clampPage(4, items.length, per)).toBe(1);
  expect(pageSlice(items, 4, per)).toEqual(items);
  expect(pageCount(items.length, perPageFor(true, 10, items.length))).toBe(6);
  expect(pagesFor(true, 6)).toBe(6);
  expect(pagesFor(false, 6)).toBe(1);
  expect(pagesFor(true, 0)).toBe(1);
});

test('a change reaches every subscriber once, an unknown value falls back to pages, unsubscribe stops it', () => {
  const seen: string[] = [];
  const off = onLongLists((m) => seen.push(m));
  setLongListsMode('scroll');
  setLongListsMode('scroll'); // no change, no call
  expect(longListsMode()).toBe('scroll');
  setLongListsMode('bogus');
  expect(longListsMode()).toBe('paged');
  off();
  setLongListsMode('scroll');
  expect(seen).toEqual(['scroll', 'paged']);
});

test('the address pins the mode for one page load; anything else is ignored', () => {
  expect(longListsFromUrl('?long_lists=scroll')).toBe('scroll');
  expect(longListsFromUrl('?design=a&long_lists=paged')).toBe('paged');
  expect(longListsFromUrl('?long_lists=all')).toBeNull();
  expect(longListsFromUrl('')).toBeNull();
});

test('ensureLongLists outside a browser keeps the default and never throws', async () => {
  await expect(ensureLongLists()).resolves.toBe('paged');
});

test('the controller reflects the mode on its host, re-renders and calls the screen back on a change', () => {
  const attrs = new Map<string, string>();
  let updates = 0;
  const changes: string[] = [];
  const controllers: { hostConnected?: () => void; hostDisconnected?: () => void }[] = [];
  const host = {
    addController: (c: (typeof controllers)[number]) => controllers.push(c),
    removeController: () => undefined,
    requestUpdate: () => void updates++,
    updateComplete: Promise.resolve(true),
    getAttribute: (k: string) => attrs.get(k) ?? null,
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
  };
  const ctl = new LongListsController(host as unknown as ConstructorParameters<typeof LongListsController>[0], (m) => changes.push(m));
  expect(controllers).toHaveLength(1);
  controllers[0].hostConnected?.();
  expect(attrs.get('data-long-lists')).toBe('paged');
  expect(ctl.paged).toBe(true);
  setLongListsMode('scroll');
  expect(attrs.get('data-long-lists')).toBe('scroll');
  expect(ctl.paged).toBe(false);
  expect(ctl.mode).toBe('scroll');
  expect(changes).toEqual(['scroll']);
  expect(updates).toBe(1);
  controllers[0].hostDisconnected?.();
  setLongListsMode('paged');
  expect(changes).toEqual(['scroll']); // disconnected: no more calls
  expect(attrs.get('data-long-lists')).toBe('scroll');
});

test('the settings row has a Hebrew and an English label for every choice', () => {
  for (const cat of [he, en] as const) {
    const s = (cat as unknown as { longLists: Record<string, string> }).longLists;
    expect(s.label.length).toBeGreaterThan(5);
    expect(s.hint.length).toBeGreaterThan(20);
    expect(s.paged.length).toBeGreaterThan(1);
    expect(s.scroll.length).toBeGreaterThan(1);
  }
  expect(he.longLists.paged).toBe('עמודים');
  expect((en as unknown as { longLists: { paged: string } }).longLists.paged).toBe('Pages');
});
