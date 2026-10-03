import { test } from '@playwright/test';
import { EL, open, screen, shot } from './electricity-ui';

// The four skins x light / dark on the main electricity screens (desktop project only): the same screens with the product tokens of every skin.
// Screenshots under docs/design/evidence/electricity-ui-bills/ (invented data, mock layer). Needs the Vite DEV server.
const MATRIX = [
  ['accounts', `${EL}/accounts`, 'accounts'],
  ['account', `${EL}/accounts/a1`, 'account'],
  ['bills', `${EL}/bills`, 'bills'],
  ['bill', `${EL}/bills/b104`, 'bill'],
  ['settings-prices', '/system/infra/prices', 'settings-prices'],
] as const;

test.describe('electricity skin matrix', () => {
  for (const skin of ['classic', 'domus', 'tesla', 'bubble'] as const)
    for (const scheme of ['light', 'dark'] as const)
      for (const [name, route, scr] of MATRIX)
        test(`${name} ${skin} ${scheme}`, async ({ page }, info) => {
          test.skip(info.project.name !== 'desktop', 'one project');
          await open(page, route, { skin, scheme });
          await screen(page, scr);
          await shot(page, info, `matrix-${name}-${skin}-${scheme}`, { full: false });
        });
});
