import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { settle } from './helpers/settle';

// SHARED-CHECKBOX-2480: the shared selection check box `sw-checkbox` (components/sw-checkbox.ts). A specimen sheet drawn with the app's
// tokens - the states, a rich label with a link, a box inside a screen's own <label>, a recipients list under a select-all box, a dense
// table row with a smaller box (the size knob), a long label, an English block - light and dark, classic skin, demo fixtures.
// Titles carry "pixel-stable" (the gate's pixel lane). Baselines are per OS: the Linux ones are generated on the runner with
// --update-snapshots, looked at, then committed; on an OS without a baseline the check is skipped instead of failing on a missing file.
// No baseline is committed yet (SHARED-CHECKBOX-2480 was built while the runner was held by the 2.47.0 gate):
//   run_smart.py preview <branch> tests/pixel-sw-checkbox.spec.ts --project=desktop --project=mobile -u --workers=1 --machine runner
// SW_CHECK_COMPARE_DIR=<dir> also writes the owner's comparison shots (native box vs sw-checkbox, every selectable skin, light and dark).

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

type Seen = { checked: boolean; value: string; id: string };
type Win = Window & { checksSeen: Seen[] };

async function specimen(page: Page, scheme: 'light' | 'dark', opts: { skin?: string; native?: boolean } = {}) {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.goto(`/?design=a&fit=off&look=performance:full&skin=${opts.skin ?? 'classic'}&scheme=${scheme}#/investigate/events`);
  await page.waitForSelector('sw-app');
  await page.waitForFunction(() => !!customElements.get('sw-checkbox'), undefined, { timeout: 30_000 });
  await page.evaluate((native) => {
    const w = window as unknown as Win;
    w.checksSeen = [];
    const sheet = document.createElement('div');
    sheet.setAttribute('data-check-specimen', '');
    sheet.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;overflow:hidden;padding:20px 16px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;' +
      'align-items:flex-start;background:var(--sw-surface-solid);color:var(--sw-text);font-family:var(--sw-font, inherit);font-size:var(--sw-fs-base);';
    const row = (into: HTMLElement = sheet, css = '') => {
      const r = document.createElement('div');
      r.style.cssText = `display:flex;flex-wrap:wrap;align-items:center;gap:10px 22px;max-inline-size:100%;${css}`;
      into.append(r);
      return r;
    };
    const cap = (text: string, into: HTMLElement = sheet) => {
      const c = document.createElement('div');
      c.textContent = text;
      c.style.cssText = 'font-size:var(--sw-fs-xs);color:var(--sw-text-3);';
      into.append(c);
    };
    type Opts = { label?: string; checked?: boolean; indeterminate?: boolean; disabled?: boolean; value?: string; id: string; labelHidden?: boolean };
    const box = (o: Opts, into: HTMLElement) => {
      const el = document.createElement('sw-checkbox') as unknown as HTMLElement & Record<string, unknown>;
      if (o.label) el.label = o.label;
      if (o.checked) el.checked = true;
      if (o.indeterminate) el.indeterminate = true;
      if (o.disabled) el.disabled = true;
      if (o.labelHidden) el.labelHidden = true;
      el.value = o.value ?? o.id;
      el.setAttribute('data-spec-check', o.id);
      el.addEventListener('change', (e) => w.checksSeen.push({ ...(e as CustomEvent<{ checked: boolean; value: string }>).detail, id: o.id }));
      into.append(el);
      return el;
    };
    const states: Opts[] = [
      { id: 'off', label: 'לא מסומן' },
      { id: 'on', label: 'מסומן', checked: true },
      { id: 'mixed', label: 'חלקי', indeterminate: true },
      { id: 'off-dis', label: 'מושבת', disabled: true },
      { id: 'on-dis', label: 'מושבת מסומן', checked: true, disabled: true },
    ];
    // 0 (comparison shots only): the native boxes the screens draw today - the 18 px accent box most of them set, and a bare one
    if (native) {
      cap('native <input type="checkbox"> (accent-color, 18 px)');
      const n = row();
      for (const s of states) {
        const l = document.createElement('label');
        l.style.cssText = 'display:inline-flex;align-items:center;gap:8px;font-size:var(--sw-fs-sm);';
        const i = document.createElement('input');
        i.type = 'checkbox';
        i.checked = !!s.checked;
        i.indeterminate = !!s.indeterminate;
        i.disabled = !!s.disabled;
        i.style.cssText = 'inline-size:18px;block-size:18px;margin:0;accent-color:var(--sw-accent);';
        l.append(i, document.createTextNode(s.label!));
        n.append(l);
      }
      cap('native, no styling (the browser default)');
      const b = row();
      for (const s of states.slice(0, 3)) {
        const l = document.createElement('label');
        const i = document.createElement('input');
        i.type = 'checkbox';
        i.checked = !!s.checked;
        i.indeterminate = !!s.indeterminate;
        l.append(i, document.createTextNode(s.label!));
        b.append(l);
      }
      cap('sw-checkbox');
    }
    // 1. the states
    const st = row();
    st.setAttribute('data-spec-row', 'states');
    for (const s of states) box(s, st);
    // 2. a rich label in the slot, with a link that keeps its own press (an acknowledgement)
    const ack = box({ id: 'ack' }, row());
    ack.innerHTML = 'קראתי ואני מאשר/ת את <a href="#terms" data-spec-link>תנאי השימוש</a>';
    // 3. a screen's own <label> row around the box (where a native box sat): its text ticks the box
    const lab = document.createElement('label');
    lab.setAttribute('data-spec-label', '');
    lab.style.cssText = 'display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border:1px solid var(--sw-border);border-radius:var(--sw-r-sm);';
    const inl = box({ id: 'inlabel', label: 'שלח גם בוואטסאפ', labelHidden: true }, lab);
    inl.setAttribute('in-label', '');
    lab.append(document.createTextNode('שלח גם בוואטסאפ'));
    row().append(lab);
    // 4. a selection list: recipients under a select-all box (mixed: two of four)
    const list = document.createElement('div');
    list.setAttribute('data-spec-list', '');
    list.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:10px 12px;border:1px solid var(--sw-border);border-radius:var(--sw-r-md);inline-size:min(100%, 300px);box-sizing:border-box;';
    box({ id: 'all', label: 'כל הנמענים (2 מתוך 4)', indeterminate: true }, list);
    for (const [i, name] of ['יוסי כהן', 'מיכל לוי', 'אבי מזרחי', 'דנה פרץ'].entries()) box({ id: `r${i}`, label: name, checked: i % 2 === 0 }, list);
    sheet.append(list);
    // 5. a dense table row: the size knob (16 px), the box without a visible label (its name is the row's)
    const dense = row(sheet, '--sw-check-size:16px;gap:10px 14px;font-size:var(--sw-fs-sm);');
    dense.setAttribute('data-spec-row', 'dense');
    for (const [i, n] of ['מצלמה 1 - כניסה', 'מצלמה 2 - חניון'].entries()) {
      const cell = document.createElement('span');
      cell.style.cssText = 'display:inline-flex;align-items:center;gap:8px;';
      box({ id: `cam${i}`, label: `בחר ${n}`, labelHidden: true, checked: i === 0 }, cell);
      cell.append(document.createTextNode(n));
      dense.append(cell);
    }
    // 6. a long label wraps inside a narrow box, the box stays at the first line
    const narrow = row(sheet, 'inline-size:min(100%, 260px);');
    box({ id: 'long', label: 'קבלת התראה על כל פתיחה של דלת החירום בקומת המרתף גם מחוץ לשעות הפעילות', checked: true }, narrow);
    // 7. English (left to right): the box on the left
    const ltr = row(sheet);
    ltr.setAttribute('dir', 'ltr');
    ltr.setAttribute('data-spec-row', 'ltr');
    box({ id: 'en1', label: 'Email', checked: true }, ltr);
    box({ id: 'en2', label: 'Push notification' }, ltr);
    box({ id: 'en3', label: 'Some', indeterminate: true }, ltr);
    document.body.append(sheet);
  }, !!opts.native);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

const box = (page: Page, id: string) => page.locator(`[data-check-specimen] sw-checkbox[data-spec-check="${id}"]`);
const seen = (page: Page) => page.evaluate(() => (window as unknown as Win).checksSeen);

test.describe('pixel: sw-checkbox', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-fixture spec');

  for (const scheme of ['light', 'dark'] as const) {
    test(`sw-checkbox specimen ${scheme} is pixel-stable`, async ({ page }, info) => {
      const file = `sw-checkbox-${scheme}.png`; // Playwright adds -<project>-<platform>
      if (noBaseline(info, file)) {
        info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
        test.skip(true, `${file}: no baseline on ${process.platform}`);
      }
      await specimen(page, scheme);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over).toBeLessThanOrEqual(0);
      await expect(page).toHaveScreenshot(file, { animations: 'disabled', maxDiffPixelRatio: 0.002 });
    });
  }

  test('sw-checkbox: a press on the box or its text ticks it once and reports; disabled never moves; a mixed box becomes checked', async ({ page }) => {
    await specimen(page, 'light');
    await box(page, 'off').locator('button').click();
    await expect(box(page, 'off')).toHaveAttribute('checked', '');
    await box(page, 'on').locator('.text').click(); // the text, through the row's <label>
    await expect(box(page, 'on')).not.toHaveAttribute('checked');
    await box(page, 'mixed').locator('button').click();
    await expect(box(page, 'mixed')).toHaveAttribute('checked', '');
    await expect(box(page, 'mixed')).not.toHaveAttribute('indeterminate');
    await box(page, 'off-dis').locator('.text').click({ force: true });
    await box(page, 'on-dis').locator('button').click({ force: true });
    await expect(box(page, 'off-dis')).not.toHaveAttribute('checked');
    await expect(box(page, 'on-dis')).toHaveAttribute('checked', '');
    expect(await seen(page)).toEqual([
      { checked: true, value: 'off', id: 'off' },
      { checked: false, value: 'on', id: 'on' },
      { checked: true, value: 'mixed', id: 'mixed' },
    ]);
  });

  test('sw-checkbox: the checkbox role, aria-checked (mixed included), the name from `label` or from the slot, disabled', async ({ page }) => {
    await specimen(page, 'light');
    const sheet = page.locator('[data-check-specimen]');
    await expect(sheet.getByRole('checkbox', { name: 'מסומן', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(sheet.getByRole('checkbox', { name: 'לא מסומן' })).toHaveAttribute('aria-checked', 'false');
    await expect(sheet.getByRole('checkbox', { name: 'חלקי' })).toHaveAttribute('aria-checked', 'mixed');
    await expect(sheet.getByRole('checkbox', { name: 'מושבת', exact: true })).toBeDisabled();
    // the slotted rich label names the box (through the shadow <label>)
    await expect(sheet.getByRole('checkbox', { name: /קראתי ואני מאשר/ })).toHaveCount(1);
    // labelHidden: the name stays, the text is not drawn twice
    await expect(sheet.getByRole('checkbox', { name: 'בחר מצלמה 1 - כניסה' })).toHaveAttribute('aria-checked', 'true');
    await expect(box(page, 'cam0').locator('.text')).toBeHidden();
    // the drawn mark is decoration
    await expect(box(page, 'on').locator('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  test('sw-checkbox: Space ticks, Enter does not, Tab reaches every enabled box', async ({ page }) => {
    await specimen(page, 'light');
    // host.focus() lands on the box (delegatesFocus)
    expect(await box(page, 'off').evaluate((el) => { (el as HTMLElement).focus(); return el.shadowRoot!.activeElement === el.shadowRoot!.querySelector('button'); })).toBe(true);
    await box(page, 'off').locator('button').focus();
    await expect(box(page, 'off').locator('button')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(box(page, 'off')).toHaveAttribute('checked', '');
    await page.keyboard.press('Enter');
    await expect(box(page, 'off')).toHaveAttribute('checked', '');
    await page.keyboard.press('Space');
    await expect(box(page, 'off')).not.toHaveAttribute('checked');
    await page.keyboard.press('Tab');
    await expect(box(page, 'on').locator('button')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(box(page, 'mixed').locator('button')).toBeFocused();
    await page.keyboard.press('Tab'); // the two disabled boxes are skipped
    await expect(box(page, 'ack').locator('button')).toBeFocused();
    expect((await seen(page)).map((s) => s.checked)).toEqual([true, false]);
  });

  test('sw-checkbox: in-label - the screen\'s own label text ticks it; a link inside a rich label keeps its own press', async ({ page }) => {
    await specimen(page, 'light');
    const lab = page.locator('[data-check-specimen] label[data-spec-label]');
    await lab.click({ position: { x: 20, y: 12 } }); // on the label's own text (RTL: the box is at the start, the right)
    await expect(box(page, 'inlabel')).toHaveAttribute('checked', '');
    await box(page, 'inlabel').locator('button').click(); // the box itself: once, not twice
    await expect(box(page, 'inlabel')).not.toHaveAttribute('checked');
    expect((await seen(page)).filter((s) => s.id === 'inlabel').map((s) => s.checked)).toEqual([true, false]);
    // a press on the link of the rich label follows the link, the box stays
    await page.locator('[data-spec-link]').evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()));
    await page.locator('[data-spec-link]').click();
    await expect(box(page, 'ack')).not.toHaveAttribute('checked');
    await settle(page);
    const t = await box(page, 'ack').locator('.text').boundingBox();
    await box(page, 'ack').locator('.text').click({ position: { x: t!.width - 6, y: 6 } }); // the plain text (RTL: its start, the right) ticks it
    await expect(box(page, 'ack')).toHaveAttribute('checked', '');
  });

  test('sw-checkbox: RTL puts the box at the start (right), LTR at the left; the size knob; a long label wraps beside the box', async ({ page }) => {
    await specimen(page, 'light');
    const r = async (id: string) =>
      box(page, id).evaluate((el) => {
        const b = el.shadowRoot!.querySelector('button')!.getBoundingClientRect();
        const t = el.shadowRoot!.querySelector('.text')!.getBoundingClientRect();
        return { bx: b.x, bw: b.width, bh: b.height, by: b.y, tx: t.x, tw: t.width, th: t.height, ty: t.y };
      });
    const he = await r('on');
    expect(he.bx).toBeGreaterThan(he.tx + he.tw - 1); // the box right of its text
    expect(he.bw).toBe(18);
    expect(he.bh).toBe(18);
    const en = await r('en1');
    expect(en.bx + en.bw).toBeLessThanOrEqual(en.tx + 1); // the box left of its text
    const dense = await r('cam0');
    expect(dense.bw).toBe(16); // --sw-check-size on the row
    // a single line: the box centred on it; a wrapped label: the box on its FIRST line (the same offset from the text's top)
    expect(Math.abs(he.by + he.bh / 2 - (he.ty + he.th / 2))).toBeLessThanOrEqual(1);
    const long = await r('long');
    expect(long.th).toBeGreaterThan(long.bh * 1.5); // wrapped to more lines
    expect(Math.abs(long.by + long.bh / 2 - long.ty - (he.by + he.bh / 2 - he.ty))).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('sw-checkbox: a coarse pointer gets a 44 px tall hit area (block axis only); a fine pointer none', async ({ page }) => {
    await specimen(page, 'light');
    await settle(page);
    const hit = await box(page, 'on').evaluate((el) => {
      const b = el.shadowRoot!.querySelector('button')!;
      const cs = getComputedStyle(b, '::before');
      return { coarse: matchMedia('(pointer: coarse)').matches, content: cs.content, h: parseFloat(cs.height), w: parseFloat(cs.width), bw: b.getBoundingClientRect().width };
    });
    if (hit.coarse) {
      expect(hit.h).toBe(44);
      expect(hit.w).toBe(hit.bw); // no inline growth: nothing overflows sideways
    } else {
      expect(hit.content === 'none' || hit.content === 'normal').toBe(true);
    }
  });

  test('comparison shots for the owner: native box vs sw-checkbox, every selectable skin, light and dark', async ({ page }, info) => {
    const dir = process.env.SW_CHECK_COMPARE_DIR;
    test.skip(!dir || info.project.name !== 'desktop', 'set SW_CHECK_COMPARE_DIR (desktop project) to write the comparison shots');
    test.setTimeout(600_000);
    for (const skin of ['classic', 'domus', 'tesla', 'crystal', 'infra', 'soft']) {
      for (const scheme of ['light', 'dark'] as const) {
        await specimen(page, scheme, { skin, native: true });
        await settle(page);
        // the sheet's content box, not the whole 1440 px viewport
        const clip = await page.locator('[data-check-specimen]').evaluate((s) => {
          let w = 0;
          let h = 0;
          for (const c of Array.from(s.children)) {
            const r = c.getBoundingClientRect();
            w = Math.max(w, window.innerWidth - r.left);
            h = Math.max(h, r.bottom);
          }
          return { x: Math.max(0, window.innerWidth - w - 16), y: 0, width: Math.min(window.innerWidth, w + 16), height: Math.ceil(h + 20) };
        });
        await page.screenshot({ path: path.join(dir!, `check-${skin}-${scheme}.png`), clip, animations: 'disabled' });
      }
    }
  });
});
