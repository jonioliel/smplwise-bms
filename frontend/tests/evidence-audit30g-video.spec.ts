import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// AUDIT30-G-VIDEO (design audit round 30, branch G: video and investigation). Demo fixtures, every /api/v1 call aborted.
// One regression test per fix:
//   finding 15 (G2, Q10 = א assumed) - no zone id ("Asia/Jerusalem"), "Presets", "Triggers", "NVR", "HA" or "Capability" in the operator
//                copy of camera health, playback, the single camera, the rules (every tab), the events centre and the live event.
//   finding 12 + 6 (G5) - the live event screen draws its status words with sw-badge (no local span.badge) inside sw-page (list and
//                detail), and every filled badge there reads >= 4.5:1.
//   finding 10 (G4, part without branch B) - camera health: rate, frame rate and stream cells are not monospace.
//   finding 5 (G1) - camera health: the recorder card left the page for a drawer; the page still does not scroll at 1366x768.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-audit30g-video.spec.ts --project=desktop

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/changes/evidence/AUDIT30-G-VIDEO');
type Scheme = 'light' | 'dark';

async function open(page: Page, hash: string, scheme: Scheme = 'light') {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(`/?design=a&fit=off&skin=classic&scheme=${scheme}#${hash}`);
  await page.waitForSelector('sw-app');
  if (scheme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(1500);
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, `${name}.png`) });
}

/** Visible text of the screen (every open shadow root), plus attribute copy a person reads (title, aria-label, placeholder). */
async function texts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const walk = (root: Document | ShadowRoot) => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (el.shadowRoot) walk(el.shadowRoot);
        if (['STYLE', 'SCRIPT'].includes(el.tagName)) continue;
        if (!(el as HTMLElement).getClientRects().length) continue;
        for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && n.nodeValue?.trim()) out.push(n.nodeValue.trim());
        for (const a of ['title', 'aria-label', 'placeholder', 'heading', 'subheading', 'label']) {
          const v = el.getAttribute(a);
          if (v?.trim()) out.push(v.trim());
        }
      }
    };
    walk(document);
    return out;
  });
}

const BANNED = [/Asia\/Jerusalem/, /\bPresets?\b/, /\bTriggers?\b/, /(^|[^A-Za-z])NVR([^A-Za-z]|$)/, /(^|[^A-Za-z])HA([^A-Za-z]|$)/, /capability/i];
const bad = (all: string[]) => all.filter((t) => BANNED.some((re) => re.test(t)));

test.describe('finding 15: Hebrew operator copy on the video screens', () => {
  // lead answer Q1 = a (2026-11-12): every operator "NVR" of branch G's screens is "מקליט"; a source guard (no browser) checks the
  // copy paths the demo never draws (writes, errors, live-only rows) in the same files
  test('source guard: no "NVR" in the Hebrew copy of the video and investigation screens', () => {
    const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
    const files = [
      ...fs.readdirSync(path.join(src, 'screens')).filter((f) => /^(live-|investigate-).*\.ts$|^security-alarm\.ts$|^system-devices\.ts$/.test(f)).map((f) => path.join(src, 'screens', f)),
      path.join(src, 'i18n', 'he.ts'),
    ];
    const hits: string[] = [];
    for (const f of files) {
      fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line) || line.includes('DEMO_SOURCE_WORDS')) return;
        const code = line.replace(/\s\/\/\s.*$/, '').replace(/\/\*.*?\*\//g, '');
        if (/[֐-׿]/.test(code) && /(^|[^A-Za-z_-])NVR([^A-Za-z_-]|$)/.test(code)) hits.push(`${path.basename(f)}:${i + 1}`);
      });
    }
    expect(files.length).toBeGreaterThan(10);
    expect(hits).toEqual([]);
  });

  for (const hash of ['/investigate/health', '/investigate/playback', '/investigate/events', '/investigate/incidents', '/investigate/incidents/demo-incident',
    '/live', '/live/wall', '/investigate/cases', '/investigate/search', '/investigate/exports']) {
    test(hash, async ({ page }) => {
      await open(page, hash);
      // the demo health row "NVR (הקלטה)" is fixture data of src/fixtures/catalog.ts (not a branch G file; recorded in the change note)
      expect(bad(await texts(page)).filter((t) => t !== 'NVR (הקלטה)'), hash).toEqual([]);
    });
  }

  test('single camera: the saved positions chip and the source time', async ({ page }) => {
    await open(page, '/live/cameras/cam-4');
    const scr = page.locator('sw-app live-camera');
    await expect(scr).toBeAttached();
    const all = await texts(page);
    expect(all.filter((t) => /\bPresets?\b|Asia\/Jerusalem/.test(t))).toEqual([]);
    const presets = scr.locator('sw-chip[icon="bookmark"]');
    if (await presets.count()) await expect(presets).toHaveText('מיקומים שמורים');
  });

  test('rules: every tab', async ({ page }) => {
    await open(page, '/investigate/rules');
    const scr = page.locator('sw-app investigate-rules');
    const tabs = scr.locator('sw-tabs');
    await expect(tabs).toBeAttached();
    for (const id of ['rules', 'notif', 'sched', 'trig']) {
      // the tab state of the screen (sw-tabs drives the same field)
      await page.evaluate((id) => {
        (document.querySelector('sw-app')!.shadowRoot!.querySelector('investigate-rules') as unknown as { tab: string }).tab = id;
      }, id);
      await page.waitForTimeout(200);
      expect(bad(await texts(page)).filter((t) => !/^(Push|Beta)$/.test(t)), `rules tab ${id}`).toEqual([]);
    }
    expect((await texts(page)).some((t) => t.includes('מפעילים'))).toBe(true);
  });
});

test.describe('finding 12 / 6: the live event screen uses sw-page and sw-badge', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const hash of ['/investigate/incidents', '/investigate/incidents/demo-incident']) {
      test(`${hash} ${scheme}`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await open(page, hash, scheme);
        const scr = page.locator('sw-app investigate-incidents');
        await expect(scr.locator('sw-page')).toHaveCount(1);
        const r = await page.evaluate(() => {
          const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('investigate-incidents')!.shadowRoot!;
          const local = root.querySelectorAll('span.badge, .badge:not(sw-badge)').length;
          const own = root.querySelectorAll('h1').length;
          const page = root.querySelector('sw-page')!;
          const h1 = page.shadowRoot!.querySelector('h1');
          const badges = [...root.querySelectorAll<HTMLElement>('sw-badge[filled]')].filter((b) => b.getClientRects().length);
          const parse = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number);
          const lum = ([r, g, b]: number[]) => {
            const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          const ratios = badges.map((b) => {
            const cs = getComputedStyle(b);
            const [x, y] = [lum(parse(cs.color)), lum(parse(cs.backgroundColor))];
            return { t: b.getAttribute('label'), ratio: (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05), alpha: parse(cs.backgroundColor)[3] ?? 1 };
          });
          return { local, own, h1: h1?.textContent?.trim() ?? '', ratios };
        });
        expect(r.local, 'no local span.badge').toBe(0);
        expect(r.own, 'no own <h1>: the title is sw-page\'s').toBe(0);
        expect(r.h1.length).toBeGreaterThan(0);
        expect(r.ratios.length).toBeGreaterThan(0);
        for (const b of r.ratios.filter((x) => x.alpha === 1)) expect(b.ratio, `"${b.t}" ${scheme}`).toBeGreaterThanOrEqual(4.5);
        if (hash.endsWith('demo-incident')) await expect(scr.locator('sw-badge[data-incident-status]')).toBeVisible();
        await shot(page, `incidents-${hash.endsWith('incident') ? 'detail' : 'list'}-${scheme}-1440`);
      });
    }
  }

  for (const s of [{ w: 1366, h: 768 }, { w: 390, h: 844 }]) {
    test(`no page scroll ${s.w}x${s.h}`, async ({ page }) => {
      await page.setViewportSize({ width: s.w, height: s.h });
      for (const hash of ['/investigate/incidents', '/investigate/incidents/demo-incident']) {
        await open(page, hash);
        const over = await page.evaluate(() => { const m = document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!; return m.scrollHeight - m.clientHeight; });
        expect(over, `${hash} ${s.w}x${s.h}`).toBeLessThanOrEqual(1);
        await shot(page, `incidents-${hash.endsWith('incident') ? 'detail' : 'list'}-light-${s.w}`);
      }
    });
  }
});

test.describe('finding 10 / 5: camera health', () => {
  test('measured values are not monospace; the recorder facts are a drawer', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/investigate/health');
    const scr = page.locator('sw-app system-devices');
    await expect(scr.locator('sw-table')).toBeAttached();
    const fam = await page.evaluate(() => {
      const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('system-devices')!.shadowRoot!;
      const t = root.querySelector('sw-table')!.shadowRoot!;
      const cells = [...t.querySelectorAll<HTMLElement>('[data-health-num]')];
      const tds = [...t.querySelectorAll<HTMLElement>('td.ltr')];
      return { n: cells.length, mono: cells.filter((c) => /mono/i.test(getComputedStyle(c).fontFamily)).length, ltrTd: tds.length,
        dir: cells.every((c) => getComputedStyle(c).direction === 'ltr') };
    });
    expect(fam.n, 'rate / frame rate / stream cells').toBeGreaterThan(0);
    expect(fam.mono, 'no monospace numbers').toBe(0);
    expect(fam.ltrTd, 'no monospace ltr column').toBe(0);
    expect(fam.dir, 'each value is its own left-to-right isolate').toBe(true);
    await expect(scr.locator('sw-card')).toHaveCount(0);
    await scr.locator('[data-health-recorder-open]').click();
    const drawer = scr.locator('[data-health-recorder-drawer]');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('[data-health-recorder]')).toContainText('קושחה');
    await shot(page, 'health-recorder-drawer-light-1440');
  });

  for (const s of [{ w: 1366, h: 768 }, { w: 1440, h: 900 }]) {
    test(`no page scroll ${s.w}x${s.h}`, async ({ page }) => {
      await page.setViewportSize({ width: s.w, height: s.h });
      await open(page, '/investigate/health');
      await expect(page.locator('sw-app system-devices sw-table')).toBeAttached();
      await page.waitForTimeout(400);
      const over = await page.evaluate(() => { const m = document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!; return m.scrollHeight - m.clientHeight; });
      expect(over).toBeLessThanOrEqual(1);
      await shot(page, `health-light-${s.w}`);
    });
  }
});
