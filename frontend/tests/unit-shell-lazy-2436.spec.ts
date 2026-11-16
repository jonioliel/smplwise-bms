import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { navRfqTitle } from '../src/i18n/nav-label-bridges';
import { nt, NAV_RFQ_HE, NAV_RFQ_EN } from '../src/tickets/nav-text';
import { rt, rfqTemplate } from '../src/tickets/rfq-text';
import * as model from '../src/xsection/xs-model';
import * as options from '../src/xsection/xs-options';

// CR-SHELL-LAZY-2436 (review 07:F4 a-c, 06:BUNDLE-1 shell side, 08:F02 shell imports, 07:F24 QR library): the on-demand features the
// shell, the device popup, the user menu and the floor link dialog used to import eagerly arrive as chunks of their own, and the shell
// reads its two RFQ words and the cross-section options from small modules. Node only: the import graph is read from the source.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../src');
const read = (rel: string): string => readFileSync(path.join(SRC, rel), 'utf8');
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

/** The static runtime imports of a module, src-relative (type-only imports carry no code into a chunk). */
function staticImports(rel: string): string[] {
  const out: string[] = [];
  for (const m of code(rel).matchAll(/^import\s+(?:(type)\s+)?(?:([\s\S]*?)\s+from\s+)?'([^']+)';/gm)) {
    if (m[1]) continue;
    const names = m[2] ? /^\{([\s\S]*)\}$/.exec(m[2].trim()) : null;
    if (names && names[1].split(',').map((s) => s.trim()).filter(Boolean).every((s) => s.startsWith('type '))) continue;
    const to = m[3];
    out.push(to.startsWith('.') ? `${path.posix.normalize(path.posix.join(path.posix.dirname(rel), to)).replace(/\.ts$/, '')}.ts` : to);
  }
  return out;
}
const dynamicImports = (rel: string): string[] => [...code(rel).matchAll(/import\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);

test('lazy-tags-check: every tag is defined where it is used, and none of the on-demand modules is in the entry chunk', () => {
  const out = execFileSync(process.execPath, [path.join(HERE, '..', 'scripts', 'lazy-tags-check.mjs'), '--stats'], { encoding: 'utf8' });
  expect(out).toContain('lazy-tags-check: OK');
  const stat = JSON.parse(out.split('\n')[0]) as { notInEntry: number };
  expect(stat.notInEntry).toBe(8);
});

test('the deny-list of the check names the eight modules this branch took out of the entry chunk', () => {
  const s = readFileSync(path.join(HERE, '..', 'scripts', 'lazy-tags-check.mjs'), 'utf8');
  for (const m of ['screens/schedule-editor.ts', 'tickets/ticket-create.ts', 'components/sw-second-factor.ts', 'arx/boot.ts', 'arx/arx-login.ts', 'arx/arx-welcome.ts', 'tickets/rfq-text.ts', 'xsection/sw-xsection.ts']) {
    expect(s, m).toContain(`'${m}'`);
  }
});

test('the shell imports the RFQ words and the cross-section options from their small modules, and no media remote', () => {
  const imps = staticImports('shell/sw-app.ts');
  expect(imps).not.toContain('tickets/rfq-text.ts');
  expect(imps).not.toContain('xsection/xs-model.ts');
  expect(imps).not.toContain('components/media-remote.ts');
  expect(imps).toContain('tickets/nav-text.ts');
  expect(imps).toContain('xsection/xs-options.ts');
  expect(staticImports('i18n/nav-label-bridges.ts').sort()).toEqual(['i18n/he.ts', 'tickets/nav-text.ts']);
});

test('nav-text holds the two shell words once; rfq-text reads them from there (same text in both languages)', () => {
  expect(staticImports('tickets/nav-text.ts').sort()).toEqual(['i18n/nav-labels.ts', 'tickets/naming.ts']);
  for (const k of ['navTitle', 'navQuestionsAria'] as const) {
    expect(rfqTemplate(k, 'he')).toBe(NAV_RFQ_HE[k]);
    expect(rfqTemplate(k, 'en')).toBe(NAV_RFQ_EN[k]);
  }
  expect(nt('navTitle')).toBe(rt('navTitle'));
  expect(navRfqTitle()).toBe(rt('navTitle'));
  expect(nt('navQuestionsAria', { n: 3 })).toBe(rt('navQuestionsAria', { n: 3 }));
  expect(nt('navQuestionsAria', { n: 3 })).toBe('3 שאלות של ספקים ממתינות');
  // no string exists twice: the Hebrew words are written in nav-text only
  expect(read('tickets/rfq-text.ts')).not.toContain(`'${NAV_RFQ_HE.navQuestionsAria}'`); // (qBadgeAria is a longer, different text)
  expect(read('tickets/rfq-text.ts')).not.toContain(`navTitle: '${NAV_RFQ_HE.navTitle}'`);
});

test('xs-options is the one home of the ui.xs options; xs-model re-exports the very same bindings', () => {
  expect(staticImports('xsection/xs-options.ts')).toEqual([]);
  expect(model.xsOptions).toBe(options.xsOptions);
  expect(model.setXsOptions).toBe(options.setXsOptions);
  expect(model.normalizeXs).toBe(options.normalizeXs);
  expect(model.XS_DEFAULT).toBe(options.XS_DEFAULT);
  model.setXsOptions({ syn_tab: false });
  expect(options.xsOptions().syn_tab).toBe(false);
  options.setXsOptions(null);
  expect(model.xsOptions().syn_tab).toBe(true);
});

test('main.ts loads the remote start-up only on the remote channel, as a chunk of its own', () => {
  expect(staticImports('main.ts')).not.toContain('arx/boot.ts');
  expect(code('main.ts')).toMatch(/if \(REMOTE\) void import\('\.\/arx\/boot'\)\.then\(\(m\) => m\.bootRemote\(\)\)/);
});

test('the device popup, the user menu and the floor link dialog import their on-demand parts with import()', () => {
  const da = staticImports('components/device-activity.ts');
  expect(da).not.toContain('screens/schedule-editor.ts');
  expect(da).not.toContain('tickets/ticket-create.ts');
  expect(dynamicImports('components/device-activity.ts')).toEqual(expect.arrayContaining(['../screens/schedule-editor', '../tickets/ticket-create']));
  expect(staticImports('shell/sw-user-menu.ts')).not.toContain('components/sw-second-factor.ts');
  expect(dynamicImports('shell/sw-user-menu.ts')).toContain('../components/sw-second-factor');
  expect(staticImports('xsection/sw-floor-home-link.ts')).not.toContain('xsection/sw-xsection.ts');
  expect(dynamicImports('xsection/sw-floor-home-link.ts')).toContain('./sw-xsection');
});

test('GATE2342: a lazily imported tag is rendered only once its definition is there (never upgraded in place)', async () => {
  const da = code('components/device-activity.ts');
  // the editor sheet and the create form open only after their chunk landed
  expect(da).toMatch(/customElements\.get\('schedule-editor'\)/);
  expect(da).toMatch(/customElements\.get\('ticket-create'\)/);
  const menu = code('shell/sw-user-menu.ts');
  expect(menu).toMatch(/this\.factorReady \? html`<sw-second-factor><\/sw-second-factor>/);
  // schedule-editor is no longer the eager exception of the lazy-screens header: its route is a lazy screen like the others
  expect(read('shell/lazy-screens.ts')).not.toContain('Not listed: schedule-editor');
  expect(Object.keys((await import('../src/shell/lazy-screens')).LAZY_SCREENS)).toContain('schedule-editor');
});
