import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installDiscovery, newDiscoveryMock, openApp } from './camera-discovery-mocks';

// ONVIF-UI-2500: the before / after capture of the entry point - הגדרות › אבטחה › NVR, the "מצלמות ללא מקליט" card - on the mocked
// backend of tests/camera-discovery-mocks.ts. Run once against a build of the base branch (SW_ONVIF_TAG=before) and once against this
// branch (SW_ONVIF_TAG=after); the wizard's own steps are captured by tests/camera-discovery-2500.spec.ts (SW_ONVIF_SHOTS).
//   SW_ONVIF_SHOTS=<dir> SW_ONVIF_TAG=before|after SW_BASE_URL=http://127.0.0.1:<port>/ \
//     npx playwright test tests/evidence-onvif-ui-2500.spec.ts --project=desktop --project=mobile
// Skipped without SW_ONVIF_SHOTS.

const DIR = process.env.SW_ONVIF_SHOTS ?? '';
const TAG = process.env.SW_ONVIF_TAG ?? 'after';

test('the NVR page card (entry point)', async ({ page }, info) => {
  test.skip(!DIR, 'capture only (SW_ONVIF_SHOTS)');
  await installDiscovery(page, newDiscoveryMock());
  await openApp(page, '/system/security/nvr');
  await expect(page.locator('[data-standalone-cameras]')).toBeVisible();
  await page.waitForTimeout(1200);
  await page.locator('[data-standalone-cameras]').scrollIntoViewIfNeeded();
  fs.mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: path.join(DIR, `${TAG}-entry-${info.project.name}.png`) });
});
