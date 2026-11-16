import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lazy, lazyAdapter } from '../src/api/demo-load';

// CR-MOCKS-LAZY-2436 (docs/changes/CR-MOCKS-LAZY-2436.md, review 07:F2 and 08:F02): the demo stores load on demand. With a backend
// they are never fetched; without one the demo answers after one extra chunk request. Runs in Node: a source scan of the row's
// modules, the entry chunk's source map when a build is there (`npm run build` -> dist/, or SW_DIST), the loader's contract, and a
// few demo answers through the lazy adapters (no backend in Node, so `isApi()` is false and the demo side answers).

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src');
const DIST = process.env.SW_DIST || path.join(HERE, '..', 'dist');

/** The row's modules (MASTER_PLAN 3.2, CR-MOCKS-LAZY-2436). */
const ROW = [
  'api/tickets.ts', 'api/tickets-conversation.ts', 'api/tickets-delete.ts', 'api/tickets-quotes.ts', 'api/tickets-rfq.ts', 'api/tickets-s4.ts',
  'api/media-players.ts', 'api/media-admin.ts', 'api/media-screens.ts', 'api/schedules.ts', 'api/device-activity.ts', 'api/mapping.ts',
  'api/electricity-meters.ts', 'tickets/rfq-board.ts', 'tickets/rfq-new.ts',
];
/** A demo store or its fixtures. */
const DEMO_MODULE = /(-mock|\/mapping-demo|\/electricity\/fixtures)$/;

/** The demo modules that leave the entry with this row. `schedules-mock` (also imported by schedule-editor.ts for DEMO_SUN) and
 * `tickets-costs-mock` (tickets-costs.ts, synchronous `pageUrl`) stay until the rows that hold those files convert them. */
const LEAVES_ENTRY = [
  'src/api/tickets-mock.ts', 'src/api/tickets-s4-mock.ts', 'src/api/tickets-rfq-mock.ts', 'src/api/media-players-mock.ts', 'src/api/media-screens-mock.ts',
  'src/api/device-activity-mock.ts', 'src/api/mapping-demo.ts', 'src/electricity/fixtures.ts',
];

/** Every `import ... from '<spec>'` of a source file whose specifier is a demo module and that brings in a value (not `import type`). */
function valueImportsOfDemo(file: string): string[] {
  const text = fs.readFileSync(path.join(SRC, file), 'utf8');
  const out: string[] = [];
  for (const m of text.matchAll(/^import\s+([\s\S]*?)\s+from\s+'([^']+)';/gm)) {
    const [, what, spec] = m;
    if (!DEMO_MODULE.test(spec)) continue;
    if (/^type\s/.test(what)) continue;
    const names = /^\{([\s\S]*)\}$/.exec(what.trim());
    if (names && names[1].split(',').map((n) => n.trim()).filter(Boolean).every((n) => n.startsWith('type '))) continue;
    out.push(`${file}: import ${what.replace(/\s+/g, ' ')} from '${spec}'`);
  }
  return out;
}

/** The entry chunk named by dist/index.html and the `src/...` modules of its source map. */
function entrySources(): { file: string; sources: string[] } | null {
  const html = path.join(DIST, 'index.html');
  if (!fs.existsSync(html)) return null;
  const m = /src="\.\/(assets\/index-[^"]+\.js)"/.exec(fs.readFileSync(html, 'utf8'));
  if (!m || !fs.existsSync(path.join(DIST, `${m[1]}.map`))) return null;
  const map = JSON.parse(fs.readFileSync(path.join(DIST, `${m[1]}.map`), 'utf8')) as { sources: string[] };
  const sources = map.sources.map((s) => s.replace(/\\/g, '/')).filter((s) => s.includes('/src/')).map((s) => `src/${s.split('/src/').pop()}`);
  return { file: m[1], sources };
}

test.describe('demo stores load on demand (07:F2, 08:F02)', () => {
  test("the row's modules import no demo store or fixture module statically (types only)", () => {
    const found = ROW.flatMap(valueImportsOfDemo);
    expect(found).toEqual([]);
  });

  test('the built entry chunk carries none of the demo modules this row makes lazy', () => {
    const e = entrySources();
    test.skip(!e, `no build with a source map at ${DIST} (run npm run build first)`);
    const { file, sources } = e as NonNullable<typeof e>;
    expect(sources.filter((s) => LEAVES_ENTRY.includes(s))).toEqual([]);
    const still = sources.filter((s) => /-mock\.ts$|\/mapping-demo\.ts$|\/electricity\/fixtures\.ts$/.test(s));
    test.info().annotations.push({ type: 'entry', description: `${file}: demo modules still in the entry: ${still.join(', ') || 'none'}` });
  });
});

test.describe('the loader (src/api/demo-load.ts)', () => {
  interface Store { n: number; add(by: number): Promise<number>; url(id: string): string; extra?(): Promise<string> }

  test('lazy: one load on the first call, shared; `loaded` once it arrived; a failed load is tried again', async () => {
    let calls = 0;
    const l = lazy(async () => ({ v: ++calls }));
    expect(calls).toBe(0);
    expect(l.loaded).toBeNull();
    const [a, b] = await Promise.all([l(), l()]);
    expect(a).toBe(b);
    expect(calls).toBe(1);
    expect(l.loaded).toBe(a);
    let fails = 1;
    const f = lazy(async () => {
      if (fails-- > 0) throw new Error('chunk');
      return 'ok';
    });
    await expect(f()).rejects.toThrow('chunk');
    await expect(f()).resolves.toBe('ok');
  });

  test('lazyAdapter: nothing loads until a method is called; arguments and `this` reach the store in force on every call', async () => {
    let loads = 0;
    let current: Store = { n: 1, async add(by) { this.n += by; return this.n; }, url: (id) => `store:${id}` };
    const a = lazyAdapter<Store>(async () => {
      loads += 1;
      return current;
    }, { n: 0, url: (id) => `sync:${id}`, extra: undefined });
    expect(loads).toBe(0);
    expect(await a.add(2)).toBe(3);
    current = { ...current, n: 10 };
    expect(await a.add(1)).toBe(11); // a reset store answers the next call
    expect(a.add).toBe(a.add); // a stable method identity
  });

  test('lazyAdapter: synchronous and optional members are the given ones; the adapter is not a thenable', async () => {
    let loads = 0;
    const a = lazyAdapter<Store>(async () => {
      loads += 1;
      return { n: 5, add: async () => 0, url: () => 'store' };
    }, { n: 0, url: (id) => `sync:${id}`, extra: undefined });
    expect(a.url('x')).toBe('sync:x');
    expect(a.extra).toBeUndefined();
    expect(Boolean(a.extra)).toBe(false);
    expect((a as unknown as { then?: unknown }).then).toBeUndefined();
    expect(await Promise.resolve(a)).toBe(a);
    // what generic code probes (serialising, printing) never loads the store
    expect(JSON.stringify(a)).toBe('{"n":0}');
    expect(String(a)).toBe('[object Object]');
    expect(loads).toBe(0);
  });
});

test.describe('demo answers through the lazy adapters (no backend)', () => {
  test('tickets: the slice parts registered before the store loads are on the first answer (delete right, outside-contact link)', async () => {
    const { ticketsApi } = await import('../src/api/tickets');
    await import('../src/api/tickets-delete');
    await import('../src/api/tickets-s4');
    const page = await ticketsApi().list({ scope: 'visible', status: 'all', limit: 50 });
    expect(page.items.length).toBeGreaterThan(0);
    const t = await ticketsApi().get(page.items[0].id);
    expect(t.can).toMatchObject({ delete: true });
    expect('link' in t).toBe(true);
    expect(ticketsApi().photoUrl({ url: 'blob:demo-1' } as Parameters<ReturnType<typeof ticketsApi>['photoUrl']>[0])).toBe('blob:demo-1');
  });

  test('tickets: a part registered after the store loaded applies before the next answer', async () => {
    const { ticketsApi, withTicketsMock } = await import('../src/api/tickets');
    const first = (await ticketsApi().list({ scope: 'visible', status: 'all', limit: 50 })).items[0];
    withTicketsMock((m) => m.extendMockView((t) => ({ ...t, title: `${t.title} *` })));
    expect((await ticketsApi().get(first.id)).title).toMatch(/ \*$/);
  });

  test('rfq: the optional members the demo store lacks stay absent; a file address before any upload is empty', async () => {
    const { ticketsRfqApi } = await import('../src/api/tickets-rfq');
    const api = ticketsRfqApi();
    expect(api.vendorFileUrl).toBeUndefined();
    expect(api.decideArrival).toBeUndefined();
    expect(api.attachmentUrl('r1', 'nope')).toBe('');
    expect((await api.meta()).departments.length).toBeGreaterThan(0);
  });
});
