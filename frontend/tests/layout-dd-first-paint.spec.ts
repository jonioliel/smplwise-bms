import { test, expect, type Page } from '@playwright/test';
import { installBubbleMock } from './bubble-mocks';
import { installTicketsMock } from './tickets-mocks';

// FIX2231C-295: the header dropdown (ui.dd_place 2/3/4, wide screen) must not jump when a page is entered. Frame by frame (requestAnimationFrame) from the
// moment the route changes, the chips' box is recorded; every frame in which a chip is painted must show it at its settled place, and the chip is
// never painted over the page title. Needs the Vite DEV server, see layout-dd-place.spec.ts for the command (port 5196).
//   SW_FP_DUMP=1 prints the sampled frames.

type Place = '1' | '2' | '3' | '4';
const PLACES: readonly Place[] = ['1', '2', '3', '4'];

async function overrideSettings(page: Page, place: Place) {
  await page.addInitScript((p) => {
    const orig = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await orig(input, init);
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (method !== 'GET' || !res.ok) return res;
      if (new URL(url, location.href).pathname.endsWith('/api/v1/settings')) {
        const body = (await res.clone().json()) as { settings?: Record<string, unknown> };
        const settings = { ...(body.settings ?? {}), 'ui.tabs_mode': 'dropdown', 'ui.dd_place': p };
        return new Response(JSON.stringify({ ...body, settings }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return res;
    };
    try {
      localStorage.removeItem('sw.dd.place');
      localStorage.removeItem('sw.tabs.mode');
    } catch {
      /* storage unavailable */
    }
  }, place);
}

interface Frame {
  t: number;
  chip: { l: number; r: number; t: number; b: number } | null;
  all: string;
  title: { l: number; r: number; t: number; b: number } | null;
  place: string | null;
  fb: string | null;
}

/** start sampling every animation frame; returns a stop function's key on window */
async function startSampling(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __fp: Frame[]; __fpStop: boolean };
    w.__fp = [];
    w.__fpStop = false;
    const t0 = performance.now();
    const box = (r: DOMRect) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom });
    const findH1 = (root: ParentNode, d: number): HTMLElement | null => {
      for (const el of root.querySelectorAll<HTMLElement>('*')) {
        if (el.localName === 'h1') {
          const r = el.getBoundingClientRect();
          if (r.width > 0) return el;
        }
      }
      for (const el of root.querySelectorAll<HTMLElement>('*')) {
        if (el.shadowRoot && d < 12) {
          const h = findH1(el.shadowRoot, d + 1);
          if (h) return h;
        }
      }
      return null;
    };
    const tick = () => {
      const app = document.querySelector('sw-app')!;
      const root = app.shadowRoot!;
      const chipEl = [...root.querySelectorAll<HTMLElement>('.subnav[data-tabstyle="dropdown"] > sw-tabs, .tabpair:not(.single) > sw-tabs, .tabpair:not(.single) > sw-dropdown')].find((e) => e.getBoundingClientRect().width > 0);
      const screen = root.querySelector('.screen') ?? root;
      const h1 = findH1(screen, 0);
      let title = null;
      if (h1) {
        const range = document.createRange();
        range.selectNodeContents(h1);
        const tr = range.getBoundingClientRect();
        if (tr.width > 0) title = box(tr);
      }
      let chip = null;
      if (chipEl) {
        const cs = getComputedStyle(chipEl);
        if (cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05) chip = box(chipEl.getBoundingClientRect());
      }
      const all = [...root.querySelectorAll<HTMLElement>('.subnav[data-tabstyle="dropdown"] > sw-tabs, .tabpair:not(.single) > sw-tabs, .tabpair:not(.single) > sw-dropdown')].map((e) => { const r = e.getBoundingClientRect(); return r.width > 0 ? `${Math.round(r.left)}..${Math.round(r.right)}y${Math.round(r.top)}` : 'x'; }).join(' ');
      w.__fp.push({ all, t: Math.round(performance.now() - t0), chip, title, place: app.getAttribute('data-dd-place'), fb: app.getAttribute('data-dd-fallback') });
      if (!w.__fpStop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const stopSampling = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __fp: Frame[]; __fpStop: boolean };
    w.__fpStop = true;
    return w.__fp;
  });

const TARGETS = [
  { id: 'devices', hash: '/devices/areas/living', from: '/home', install: (page: Page) => installBubbleMock(page) },
  { id: 'tickets', hash: '/tickets/mine', from: '/home', install: (page: Page) => installTicketsMock(page, { persona: 'admin' }) },
] as const;

for (const tgt of TARGETS) {
  for (const place of PLACES) {
    test(`first paint of ${tgt.id} keeps the dropdown still, placement ${place}, 1440x900`, async ({ page }) => {
      await tgt.install(page);
      await overrideSettings(page, place);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/?design=a#${tgt.from}`);
      await page.waitForSelector('sw-app[data-shell-ready]');
      await page.waitForTimeout(1500);
      await startSampling(page);
      await page.evaluate((h) => {
        location.hash = h;
      }, tgt.hash);
      // title drawn and settled (past the 1.2 s re-fit interval)
      await expect
        .poll(async () => (await page.evaluate(() => (window as unknown as { __fp: Frame[] }).__fp.at(-1)?.title)) ?? null, { timeout: 10_000 })
        .not.toBeNull();
      await page.waitForTimeout(2500);
      const frames = await stopSampling(page);
      const settled = frames.at(-1)!;
      if (process.env.SW_FP_DUMP) {
        let prev = '';
        for (const f of frames) {
          const s = JSON.stringify({ ...f, t: 0 });
          if (s !== prev) console.log(`${tgt.id}/${place} t=${f.t} place=${f.place}/${f.fb} all=[${f.all}] chip=${f.chip ? `${Math.round(f.chip.l)}..${Math.round(f.chip.r)} y${Math.round(f.chip.t)}` : '-'} title=${f.title ? `${Math.round(f.title.l)}..${Math.round(f.title.r)} y${Math.round(f.title.t)}` : '-'}`);
          prev = s;
        }
      }
      expect(settled.chip, 'chip drawn when settled').not.toBeNull();
      const moved = frames.filter((f) => f.chip && (Math.abs(f.chip.l - settled.chip!.l) > 1 || Math.abs(f.chip.t - settled.chip!.t) > 1));
      expect(moved.map((f) => `t=${f.t} chip x${Math.round(f.chip!.l)} y${Math.round(f.chip!.t)}`), 'no painted frame shows the chip away from its settled box').toEqual([]);
      // the chip is never painted over the title (measured in the same frame)
      const covered = frames.filter((f) => f.chip && f.title && f.chip.l < f.title.r - 0.5 && f.chip.r > f.title.l + 0.5 && f.chip.t < f.title.b - 0.5 && f.chip.b > f.title.t + 0.5);
      expect(covered.map((f) => `t=${f.t}`), 'no frame paints the chip over the title').toEqual([]);
    });
  }
}

// The security pages (the pair: area chip + the screen's own page chip, which joins after the screen loads) in demo mode: the dropdown mode and
// the placement are the user's own choice here.
const MODE_URL = '/src/shell/tabs-mode.ts';
for (const hash of ['/security/live/wall', '/security/recordings']) {
  for (const place of PLACES) {
    test(`first paint of ${hash} (demo) keeps the dropdowns still, placement ${place}, 1440x900`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('about:blank');
      await page.goto('/?design=a#/home');
      await page.waitForSelector('sw-app[data-shell-ready]');
      await page.evaluate(async ([url, p]) => {
        const m = await import(/* @vite-ignore */ url as string);
        await m.saveOwnTabsMode('dropdown', {});
        await m.saveOwnDdPlace(p);
      }, [MODE_URL, place] as const);
      await page.waitForTimeout(1500);
      await startSampling(page);
      await page.evaluate((h) => {
        location.hash = h;
      }, hash);
      await page.waitForTimeout(4000);
      const frames = await stopSampling(page);
      const settled = frames.at(-1)!;
      if (process.env.SW_FP_DUMP) {
        let prev = '';
        for (const f of frames) {
          const s = JSON.stringify({ ...f, t: 0 });
          if (s !== prev) console.log(`${hash}/${place} t=${f.t} place=${f.place}/${f.fb} all=[${f.all}] chip=${f.chip ? `${Math.round(f.chip.l)}..${Math.round(f.chip.r)} y${Math.round(f.chip.t)}` : '-'} title=${f.title ? `${Math.round(f.title.l)}..${Math.round(f.title.r)} y${Math.round(f.title.t)}` : '-'}`);
          prev = s;
        }
      }
      expect(settled.chip, 'chip drawn when settled').not.toBeNull();
    });
  }
}
