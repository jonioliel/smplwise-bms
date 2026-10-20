import { test } from '@playwright/test';
import fs from 'node:fs';

// UXREST-295 focus-order / focus-ring driver (exploratory; writes docs/design/evidence/UXREST-295/focus-<project>-<phase>.json).
//   UX_PHASE=before|after  UX_ROUTES=/a,/b
const ROUTES = (process.env.UX_ROUTES || '/,/live,/explore/sites,/devices/building,/investigate/events,/tickets/mine,/tickets/board,/system/access,/system/notifications,/system/tickets,/wiskey/people,/styleguide').split(',');
const PHASE = process.env.UX_PHASE || 'before';
const OUT = '../docs/design/evidence/UXREST-295';
const STOPS = 45;

type Stop = { tag: string; label: string; x: number; y: number; w: number; h: number; ring: boolean; shown: boolean };

test('focus order', async ({ page }, info) => {
  test.setTimeout(900_000);
  const res: Record<string, unknown> = {};
  for (const r of ROUTES) {
    await page.goto('about:blank');
    await page.goto(`/?design=a#${r}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1800);
    await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur?.(); window.scrollTo(0, 0); });
    const stops: Stop[] = [];
    for (let i = 0; i < STOPS; i++) {
      await page.keyboard.press('Tab');
      const s = await page.evaluate((): Stop | null => {
        let e: Element | null = document.activeElement;
        while (e?.shadowRoot?.activeElement) e = e.shadowRoot.activeElement;
        if (!e || e === document.body) return null;
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        const host = (e.getRootNode() as ShadowRoot).host as HTMLElement | undefined;
        const hcs = host ? getComputedStyle(host) : null;
        const own = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 || (cs.boxShadow !== 'none' && /rgb/.test(cs.boxShadow));
        const ringOf = (c: CSSStyleDeclaration) => (c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) > 0) || (c.boxShadow !== 'none' && /rgb/.test(c.boxShadow));
        // a ring on the host element, or on a wrapper that holds the focus (a search box drawn by its label's :focus-within)
        let anc = false;
        for (let p: Element | null = e.parentElement, i = 0; p && i < 3; p = p.parentElement, i++) if (p.matches(':focus-within') && ringOf(getComputedStyle(p))) anc = true;
        const hostRing = (hcs ? ringOf(hcs) : false) || anc;
        const label = (e.getAttribute('aria-label') || (e as HTMLElement).innerText || e.getAttribute('title') || (e as HTMLInputElement).placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 30);
        const inView = r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
        return { tag: e.tagName.toLowerCase(), label, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), ring: own || hostRing, shown: inView && r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05 };
      });
      if (!s) { stops.push({ tag: 'BODY', label: '', x: 0, y: 0, w: 0, h: 0, ring: true, shown: true }); break; }
      stops.push(s);
    }
    const noRing = stops.filter((s) => !s.ring && s.tag !== 'BODY');
    const hidden = stops.filter((s) => !s.shown);
    // visual order: a jump upwards by > 60 px that is not a wrap to the top (the first stops are the chrome)
    const upJumps = stops.slice(1).map((s, i) => ({ from: stops[i].label, to: s.label, dy: s.y - stops[i].y })).filter((j) => j.dy < -60);
    res[r] = { stops: stops.length, noRing: noRing.map((s) => `${s.tag}:${s.label}`), hidden: hidden.map((s) => `${s.tag}:${s.label}@${s.x},${s.y}`), upJumps: upJumps.slice(0, 8), trace: stops.map((s) => `${s.tag}:${s.label}@${s.x},${s.y}${s.ring ? '' : ' !noring'}${s.shown ? '' : ' !hidden'}`) };
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/focus-${info.project.name}-${PHASE}.json`, JSON.stringify(res, null, 1));
});
