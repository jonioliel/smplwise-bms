import { test } from '@playwright/test';
import fs from 'node:fs';
import { contrastProbe, overflowProbe } from './probe-uxrest-295';

// UXREST-295 audit driver (exploratory; writes docs/design/evidence/UXREST-295/audit-<mode>-<project>-<phase>.json). Demo data, no backend.
//   UX_MODE=dark|zoom  UX_PHASE=before|after  UX_ROUTES=/a,/b
const ROUTES = (process.env.UX_ROUTES || '/,/live,/live/wall,/explore/sites,/explore/floors/f0,/devices/building,/devices/schedules,/devices/automations,/investigate/events,/investigate/playback,/security/alarm,/multimedia/players,/multimedia/screens,/tickets/mine,/tickets/board,/tickets/rfqs,/infra/electricity/meters,/infra/generator/live,/system/access,/system/notifications,/system/setup,/system/diagnostics,/system/tickets,/system/security/cameras,/system/messaging-accounts,/wiskey/overview,/wiskey/people,/styleguide').split(',');
const MODE = process.env.UX_MODE || 'dark';
const PHASE = process.env.UX_PHASE || 'before';
const OUT = '../docs/design/evidence/UXREST-295';

test(`audit ${MODE}`, async ({ page }, info) => {
  test.setTimeout(900_000);
  const res: Record<string, unknown> = {};
  if (MODE === 'zoom') await page.setViewportSize(info.project.name === 'mobile' ? { width: 195, height: 422 } : { width: 720, height: 450 });
  for (const r of ROUTES) {
    await page.goto('about:blank');
    await page.goto(`/?design=a${MODE === 'dark' ? '&scheme=dark' : ''}#${r}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1800);
    if (MODE === 'dark') {
      const c = await contrastProbe(page);
      res[r] = { n: c.n, fails: c.fails.length, top: c.fails.slice(0, 15) };
    } else if (MODE === 'zoom') res[r] = await overflowProbe(page);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(`${OUT}/audit-${MODE}-${info.project.name}-${PHASE}.json`, JSON.stringify(res, null, 1));
});
