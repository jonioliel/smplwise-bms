import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// SYS-AUDIT-QUICKFIX-2437 (design audit round 30, the fixes that need no owner decision). Measured in the browser, demo fixtures:
//   finding 3  - dark scheme: the selected tab of the service-calls settings and the selected severity pill of the notification
//                settings were white on white (1:1). Label >= 4.5:1 on its key, key >= 3:1 from its track (WCAG 1.4.3 / 1.4.11).
//   finding 12 - every FILLED sw-badge on the investigation screens reads >= 4.5:1, light and dark ("סגור" 2.54:1, "קריטי" 3.76:1).
//   finding 15 - no operator screen text says "HA" (owner rule: no Home Assistant naming) or "Capability" (English jargon).
//   finding 2  - the glass screens draw their text in the product face (Heebo), not the OS stack.
//   run_smart.py preview <branch> tests/evidence-sys-audit-quickfix-2437.spec.ts --project=desktop --workers=1

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/SYS-AUDIT-QUICKFIX-2437');
type Scheme = 'light' | 'dark';

async function open(page: Page, hash: string, scheme: Scheme) {
  await page.route('**/api/v1/**', (route) => route.abort()); // demo mode whatever runs on the preview's proxy target
  await page.addInitScript((sch) => {
    try {
      localStorage.setItem('sw.demo.automations', JSON.stringify({ user: 'installer', scheme: sch }));
    } catch {
      /* private window */
    }
  }, scheme);
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

/** label / key / track contrast of every visible element matching `sel` (light DOM and every shadow root) */
async function measure(page: Page, sel: string) {
  return page.evaluate((sel) => {
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
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bgOf = (el: Element): C => {
      const chain: Element[] = [];
      for (let e: Element | null = el; e; e = up(e)) chain.push(e);
      let c: C = dark ? { r: 13, g: 18, b: 32, a: 1 } : { r: 245, g: 247, b: 251, a: 1 };
      for (const e of chain.reverse()) {
        const x = parse(getComputedStyle(e).backgroundColor);
        if (x && x.a > 0) c = over(x, c);
      }
      return c;
    };
    const found: Element[] = [];
    const walk = (root: Document | ShadowRoot) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) walk(el.shadowRoot);
        if (el.matches(sel)) found.push(el);
      }
    };
    walk(document);
    return found
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      })
      .map((el) => {
        const bg = bgOf(el);
        const fg = over(parse(getComputedStyle(el).color)!, bg);
        return { what: (el.textContent || el.getAttribute('label') || '').trim().slice(0, 24), label: ratio(fg, bg), track: ratio(bg, bgOf(up(el)!)) };
      });
  }, sel);
}

/** every visible text of the page, shadow roots included */
async function texts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const walk = (root: Document | ShadowRoot | Element) => {
      for (const n of Array.from(root.childNodes)) {
        if (n.nodeType === 3) {
          const t = n.nodeValue?.trim();
          const p = n.parentElement;
          if (t && p && p.getClientRects().length && !['STYLE', 'SCRIPT'].includes(p.tagName)) out.push(t);
        } else if (n.nodeType === 1) {
          const el = n as Element;
          if (el.shadowRoot) walk(el.shadowRoot);
          walk(el);
        }
      }
    };
    walk(document);
    return out;
  });
}

test.describe('finding 3: dark scheme, the selected settings tab / severity pill is readable', () => {
  const CASES: [name: string, hash: string, sel: string][] = [
    ['tickets-settings-tabs', '/system/tickets', "[data-tickets-settings-tabs] button[aria-selected='true']"],
    ['tickets-settings-segments', '/system/tickets?tab=display', ".seg button[aria-pressed='true']"],
    ['notifications-severity', '/system/notifications', ".sevseg button[aria-pressed='true']"],
  ];
  for (const [name, hash, sel] of CASES) {
    test(name, async ({ page }) => {
      await open(page, hash, 'dark');
      const keys = await measure(page, sel);
      console.log(`${name}: ${keys.length} key(s)\n` + keys.map((k) => `  "${k.what}": label ${k.label.toFixed(2)}, track ${k.track.toFixed(2)}`).join('\n'));
      expect(keys.length, `${sel} on ${hash}`).toBeGreaterThan(0);
      for (const k of keys) {
        expect(k.label, `label of "${k.what}"`).toBeGreaterThanOrEqual(4.5);
        expect(k.track, `key "${k.what}" vs its track`).toBeGreaterThanOrEqual(3);
      }
      await shot(page, `dark-${name}`);
    });
  }
});

test.describe('finding 12: filled status badges read >= 4.5:1', () => {
  for (const scheme of ['light', 'dark'] as const)
    for (const hash of ['/investigate/events', '/investigate/cases', '/investigate/incidents']) {
      test(`${hash} ${scheme}`, async ({ page }) => {
        await open(page, hash, scheme);
        const badges = await measure(page, 'sw-badge[filled], span.badge[data-look]');
        console.log(`${hash} ${scheme}: ${badges.length} filled badge(s)\n` + badges.map((b) => `  "${b.what}": ${b.label.toFixed(2)}`).join('\n'));
        for (const b of badges) expect(b.label, `"${b.what}" on ${hash} ${scheme}`).toBeGreaterThanOrEqual(4.5);
        await shot(page, `${scheme}-badges-${hash.split('/').pop()}`);
      });
    }
});

test.describe('finding 15: no "HA" / "Capability" in operator screen text', () => {
  for (const hash of ['/investigate/events', '/investigate/health', '/investigate/incidents', '/investigate/cases', '/live', '/security/alarm']) {
    test(hash, async ({ page }) => {
      await open(page, hash, 'light');
      const bad = (await texts(page)).filter((t) => /(^|[^A-Za-z])HA([^A-Za-z]|$)/.test(t) || /capability/i.test(t));
      expect(bad, hash).toEqual([]);
    });
  }
});

test.describe('finding 2: glass screens use the product face', () => {
  for (const hash of ['/devices/schedules', '/multimedia/screens', '/system/notifications', '/system/tickets']) {
    test(hash, async ({ page }) => {
      await open(page, hash, 'light');
      const fams = await page.evaluate(() => {
        const out: Record<string, number> = {};
        const walk = (root: Document | ShadowRoot) => {
          for (const el of root.querySelectorAll('*')) {
            if (el.shadowRoot) walk(el.shadowRoot);
            const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.nodeValue?.trim());
            if (!own || !el.getClientRects().length || ['STYLE', 'SCRIPT'].includes(el.tagName)) continue;
            const f = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim();
            out[f] = (out[f] ?? 0) + 1;
          }
        };
        walk(document);
        return out;
      });
      console.log(hash, JSON.stringify(fams));
      const os = Object.entries(fams).filter(([f]) => /apple-system|system-ui|BlinkMacSystemFont|Segoe UI/i.test(f));
      expect(os, `${hash}: text in the OS face`).toEqual([]);
      expect(fams['Heebo'] ?? 0, `${hash}: text in Heebo`).toBeGreaterThan(0);
    });
  }
});
