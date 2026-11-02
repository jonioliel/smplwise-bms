import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, get, inflightGetCount, post } from '../src/api/client';
import { loadScreen, waitingScreenTags } from '../src/shell/lazy-screens';

// PERF-HOME-DEVICES-2342 (docs/changes/PERF-HOME-DEVICES-2342.md): the in-flight GET sharing of the API client and the static guard of the
// shell's lazy screen chunks. No browser page.

const HERE = path.dirname(fileURLToPath(import.meta.url));

type Call = { url: string; method: string };

async function withFetch<T>(reply: (url: string, n: number) => { status: number; body?: unknown }, run: (calls: Call[]) => Promise<T>): Promise<T> {
  const orig = globalThis.fetch;
  // a stub document left on globalThis would make lit-html (first imported later in this worker by another spec) bind to it
  const origDoc = (globalThis as { document?: unknown }).document;
  (globalThis as { document?: unknown }).document = { baseURI: 'http://h/app/' };
  const calls: Call[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET' });
    const r = reply(String(url), calls.length);
    await new Promise((res) => setTimeout(res, 5)); // the answer arrives later: the second caller asks while the first is in flight
    return new Response(r.status === 204 ? null : JSON.stringify(r.body ?? {}), { status: r.status, statusText: r.status === 200 ? 'OK' : 'ERR' });
  }) as typeof fetch;
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = orig;
    if (origDoc === undefined) delete (globalThis as { document?: unknown }).document;
    else (globalThis as { document?: unknown }).document = origDoc;
  }
}

test.describe('in-flight GET sharing', () => {
  test('concurrent GETs of one address send one request; each caller gets its own parsed copy', async () => {
    await withFetch(() => ({ status: 200, body: { settings: { a: 1 }, list: [1, 2] } }), async (calls) => {
      const [x, y, z] = await Promise.all([get<{ settings: { a: number }; list: number[] }>('settings'), get<{ settings: { a: number } }>('settings'), get<{ settings: { a: number } }>('/settings')]);
      expect(calls.map((c) => c.url)).toEqual(['http://h/app/api/v1/settings']);
      expect(x).toEqual(y);
      expect(x).not.toBe(y); // no shared object: a caller that mutates its answer does not change another's
      x.settings.a = 99;
      x.list.push(3);
      expect(y.settings.a).toBe(1);
      expect(z.settings.a).toBe(1);
      expect(inflightGetCount()).toBe(0);
    });
  });

  test('nothing is cached past the answer: a later GET asks again', async () => {
    await withFetch((_u, n) => ({ status: 200, body: { n } }), async (calls) => {
      expect(await get<{ n: number }>('devices/tree')).toEqual({ n: 1 });
      expect(await get<{ n: number }>('devices/tree')).toEqual({ n: 2 });
      expect(calls.length).toBe(2);
    });
  });

  test('different addresses, writes and GETs with options are never shared', async () => {
    await withFetch(() => ({ status: 200, body: {} }), async (calls) => {
      await Promise.all([get('devices/tree'), get('devices/items?kind=lights'), post('devices/refresh'), post('devices/refresh'), api('settings', { headers: { 'If-None-Match': 'x' } }), api('settings', { headers: { 'If-None-Match': 'x' } })]);
      expect(calls.length).toBe(6);
      expect(calls.filter((c) => c.method === 'POST').length).toBe(2);
    });
  });

  test('a shared failure reaches every caller as the same ApiError; a 204 is undefined for each', async () => {
    await withFetch((u) => (u.endsWith('/gone') ? { status: 404, body: { code: 'not_found', user_message: 'x', retryable: false, correlation_id: '', details: {} } } : { status: 204 }), async (calls) => {
      const r = await Promise.allSettled([get('gone'), get('gone')]);
      expect(r.map((x) => x.status)).toEqual(['rejected', 'rejected']);
      expect(r.map((x) => (x as PromiseRejectedResult).reason.code)).toEqual(['not_found', 'not_found']);
      expect(await Promise.all([get('empty'), get('empty')])).toEqual([undefined, undefined]);
      expect(calls.length).toBe(2);
    });
  });
});

test.describe('lazy screen chunks', () => {
  // GATE2342-B: the shell waits for a route screen's chunk before it renders the tag (an element upgraded in place gets its properties
  // back only after connectedCallback: the plan editor loaded floor f0 instead of the one in the address). Lit results are modelled
  // as plain objects (strings / values), which is all waitingScreenTags reads; no browser, so no tag is defined here.
  test('waitingScreenTags finds the lazy screen tags of a route template, also inside keyed() and nested templates', () => {
    const tpl = (strings: string[], ...values: unknown[]) => ({ _$litType$: 1, strings, values });
    const editor = tpl(['<explore-plan-editor .floorId=', ' .presetEntity=', '></explore-plan-editor>'], 'f-2', '');
    expect(waitingScreenTags(editor)).toEqual(['explore-plan-editor']);
    expect(waitingScreenTags({ _$litDirective$: class {}, values: ['f-2', editor] })).toEqual(['explore-plan-editor']); // keyed(key, tpl)
    expect(waitingScreenTags(tpl(['<div class="x">', '</div>'], tpl(['<tickets-list .route=', '></tickets-list>'], { segments: [] })))).toEqual(['tickets-list']);
    expect(waitingScreenTags([tpl(['<explore-floors></explore-floors>']), tpl(['<explore-floors></explore-floors>'])])).toEqual(['explore-floors']);
    // not lazy (in the entry chunk), not a template, nothing
    expect(waitingScreenTags(tpl(['<sw-state-panel state="loading"></sw-state-panel>']))).toEqual([]);
    expect(waitingScreenTags(tpl(['<devices-building></devices-building>']))).toEqual([]);
    expect(waitingScreenTags(Symbol('nothing'))).toEqual([]);
    expect(waitingScreenTags(null)).toEqual([]);
    expect(waitingScreenTags('explore-plan-editor')).toEqual([]);
  });

  test('the shell renders a route through waitingScreenTags before the keyed() screen', () => {
    const app = fs.readFileSync(path.join(HERE, '..', 'src', 'shell', 'sw-app.ts'), 'utf8');
    const body = app.slice(app.indexOf('private renderScreen()'), app.indexOf('private renderRoute()'));
    expect(body).toContain('waitingScreenTags(view)');
    expect(body).toContain('loadScreen(tag, () => this.requestUpdate())');
    expect(body.indexOf('waitingScreenTags(view)')).toBeLessThan(body.indexOf('keyed(this.permEpoch, view)'));
    expect(loadScreen('not-a-screen')).toBe(false);
  });

  test('every tag rendered by the shell or a screen is defined where it is rendered (scripts/lazy-tags-check.mjs)', () => {
    const out = execFileSync(process.execPath, [path.join(HERE, '..', 'scripts', 'lazy-tags-check.mjs')], { encoding: 'utf8' });
    expect(out).toContain('lazy-tags-check: OK');
  });

  test('the shell imports none of the lazy screens eagerly, and the home screen stays in the entry chunk', () => {
    const app = fs.readFileSync(path.join(HERE, '..', 'src', 'shell', 'sw-app.ts'), 'utf8');
    const lazy = fs.readFileSync(path.join(HERE, '..', 'src', 'shell', 'lazy-screens.ts'), 'utf8');
    const mods = [...lazy.matchAll(/import\('\.\.\/([^']+)'\)/g)].map((m) => m[1]);
    expect(mods.length).toBeGreaterThan(80);
    for (const m of mods) expect(app, m).not.toContain(`import '../${m}';`);
    expect(app).toContain("import { DEMO_DEVICES_TREE } from '../screens/devices-building';");
    expect(lazy).not.toContain("'devices-building'");
  });
});
