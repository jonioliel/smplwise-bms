// Settings / schedules / automations evidence shots (pilot/SET-polish, 2026-10-10).
// Demo mode, no backend. A vite preview must serve dist/ (default http://127.0.0.1:4815/).
//   node scripts/settings-shots.mjs <outDir> [--set=quick|full] [--base=http://127.0.0.1:4815/]
// quick: classic light (1440 + 390), classic dark 1440, domus light 1440. skins: domus dark, tesla, bubble, tablet 1024 (use --only for a few routes). full: both.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--'));
if (!out) throw new Error('usage: settings-shots.mjs <outDir> [--set=quick|full] [--base=url] [--only=id,id]');
const set = (args.find((a) => a.startsWith('--set=')) ?? '--set=quick').slice(6);
const base = (args.find((a) => a.startsWith('--base=')) ?? '--base=http://127.0.0.1:4815/').slice(7);
const only = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
/** --variants=classic-light-390,domus-light-1440: only those skin-scheme-width cells of the chosen set. */
const variants = (args.find((a) => a.startsWith('--variants=')) ?? '').slice(11).split(',').filter(Boolean);

const ROUTES = [
  { id: 'settings-general', hash: '/system/diagnostics' },
  { id: 'settings-tabs', hash: '/system/diagnostics?tab=tabs' },
  { id: 'settings-media', hash: '/system/diagnostics?tab=media' },
  { id: 'settings-devices', hash: '/system/diagnostics?tab=devices' },
  { id: 'settings-remote', hash: '/system/diagnostics?tab=remote' },
  { id: 'settings-health', hash: '/system/diagnostics?tab=health' },
  { id: 'settings-backup', hash: '/system/diagnostics?tab=backup' },
  { id: 'settings-notifications', hash: '/system/notifications' },
  { id: 'settings-access', hash: '/system/access' },
  { id: 'settings-security', hash: '/system/security' },
  { id: 'settings-audit', hash: '/system/audit' },
  { id: 'settings-storage', hash: '/system/storage' },
  { id: 'settings-update', hash: '/system/update' },
  { id: 'settings-setup', hash: '/system/setup' },
  { id: 'settings-schedules', hash: '/system/schedules' },
  { id: 'settings-automations', hash: '/system/automations' },
  { id: 'settings-multimedia', hash: '/system/multimedia' },
  { id: 'settings-infra', hash: '/system/infra' },
  { id: 'settings-wall', hash: '/system/wall' },
  { id: 'schedules', hash: '/devices/schedules' },
  { id: 'schedules-table', hash: '/devices/schedules?view=table' },
  { id: 'schedules-week', hash: '/devices/schedules?view=week' },
  { id: 'schedule-editor', hash: '/devices/schedules/new/edit' },
  { id: 'automations', hash: '/devices/automations' },
  { id: 'automations-scenes', hash: '/devices/automations/scenes' },
  { id: 'automation-builder', hash: '/devices/automations/new/edit?kind=automation' },
];

const QUICK = [
  { skin: 'classic', scheme: 'light', width: 1440 },
  { skin: 'classic', scheme: 'light', width: 390 },
  { skin: 'classic', scheme: 'dark', width: 1440 },
  { skin: 'domus', scheme: 'light', width: 1440 },
];
const FULL = [
  ...QUICK,
  { skin: 'classic', scheme: 'light', width: 1024 },
  { skin: 'domus', scheme: 'dark', width: 1440 },
  { skin: 'tesla', scheme: 'light', width: 1440 },
  { skin: 'tesla', scheme: 'dark', width: 1440 },
  { skin: 'bubble', scheme: 'light', width: 1440 },
  { skin: 'bubble', scheme: 'dark', width: 390 },
];

/** The other skins on four key screens (kept small: the evidence folder is committed). */
const SKINS = [
  { skin: 'domus', scheme: 'dark', width: 1440 },
  { skin: 'tesla', scheme: 'light', width: 1440 },
  { skin: 'tesla', scheme: 'dark', width: 1440 },
  { skin: 'bubble', scheme: 'light', width: 1440 },
  { skin: 'bubble', scheme: 'dark', width: 390 },
  { skin: 'classic', scheme: 'light', width: 1024 },
];
const matrix = (set === 'full' ? FULL : set === 'skins' ? SKINS : QUICK).filter((v) => !variants.length || variants.includes(`${v.skin}-${v.scheme}-${v.width}`));
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const routes = only.length ? ROUTES.filter((r) => only.includes(r.id)) : ROUTES;
let n = 0;
for (const v of matrix) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.width < 500 ? 844 : v.width < 1100 ? 768 : 900 }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', colorScheme: v.scheme, deviceScaleFactor: 1, isMobile: v.width < 500, hasTouch: v.width < 500 });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-10-01T13:00:00Z'));
  for (const r of routes) {
    const url = `${base}?design=a&look=performance:full&skin=${v.skin}&scheme=${v.scheme}#${r.hash}`;
    try {
      await page.goto('about:blank');
      await page.goto(url);
      await page.waitForSelector('sw-app');
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
      await page.waitForTimeout(900);
      const file = path.join(out, `${r.id}-${v.skin}-${v.scheme}-${v.width}.png`);
      await page.screenshot({ path: file, fullPage: false });
      n++;
    } catch (err) {
      console.error(`FAIL ${r.id} ${v.skin}/${v.scheme}/${v.width}: ${String(err).split('\n')[0]}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(`${n} shots -> ${out}`);
