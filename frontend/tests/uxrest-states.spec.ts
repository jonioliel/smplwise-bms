import { test } from '@playwright/test';
import fs from 'node:fs';

// UXREST-295: loading / API error / offline states, exploratory driver. No backend: every api/v1 call hangs (loading), answers 500 (error)
// or fails at the network (offline). Records the visible text of each screen and what looks like a raw technical string.
//   UX_PHASE=before|after  UX_ROUTES=/a,/b   shots -> docs/design/evidence/UXREST-295/states-<phase>/
const ROUTES = (process.env.UX_ROUTES || '/,/live,/explore/sites,/devices/building,/investigate/events,/security/alarm,/tickets/mine,/tickets/board,/infra/electricity/meters,/system/access,/system/notifications,/system/tickets,/wiskey/overview,/wiskey/people,/multimedia/players').split(',');
const PHASE = process.env.UX_PHASE || 'before';
const OUT = `../docs/design/evidence/UXREST-295/states-${PHASE}`;
const RAW = /\b(http_\d{3}|nvr_not_configured|ECONN|Failed to fetch|NetworkError|TypeError|undefined|\[object|null\b|NaN|Internal Server Error|SyntaxError)/;

test('states', async ({ page }, info) => {
  test.setTimeout(900_000);
  fs.mkdirSync(OUT, { recursive: true });
  const res: Record<string, unknown> = {};
  for (const mode of ['loading', 'error', 'offline'] as const) {
    await page.unrouteAll();
    await page.route('**/api/v1/**', async (route) => {
      if (mode === 'loading') return; // never answered
      if (mode === 'offline') return route.abort('internetdisconnected');
      return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'internal_error', user_message: '', retryable: true, correlation_id: 'x', details: {} }) });
    });
    for (const r of ROUTES) {
      await page.goto('about:blank');
      await page.goto(`/#${r}`);
      await page.waitForSelector('sw-app');
      await page.waitForTimeout(mode === 'loading' ? 2500 : 3500);
      const d = await page.evaluate(() => {
        const texts: string[] = [];
        let panels = 0, alerts = 0, busy = 0;
        const walk = (root: ParentNode) => {
          for (const el of Array.from(root.querySelectorAll('*'))) {
            if (el.tagName === 'SW-STATE-PANEL') panels++;
            if (el.getAttribute('role') === 'alert' || el.getAttribute('role') === 'status') alerts++;
            if (el.getAttribute('aria-busy') === 'true') busy++;
            if (el.shadowRoot) walk(el.shadowRoot);
          }
        };
        walk(document);
        const grab = (root: ParentNode) => {
          for (const el of Array.from(root.querySelectorAll('*'))) {
            if (el.shadowRoot) grab(el.shadowRoot);
            for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && n.textContent?.trim()) texts.push(n.textContent.trim());
          }
        };
        grab(document);
        return { panels, alerts, busy, texts: texts.slice(0, 80), h1: document.querySelectorAll('h1').length };
      });
      const raw = d.texts.filter((t) => RAW.test(t));
      res[`${mode} ${r}`] = { panels: d.panels, alerts: d.alerts, busy: d.busy, nTexts: d.texts.length, raw, sample: d.texts.filter((t) => t.length > 3).slice(0, 14) };
      await page.screenshot({ path: `${OUT}/${mode}-${r.replace(/\//g, '_') || 'home'}-${info.project.name}.png` });
    }
  }
  fs.writeFileSync(`${OUT}/states-${info.project.name}.json`, JSON.stringify(res, null, 1));
});
