import type { Locator } from '@playwright/test';

/** AUDIT30-H2 (design audit round 30, #16): the WisKey screens' choice lists are <sw-dropdown>, no native <select>. Pick an option
 * by its id whichever the control is (a native select still answers selectOption): open the chip, press the option. */
export async function pickOption(el: Locator, id: string): Promise<void> {
  const tag = await el.evaluate((n) => n.localName);
  if (tag === 'select') {
    await el.selectOption(id);
    return;
  }
  await el.locator('[data-dropdown-chip]').click();
  await el.locator(`[role="option"][data-id="${id}"]`).click();
}

/** The chosen id of a <sw-dropdown> (its `value` property), for `expect.poll`. */
export const ddValue = (el: Locator): Promise<string> => el.evaluate((n) => (n as HTMLElement & { value: string }).value);
