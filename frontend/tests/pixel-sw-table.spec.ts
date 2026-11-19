import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

// CR-CMP2-TABLES-2450 (owner N10): the shared table `sw-table`, pinned on its own - a specimen of the shared cell vocabulary the hand-built
// tables move onto (a t1 / t2 name cell, a number column, a muted column, status chips in every tone, an actions column, a truncated
// column, a selected row) inside a card (`bare`) and as its own card, light and dark, classic skin, no server. The screens that moved
// are pinned by their own shots. Titles carry "pixel-stable" (the gate's pixel lane). Baselines are per OS: the Linux ones are generated
// on the runner with --update-snapshots, looked at, then committed; on an OS without a baseline the check is skipped.
//   run_smart.py preview <branch> tests/pixel-sw-table.spec.ts --project=desktop --project=mobile -u --workers=1 --machine runner

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

type Win = Window & { tblSeen: string[] };

async function specimen(page: Page, scheme: 'light' | 'dark') {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  // the audit screen loads sw-table (lazy screen chunk)
  await page.goto(`/?design=a&fit=off&look=performance:full&skin=classic&scheme=${scheme}#/system/audit`);
  await page.waitForSelector('sw-app');
  await page.waitForFunction(() => !!customElements.get('sw-table'), undefined, { timeout: 30_000 });
  // the columns render strings or DOM nodes built here (no lit import in the page: the spec runs on a preview build too)
  await page.evaluate(() => {
    type Row = Record<string, unknown>;
    type Col = { key: string; label: string; kind?: string | string[]; render?: (r: Row) => unknown; hideBelow?: string; cellAttrs?: (r: Row) => Record<string, string> };
    type Tbl = HTMLElement & { columns: Col[]; rows: Row[]; rowKey: string; selected: string | null; rowAttrs?: (r: Row) => Record<string, unknown> };
    const el = (tag: string, cls: string, text: string, attrs: Record<string, string> = {}) => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      n.textContent = text;
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      return n;
    };
    const two = (a: string, b: string) => {
      const f = document.createDocumentFragment();
      f.append(el('span', 't1', a), el('span', 't2', b));
      return f;
    };
    const rows: Row[] = [
      { id: 'r1', name: 'לוח חשמל ראשי', place: 'קומה 1 · חדר חשמל', reading: '1,284.5', tone: 'ok', state: 'תקין', note: 'נבדק בבוקר' },
      { id: 'r2', name: 'מונה מים - לובי', place: 'לובי', reading: '86.02', tone: 'warn', state: 'צריכה חריגה', note: 'צריכה לילית מעל הסף שלושה לילות ברצף - לבדוק נזילה בחדר המשאבות' },
      { id: 'r3', name: 'גנרטור', place: 'חניון -2', reading: '12', tone: 'bad', state: 'תקלה', note: 'דלק נמוך' },
      { id: 'r4', name: 'מעלית צפונית', place: 'קומה 0', reading: '0', tone: 'info', state: 'בטיפול', note: '' },
      { id: 'r5', name: 'מצלמה 14', place: 'גג', reading: '-', tone: '', state: 'לא ידוע', note: '' },
    ];
    const columns: Col[] = [
      { key: 'name', label: 'שם', render: (r) => two(String(r.name), String(r.place)) },
      { key: 'reading', label: 'קריאה', kind: 'num' },
      { key: 'state', label: 'מצב', kind: 'status', render: (r) => el('span', 'chip', String(r.state), r.tone ? { 'data-tone': String(r.tone) } : {}), cellAttrs: (r) => ({ 'data-specimen-state': String(r.tone || 'none') }) },
      { key: 'note', label: 'הערה', kind: ['muted', 'truncate'], hideBelow: 'tablet' },
      {
        key: 'act',
        label: '',
        kind: 'actions',
        render: () => {
          const b = document.createElement('sw-button');
          b.setAttribute('size', 'sm');
          b.textContent = 'פתח';
          return b;
        },
      },
    ];
    const sheet = document.createElement('div');
    sheet.setAttribute('data-table-specimen', '');
    sheet.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;overflow:hidden;padding:20px 16px;box-sizing:border-box;display:flex;flex-direction:column;gap:16px;' +
      'background:var(--sw-bg, var(--sw-surface-2));color:var(--sw-text);font-family:var(--sw-font, inherit);';
    const make = (attrs: Record<string, string>, data: Row[]) => {
      const t = document.createElement('sw-table') as Tbl;
      t.columns = columns;
      t.rows = data;
      t.rowKey = 'id';
      t.rowAttrs = (r) => ({ 'data-specimen-row': String(r.id), 'data-tone': (r.tone as string) || null });
      for (const [k, v] of Object.entries(attrs)) t.setAttribute(k, v);
      return t;
    };
    // 1) its own card, a selected row, rows that answer the keyboard
    const own = make({ 'focus-rows': '', 'data-specimen': 'own' }, rows.slice(0, 3));
    own.selected = 'r2';
    // 2) inside a card (bare), a read-only list
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--sw-surface);border:1px solid var(--sw-border);border-radius:var(--sw-r-md);box-shadow:var(--sw-shadow-1);overflow:hidden';
    card.append(make({ bare: '', 'static-rows': '', 'data-specimen': 'bare' }, rows.slice(2)));
    // 3) the empty state the screen slots in
    const empty = make({ 'data-specimen': 'empty' }, []);
    empty.append(el('div', '', 'אין קריאות בטווח הזה', { slot: 'empty', 'data-specimen-empty': '', style: 'padding:16px;text-align:center;color:var(--sw-text-3)' }));
    sheet.append(own, card, empty);
    document.body.append(sheet);
  });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

test.describe('pixel: sw-table', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-fixture spec');

  for (const scheme of ['light', 'dark'] as const) {
    test(`sw-table specimen ${scheme} is pixel-stable`, async ({ page }, info) => {
      const file = `sw-table-${scheme}.png`; // Playwright adds -<project>-<platform>
      if (noBaseline(info, file)) {
        info.annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
        test.skip(true, `${file}: no baseline on ${process.platform}`);
      }
      await specimen(page, scheme);
      // nothing pushes the page sideways (owner rule: no scrolling in control screens)
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over).toBeLessThanOrEqual(0);
      await expect(page).toHaveScreenshot(file, { animations: 'disabled', maxDiffPixelRatio: 0.002 });
    });
  }

  test('sw-table behaviour: row and cell hooks, a dropped hook goes, static rows stay silent, the arrows walk the rows, the empty slot', async ({ page }, info) => {
    await specimen(page, 'light');
    const own = page.locator('[data-table-specimen] sw-table[data-specimen="own"]');
    // the screens' spec selectors keep working: a tr[data-*] hook and a td[data-*] hook (Playwright's CSS reaches into the shadow root)
    await expect(own.locator('tr[data-specimen-row]')).toHaveCount(3);
    await expect(own.locator('tr[data-specimen-row="r2"][data-tone="warn"]')).toHaveCount(1);
    await expect(own.locator('tr[data-specimen-row="r2"] [data-specimen-state="warn"] .chip')).toHaveText('צריכה חריגה');
    // a later render that drops a hook removes it (rows are reused by position)
    await own.evaluate((t) => {
      const tbl = t as HTMLElement & { rows: Record<string, unknown>[] };
      tbl.rows = tbl.rows.map((r) => (r.id === 'r2' ? { ...r, tone: '' } : r));
    });
    await expect(own.locator('tr[data-specimen-row="r2"]')).not.toHaveAttribute('data-tone', /.*/);
    // the number cell is its own LTR isolate, aligned to the reading end
    const num = await own.locator('tr[data-specimen-row="r1"] td.k-num').evaluate((td) => [getComputedStyle(td).textAlign, getComputedStyle(td.querySelector('.num') as Element).direction]);
    expect(num[1]).toBe('ltr');
    expect(['end', 'left']).toContain(num[0]);
    // keyboard: Enter picks, ArrowDown walks to the next row (desktop: the rows are a table, not the phone stack)
    await page.evaluate(() => {
      (window as unknown as Win).tblSeen = [];
      document.querySelector('[data-table-specimen]')?.addEventListener('row-select', (e) => (window as unknown as Win).tblSeen.push((e as CustomEvent<{ id: string }>).detail.id));
    });
    await own.locator('tr[data-specimen-row="r1"]').focus();
    await page.keyboard.press('ArrowDown');
    await expect(own.locator('tr[data-specimen-row="r2"]')).toBeFocused();
    await page.keyboard.press('End');
    await expect(own.locator('tr[data-specimen-row="r3"]')).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => (window as unknown as Win).tblSeen)).toEqual(['r3']);
    // a read-only list: no tab stop, no pointer, a click fires nothing
    const bare = page.locator('[data-table-specimen] sw-table[data-specimen="bare"]');
    await expect(bare.locator('tr[data-specimen-row="r4"]')).not.toHaveAttribute('tabindex', /.*/);
    if (info.project.name !== 'mobile') {
      await bare.locator('tr[data-specimen-row="r4"]').click();
      expect(await bare.locator('tr[data-specimen-row="r4"]').evaluate((tr) => getComputedStyle(tr).cursor)).toBe('default');
    }
    expect(await page.evaluate(() => (window as unknown as Win).tblSeen)).toEqual(['r3']);
    // bare: no card of its own
    expect(await bare.evaluate((t) => getComputedStyle(t).borderTopWidth)).toBe('0px');
    // the screen's empty state is slotted (its own hook and copy)
    await expect(page.locator('[data-table-specimen] sw-table[data-specimen="empty"] [data-specimen-empty]')).toBeVisible();
  });
});
