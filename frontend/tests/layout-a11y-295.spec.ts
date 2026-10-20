import { test, expect, type Locator, type Page } from '@playwright/test';
import { installTicketsMock, url } from './tickets-mocks';

// UXFIX-A11Y-295: the browser half of the UX audit fixes (private/planning/UX_AUDIT_2026-10-20.md). Demo data / the tickets mock, no
// backend; `npm run build` first, then
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-a11y-295.spec.ts --project=mobile --project=desktop --workers=1
// - touch targets (finding 6): the hit area of each control the audit measured is probed with elementFromPoint (through the shadow roots)
//   at +-21 px from its centre, so an invisible ::after ring counts and a neighbour's ring that steals the edge does not;
// - empty state (finding 4): the preset empty icon is the neutral tray;
// - layout shift (finding 7): the cards replace skeleton cards of the same height, CLS of the list load stays under 0.1;
// - calendar header (finding 12) and the notification severity picker (finding 13) on a phone.

const HALF = 21; // a 44 px square around the centre (42 px between the probes, the probes 1 px inside the edge)

/** Every probe of the 44 px cross around the control lands on the control (or on something inside it). */
async function hitCross(loc: Locator): Promise<{ w: number; h: number; misses: string[] }> {
  await loc.scrollIntoViewIfNeeded();
  return loc.evaluate((el, half) => {
    const deepHit = (x: number, y: number): Element | null => {
      let e = document.elementFromPoint(x, y);
      while (e?.shadowRoot) {
        const inner = e.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === e) break;
        e = inner;
      }
      return e;
    };
    const inside = (t: Element | null): boolean => {
      for (let n: Node | null = t; n; n = n.parentNode ?? (n as ShadowRoot).host ?? null) if (n === el) return true;
      return false;
    };
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const misses: string[] = [];
    for (const [dx, dy, name] of [[-half, 0, 'start/left'], [half, 0, 'end/right'], [0, -half, 'top'], [0, half, 'bottom']] as const) {
      const t = deepHit(cx + dx, cy + dy);
      if (!inside(t)) misses.push(`${name} -> ${t ? t.tagName.toLowerCase() + (t.className ? '.' + String(t.className).split(' ').join('.') : '') : 'nothing'}`);
    }
    return { w: Math.round(r.width), h: Math.round(r.height), misses };
  }, HALF);
}

async function expectHit(loc: Locator, label: string) {
  const n = await loc.count();
  expect(n, `${label}: present`).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const h = await hitCross(loc.nth(i));
    console.log(`hit ${label}[${i}] drawn ${h.w}x${h.h} misses ${JSON.stringify(h.misses)}`);
    expect(h.misses, `${label}[${i}] (drawn ${h.w}x${h.h})`).toEqual([]);
  }
}

async function openDemo(page: Page, hash: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1200);
}

test.describe('touch targets (phone)', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'the phone project (touch)');

  // (the events range toggle renders in the API mode only - its 44 px rule is CSS in investigate-events.ts, not probed here)
  test('corner search / status keys and filter chips: a 44 px hit area', async ({ page }) => {
    await openDemo(page, '/styleguide');
    await expectHit(page.locator('sw-app .float .pillrow button'), 'corner key');
    const chips = page.locator('sw-app styleguide-screen sw-chip');
    const n = await chips.count();
    expect(n, 'events filter chips').toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const h = await hitCross(chips.nth(i).locator('button'));
      console.log(`hit chip[${i}] drawn ${h.w}x${h.h} misses ${JSON.stringify(h.misses)}`);
      expect(h.h, 'the chip keeps its drawn height').toBeLessThan(40);
      expect(h.misses, `chip[${i}]`).toEqual([]);
    }
  });

  test('a shared field select is 44 px; the tickets view switch keys are 44 x 44', async ({ page }) => {
    await openDemo(page, '/live/wall');
    const q = page.locator('live-wall [data-wall-quality]');
    if (await q.count()) expect(Math.round((await q.first().boundingBox())!.height), 'select in a field').toBeGreaterThanOrEqual(44);
    await installTicketsMock(page);
    await page.goto('about:blank');
    await page.goto(url('/tickets/all'));
    await page.waitForSelector('sw-app tickets-list [data-view-switch]');
    for (const b of await page.locator('sw-app tickets-list [data-view-switch] button').all()) {
      const box = (await b.boundingBox())!;
      expect(Math.round(box.width), 'view switch width').toBeGreaterThanOrEqual(44);
      expect(Math.round(box.height), 'view switch height').toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'no sideways page scroll').toBeLessThanOrEqual(0);
  });
});

test('empty state: the preset icon is the neutral tray, error and loading keep theirs', async ({ page }) => {
  await openDemo(page, '/styleguide');
  const icon = (state: string) => page.locator(`styleguide-screen sw-state-panel[state="${state}"]`).first().locator('.icon');
  await expect(icon('empty')).toHaveAttribute('data-icon', 'inbox');
  await expect(icon('error')).toHaveAttribute('data-icon', 'warning');
  await expect(icon('loading')).toHaveAttribute('data-icon', 'clock');
});

test('tickets list: the cards replace skeleton cards of their own height; the load shifts the layout by < 0.1', async ({ page }, info) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number; __shifts: string[] };
    w.__cls = 0;
    w.__shifts = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; startTime: number; sources?: { node?: Node; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] }[]) {
          if (e.hadRecentInput) continue;
          w.__cls += e.value;
          const src = (e.sources ?? []).slice(0, 4).map((s) => {
            const n = s.node as Element | undefined;
            const name = n ? (n.nodeType === 1 ? `${n.tagName.toLowerCase()}${n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).join('.') : ''}` : '#text') : '?';
            return `${name} y${Math.round(s.previousRect.y)}->${Math.round(s.currentRect.y)} h${Math.round(s.previousRect.height)}->${Math.round(s.currentRect.height)}`;
          });
          w.__shifts.push(`${Math.round(e.startTime)}ms ${e.value.toFixed(3)} [${src.join('; ')}]`);
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      /* no layout-shift entries in this engine */
    }
  });
  await installTicketsMock(page);
  // the list answers late, so the skeleton is on screen long enough to be measured (registered last: runs before the mock)
  await page.route(
    (u) => /\/api\/v1\/tickets$/.test(u.pathname),
    async (route) => {
      if (route.request().method() === 'GET') await new Promise((r) => setTimeout(r, 1800));
      await route.fallback();
    },
  );
  await page.goto('about:blank');
  await page.goto(url('/tickets/all'));
  const sk = page.locator('sw-app tickets-list ticket-card[skeleton]');
  await expect(sk.first()).toBeVisible({ timeout: 15_000 });
  const skH = (await sk.first().boundingBox())!.height;
  const skTop = (await sk.first().boundingBox())!.y;
  const hdrSk = (await page.locator('sw-app tickets-list [data-tickets-header]').boundingBox())!;
  const real = page.locator('sw-app tickets-list [data-tickets-grid] ticket-card');
  await expect(real.first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1000);
  const realTop = (await real.first().boundingBox())!.y;
  const hdr = (await page.locator('sw-app tickets-list [data-tickets-header]').boundingBox())!;
  console.log(`[${info.project.name}] first card top ${Math.round(skTop)} (skeleton) -> ${Math.round(realTop)}; header ${Math.round(hdrSk.y)}+${Math.round(hdrSk.height)} -> ${Math.round(hdr.y)}+${Math.round(hdr.height)}`);
  const hs = (await real.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))).sort((a, b) => a - b);
  const median = hs[Math.floor(hs.length / 2)];
  const { cls, shifts } = await page.evaluate(() => ({ cls: (window as unknown as { __cls: number }).__cls, shifts: (window as unknown as { __shifts: string[] }).__shifts }));
  console.log(`[${info.project.name}] skeleton card ${Math.round(skH)} px, real cards ${hs.map(Math.round).join('/')} px (median ${Math.round(median)}), CLS ${cls.toFixed(3)} (${shifts.join(', ')})`);
  expect(Math.abs(skH - median) / median, 'skeleton height vs the median card').toBeLessThanOrEqual(0.12);
  expect(cls, 'cumulative layout shift of the list load').toBeLessThan(0.1);
});

test.describe('phone headers', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'the phone project (touch)');
  test.use({ timezoneId: 'Asia/Jerusalem', locale: 'he-IL' });

  test('tickets calendar: the week range is one line, the controls above the first event are shorter than the audit measured', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('sw.tickets.list.calendar', '1');
      } catch {
        /* about:blank */
      }
    });
    await installTicketsMock(page, { schedule: true });
    await page.clock.setFixedTime(new Date('2026-10-13T10:42:00Z'));
    await page.goto('about:blank');
    await page.goto(url('/tickets/mine'));
    const C = 'sw-app tickets-list tickets-calendar';
    await page.waitForSelector(`${C} [data-cal][data-cal-mode="day"]`);
    const h2 = page.locator(`${C} [data-cal-range]`);
    const m = await h2.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { h: el.getBoundingClientRect().height, lh: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5, ws: cs.whiteSpace };
    });
    console.log(`calendar range: ${Math.round(m.h)} px tall, line ${Math.round(m.lh)} px, white-space ${m.ws}`);
    expect(m.ws).toBe('nowrap');
    expect(m.h, 'one line').toBeLessThanOrEqual(m.lh * 1.3);
    await expect(page.locator(`${C} [data-cal-range] bdi[dir="ltr"]`)).toHaveText('11–17');
    const bar = (await page.locator(`${C} [data-cal-nav]`).first().boundingBox())!;
    expect(Math.round(bar.height), 'the week bar is one row of 44 px keys').toBeLessThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'no sideways page scroll').toBeLessThanOrEqual(0);
  });

  test('notification rules: every severity level carries its name, the chip rows stay inside the card', async ({ page }) => {
    await openDemo(page, '/system/notifications');
    const sys = page.locator('sw-app system-notifications');
    await expect(sys.locator('[data-notify-settings]')).toBeVisible();
    const card = sys.locator('.scard').filter({ has: page.locator('.sevseg') }).first();
    await card.scrollIntoViewIfNeeded();
    const keys = card.locator('.sevseg button');
    await expect(keys).toHaveCount(3);
    for (const k of await keys.all()) {
      expect(((await k.textContent()) ?? '').trim().length, 'a level shows its name').toBeGreaterThan(1);
      expect(Math.round((await k.boundingBox())!.height), 'severity key').toBeGreaterThanOrEqual(44);
    }
    const c = (await card.boundingBox())!;
    for (const ch of await card.locator('.chs > *').all()) {
      const b = (await ch.boundingBox())!;
      expect(b.x, 'chip inside the card (start)').toBeGreaterThanOrEqual(c.x - 0.5);
      expect(b.x + b.width, 'chip inside the card (end)').toBeLessThanOrEqual(c.x + c.width + 0.5);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'no sideways page scroll').toBeLessThanOrEqual(0);
  });
});
