import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { skinsUnderTest } from './helpers/frozen-skins';

// DROPDOWNFIT-295 (owner, phone, 2026-10-24): the text inside the dropdowns was cut off ("כל ה...", "ע...") and the dropdowns of one screen
// did not look alike. Guard on the security screen (the camera wall, API mode, capsule dropdown style), crystal and bubble skins, at 320 / 360 /
// 411 / 1280 px:
//   1. every dropdown label fits whole: a sw-dropdown's `.txt` has scrollWidth <= clientWidth (and scrollHeight <= clientHeight when it wrapped),
//      a capsule select's selected text measures <= its content box; no text-overflow ellipsis anywhere in the controls;
//   2. all the capsule controls of the screen share the same height, ring width, radius, base font size / weight and the 44 px touch target
//      (the label may shrink inside the control - the control's own base size is what is compared);
//   3. the page has no horizontal overflow.
// No backend: the app (dev server or preview), the API answered by page.route. DROPDOWNFIT_SHOT_DIR=<dir> (+ DROPDOWNFIT_SHOT_NAME) also writes a PNG at 411 px; DROPDOWNFIT_SHOT_ONLY=1 only takes it.
const WIDTHS = [320, 360, 411, 1280];
const SKINS = skinsUnderTest(['crystal', 'bubble']);
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

async function mock(page: Page, size: string) {
  await page.addInitScript(() => localStorage.setItem('sw.wall.count', '32'));
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'me') {
      const perms = ['video.live'];
      return json({
        user: { id: 'u', username: 'dana', display_name: 'Dana', source: 'ingress' }, channel: 'local', remote: null, bindings: [],
        permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
      });
    }
    if (p === 'cameras') {
      const cameras = Array.from({ length: 6 }, (_, i) => ({
        id: `c${i + 1}`, recorder_id: i < 3 ? 'r1' : 'r2', channel: i + 1, name: `מצלמה ${i + 1}`, name_source: 'nvr', alias: null, enabled: true, sort_order: i, grid_col_span: 1, main_track: 1, sub_track: 2,
        status: 'online', last_seen_at: null, can_view_live: false,
        encoding: { main: { codec: 'H.264', webrtc: 'ok' }, sub: { codec: 'H.264', webrtc: 'ok' } },
      }));
      return json({ cameras, recorder: null, can_sync: false, media: {} });
    }
    if (p === 'settings') {
      return json({
        settings: { 'media.transport_default': 'mse', 'media.max_live_sessions': 16, 'media.wall_profile': 'sub', 'snapshots.max_age_s': 60, 'ui.tabs_mode': 'dropdown', 'ui.tabs_mode_groups': {}, 'ui.dd_style': 'capsule', 'ui.dd_style_groups': {}, 'ui.dd_size': size, 'ui.dd_size_groups': {} },
        can_edit: false,
      });
    }
    if (/^cameras\/[^/]+\/snapshot\.jpg$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: GIF });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

interface Control {
  kind: 'dropdown' | 'select';
  name: string;
  fits: boolean;
  fitState: string;
  ellipsis: boolean;
  height: number;
  ring: string;
  radius: string;
  baseFont: string;
  baseWeight: string;
  dim: string;
}

/** Runs in the page: walks light DOM + shadow roots, reads every capsule dropdown and capsule select. */
function readControls(): Control[] {
  const out: Control[] = [];
  const canvas = document.createElement('canvas').getContext('2d')!;
  const walk = (root: Document | ShadowRoot) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot);
      if (el.tagName === 'SW-DROPDOWN' && el.getAttribute('dd-style') === 'capsule') {
        const chip = el.shadowRoot!.querySelector('.chip') as HTMLElement;
        const txt = el.shadowRoot!.querySelector('.chip .txt') as HTMLElement;
        const before = getComputedStyle(chip, '::before');
        const cs = getComputedStyle(chip);
        const fits = txt.scrollWidth <= txt.clientWidth + 0.5 && txt.scrollHeight <= txt.clientHeight + 3;
        out.push({
          kind: 'dropdown', name: chip.getAttribute('aria-label') || '?', fits, fitState: txt.getAttribute('data-fit') || 'none',
          ellipsis: getComputedStyle(txt).textOverflow === 'ellipsis',
          height: Math.max(parseFloat(before.height), 0) + 0, ring: before.borderTopWidth, radius: before.borderTopLeftRadius,
          baseFont: cs.fontSize, baseWeight: cs.fontWeight,
          dim: `txt ${txt.scrollWidth}x${txt.scrollHeight} in ${txt.clientWidth}x${txt.clientHeight} font ${getComputedStyle(txt).fontSize}`,
        });
        const box = chip.getBoundingClientRect();
        if (box.height < (innerWidth <= 1100 ? 44 : 44) - 0.5) out.push({ ...out[out.length - 1], name: `TOUCH ${box.height}`, fits: false });
      }
      if (el.tagName === 'SW-FIELD' && el.hasAttribute('capsule')) {
        const sel = el.querySelector('select') as HTMLSelectElement | null;
        if (!sel) continue;
        const cs = getComputedStyle(sel);
        const avail = sel.clientWidth - parseFloat(cs.paddingInlineStart) - parseFloat(cs.paddingInlineEnd);
        canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const w = canvas.measureText(sel.selectedOptions[0]?.textContent?.trim() ?? '').width;
        const ref = getComputedStyle(el);
        out.push({
          kind: 'select', name: sel.getAttribute('aria-label') || '?', fits: w <= avail + 0.5, fitState: sel.getAttribute('data-fit') || 'none',
          ellipsis: cs.textOverflow === 'ellipsis',
          height: sel.getBoundingClientRect().height, ring: cs.borderTopWidth, radius: cs.borderTopLeftRadius,
          baseFont: ref.getPropertyValue('--_cfs').trim(), baseWeight: cs.fontWeight,
          dim: `text ${Math.round(w)} in ${Math.round(avail)} font ${cs.fontSize}`,
        });
      }
    }
  };
  walk(document);
  return out;
}

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120)))));

async function openWall(page: Page, skin: string, width: number, size = 'md') {
  await mock(page, size);
  await page.setViewportSize({ width, height: width > 1000 ? 900 : 844 });
  await page.goto(`./?design=a&skin=${skin}&scheme=light#/live/wall`);
  await page.waitForSelector('live-wall');
  await expect(page.locator('live-wall sw-camera-tile[data-cam]')).toHaveCount(6);
  await page.waitForTimeout(700);
  await settle(page);
}

async function shot(page: Page, skin: string) {
  const dir = process.env.DROPDOWNFIT_SHOT_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${process.env.DROPDOWNFIT_SHOT_NAME || 'shot'}-${skin}.png` });
}

for (const skin of SKINS) {
  test(`dropdown fit: ${skin}, security screen at ${WIDTHS.join(' / ')} px - labels whole, capsules alike, no overflow`, async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project: the widths are set here');
    const problems: string[] = [];
    for (const w of WIDTHS) {
      await openWall(page, skin, w);
      if (process.env.DROPDOWNFIT_SHOT_ONLY) {
        if (w === 411) await shot(page, skin);
        continue;
      }
      const controls = await page.evaluate(readControls);
      expect(controls.filter((c) => c.kind === 'dropdown').length, `${w}px: capsule dropdowns on the screen`).toBeGreaterThanOrEqual(2);
      if (w < 768) expect(controls.filter((c) => c.kind === 'select').length, `${w}px: the phone bar's capsule selects`).toBeGreaterThanOrEqual(2);
      for (const c of controls) {
        if (!c.fits) problems.push(`${skin} ${w}px: "${c.name}" (${c.kind}) label does not fit (fit=${c.fitState}; ${c.dim})`);
        if (c.ellipsis) problems.push(`${skin} ${w}px: "${c.name}" has an ellipsis`);
      }
      const key = (c: Control) => `${Math.round(c.height)}|${c.ring}|${c.radius}|${c.baseFont}|${c.baseWeight}`;
      const alike = controls.filter((c) => !c.name.startsWith('TOUCH'));
      if (new Set(alike.map(key)).size !== 1) problems.push(`${skin} ${w}px: the capsules differ: ${alike.map((c) => `${c.name} [${key(c)}]`).join('  vs  ')}`);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (over > 0) problems.push(`${skin} ${w}px: horizontal page overflow ${over}px`);
      if (w === 411) await shot(page, skin);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}

test('dropdown fit: the size dial (sm / lg) keeps the same rule on the phone', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one project: the widths are set here');
  const problems: string[] = [];
  for (const size of ['sm', 'lg']) {
    await openWall(page, 'crystal', 360, size);
    for (const c of await page.evaluate(readControls)) if (!c.fits || c.ellipsis) problems.push(`${size}: "${c.name}" (${c.kind}) fit=${c.fitState}`);
  }
  expect(problems, problems.join('\n')).toEqual([]);
});
