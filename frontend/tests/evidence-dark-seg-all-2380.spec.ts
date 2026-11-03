import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// DARK-SEG-ALL-2380 (owner-approved 03.11, WCAG 1.4.11): in the dark scheme the CHOSEN key of every segmented control is at least
// 3:1 from its track and its label at least 4.5:1 on it - measured in the browser on the computed colours (the unit spec
// tests/unit-dark-polish-beds.spec.ts evaluates the same CSS per skin; this is the receipt that the page draws what the CSS says).
// One screen per family of the controls that moved onto --sw-seg-key / --sw-seg-key-ink. Backgrounds are composited through every
// ancestor (shadow hosts included). The light scheme is the pixel suites' business (its baselines did not move).
//   run_smart.py preview <branch> tests/evidence-dark-seg-all-2380.spec.ts --project=desktop --project=mobile --workers=1

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/DARK-SEG-ALL-2380');
type Info = { project: { name: string } };

async function shot(page: Page, name: string, info: Info) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) });
}

const clocked = new WeakSet<Page>();
async function openDark(page: Page, hash: string) {
  await page.route('**/api/v1/**', (route) => route.abort()); // demo mode whatever runs on the preview's proxy target
  if (!clocked.has(page)) {
    clocked.add(page);
    await page.clock.install({ time: new Date('2026-10-23T09:00:00Z') });
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('about:blank');
  await page.goto(`/?design=a&fit=off&scheme=dark#${hash}`);
  await page.waitForSelector('sw-app');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(1200);
}

/** the chosen keys of the segmented controls on the page (light DOM and every shadow root) with their label / track contrast */
async function chosenKeys(page: Page) {
  return page.evaluate(() => {
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
    const ratio = (x: C, y: C) => {
      const [a, b] = [lum(x), lum(y)];
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    };
    const up = (el: Element): Element | null => el.parentElement ?? ((el.parentNode as ShadowRoot | null)?.host ?? null);
    const bgOf = (el: Element): C => {
      const chain: Element[] = [];
      for (let e: Element | null = el; e; e = up(e)) chain.push(e);
      let c: C = { r: 0, g: 0, b: 0, a: 1 };
      for (const e of chain.reverse()) {
        const x = parse(getComputedStyle(e).backgroundColor);
        if (x && x.a > 0) c = over(x, c);
      }
      return c;
    };
    // the chosen keys DARK-SEG-ALL-2380 moved (the inventory of tests/unit-dark-polish-beds.spec.ts), outside a glass host
    const KEYS = [
      ".seg button[aria-pressed='true']", ".seg button[aria-selected='true']", ".seg button[aria-checked='true']", '.seg button.on',
      '.segt button.on', '.vw button.on', ".vw button[aria-pressed='true']", ".lay-seg button[aria-pressed='true']",
      ".tabs button[aria-pressed='true']", ".tabs button[aria-selected='true']", ".tab[aria-current='page']",
      '.rangepick button.on', ".ptabs button[aria-pressed='true']", ".panes button[aria-selected='true']",
      ".rolepick button[aria-pressed='true']", '.windows button.on', '.transport button.on', ".vt button[aria-pressed='true']",
      ".bswitch button[aria-pressed='true']", ".layers button[aria-selected='true']", 'nav.sections a.on',
      ".pfl .segs button[aria-pressed='true']",
    ].join(', ');
    const found: { el: Element; host: string }[] = [];
    const walk = (root: Document | ShadowRoot) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) walk(el.shadowRoot);
        const host = (root as ShadowRoot).host;
        if (el.matches(KEYS)) found.push({ el, host: host?.tagName.toLowerCase() ?? 'doc' });
        // sw-tabs' pill: the chosen label inside the .on tab
        if (host?.tagName === 'SW-TABS' && host.getAttribute('data-variant') === 'pill' && el.matches('.on .lbl')) found.push({ el, host: 'sw-tabs[pill]' });
      }
    };
    walk(document);
    return found
      .filter(({ el }) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[data-devices-style="glass"]');
      })
      .map(({ el: hit, host }) => {
        // sw-app's phone security row draws the chosen key on the label's .pill inside a transparent link: measure the pill
        const pill = hit.querySelector(':scope > .pill');
        const el = pill && (parse(getComputedStyle(pill).backgroundColor)?.a ?? 0) > 0 ? pill : hit;
        const bg = bgOf(el);
        const fg = over(parse(getComputedStyle(el).color)!, bg);
        const track = bgOf(up(el)!);
        return { what: `${host} .${(el.parentElement?.className || '').toString().slice(0, 24)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 16)}"`, label: ratio(fg, bg), track: ratio(bg, track) };
      });
  });
}

const SCREENS: [name: string, hash: string][] = [
  ['settings-look', '/system/diagnostics?tab=general'],
  ['settings-update', '/system/update'],
  ['settings-readiness', '/system/readiness'],
  ['security-alarm', '/security/alarm'],
  ['investigate-events', '/investigate/events'],
  ['investigate-reviews', '/investigate/reviews'],
  ['investigate-incidents', '/investigate/incidents'],
  ['calendars', '/calendars/cal'],
  ['devices-building', '/devices/building'],
  ['explore-presence', '/explore/presence'],
];

test.describe('DARK-SEG-ALL-2380: dark scheme, the chosen segment is 3:1 from its track and its label 4.5:1', () => {
  for (const [name, hash] of SCREENS) {
    test(name, async ({ page }, info) => {
      await openDark(page, hash);
      const keys = await chosenKeys(page);
      console.log(`${name}/${info.project.name}: ${keys.length} chosen key(s)\n` + keys.map((k) => `  ${k.what}: label ${k.label.toFixed(2)}, track ${k.track.toFixed(2)}`).join('\n'));
      for (const k of keys) {
        expect(k.label, `label of ${k.what}`).toBeGreaterThanOrEqual(4.5);
        expect(k.track, `chosen ${k.what} vs its track`).toBeGreaterThanOrEqual(3);
      }
      await shot(page, `dark-${name}`, info);
    });
  }
});
