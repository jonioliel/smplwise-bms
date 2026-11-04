import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KEY_HINT_MOVE_PX, KEY_HINT_PRESS_MS, KEY_HINT_SHOW_MS, WALL_PHONE_BAR_DEFAULT, WALL_PHONE_BAR_HINT, WALL_PHONE_BAR_KEY, WALL_PHONE_BAR_LABEL,
  WALL_PHONE_BAR_MODES, WALL_PHONE_BAR_OPTIONS, colsBadge, countBadge, keyHint, wallPhoneBarMode,
} from '../src/screens/wall-phone-bar';
import { COUNT_ALL } from '../src/screens/wall-count';

// WALL-PHONE-TOOLBAR-2401 (owner 04.11 evening): the camera wall's toolbar on a phone - ONE row of icon keys by default, the full labels in two
// rows as an installation setting (ui.wall_phone_bar). Node only: the rules are a pure module (screens/wall-phone-bar.ts); the wiring of the
// wall, the settings row, the dropdown's icon-only key and the server key is read from the source. The browser checks are in
// evidence-mobile-wall-kiosk.spec.ts (runner).
//   npx playwright test -c playwright.unit.config.ts tests/unit-wall-phone-bar-2401.spec.ts

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');
const WALL = read('src/screens/live-wall.ts');
const SETTINGS = read('src/screens/system-diagnostics.ts');
const DROPDOWN = read('src/components/sw-dropdown.ts');
const BACKEND = read('../smplwise_vms/backend/smplwise/routers/settings.py');
const MEDIA = read('src/api/media.ts');

test.describe('the setting', () => {
  test('two modes, the icon row is the default, an unknown value reads as the default', () => {
    expect(WALL_PHONE_BAR_KEY).toBe('ui.wall_phone_bar');
    expect([...WALL_PHONE_BAR_MODES]).toEqual(['icons', 'labels']);
    expect(WALL_PHONE_BAR_DEFAULT).toBe('icons');
    expect(wallPhoneBarMode('icons')).toBe('icons');
    expect(wallPhoneBarMode('labels')).toBe('labels');
    for (const raw of [undefined, null, '', 'LABELS', 'label', 'two', 1, true, {}, ['labels']]) expect(wallPhoneBarMode(raw), String(raw)).toBe('icons');
  });

  test('the settings row: the owner\'s label, the default first and marked, the two choices only', () => {
    expect(WALL_PHONE_BAR_LABEL).toBe('סרגל קיר המצלמות בטלפון');
    expect(WALL_PHONE_BAR_OPTIONS.map(([v]) => v)).toEqual(['icons', 'labels']);
    expect(WALL_PHONE_BAR_OPTIONS[0][1]).toBe('שורה אחת עם אייקונים (ברירת מחדל)');
    expect(WALL_PHONE_BAR_OPTIONS[1][1]).toBe('שתי שורות עם שמות מלאים');
    // the settings tab must not grow more than one short row (owner rule: no scrolling in control screens)
    expect(WALL_PHONE_BAR_HINT.length).toBeLessThanOrEqual(90);
    for (const t of [WALL_PHONE_BAR_LABEL, WALL_PHONE_BAR_HINT, ...WALL_PHONE_BAR_OPTIONS.map(([, l]) => l)]) expect(t).not.toMatch(/Home Assistant|\bHA\b/);
  });

  test('the settings row sits with the other wall settings and writes the key through the normalizer', () => {
    const row = SETTINGS.indexOf('data-set-wall-phone-bar-row');
    expect(row).toBeGreaterThan(SETTINGS.indexOf('data-set-kiosk-layout'));
    expect(row).toBeLessThan(SETTINGS.indexOf('data-set-start-route'));
    expect(SETTINGS).toContain("this.set('ui.wall_phone_bar', wallPhoneBarMode(");
    expect(SETTINGS).toMatch(/data-set-wall-phone-bar \?disabled=\$\{!api \|\| !this\.canEdit\}/);
    expect(MEDIA).toContain("'ui.wall_phone_bar'?: 'icons' | 'labels';");
  });

  test('the server knows the key: default icons, only the two values', () => {
    expect(BACKEND).toMatch(/"ui\.wall_phone_bar": "icons"/);
    expect(BACKEND).toMatch(/ui_wall_phone_bar: str \| None = Field\(default=None, pattern="\^\(icons\|labels\)\$", alias="ui\.wall_phone_bar"\)/);
  });
});

test.describe('the keys', () => {
  test('the full name is "<what>: <chosen>", the name alone without a choice', () => {
    expect(keyHint('איכות', 'אוטו')).toBe('איכות: אוטו');
    expect(keyHint('עמודות בקיר', ' עמודה אחת ')).toBe('עמודות בקיר: עמודה אחת');
    expect(keyHint('קיוסק')).toBe('קיוסק');
    expect(keyHint('NVR', '')).toBe('NVR');
    expect(keyHint('NVR', null)).toBe('NVR');
  });

  test('the count badge: the count chosen, the total for "all" or a count above it, nothing for a map selection', () => {
    expect(countBadge(9, 24, false)).toBe('9');
    expect(countBadge(1, 24, false)).toBe('1');
    expect(countBadge(COUNT_ALL, 24, false)).toBe('24');
    expect(countBadge(40, 24, false)).toBe('24');
    expect(countBadge(24, 24, false)).toBe('24');
    expect(countBadge(9, 24, true)).toBe('');
    expect(countBadge(0, 0, false)).toBe('');
    expect(countBadge(Number.NaN, 8, false)).toBe('8');
  });

  test('the columns badge: a number only for a column count chosen by hand', () => {
    expect(colsBadge(0)).toBe('');
    expect(colsBadge(1)).toBe('1');
    expect(colsBadge(6)).toBe('6');
    expect(colsBadge(-1)).toBe('');
    expect(colsBadge(Number.NaN)).toBe('');
  });

  test('a badge is short: it never needs cutting', () => {
    for (const n of [1, 9, 12, 32, 99]) expect(countBadge(n, 100, false).length).toBeLessThanOrEqual(2);
    expect(countBadge(COUNT_ALL, 100, false).length).toBeLessThanOrEqual(3);
    for (let c = 0; c <= 6; c++) expect(colsBadge(c).length).toBeLessThanOrEqual(1);
  });

  test('a long press is a deliberate hold; a moving finger is a scroll', () => {
    expect(KEY_HINT_PRESS_MS).toBeGreaterThanOrEqual(350);
    expect(KEY_HINT_PRESS_MS).toBeLessThanOrEqual(600);
    expect(KEY_HINT_SHOW_MS).toBeGreaterThan(KEY_HINT_PRESS_MS);
    expect(KEY_HINT_MOVE_PX).toBeGreaterThan(0);
  });
});

test.describe('the wiring', () => {
  test('the wall draws the bar in the installation\'s mode, icons unless the setting says labels', () => {
    expect(WALL).toContain("wallPhoneBarMode(this.settings?.['ui.wall_phone_bar'])");
    expect(WALL).toContain("this.phoneBarMode === 'labels' ? this.renderPhoneBarLabels(api, total) : this.renderPhoneBarIcons(api, total)");
    expect(WALL).toContain('data-wall-phone-bar data-mode="icons"');
    expect(WALL).toContain('data-wall-phone-bar data-mode="labels"');
  });

  test('the icon row keeps every control and its test hooks; the columns stay the shared dropdown (icon-only)', () => {
    const icons = WALL.slice(WALL.indexOf('private renderPhoneBarIcons('), WALL.indexOf('render() {', WALL.indexOf('private renderPhoneBarIcons(')));
    expect(icons).toContain('this.qualityControl(quality)');
    expect(icons).toContain('this.countControl(total, count)');
    expect(icons).toContain('this.columnsDropdown(true, true)');
    expect(icons).toContain('this.recorderControl(true, recorder)');
    expect(icons).toContain('this.kioskKey(');
    expect(icons).toContain('data-wall-key-hint');
    expect(WALL).toMatch(/\?icon-only=\$\{key\}/);
    for (const hook of ['data-wall-quality', 'data-wall-count-select', 'data-wall-cols-dd', 'data-wall-recorder', 'data-open-kiosk']) expect(WALL, hook).toContain(hook);
  });

  test('the labels mode is the earlier toolbar: a 150 px basis for every labelled control, wrapping into rows', () => {
    expect(WALL).toMatch(/\.pbar sw-field \{\s*flex: 1 1 150px;/);
    expect(WALL).toMatch(/\.pbar sw-dropdown\[block\] \{\s*flex: 1 1 150px;/);
    expect(WALL).toMatch(/\.pbar \{[^}]*flex-wrap: wrap;/);
    const labels = WALL.slice(WALL.indexOf('private renderPhoneBarLabels('), WALL.indexOf('private iconKey('));
    expect(labels).toContain('this.columnsDropdown(true)');
    expect(labels).toContain('this.recorderSelect(true)');
  });

  test('the icon row is one row of 44 px keys, the select laid over the key, the long press caught before a click opens anything', () => {
    expect(WALL).toMatch(/\.pbar\[data-mode='icons'\] \{[^}]*flex-wrap: nowrap;/);
    expect(WALL).toMatch(/\.pbar\[data-mode='icons'\] \.ikey \{[^}]*inline-size: 44px;[^}]*block-size: 44px;/);
    expect(WALL).toMatch(/\.pbar\[data-mode='icons'\] \.ikey > select \{[^}]*position: absolute;[^}]*inset: 0;[^}]*opacity: 0;/);
    expect(WALL).toMatch(/\.pbar\[data-mode='icons'\] \.kiosk \{\s*inline-size: 44px;\s*block-size: 44px;/);
    expect(WALL).toMatch(/onKeyClick = \{[\s\S]*?capture: true,/);
    expect(WALL).toContain('@click=${this.onKeyClick}');
    // the select of a key stays in sw-field (its own focus treatment, no second ring from the focus policy)
    expect(WALL).toMatch(/<sw-field class="ikey"[^>]*>[\s\S]*?\$\{control\}<\/sw-field>/);
    // no capsule key is taller than the 56 px row allows
    for (const m of WALL.matchAll(/\.ikey\[data-capsule\][^{]*\{[^}]*block-size: (\d+)px;/g)) expect(Number(m[1])).toBeLessThanOrEqual(48);
  });

  test('nothing in the toolbar ends a label in an ellipsis', () => {
    const css = WALL.slice(WALL.indexOf('static styles'), WALL.indexOf('`, bubbleChrome]'));
    expect(css).not.toMatch(/text-overflow:\s*ellipsis/);
    const ddCss = DROPDOWN.slice(DROPDOWN.indexOf('WALL-PHONE-TOOLBAR-2401: icon-only'), DROPDOWN.indexOf('@media (forced-colors: active)', DROPDOWN.indexOf('WALL-PHONE-TOOLBAR-2401: icon-only')));
    expect(ddCss).not.toMatch(/text-overflow:\s*ellipsis/);
  });
});

test.describe('the dropdown\'s icon-only key', () => {
  test('a reflected attribute and a badge; no label text and no chevron on the key; the full name as tooltip and accessible name', () => {
    expect(DROPDOWN).toContain("@property({ type: Boolean, attribute: 'icon-only', reflect: true }) iconOnly = false;");
    expect(DROPDOWN).toContain("@property() badge = '';");
    const r = DROPDOWN.slice(DROPDOWN.indexOf('if (this.iconOnly) {'), DROPDOWN.indexOf('return this.renderControl(listId, aria, html`<span class="txt">'));
    expect(r).not.toContain('class="txt"');
    expect(r).toContain('data-dd-badge');
    expect(DROPDOWN).toContain('title=${keyOnly ? aria : nothing}');
    expect(DROPDOWN).toContain('${keyOnly ? nothing : html`<span class="chev"');
  });

  test('the key is 44 px (48 px at most for the large capsule) and the fit drops a stale tight state', () => {
    expect(DROPDOWN).toMatch(/:host\(\[icon-only\]:not\(\[block\]\):not\(\[multiple\]\)\) \.chip \{[^}]*inline-size: 44px;[^}]*block-size: 44px;/);
    expect(DROPDOWN).toMatch(/:host\(\[icon-only\]\[dd-style='capsule'\]\[dd-size='lg'\]\) \{\s*--_ch: 48px;/);
    const fit = DROPDOWN.slice(DROPDOWN.indexOf('private fitLabel = () => {'), DROPDOWN.indexOf('fitTextElement(txt);'));
    expect(fit.indexOf("this.removeAttribute('data-tight')")).toBeLessThan(fit.indexOf('if (!txt) return;'));
  });
});
