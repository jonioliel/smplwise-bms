import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';

// AUDIT30-B-SHARED (design audit round 30, branch B: the shared components). In the browser, demo fixtures, classic skin:
//   finding 4  - the selected sw-chip is the soft accent field (no gradient key, no inverse ink), light and dark, >= 4.5:1
//   finding 7  - sw-kpi unit / secondary / tone warn | alarm / dot render, keep the 60 px compact height and name the tile
//   finding 10 - sw-table TableColumn.card at 375 px: one line "title · badge" + one meta line (<= 64 px a row; the old stack ~160 px);
//                a table that marks no column keeps the old stack
//   finding 12 - the filled badges on the investigation screens (events, cases, incidents) read >= 4.5:1, light and dark
//   finding 16 - sw-field type="search": 34 px, --sw-r-sm, the clear key empties the box (input + search-clear), Escape too
// The components are mounted on a gallery laid over the app (every shared component is registered once the routes below loaded).
// Pixel baselines ("pixel-stable" in the title: the gate's pixel group) are Linux ones generated on the runner with --update-snapshots;
// on an OS without a baseline the comparison is skipped, not failed.
//   run_smart.py preview pilot/AUDIT30-B-SHARED tests/evidence-audit30b-shared.spec.ts --project=desktop --project=mobile --workers=1

type Scheme = 'light' | 'dark';
const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, hash: string, scheme: Scheme = 'light', skin = 'classic') {
  await page.route('**/api/v1/**', (route) => route.abort()); // demo mode
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(`/?design=a&fit=off&skin=${skin}&scheme=${scheme}#${hash}`);
  await page.waitForSelector('sw-app');
  if (scheme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(1200);
}

/** visit routes until every shared component of the branch is registered */
async function register(page: Page, scheme: Scheme = 'light', skin = 'classic') {
  for (const hash of ['/investigate/health', '/investigate/events', '/system/audit', '/investigate/cases']) {
    await open(page, hash, scheme, skin);
    const missing = await page.evaluate(() => ['sw-chip', 'sw-kpi', 'sw-table', 'sw-field', 'sw-badge'].filter((n) => !customElements.get(n)));
    if (!missing.length) return;
  }
  throw new Error('a shared component was never registered');
}

/** the gallery: every new variant, laid over the app on the canvas colour */
async function mountGallery(page: Page) {
  await page.evaluate(() => {
    document.getElementById('b30')?.remove();
    const g = document.createElement('div');
    g.id = 'b30';
    g.setAttribute('dir', 'rtl');
    g.style.cssText =
      'position:fixed;inset:0;z-index:99999;overflow:auto;background:var(--sw-bg);color:var(--sw-text);font-family:var(--sw-font);padding:16px;display:flex;flex-direction:column;gap:14px;box-sizing:border-box';
    g.innerHTML = `
      <div data-g="chips" style="display:flex;gap:8px;flex-wrap:wrap">
        <sw-chip selected count="12">הכול</sw-chip><sw-chip count="3">פתוחות</sw-chip><sw-chip dot="var(--sw-danger)">דחוף</sw-chip><sw-chip disabled>סגורות</sw-chip>
      </div>
      <div data-g="kpis" style="display:grid;grid-template-columns:repeat(auto-fill,220px);gap:10px;align-items:start">
        <sw-kpi data-k="unit" layout="compact" icon="info" label="היום" value="284" unit='קוט"ש'></sw-kpi>
        <sw-kpi data-k="sec" layout="compact" icon="camera" label="פעילות" value="8" secondary="מתוך 12"></sw-kpi>
        <sw-kpi data-k="warn" layout="compact" tone="warn" icon="info" label="דורש בדיקה" value="3" detail="2 ממתינות"></sw-kpi>
        <sw-kpi data-k="alarm" layout="compact" tone="alarm" dot="alarm" label="תקלות" value="1" detail="מעלית 2"></sw-kpi>
        <sw-kpi data-k="dot" layout="compact" dot="live" label="מחוברים" value="11"></sw-kpi>
        <sw-kpi data-k="ctl" layout="compact" icon="info" label="דורש בדיקה" value="3" detail="2 ממתינות"></sw-kpi>
        <sw-kpi data-k="ctl0" layout="compact" icon="info" label="מצלמות" value="8"></sw-kpi>
      </div>
      <div data-g="search" style="max-inline-size:320px"><sw-field type="search" placeholder="חיפוש מצלמה"></sw-field></div>
      <sw-table data-t="card"></sw-table>
      <sw-table data-t="plain"></sw-table>`;
    document.body.appendChild(g);
    const rows = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      name: `מצלמה ${i + 1} - כניסה ראשית`,
      state: i % 3 ? 'live' : 'offline',
      fps: `${10 + i} fps`,
      res: '1920x1080',
      fw: 'V5.7.3',
      site: 'בניין א',
    }));
    type Col = { key: string; label: string; card?: string; render?: (r: Record<string, unknown>) => unknown };
    const badge = (r: Record<string, unknown>) => {
      const b = document.createElement('sw-badge') as HTMLElement & { kind: string; label: string };
      b.kind = String(r.state);
      return b;
    };
    const cols = (card: boolean): Col[] => [
      { key: 'name', label: 'שם', card: card ? 'title' : undefined },
      { key: 'state', label: 'מצב', card: card ? 'badge' : undefined, render: badge },
      { key: 'fps', label: 'קצב', card: card ? 'meta' : undefined },
      { key: 'res', label: 'רזולוציה', card: card ? 'meta' : undefined },
      { key: 'fw', label: 'קושחה', card: card ? 'hide' : undefined },
      { key: 'site', label: 'אתר', card: card ? 'meta' : undefined },
    ];
    const t1 = g.querySelector('[data-t="card"]') as HTMLElement & { columns: Col[]; rows: unknown[] };
    const t2 = g.querySelector('[data-t="plain"]') as HTMLElement & { columns: Col[]; rows: unknown[] };
    t1.columns = cols(true);
    t1.rows = rows;
    t2.columns = cols(false);
    t2.rows = rows.slice(0, 2);
  });
  await page.waitForTimeout(300);
}

/** contrast of an element's text against its own (composited) background chain, shadow roots included */
function contrastIn(page: Page, js: string) {
  return page.evaluate((code) => {
    type C = { r: number; g: number; b: number; a: number };
    const parse = (s: string): C | null => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const over = (t: C, b: C): C => {
      const a = t.a + b.a * (1 - t.a);
      const mix = (x: number, y: number) => (x * t.a + y * b.a * (1 - t.a)) / a;
      return { r: mix(t.r, b.r), g: mix(t.g, b.g), b: mix(t.b, b.b), a };
    };
    const lum = (c: C) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const up = (el: Element): Element | null => el.parentElement ?? ((el.parentNode as ShadowRoot | null)?.host ?? null);
    const bgOf = (el: Element): C => {
      const chain: Element[] = [];
      for (let e: Element | null = el; e; e = up(e)) chain.push(e);
      let c: C = { r: 255, g: 255, b: 255, a: 1 };
      for (const e of chain.reverse()) {
        const x = parse(getComputedStyle(e).backgroundColor);
        if (x && x.a > 0) c = over(x, c);
      }
      return c;
    };
    const el = new Function(`return (${code})`)() as Element;
    const bg = bgOf(el);
    const fg = over(parse(getComputedStyle(el).color)!, bg);
    const [a, b] = [lum(fg), lum(bg)];
    return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), image: getComputedStyle(el).backgroundImage, bg: getComputedStyle(el).backgroundColor };
  }, js);
}

for (const scheme of ['light', 'dark'] as const) {
  test(`finding 4: the selected chip is the soft accent field, no raised key, >= 4.5:1 (${scheme})`, async ({ page }) => {
    await register(page, scheme);
    await mountGallery(page);
    const sel = await contrastIn(page, `document.querySelector('#b30 sw-chip[selected]').shadowRoot.querySelector('button')`);
    const tok = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.background = 'var(--sw-accent-soft)';
      document.getElementById('b30')!.appendChild(probe);
      const v = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return v;
    });
    expect(sel.image).toBe('none'); // classic rule 1 painted a linear-gradient key
    expect(sel.bg).toBe(tok);
    expect(sel.ratio).toBeGreaterThanOrEqual(4.5);
    // the unselected chip keeps the classic raised key
    const off = await contrastIn(page, `document.querySelector('#b30 sw-chip:not([selected])').shadowRoot.querySelector('button')`);
    expect(off.image).toContain('linear-gradient');
  });

  // regression (runner pixel diff, wk-overview domus): every skin's selected chip label stays >= 4.5:1 on whatever field that skin draws
  for (const skin of ['domus', 'tesla', 'crystal', 'infra', 'soft'] as const) {
    test(`finding 4 regression: the selected chip reads >= 4.5:1 in ${skin} (${scheme})`, async ({ page }) => {
      await register(page, scheme, skin);
      await mountGallery(page);
      const sel = await contrastIn(page, `document.querySelector('#b30 sw-chip[selected]').shadowRoot.querySelector('button')`);
      expect(sel.ratio, `${skin}/${scheme} ${sel.bg} ${sel.image}`).toBeGreaterThanOrEqual(4.5);
    });
  }

  test(`finding 12: every filled badge on events, cases and incidents reads >= 4.5:1 (${scheme})`, async ({ page }) => {
    const bad: string[] = [];
    let seen = 0;
    for (const hash of ['/investigate/events', '/investigate/cases', '/investigate/incidents']) {
      await open(page, hash, scheme);
      const rows = await page.evaluate(() => {
        const out: Element[] = [];
        const walk = (root: ParentNode) => {
          for (const el of Array.from(root.querySelectorAll('*'))) {
            if (el.tagName === 'SW-BADGE' && el.hasAttribute('filled')) out.push(el);
            const sr = (el as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;
            if (sr) walk(sr);
          }
        };
        walk(document);
        (window as unknown as { __b30: Element[] }).__b30 = out;
        return out.length;
      });
      seen += rows;
      for (let i = 0; i < rows; i++) {
        const r = await contrastIn(page, `window.__b30[${i}]`);
        if (r.ratio < 4.5) bad.push(`${hash} #${i}: ${r.ratio.toFixed(2)}`);
      }
    }
    console.log(`filled badges measured (${scheme}): ${seen}`);
    expect(bad).toEqual([]);
  });
}

test('finding 7: the KPI variants render, keep 60 px, and name the whole tile', async ({ page }) => {
  await register(page);
  await mountGallery(page);
  const r = await page.evaluate(() => {
    const k = (n: string) => document.querySelector(`#b30 sw-kpi[data-k="${n}"]`) as HTMLElement;
    const sr = (n: string) => k(n).shadowRoot!;
    return {
      heights: Object.fromEntries(['unit', 'sec', 'warn', 'alarm', 'dot', 'ctl', 'ctl0'].map((n) => [n, Math.round(k(n).getBoundingClientRect().height)])),
      unit: sr('unit').querySelector('[data-kpi-unit]')?.textContent,
      unitColor: getComputedStyle(sr('unit').querySelector('[data-kpi-unit]')!).color,
      labelColor: getComputedStyle(sr('unit').querySelector('.label')!).color,
      sec: sr('sec').querySelector('[data-kpi-secondary]')?.textContent,
      title: k('sec').title,
      warnBorder: getComputedStyle(k('warn')).borderColor,
      warnBg: getComputedStyle(k('warn')).backgroundColor,
      plainBg: getComputedStyle(k('unit')).backgroundImage,
      dotHasIcon: !!sr('dot').querySelector('.icon'),
      dotHasDot: !!sr('dot').querySelector('[data-kpi-dot]'),
      alarmDot: getComputedStyle(sr('alarm').querySelector('[data-kpi-dot]')!, '::before').backgroundColor,
      iconTile: !!sr('unit').querySelector('.icon') && !sr('unit').querySelector('[data-kpi-dot]'),
    };
  });
  console.log(JSON.stringify(r.heights));
  // the tile keeps the height the same words have in the old tile: 60 px for a one-line tile (DESIGN.md), no extra line for the unit, the
  // "of N" figure, the dot or the warn / alarm fill (the controls ctl* carry the same words without the new properties)
  // (a long label that does not fit beside the value goes to its second line exactly as before, in the old tile too)
  for (const n of ['ctl0', 'unit', 'sec', 'dot'] as const) expect(r.heights[n], n).toBe(60);
  expect(r.heights.warn).toBe(r.heights.ctl);
  expect(r.heights.alarm).toBe(r.heights.ctl);
  expect(r.unit).toBe('קוט"ש');
  expect(r.unitColor).toBe(r.labelColor); // --sw-text-2
  expect(r.sec).toBe('מתוך 12');
  expect(r.title).toBe('8 מתוך 12 פעילות');
  expect(r.warnBorder).not.toBe('rgba(0, 0, 0, 0)');
  expect(r.warnBg).not.toBe('rgba(0, 0, 0, 0)');
  expect(r.dotHasIcon).toBe(false);
  expect(r.dotHasDot).toBe(true);
  expect(r.alarmDot).not.toBe('rgba(0, 0, 0, 0)');
  expect(r.iconTile).toBe(true);
});

test('finding 10: at 375 px a card-template row is one line + one meta line; an unmarked table keeps the old stack', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await register(page);
  await mountGallery(page);
  const r = await page.evaluate(() => {
    const t = (n: string) => document.querySelector(`#b30 sw-table[data-t="${n}"]`)!.shadowRoot!;
    const row = t('card').querySelector('tbody tr')!;
    const cell = (c: string) => row.querySelector(c)!.getBoundingClientRect();
    const shown = Array.from(row.children).filter((td) => getComputedStyle(td).display !== 'none').length;
    return {
      cardRow: Math.round(row.getBoundingClientRect().height),
      firstFive: Math.round(t('card').querySelectorAll('tbody tr')[4].getBoundingClientRect().bottom - t('card').querySelector('tbody tr')!.getBoundingClientRect().top),
      titleTop: Math.round(cell('td.c-title').top),
      badgeTop: Math.round(cell('td.c-badge').top),
      titleH: Math.round(cell('td.c-title').height),
      meta: row.querySelector('[data-card-meta]')!.textContent!.replace(/\s+/g, ' ').trim(),
      shown,
      plainRow: Math.round(t('plain').querySelector('tbody tr')!.getBoundingClientRect().height),
      plainMeta: !!t('plain').querySelector('[data-card-meta]'),
      attr: document.querySelector('#b30 sw-table[data-t="card"]')!.hasAttribute('card-template'),
      plainAttr: document.querySelector('#b30 sw-table[data-t="plain"]')!.hasAttribute('card-template'),
    };
  });
  console.log(JSON.stringify(r));
  expect(r.attr).toBe(true);
  expect(r.plainAttr).toBe(false);
  expect(r.cardRow).toBeLessThanOrEqual(64);
  expect(r.firstFive).toBeLessThanOrEqual(5 * 64); // five cameras in ~320 px (was ~2.5 cameras in the first screen)
  expect(Math.abs(r.titleTop - r.badgeTop)).toBeLessThanOrEqual(8); // title and badge on one line
  expect(r.titleH).toBeLessThanOrEqual(24);
  expect(r.meta).toBe('10 fps · 1920x1080 · בניין א');
  expect(r.shown).toBe(3); // title, badge, meta (the firmware column is hidden, the meta columns are folded into the meta line)
  expect(r.plainMeta).toBe(false);
  expect(r.plainRow).toBeGreaterThan(100); // the old label / value stack is untouched
});

test('finding 10: above 600 px a card-template table is the ordinary table (no meta line, every column)', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await register(page);
  await mountGallery(page);
  const r = await page.evaluate(() => {
    const sr = document.querySelector('#b30 sw-table[data-t="card"]')!.shadowRoot!;
    return {
      ths: sr.querySelectorAll('thead th').length,
      meta: getComputedStyle(sr.querySelector('[data-card-meta]')!).display,
      fw: getComputedStyle(sr.querySelectorAll('tbody tr')[0].children[4]).display,
    };
  });
  expect(r.ths).toBe(6);
  expect(r.meta).toBe('none');
  expect(r.fw).toBe('table-cell');
});

test('finding 16: the search box - 34 px, --sw-r-sm, clear key and Escape empty it', async ({ page }, info) => {
  await register(page);
  await mountGallery(page);
  const field = page.locator('#b30 sw-field[type="search"]');
  const input = field.locator('input.search');
  const coarse = info.project.name === 'mobile';
  const box = await input.evaluate((el) => ({ h: el.getBoundingClientRect().height, r: getComputedStyle(el).borderTopLeftRadius, fs: getComputedStyle(el).fontSize }));
  const rsm = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sw-r-sm').trim());
  expect(Math.round(box.h)).toBe(coarse ? 44 : 34);
  expect(box.r).toBe(rsm);
  if (coarse) expect(parseFloat(box.fs)).toBeGreaterThanOrEqual(16);
  await expect(input).toHaveAttribute('aria-label', 'חיפוש מצלמה');
  await expect(field.locator('[data-search-clear]')).toHaveCount(0);
  await page.evaluate(() => {
    const f = document.querySelector('#b30 sw-field[type="search"]')!;
    (window as unknown as { __ev: string[] }).__ev = [];
    f.addEventListener('input', (e) => (window as unknown as { __ev: string[] }).__ev.push(`input:${(e.target as HTMLInputElement & { value: string }).value}`));
    f.addEventListener('search-clear', () => (window as unknown as { __ev: string[] }).__ev.push('clear'));
  });
  await input.fill('כניסה');
  await expect(field).toHaveJSProperty('value', 'כניסה');
  await field.locator('[data-search-clear]').click();
  await expect(field).toHaveJSProperty('value', '');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await input.fill('לובי');
  await input.press('Escape');
  await expect(field).toHaveJSProperty('value', '');
  const ev = await page.evaluate(() => (window as unknown as { __ev: string[] }).__ev);
  expect(ev).toContain('input:כניסה');
  expect(ev.filter((e) => e === 'clear').length).toBe(2);
  expect(ev).toContain('input:');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`classic is pixel-stable: AUDIT30-B shared variants gallery (${scheme})`, async ({ page }, info) => {
    await register(page, scheme);
    await mountGallery(page);
    await settlePage(page);
    const file = `audit30b-gallery-${scheme}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
    if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
    else await expect(page.locator('#b30')).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
  });
}

// the change note's screenshots (1440 / 768 / 375, light and dark): docs/design/evidence/AUDIT30-B-SHARED/
const EVIDENCE = new URL('../../docs/design/evidence/AUDIT30-B-SHARED/', import.meta.url);
test('evidence shots: the gallery at 1440 / 768 / 375, light and dark', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one set of shots');
  test.setTimeout(240_000); // six views, each a fresh app load (a busy runner needed more than the default 60 s)
  fs.mkdirSync(EVIDENCE, { recursive: true });
  for (const scheme of ['light', 'dark'] as const) {
    for (const [w, h] of [[1440, 900], [768, 1024], [375, 812]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await register(page, scheme);
      await mountGallery(page);
      await settlePage(page);
      await page.locator('#b30').screenshot({ path: new URL(`gallery-${scheme}-${w}.png`, EVIDENCE).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
    }
  }
});
