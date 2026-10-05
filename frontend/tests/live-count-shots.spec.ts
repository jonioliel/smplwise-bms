import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { mockWall, openWall } from './wall-count-mock';

// LV1 evidence only (no assertions): the wall's toolbar before / after. SW_SHOTS=<dir> SHOT_TAG=before|after. The same file runs on
// origin/main (before) and on the branch (after).
const SHOTS = process.env.SW_SHOTS ?? '';
const TAG = process.env.SHOT_TAG ?? 'after';

test('wall toolbar shots', async ({ page }, info) => {
  test.skip(!SHOTS, 'SW_SHOTS not set');
  await mockWall(page, { count: '12' });
  await openWall(page, 12);
  await page.waitForTimeout(800);
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${TAG}-${info.project.name}-12.png`) });
});
