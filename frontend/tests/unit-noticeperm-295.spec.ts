import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// NOTICEPERM-295: the chip switch and the permanent-link strings exist in both languages, and the API client reads the stored link.
//   npx playwright test tests/unit-noticeperm-295.spec.ts --project=desktop

const src = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');

test('the chip switch and its old-boards explanation are in Hebrew and English', () => {
  const i18n = src('i18n/notices.ts');
  for (const key of ['infoShow', 'infoOldBoards']) {
    expect(i18n.split(`${key}:`).length - 1, key).toBe(2);
  }
  expect(i18n).toContain('2.16.0');
});

test('the info picker emits info-show-change and the page wires it to blocks.info_show', () => {
  expect(src('notices/display-info.ts')).toContain("'info-show-change'");
  const page = src('screens/system-notices.ts');
  expect(page).toContain('info_show: e.detail');
  expect(page).toContain('d.blocks.info_show !== false');
});

test('the copy button reads the stored link instead of re-issuing, and only an unstored board asks first', () => {
  const api = src('api/notices.ts');
  expect(api).toContain('/link`');
  expect(api).toContain('has_stored_link');
  const page = src('screens/system-notices.ts');
  expect(page).toContain('getBoardLink(b.id)');
  expect(page).toMatch(/if \(!b\.has_stored_link\) \{\s+this\.confirmRotate = \{ board: b, copy: true \};/);
});
