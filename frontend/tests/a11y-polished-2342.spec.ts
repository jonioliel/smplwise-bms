import { test, expect, type Page } from '@playwright/test';

// A11Y-POLISHED-2342: the browser half of the accessibility pass (docs/changes/A11Y-POLISHED-2342.md); the static half is
// tests/unit-a11y-polished-lint.spec.ts. Throwaway elements are mounted on the style guide (demo data, no backend), as in
// tests/a11y-dialog-focus-2310.spec.ts:
//   - a confirmation opened over a dialog: Escape closes the top one only, a second Escape the one below;
//   - sw-popover: Escape inside the card closes it and gives the focus back to where it came from;
//   - sw-field: the slotted control is named by the field's label (the label sits in the shadow root and was never associated).
//   npm run build, then SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/a11y-polished-2342.spec.ts --workers=1

async function styleguide(page: Page) {
  await page.goto('about:blank');
  await page.goto('/?design=a#/styleguide');
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(800);
}

const deepActiveId = (page: Page) =>
  page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return (a as HTMLElement | null)?.id || a?.tagName || '';
  });

test('stacked dialogs: Escape closes only the top one', async ({ page }) => {
  await styleguide(page);
  await page.evaluate(() => {
    type Dlg = HTMLElement & { open: boolean; heading: string };
    const outer = document.createElement('sw-dialog') as Dlg;
    outer.id = 'a11y-outer';
    outer.heading = 'חיצוני';
    outer.innerHTML = '<button id="o-btn">פעולה</button>';
    document.body.append(outer);
    outer.open = true;
    const inner = document.createElement('sw-dialog') as Dlg;
    inner.id = 'a11y-inner';
    inner.heading = 'אישור';
    inner.innerHTML = '<button id="i-btn">אישור</button>';
    setTimeout(() => {
      document.body.append(inner);
      inner.open = true;
    }, 200);
  });
  await page.waitForTimeout(600);
  const open = () => page.evaluate(() => ['a11y-outer', 'a11y-inner'].map((id) => (document.getElementById(id) as unknown as { open: boolean }).open));
  expect(await open()).toEqual([true, true]);
  await page.keyboard.press('Escape');
  await expect.poll(open).toEqual([true, false]);
  await page.keyboard.press('Escape');
  await expect.poll(open).toEqual([false, false]);
});

test('sw-popover: Escape inside the card closes it and the focus goes back to the opener', async ({ page }) => {
  await styleguide(page);
  // the style guide's chunk defines <sw-popover> (the screens are lazy chunks since PERF-HOME-DEVICES-2342, 2.34.2)
  await page.waitForFunction(() => !!customElements.get('sw-popover'));
  await page.evaluate(() => {
    const opener = document.createElement('button');
    opener.id = 'pop-opener';
    opener.textContent = 'open';
    opener.style.cssText = 'position:fixed;inset-block-start:4px;inset-inline-start:4px;z-index:5';
    const stage = document.createElement('div');
    stage.style.cssText = 'position:fixed;inset-block-start:60px;inset-inline-start:60px;inline-size:600px;block-size:400px';
    const pop = document.createElement('sw-popover') as HTMLElement & { heading: string };
    pop.id = 'a11y-pop';
    pop.heading = 'כרטיס';
    pop.innerHTML = '<button id="pop-in">פעולה</button>';
    pop.addEventListener('close', () => pop.remove());
    stage.append(pop);
    document.body.append(opener, stage);
    opener.focus();
  });
  // the card's slot exists after its first render: only then is the slotted button rendered and focusable
  await page.waitForFunction(() => !!document.getElementById('a11y-pop')?.shadowRoot?.querySelector('slot'));
  await page.evaluate(() => (document.getElementById('pop-in') as HTMLElement).focus());
  expect(await deepActiveId(page)).toBe('pop-in');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => !!document.getElementById('a11y-pop'))).toBe(false);
  await expect.poll(() => deepActiveId(page)).toBe('pop-opener');
});

test('sw-field names its slotted control with its label', async ({ page }) => {
  await styleguide(page);
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset-block-start:60px;inset-inline-start:60px;z-index:5;background:#fff;padding:8px';
    host.innerHTML =
      '<sw-field label="שם המצלמה"><input id="f-in"></sw-field>' +
      '<sw-field label="סוג"><select id="f-sel"><option>א</option></select></sw-field>' +
      '<sw-field label="תווית"><input id="f-own" aria-label="שם משלו"></sw-field>';
    document.body.append(host);
  });
  await expect(page.getByRole('textbox', { name: 'שם המצלמה' })).toHaveCount(1);
  await expect(page.getByRole('combobox', { name: 'סוג' })).toHaveCount(1);
  // a name the screen gave its control is kept
  await expect(page.locator('#f-own')).toHaveAttribute('aria-label', 'שם משלו');
});

// CR-MODAL-STACK-2441 (code review 07:F13): the three modal primitives share one stack (components/modal-stack.ts), so the rule of the
// first test holds across them - one Escape press closes one layer, the top one.
type Layer = HTMLElement & { open: boolean; heading: string; kind?: string; modal?: boolean };
const openOf = (page: Page, ids: string[]) => page.evaluate((list) => list.map((id) => (document.getElementById(id) as unknown as { open: boolean }).open), ids);

test('a confirmation over a sheet: Escape closes the dialog only, a second press closes the sheet', async ({ page }) => {
  await styleguide(page);
  await page.waitForFunction(() => !!customElements.get('sw-sheet') && !!customElements.get('sw-dialog'));
  await page.evaluate(() => {
    const sheet = document.createElement('sw-sheet') as Layer;
    sheet.id = 'ms-sheet';
    sheet.kind = 'centred';
    sheet.heading = 'גיליון';
    sheet.innerHTML = '<button id="ms-s-btn">מחק</button>';
    document.body.append(sheet);
    sheet.open = true;
    // the confirmation is NOT inside the sheet (the screen renders it beside it, as screens/devices-area.ts does)
    const dlg = document.createElement('sw-dialog') as Layer;
    dlg.id = 'ms-confirm';
    dlg.heading = 'אישור';
    dlg.innerHTML = '<button id="ms-c-btn">אישור</button>';
    setTimeout(() => {
      document.body.append(dlg);
      dlg.open = true;
    }, 200);
  });
  await page.waitForTimeout(600);
  const ids = ['ms-sheet', 'ms-confirm'];
  expect(await openOf(page, ids)).toEqual([true, true]);
  await page.keyboard.press('Escape');
  await expect.poll(() => openOf(page, ids)).toEqual([true, false]);
  // it stays open: the same press did not reach the sheet late
  await page.waitForTimeout(300);
  expect(await openOf(page, ids)).toEqual([true, false]);
  await page.keyboard.press('Escape');
  await expect.poll(() => openOf(page, ids)).toEqual([false, false]);
});

test('the listener order does not matter: a sheet opened over a dialog closes first, the dialog on the second press', async ({ page }) => {
  await styleguide(page);
  await page.waitForFunction(() => !!customElements.get('sw-sheet') && !!customElements.get('sw-dialog'));
  await page.evaluate(() => {
    // the sheet is in the page first (its key listener runs first) and ends as the top layer: when the top layer closes inside its
    // listener, the layer below (whose listener runs next, on the same press) must not close too
    const sheet = document.createElement('sw-sheet') as Layer;
    sheet.id = 'ms-sheet2';
    sheet.kind = 'centred';
    sheet.heading = 'בחירה';
    sheet.innerHTML = '<button id="ms-s2-btn">בחר</button>';
    const dlg = document.createElement('sw-dialog') as Layer;
    dlg.id = 'ms-dlg2';
    dlg.heading = 'טופס';
    dlg.innerHTML = '<button id="ms-d2-btn">פתח</button>';
    document.body.append(sheet, dlg);
    sheet.open = true;
    setTimeout(() => {
      // the sheet leaves the stack and opens again: it is now above the dialog, while its listener is still the older one
      dlg.open = true;
      setTimeout(() => {
        sheet.open = false;
        setTimeout(() => (sheet.open = true), 50);
      }, 100);
    }, 100);
  });
  await page.waitForTimeout(800);
  const ids = ['ms-dlg2', 'ms-sheet2'];
  expect(await openOf(page, ids)).toEqual([true, true]);
  await page.keyboard.press('Escape');
  await expect.poll(() => openOf(page, ids)).toEqual([true, false]);
  await page.waitForTimeout(300);
  expect(await openOf(page, ids)).toEqual([true, false]);
  await page.keyboard.press('Escape');
  await expect.poll(() => openOf(page, ids)).toEqual([false, false]);
});

test('a modal drawer: a sheet or a confirmation inside it takes Escape first, the drawer closes on the last press', async ({ page }) => {
  await styleguide(page);
  await page.waitForFunction(() => !!customElements.get('sw-sheet') && !!customElements.get('sw-dialog') && !!customElements.get('sw-drawer'));
  await page.evaluate(() => {
    const drawer = document.createElement('sw-drawer') as Layer;
    drawer.id = 'ms-drawer';
    drawer.modal = true;
    drawer.heading = 'מגירה';
    drawer.innerHTML = '<button id="ms-dr-btn">פעולה</button>';
    // inside the drawer: everything outside a modal drawer is inert
    const sheet = document.createElement('sw-sheet') as Layer;
    sheet.id = 'ms-dr-sheet';
    sheet.kind = 'centred';
    sheet.heading = 'גיליון';
    sheet.innerHTML = '<button id="ms-drs-btn">בחר</button>';
    const dlg = document.createElement('sw-dialog') as Layer;
    dlg.id = 'ms-dr-confirm';
    dlg.heading = 'אישור';
    dlg.innerHTML = '<button id="ms-drc-btn">אישור</button>';
    drawer.append(sheet, dlg);
    document.body.append(drawer);
    drawer.open = true;
    setTimeout(() => (sheet.open = true), 200);
    setTimeout(() => (dlg.open = true), 400);
  });
  await page.waitForTimeout(900);
  const ids = ['ms-drawer', 'ms-dr-sheet', 'ms-dr-confirm'];
  expect(await openOf(page, ids)).toEqual([true, true, true]);
  await page.keyboard.press('Escape');
  await expect.poll(() => openOf(page, ids)).toEqual([true, true, false]);
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await expect.poll(() => openOf(page, ids)).toEqual([true, false, false]);
  await page.waitForTimeout(300);
  expect(await openOf(page, ids)).toEqual([true, false, false]);
  await page.keyboard.press('Escape');
  await expect.poll(() => openOf(page, ids)).toEqual([false, false, false]);
});

test('single layers are as before: one Escape closes a sheet, and one closes a modal drawer', async ({ page }) => {
  await styleguide(page);
  await page.waitForFunction(() => !!customElements.get('sw-sheet') && !!customElements.get('sw-drawer'));
  await page.evaluate(() => {
    const sheet = document.createElement('sw-sheet') as Layer;
    sheet.id = 'ms-one-sheet';
    sheet.kind = 'centred';
    sheet.heading = 'גיליון';
    sheet.innerHTML = '<button>פעולה</button>';
    document.body.append(sheet);
    sheet.open = true;
  });
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await expect.poll(() => openOf(page, ['ms-one-sheet'])).toEqual([false]);
  await page.evaluate(() => {
    document.getElementById('ms-one-sheet')!.remove();
    const drawer = document.createElement('sw-drawer') as Layer;
    drawer.id = 'ms-one-drawer';
    drawer.modal = true;
    drawer.heading = 'מגירה';
    drawer.innerHTML = '<button>פעולה</button>';
    document.body.append(drawer);
    drawer.open = true;
  });
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await expect.poll(() => openOf(page, ['ms-one-drawer'])).toEqual([false]);
  // a layer that was removed from the page while open does not keep the key: a dialog opened afterwards closes on one press
  await page.evaluate(() => {
    const ghost = document.createElement('sw-sheet') as Layer;
    ghost.kind = 'centred';
    ghost.innerHTML = '<button>x</button>';
    document.body.append(ghost);
    ghost.open = true;
    setTimeout(() => {
      ghost.remove();
      const dlg = document.createElement('sw-dialog') as Layer;
      dlg.id = 'ms-after';
      dlg.heading = 'אחרי';
      dlg.innerHTML = '<button>אישור</button>';
      document.body.append(dlg);
      dlg.open = true;
    }, 200);
  });
  await page.waitForTimeout(600);
  expect(await openOf(page, ['ms-after'])).toEqual([true]);
  await page.keyboard.press('Escape');
  await expect.poll(() => openOf(page, ['ms-after'])).toEqual([false]);
});
