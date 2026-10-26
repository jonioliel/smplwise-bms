import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardModel, type CardItem } from '../src/tickets/list-card-model';
import { runLine } from '../src/tickets/model';
import { setTicketNames } from '../src/tickets/naming';
import { HOME_TITLE_DEFAULT } from '../src/api/home';
import { AREA_TABS, NAV_A } from '../src/shell/nav';
import { TOKENS } from '../src/design/tokens';

// UXFIX-NAV-295 (UX audit 2026-10-20, findings 8, 14, 15): the pure guarantees. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-uxfix-nav-295.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');
const NOW = new Date(2026, 9, 16, 12, 0, 0);
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();

function tk(o: Partial<CardItem> = {}): CardItem {
  return {
    id: 'a'.repeat(16), number: 1044, title: 'נזילה מהתקרה בשירותי קומה 2', excerpt: 'x', status: 'new', origin: 'manual',
    department: { id: 'd1', key: 'maint', name: 'אחזקה', icon: null, color: null }, category: null, priority: null,
    place_text: '', device_name: '', created_by: { id: 'u9', name: 'דנה לוי' }, created_at: ago(180), last_activity_at: ago(60),
    assignee: null, last_assignee_name: null, eta_at: null, waiting_on: 'manager', waiting_reason: null, reopen_count: 0, external_stale: false,
    closed_at: null, revision: 1, view: 'full', ...o,
  };
}

test.afterEach(() => setTicketNames(null));

test('finding 15: a request waiting for its handler says it once - the sentence keeps it, the footer keeps only the time', () => {
  const m = cardModel(tk(), { role: 'manager', now: NOW });
  expect(m.sentence).toContain('ממתין לשיוך');
  expect(m.run.text).not.toContain('ללא מטפל');
  expect(m.run.text).toContain('עודכן');
  expect(m.run.tone).toBe('bad');
});

test('finding 15: a request that is not waiting for assignment keeps its footer unchanged (the default of runLine is untouched)', () => {
  const user = { kind: 'user' as const, id: 'u1', name: 'יוסי', since: ago(60), acknowledged_at: null };
  expect(cardModel(tk({ status: 'assigned', assignee: user }), { role: 'manager', now: NOW }).run.text).toContain('יוסי');
  expect(runLine({ last_activity_at: ago(180), assignee: null }, NOW).text).toContain('ללא מטפל');
  expect(runLine({ last_activity_at: ago(180), assignee: null }, NOW, { omitUnassigned: true }).text).not.toContain('ללא מטפל');
});

test('finding 14: the home screen is titled with its navigation label', () => {
  const label = NAV_A.find((x) => x.id === 'devices')?.label;
  expect(label).toBeTruthy();
  expect(HOME_TITLE_DEFAULT).toBe(label);
  expect(HOME_TITLE_DEFAULT).toBe('ראשי');
});

test('finding 14: ONE heading style - the glass pages read the shared tokens, no px size or own family of their own', () => {
  expect(TOKENS['--sw-h1-phone']).toBeTruthy();
  expect(TOKENS['--sw-font-heading']).toBeTruthy();
  const glass = read('styles/media-glass.ts');
  const page = read('styles/media-page.ts');
  const mm = read('screens/multimedia-screens.ts');
  expect(glass).not.toMatch(/--mm-fs-page-title:\s*\d+px/);
  expect(glass).toContain('--mm-fs-page-title: var(--sw-h1);');
  expect(glass).toContain('--mm-fs-page-title: var(--sw-h1-phone);');
  for (const css of [page, mm]) {
    const h1 = /\n    h1 \{([\s\S]*?)\n    \}/.exec(css)?.[1] ?? '';
    expect(h1).toContain('font-family: var(--sw-font-heading)');
    expect(h1).toContain('var(--sw-h1-weight');
    expect(h1).toContain('var(--sw-heading');
  }
  expect(read('components/sw-page.ts')).toContain('font-family: var(--sw-font-heading');
});

test('finding 14: the infrastructure pages carry one visually hidden h1 named like the navigation (never display:none)', () => {
  const sr = read('components/sr-heading.ts');
  expect(sr).toContain('<h1 class="sr-h1"');
  expect(sr).not.toMatch(/display:\s*none/);
  expect(read('screens/infra-electricity.ts')).toContain('srHeading(');
  expect(read('screens/infra-generator.ts')).toContain('srHeading(G.tab, true)');
});

test('finding 8: the settings sub-pages are not named like the settings strip, and follow the tabs mode on every width', () => {
  const sys = (AREA_TABS.system as { id: string; label: string }[]).find((x) => x.id === 'general');
  expect(sys?.label).toBe('כללי');
  const d = read('screens/system-diagnostics.ts');
  expect(d).toContain("{ id: 'general', label: 'מראה ותצוגה' }");
  expect(d).not.toContain("{ id: 'general', label: 'כללי' }");
  // release 2.10.0: the phone-only dropdown was reverted (owner rule 0.1.157, no phone-only gate; owner decision pending)
  expect(d).not.toContain("this.phone ? 'dropdown'");
  expect(read('screens/system-index.ts')).toContain("tab: 'general', label: 'מראה ותצוגה'");
});

test('finding 15: the card title is a two-line clamp with the full width on a phone; the bottom bar label wraps', () => {
  const st = read('tickets/styles.ts');
  expect(st).toMatch(/h3 \{[^}]*-webkit-line-clamp: 2;[^}]*white-space: normal;/);
  expect(st).toMatch(/@media \(max-width: 767px\) \{[\s\S]*\.ttl \{\s*order: 2;\s*flex: 1 1 100%;/);
  const app = read('shell/sw-app.ts');
  expect(app.match(/-webkit-line-clamp: 2;[\s\S]{0,120}white-space: normal;/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
});
