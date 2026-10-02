import { test, expect, type Page } from '@playwright/test';

// Bubble foundation (owner 2026-10-02): the layout guard, ported from the approved mockup's layout-check.mjs
// (docs/design/mockups/bubble-taste on pilot/design-bubble-taste) to the real components, through shadow roots.
// Sweeps the components' demo page (#/styleguide/bubble) over widths x density x surface x scheme (+ radius, touch 32, every
// pop-up kind and state) and FAILS on:
//   escape    an element or a text run crossing the box of the bubble that contains it (pill, sheet, chip, button, tree row, dock...)
//   overflow  horizontal overflow of the page, the shell's main column, the demo host or an open sheet's body
//   floating  a floating (fixed / absolute / sticky) element intersecting interactive content outside itself (no sheet open)
//   clipped   text cut by an overflow box without an ellipsis, or text sitting in a bubble's rounded corner
//   target    an interactive element below 44 x 44 px in touch layouts (<= 1100 px) or below the desktop touch dial (44, or 32 when chosen)
// Needs the Vite DEV server (the page imports /src/design/look.ts to set the dials):
//   SW_API_PORT=59997 npx vite --host 127.0.0.1 --port 5201      then
//   SW_BASE_URL=http://127.0.0.1:5201/ npx playwright test tests/layout-bubble.spec.ts --project=desktop --workers=1
//   LAYOUT_QUICK=1 sweeps four widths only.
// The performance dial is part of the matrix: the whole sweep runs in the full tier AND in the lite tier (two tests, a worker each);
// LAYOUT_PERF=lite|full runs one.
const LOOK_URL = '/src/design/look.ts';
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 800, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const DENSITIES = ['wide', 'regular', 'compact', 'row'] as const;
const SURFACES = ['flat', 'glass', 'gradient', 'fill'] as const;
const THEMES = ['light', 'dark'] as const;
const PERFS = (process.env.LAYOUT_PERF ? [process.env.LAYOUT_PERF] : ['full', 'lite']) as ('full' | 'lite')[];
const POPUPS = ['area', 'confirm', 'inline', 'light'] as const;

interface Finding {
  cls: 'escape' | 'overflow' | 'floating' | 'clipped' | 'target';
  el: string;
  detail: string;
  ctx: string;
}

/** Runs inside the page. Walks the composed (flat) tree: light DOM, shadow roots and slotted content. */
function inPageCheck(ctx: string): Finding[] {
  const out: Finding[] = [];
  const touch = innerWidth <= 1100;
  const desktopTouch = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sw-touch-desktop')) || 44;
  const MIN = touch ? 44 : desktopTouch;
  const BUBBLE = 'sw-pill, .sheet, .tree-row, .floor-head, nav.tree, .btn, .chip, .sb, .pk-head, .stack, nav.bottom, .fab, .kv > div, .big, .x, .ring, sw-card, .pv-sheet, .seg';
  // .float = the shell's existing search / status corner (UI round 1), not a phase-B component: its 28 px button is a known shell item
  const SKIP = '.tx.over, .pv-bg, sw-icon, svg, .sr, .grab, .float';
  const INTER = 'button, a[href], [role="slider"], [role="button"], [role="switch"], [role="option"], input, select, [tabindex="0"]';
  const all: Element[] = [];
  const collect = (root: Document | ShadowRoot | Element) => {
    for (const el of root.querySelectorAll('*')) {
      all.push(el);
      if (el.shadowRoot) collect(el.shadowRoot);
    }
  };
  collect(document);
  const parentOf = (el: Element): Element | null => {
    if (el.assignedSlot) return el.assignedSlot;
    const p = el.parentNode;
    if (!p) return null;
    if (p instanceof ShadowRoot) return p.host;
    return p instanceof Element ? p : null;
  };
  const ancestors = (el: Element): Element[] => {
    const a: Element[] = [];
    for (let p = parentOf(el); p; p = parentOf(p)) a.push(p);
    return a;
  };
  const csC = new Map<Element, CSSStyleDeclaration>();
  const cs = (el: Element) => {
    let s = csC.get(el);
    if (!s) {
      s = getComputedStyle(el);
      csC.set(el, s);
    }
    return s;
  };
  const hidC = new Map<Element, boolean>();
  const hidden = (el: Element | null): boolean => {
    if (!el || el === document.documentElement) return false;
    const c = hidC.get(el);
    if (c !== undefined) return c;
    const s = cs(el);
    const h = s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || (el as HTMLElement).hidden || el.getAttribute('aria-hidden') === 'true' || hidden(parentOf(el));
    hidC.set(el, h);
    return h;
  };
  const desc = (el: Element) => {
    const c = [...el.classList].slice(0, 3).join('.');
    const t = (el.getAttribute('aria-label') || el.getAttribute('data-dev') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `${el.tagName.toLowerCase()}${c ? '.' + c : ''}${t ? ` "${t}"` : ''}`;
  };
  type Box = { l: number; t: number; r: number; b: number };
  const R = (r: DOMRect): Box => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  const inter = (a: Box, b: Box): Box => ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) });
  const empty = (a: Box) => a.r - a.l < 1 || a.b - a.t < 1;
  const scrolls = (s: CSSStyleDeclaration) => /(auto|scroll)/.test(s.overflowX + s.overflowY);
  const clips = (s: CSSStyleDeclaration) => s.overflowX !== 'visible' || s.overflowY !== 'visible';
  const visRect = (el: Element): Box => {
    let v = R(el.getBoundingClientRect());
    for (const e of ancestors(el)) if (clips(cs(e)) && cs(e).position !== 'fixed') v = inter(v, R(e.getBoundingClientRect()));
    return v;
  };
  const add = (cls: Finding['cls'], el: Element, detail: string) => out.push({ cls, el: desc(el), detail, ctx });
  const matches = (el: Element, sel: string) => {
    try {
      return el.matches(sel);
    } catch {
      return false;
    }
  };
  const skip = (el: Element) => matches(el, SKIP) || ancestors(el).some((a) => matches(a, SKIP));

  // overflow
  const ov = (el: Element | null, name: string) => {
    if (el && !hidden(el) && el.scrollWidth > el.clientWidth + 1) add('overflow', el, `${name} scrollWidth ${el.scrollWidth} > ${el.clientWidth}`);
  };
  if (document.documentElement.scrollWidth > innerWidth + 1) add('overflow', document.documentElement, `page ${document.documentElement.scrollWidth} > ${innerWidth}`);
  const app = document.querySelector('sw-app');
  ov(app?.shadowRoot?.querySelector('main') ?? null, 'main');
  const demo = app?.shadowRoot?.querySelector('bubble-demo') ?? null;
  ov(demo, 'demo');
  const openSheets = all.filter((e) => e.tagName === 'SW-SHEET' && e.hasAttribute('open'));
  const modalSheet = openSheets.find((s) => s.getAttribute('data-layout') !== 'inline') ?? null;
  for (const s of openSheets) ov(s.shadowRoot?.querySelector('.body') ?? null, 'sheet-body');

  // the scope: inside the open modal sheet (its section + slotted content), else the whole page
  const sheetSection = modalSheet?.shadowRoot?.querySelector('.sheet') ?? null;
  const inScope = (el: Element) => (sheetSection ? el === sheetSection || ancestors(el).includes(sheetSection) : true);
  const scoped = all.filter((e) => inScope(e) && !hidden(e));

  // escape: elements and text runs must stay inside their bubble
  for (const b of scoped) {
    if (!matches(b, BUBBLE) || skip(b)) continue;
    const br = R(b.getBoundingClientRect());
    if (empty(br) || empty(visRect(b))) continue;
    for (const d of scoped) {
      if (d === b || skip(d)) continue;
      const chain = ancestors(d);
      const i = chain.indexOf(b);
      if (i < 0) continue;
      if (chain.slice(0, i).some((e) => scrolls(cs(e)) || cs(e).position === 'fixed')) continue; // scrolled or floating content is laid out on its own
      if (matches(d, '.sheet') || chain.slice(0, i).some((e) => matches(e, '.sheet'))) continue;
      const r = R(d.getBoundingClientRect());
      if (empty(r)) continue;
      if (r.l < br.l - 1.5 || r.r > br.r + 1.5 || r.t < br.t - 1.5 || r.b > br.b + 1.5) add('escape', d, `outside ${desc(b)} by ${Math.round(Math.max(br.l - r.l, r.r - br.r, br.t - r.t, r.b - br.b))}px`);
    }
  }
  // clipped text (and text in a rounded corner)
  const textRoots: (Document | ShadowRoot)[] = [document, ...all.filter((e) => e.shadowRoot).map((e) => e.shadowRoot!)];
  for (const root of textRoots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim()) continue;
      const el = n.parentElement;
      if (!el || !inScope(el) || skip(el) || el.closest('script, style') || hidden(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const tr = R(range.getBoundingClientRect());
      if (empty(tr)) continue;
      let cornerDone = false;
      for (let e: Element | null = el; e; e = parentOf(e)) {
        const s = cs(e);
        if (scrolls(s)) break;
        const er = R(e.getBoundingClientRect());
        const outX = tr.l < er.l - 1.5 || tr.r > er.r + 1.5;
        if (clips(s) && outX) {
          const ell = cs(el).textOverflow === 'ellipsis' || s.textOverflow === 'ellipsis';
          if (!ell) add('clipped', el, `text cut by ${desc(e)}`);
          break;
        }
        if (matches(e, BUBBLE) && outX) {
          add('escape', el, `text outside ${desc(e)}`);
          break;
        }
        if (matches(e, BUBBLE) && !cornerDone) {
          cornerDone = true;
          const rad = Math.min(parseFloat(s.borderTopLeftRadius) || 0, (er.b - er.t) / 2, (er.r - er.l) / 2);
          if (rad > 4) {
            const pts = [[tr.l + 1, tr.t + 3], [tr.r - 1, tr.t + 3], [tr.l + 1, tr.b - 3], [tr.r - 1, tr.b - 3]];
            const cut = pts.some(([x, y]) => {
              const cx = x < er.l + rad ? er.l + rad : x > er.r - rad ? er.r - rad : null;
              const cy = y < er.t + rad ? er.t + rad : y > er.b - rad ? er.b - rad : null;
              return cx !== null && cy !== null && Math.hypot(x - cx, y - cy) > rad + 1;
            });
            if (cut) add('clipped', el, `text in the rounded corner of ${desc(e)}`);
          }
        }
      }
    }
  }
  // targets
  for (const el of scoped) {
    if (!matches(el, INTER) || el.getAttribute('tabindex') === '-1' || skip(el) || (el as HTMLButtonElement).disabled) continue;
    if (empty(visRect(el))) continue;
    const r = el.getBoundingClientRect();
    if (r.width < MIN - 0.5 || r.height < MIN - 0.5) add('target', el, `${Math.round(r.width)}x${Math.round(r.height)} < ${MIN}`);
  }
  // floating elements over interactive content (no modal sheet open)
  if (!modalSheet) {
    const floats = scoped.filter((e) => {
      const s = cs(e);
      return (s.position === 'absolute' || s.position === 'fixed' || s.position === 'sticky') && !skip(e) && !matches(e, '.backdrop, .sheet, sw-sheet') && !ancestors(e).some((a) => matches(a, 'sw-sheet'));
    });
    const targets = scoped.filter((t) => matches(t, INTER) && t.getAttribute('tabindex') !== '-1' && !skip(t));
    for (const f of floats) {
      const fr = visRect(f);
      if (empty(fr)) continue;
      for (const t of targets) {
        if (f === t || ancestors(t).includes(f) || ancestors(f).includes(t)) continue;
        const ir = inter(fr, visRect(t));
        if (!empty(ir) && (ir.r - ir.l) * (ir.b - ir.t) > 4) add('floating', f, `covers ${desc(t)}`);
      }
    }
  }
  return out;
}

const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);

async function setLook(page: Page, look: Record<string, string | number>) {
  await page.evaluate(
    async ([url, l]) => {
      const mod = await import(/* @vite-ignore */ url as string);
      await mod.saveOwnLook(l);
      // the dials are in force on <html> (a tier that did not apply would make the lite pass a copy of the full one)
      const want = (l as Record<string, unknown>).performance;
      if (want && document.documentElement.getAttribute('data-bubble-performance') !== want) throw new Error('data-bubble-performance is ' + document.documentElement.getAttribute('data-bubble-performance') + ', wanted ' + want);
    },
    [LOOK_URL, look] as const,
  );
}

async function openDemo(page: Page, theme: string) {
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=bubble&scheme=${theme}#/styleguide/bubble`);
  await page.waitForSelector('sw-app');
  await page.waitForFunction(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('bubble-demo')?.shadowRoot?.querySelector('[data-demo-grid] sw-pill'));
  await page.evaluate(() => document.fonts.ready);
}

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const demoEl = (page: Page) => page.locator('sw-app bubble-demo');

async function setSheet(page: Page, which: (typeof POPUPS)[number] | '') {
  await demoEl(page).evaluate((el, w) => {
    (el as unknown as { sheet: string }).sheet = w;
  }, which);
  await page.waitForTimeout(80);
  await settle(page);
}

test.describe('bubble layout guard', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  test.describe.configure({ timeout: 20 * 60_000 });

  for (const perf of PERFS) test(`no escape / overflow / floating / clipped / small target over widths x density x surface x scheme, pop-ups included [${perf}]`, async ({ page, context }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    await context.addInitScript(() => {
      try {
        localStorage.removeItem('sw.ui.look');
      } catch {
        /* storage unavailable */
      }
    });
    await page.emulateMedia({ reducedMotion: 'reduce' }); // every state is measured settled
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    let runs = 0;
    for (const theme of THEMES) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openDemo(page, theme);
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: height(w) });
        await settle(page);
        const combos: Record<string, string | number>[] = [];
        for (const density of DENSITIES) for (const surface of SURFACES) combos.push({ density, surface, radius: 'pill', touch: 44, performance: perf });
        combos.push({ density: 'regular', surface: 'fill', radius: 'soft', touch: 44, performance: perf }, { density: 'regular', surface: 'fill', radius: 'square', touch: 44, performance: perf });
        if (w > 1100) combos.push({ density: 'compact', surface: 'fill', radius: 'pill', touch: 32, performance: perf }, { density: 'row', surface: 'flat', radius: 'square', touch: 32, performance: perf });
        for (const c of combos) {
          await setLook(page, c);
          await setSheet(page, '');
          runs++;
          results.push(...(await page.evaluate(inPageCheck, `${theme} ${w} ${JSON.stringify(c)} page`)));
          // the pop-ups: every kind, in the densities that change the pill's shape
          if (c.surface === 'fill' || c.surface === 'glass') {
            for (const popup of c.touch === 32 ? (['area'] as const) : POPUPS) {
              for (const kind of popup === 'area' ? (['sheet', 'centred'] as const) : (['sheet'] as const)) {
                await setLook(page, { ...c, popup: kind });
                await setSheet(page, popup);
                runs++;
                results.push(...(await page.evaluate(inPageCheck, `${theme} ${w} ${JSON.stringify({ ...c, popup: kind })} popup:${popup}`)));
              }
            }
            await setSheet(page, '');
          }
        }
      }
    }
    // report
    const byCls: Record<string, number> = {};
    const uniq = new Map<string, Finding & { n: number; ctxs: Set<string> }>();
    for (const r of results) {
      byCls[r.cls] = (byCls[r.cls] || 0) + 1;
      const k = `${r.cls}|${r.el}|${r.detail}`;
      if (!uniq.has(k)) uniq.set(k, { ...r, n: 0, ctxs: new Set() });
      const u = uniq.get(k)!;
      u.n++;
      u.ctxs.add(r.ctx);
    }
    const lines = [...uniq.values()].sort((a, b) => b.n - a.n).slice(0, 80).map((u) => `[${u.cls}] ${u.el} - ${u.detail} (x${u.n}; e.g. ${[...u.ctxs][0]})`);
    console.log(`layout-bubble [${perf}]: ${runs} checks (${WIDTHS.length} widths), findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
    for (const l of lines) console.log('  ' + l);
    if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 10));
    expect(errors, 'page errors').toEqual([]);
    expect(lines, 'layout findings').toEqual([]);
  });

  // The palette dimension (release 0.1.156): a palette changes colours only, never geometry, but a palette must not push text out of a bubble
  // or hide a target either (a darker surface, a wider glass). Representative palettes only - the default blue, a mauve one and the
  // accessibility one (near-opaque glass) - over three widths, three look combinations and both schemes, one pop-up; each run first checks
  // the palette is really in force (a no-op palette would make this a copy of the main sweep).
  const PALETTES = (process.env.LAYOUT_PALETTES ? process.env.LAYOUT_PALETTES.split(',') : ['calm-blue', 'purple-rose', 'high-contrast']) as string[];
  const PAL_WIDTHS = QUICK ? [390, 1440] : [390, 1024, 1440];
  const PAL_COMBOS: Record<string, string | number>[] = [
    { density: 'regular', surface: 'fill', radius: 'pill', touch: 44 },
    { density: 'compact', surface: 'glass', radius: 'soft', touch: 44 },
    { density: 'row', surface: 'gradient', radius: 'pill', touch: 44 },
  ];
  test('no escape / overflow / floating / clipped / small target with a palette applied (representative palettes x widths x looks x scheme)', async ({ page, context }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project runs the whole sweep');
    test.setTimeout(10 * 60_000);
    await context.addInitScript(() => {
      try {
        localStorage.removeItem('sw.ui.look');
      } catch {
        /* storage unavailable */
      }
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const results: Finding[] = [];
    const notApplied: string[] = [];
    let runs = 0;
    for (const theme of THEMES) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await openDemo(page, theme);
      for (const palette of PALETTES) {
        for (const w of PAL_WIDTHS) {
          await page.setViewportSize({ width: w, height: height(w) });
          await settle(page);
          for (const c of PAL_COMBOS) {
            const look = { ...c, performance: 'full', palette };
            await setLook(page, look);
            await setSheet(page, '');
            const seen = await page.evaluate(() => ({ p: document.documentElement.getAttribute('data-bubble-palette'), accent: document.documentElement.style.getPropertyValue('--sw-accent'), bg: document.documentElement.style.getPropertyValue('--sw-bg') }));
            const want = await page.evaluate(
              async ([url, id, th]) => {
                const mod = await import(/* @vite-ignore */ url as string);
                const p = mod.paletteById(id);
                return p ? { accent: p.schemes[th as string].accent, bg: p.schemes[th as string].bg } : null;
              },
              ['/src/design/palette.ts', palette, theme] as const,
            );
            if (!want || seen.p !== palette || seen.accent !== want.accent || seen.bg !== want.bg) notApplied.push(`${theme} ${w} ${palette}: ${JSON.stringify(seen)} vs ${JSON.stringify(want)}`);
            runs++;
            results.push(...(await page.evaluate(inPageCheck, `${theme} ${w} ${palette} ${JSON.stringify(c)} page`)));
            if (c.surface !== 'gradient') {
              await setSheet(page, 'area');
              runs++;
              results.push(...(await page.evaluate(inPageCheck, `${theme} ${w} ${palette} ${JSON.stringify(c)} popup:area`)));
              await setSheet(page, '');
            }
          }
        }
      }
    }
    const uniq = new Map<string, Finding & { n: number }>();
    for (const r of results) {
      const k = `${r.cls}|${r.el}|${r.detail}`;
      const u = uniq.get(k) ?? { ...r, n: 0 };
      u.n++;
      uniq.set(k, u);
    }
    const lines = [...uniq.values()].sort((a, b) => b.n - a.n).slice(0, 60).map((u) => `[${u.cls}] ${u.el} - ${u.detail} (x${u.n}; e.g. ${u.ctx})`);
    console.log(`layout-bubble [palettes ${PALETTES.join(',')}]: ${runs} checks, findings ${results.length}, not applied ${notApplied.length}, page errors ${errors.length}`);
    for (const l of lines) console.log('  ' + l);
    expect(errors, 'page errors').toEqual([]);
    expect(notApplied, 'palette in force').toEqual([]);
    expect(lines, 'layout findings').toEqual([]);
  });
});
