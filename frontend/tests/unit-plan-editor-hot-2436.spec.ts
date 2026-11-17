import { test, expect, type Page, type Locator } from '@playwright/test';

// CR-PLAN-EDITOR-HOT-2436 (docs/changes/CR-PLAN-EDITOR-HOT-2436.md), the browser half, against the DEMO data (no backend; npm run build
// first, the preview serves dist/):
//   1. PERF-5: a render that changes none of their inputs hands the canvas the same marker, zone, issue, ruler and draft arrays (stable
//      prop identity), and a real change (the layers shown) still hands it a new, correct list;
//   2. MSG-1: a message lives its full time even when an older timer for the same text is still pending, and a detached editor's
//      timer does not fire;
//   3. RACE-7: an older entity search that answers (or fails) after a newer one does not overwrite the newer answer.
// The static half is tests/unit-plan-editor-hot-lint-2436.spec.ts.
//   SW_UNIT_PAGES=1 SW_BASE_URL=http://127.0.0.1:4173/ npx playwright test -c playwright.unit.config.ts --workers=1 tests/unit-plan-editor-hot-2436.spec.ts

type Probe = HTMLElement & {
  updateComplete: Promise<boolean>;
  requestUpdate(): void;
  info: string;
  error: string;
  layers: Set<string>;
  entQ: string;
  entResults: { entity_id: string }[];
  bundle: { source: string } | null;
  tool: string;
  flash(text: string, ms?: number): void;
  searchEntities(): Promise<void>;
};

const CANVAS_PROPS = ['markers', 'zones', 'issueIds', 'rulers', 'draftPoints', 'wallDraft', 'arcPreview', 'curveDraft', 'highlightIds', 'ghostHandles'] as const;

async function open(page: Page): Promise<Locator> {
  await page.goto('about:blank');
  await page.goto('/?design=a#/explore/floors/f0/edit');
  await page.waitForSelector('sw-app');
  const editor = page.locator('explore-plan-editor');
  await expect(editor.locator('.mapwrap')).toBeVisible({ timeout: 30_000 });
  await expect(editor.locator('sw-plan-canvas')).toBeVisible();
  return editor;
}

test.describe('plan editor hot path (demo data)', () => {
  test.skip(({ viewport }) => !!viewport && viewport.width < 768, 'the desktop editor');

  test('PERF-5: an unrelated render keeps every array prop of the canvas; a real change gives a new, correct list', async ({ page }) => {
    const editor = await open(page);
    const out = await editor.evaluate(async (n, props) => {
      const e = n as Probe;
      const c = e.shadowRoot!.querySelector('sw-plan-canvas') as unknown as Record<string, unknown>;
      const before = props.map((p) => c[p]);
      const markersBefore = (c.markers as unknown[]).length;
      e.requestUpdate(); // a render with no input changed (what a hover frame or a message does to these props)
      await e.updateComplete;
      e.info = 'x';
      await e.updateComplete;
      const same = props.filter((p, i) => c[p] !== before[i]);
      e.layers = new Set(); // every layer hidden: the markers list is rebuilt
      await e.updateComplete;
      const hidden = (c.markers as unknown[]).length;
      const changed = c.markers !== before[0];
      e.layers = new Set(['cameras', 'sensors', 'doors', 'lights']);
      await e.updateComplete;
      return { notSame: same, markersBefore, hidden, changed, after: (c.markers as unknown[]).length };
    }, CANVAS_PROPS as unknown as string[]);
    expect(out.notSame).toEqual([]);
    expect(out.markersBefore).toBeGreaterThan(0); // the demo floor has placed items: the check is not vacuous
    expect(out.changed).toBe(true);
    expect(out.hidden).toBe(0);
    expect(out.after).toBe(out.markersBefore);
  });

  test('MSG-1: the same message flashed again lives its full time; a newer message is not cut short', async ({ page }) => {
    const editor = await open(page);
    await editor.evaluate((n) => (n as Probe).flash('first', 1000));
    await page.waitForTimeout(600);
    await editor.evaluate((n) => (n as Probe).flash('first', 1000)); // the older timer (due at 1000 ms) must not wipe it
    await page.waitForTimeout(700); // 1300 ms after the first
    expect(await editor.evaluate((n) => (n as Probe).info)).toBe('first');
    await page.waitForTimeout(600); // 1900 ms: the second's own time is over
    expect(await editor.evaluate((n) => (n as Probe).info)).toBe('');

    await editor.evaluate((n) => (n as Probe).flash('older', 800));
    await page.waitForTimeout(300);
    await editor.evaluate((n) => (n as Probe).flash('newer', 1500));
    await page.waitForTimeout(800); // the older one's time has passed
    expect(await editor.evaluate((n) => (n as Probe).info)).toBe('newer');
  });

  test('MSG-1: a detached editor keeps no running message timer', async ({ page }) => {
    const editor = await open(page);
    const info = await editor.evaluate(async (n) => {
      const e = n as Probe;
      e.flash('bye', 300);
      e.remove();
      await new Promise((r) => setTimeout(r, 700));
      return e.info;
    });
    expect(info).toBe('bye'); // the timer was cleared on disconnect, so it never fired on the detached element
  });

  test('RACE-7: an older entity search answering or failing after a newer one does not overwrite it', async ({ page }) => {
    const editor = await open(page);
    let failOld = false;
    await page.route('**/api/v1/ha/entities**', async (route) => {
      const q = new URL(route.request().url()).searchParams.get('q');
      const ent = (id: string) => ({ entity_id: id, name: id, domain: id.split('.')[0], state: 'on', area_id: null, area: null, placed: false, disabled: false, attributes: {} });
      if (q === 'old') {
        await new Promise((r) => setTimeout(r, 800));
        if (failOld) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'internal', user_message: 'stale failure', retryable: false, correlation_id: '', details: {} }) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entities: [ent('sensor.old')], total: 1 }) });
      }
      await new Promise((r) => setTimeout(r, 50));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entities: [ent('sensor.new')], total: 1 }) });
    });
    const run = () =>
      editor.evaluate(async (n) => {
        const e = n as Probe;
        e.bundle = e.bundle ? { ...e.bundle, source: 'api' } : e.bundle; // the search is skipped on demo data
        e.error = '';
        e.entQ = 'old';
        const older = e.searchEntities();
        e.entQ = 'new';
        const newer = e.searchEntities();
        await Promise.all([older, newer]);
        return { ids: e.entResults.map((x) => x.entity_id), error: e.error, busy: (e as unknown as { entBusy: boolean }).entBusy };
      });
    expect(await run()).toEqual({ ids: ['sensor.new'], error: '', busy: false });
    failOld = true;
    expect(await run()).toEqual({ ids: ['sensor.new'], error: '', busy: false });
  });
});
