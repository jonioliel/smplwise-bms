import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextIndex, rovingStop } from '../src/components/tab-strip';

// A11Y-R4-LEFTOVERS-2380 (docs/changes/A11Y-R4-LEFTOVERS-2380.md): the node-only half. The switch contrast tokens are in
// tests/unit-switch-contrast-2380.spec.ts; the browser half is tests/a11y-r4-leftovers-2380.spec.ts.

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');

test.describe('sw-tabs as a tablist: the keys (tab-strip.ts)', () => {
  test('LTR: ArrowRight is the next tab, ArrowLeft the previous one, both wrap', () => {
    expect(nextIndex('ArrowRight', 0, 4, false)).toBe(1);
    expect(nextIndex('ArrowRight', 3, 4, false)).toBe(0);
    expect(nextIndex('ArrowLeft', 0, 4, false)).toBe(3);
    expect(nextIndex('ArrowLeft', 2, 4, false)).toBe(1);
  });
  test('RTL: ArrowLeft is the next tab, ArrowRight the previous one', () => {
    expect(nextIndex('ArrowLeft', 0, 4, true)).toBe(1);
    expect(nextIndex('ArrowLeft', 3, 4, true)).toBe(0);
    expect(nextIndex('ArrowRight', 0, 4, true)).toBe(3);
  });
  test('Home / End jump to the ends, any other key is left alone', () => {
    expect(nextIndex('Home', 2, 5, false)).toBe(0);
    expect(nextIndex('End', 1, 5, true)).toBe(4);
    expect(nextIndex('ArrowDown', 1, 5, false)).toBeNull();
    expect(nextIndex('Enter', 1, 5, false)).toBeNull();
    expect(nextIndex('End', 0, 0, false)).toBeNull();
  });
  test('roving tabindex: the selected tab is the one Tab stop, the first tab when none is selected, none for an empty strip', () => {
    expect(rovingStop(['a', 'b', 'c'], 'b')).toBe(1);
    expect(rovingStop(['a', 'b', 'c'], 'c')).toBe(2);
    expect(rovingStop(['a', 'b', 'c'], '')).toBe(0);
    expect(rovingStop(['a', 'b', 'c'], 'zzz')).toBe(0);
    expect(rovingStop([], 'a')).toBe(-1);
  });
});

test.describe('sw-tabs renders a real tablist (components/sw-tabs.ts)', () => {
  const src = read('components/sw-tabs.ts');
  test('the row is the tablist, every entry a tab with aria-selected and a roving tabindex', () => {
    expect(src).toMatch(/<div class="row" role="tablist"[^>]*aria-orientation="horizontal" @keydown=\$\{this\.onKey\}>/);
    expect((src.match(/role="tab"/g) ?? []).length).toBe(2); // the link form and the button form
    expect(src).toMatch(/<a href=\$\{it\.href\} role="tab"[^>]*aria-selected=\$\{it\.id === this\.active\} tabindex=\$\{i === stop \? 0 : -1\}/);
    expect(src).toMatch(/<button type="button" role="tab"[^>]*aria-selected=\$\{it\.id === this\.active\} tabindex=\$\{i === stop \? 0 : -1\}/);
  });
  test('aria-pressed is gone from the strip; a link keeps aria-current="page" (the specs and the nav read it)', () => {
    expect(src).not.toContain('aria-pressed');
    expect(src).toContain("aria-current=${it.id === this.active ? 'page' : 'false'}");
  });
  test('the keys are on the tablist; a link tab is also opened by Space', () => {
    expect(src).toMatch(/nextIndex\(ev\.key, at, tabs\.length, this\.rtl\)/);
    expect(src).toMatch(/ev\.key === ' ' && focused\?\.tagName === 'A'/);
  });
  test('`panel` marks the content element as a tabpanel named by the selected tab (an id reference cannot cross the shadow root)', () => {
    expect(src).toMatch(/@property\(\) panel = ''/);
    expect(src).toMatch(/setAttribute\('role', 'tabpanel'\)/);
    expect(src).toMatch(/setAttribute\('aria-label', on\.label\)/);
    expect(src).toMatch(/this\.markPanel\(\);/);
    for (const [f, id] of [['screens/system-infra.ts', 'infra-section'], ['screens/system-notices.ts', 'board-panel']] as const) {
      const s = read(f);
      expect(s, f).toContain(`panel="${id}"`);
      expect(s, f).toContain(`id="${id}"`);
    }
  });
  test('the look is untouched: the tabs are still the same a / button elements the stylesheet targets', () => {
    expect(src).toMatch(/\n    a,\n    button \{\n      position: relative;/);
    expect(src).toContain(":host([data-variant='pill']) .on .lbl");
  });
});

test.describe('plan editor icon bar (screens/explore-plan-editor.ts)', () => {
  const src = read('screens/explore-plan-editor.ts');
  test('desktop look unchanged: the key is 26 px', () => {
    expect(src).toMatch(/\.bar button\.icon \{[^}]*inline-size: 26px;[^}]*block-size: 26px;/s);
  });
  test('a coarse pointer gets a 44 px hit area through an invisible layer, without growing the drawn key', () => {
    const m = /@media \(pointer: coarse\) \{\s*\.bar button\.icon \{([^}]*)\}\s*\/\*[^]*?\*\/\s*\.bar button\.icon::after \{([^}]*)\}/.exec(src);
    expect(m, 'the coarse block').not.toBeNull();
    expect(m![1]).toContain('position: relative');
    expect(m![1]).toContain('inline-size: var(--sw-ctl-h-lg)');
    expect(m![2]).toContain('position: absolute');
    expect(m![2]).toContain('inset: min(0px, calc((var(--sw-ctl-h-lg) - 44px) / 2))');
  });
  test('the layer cannot overlap a neighbour: it grows by at most 4 px a side (ctl-h-lg >= 36) and the bar gap is 8 px', () => {
    expect(src).toMatch(/\.bar \{[^}]*gap: 8px;/s);
  });
});

test.describe('shell status key note (shell/sw-app.ts)', () => {
  const src = read('shell/sw-app.ts');
  test('aria-expanded and aria-controls follow the note (controls only while it exists)', () => {
    expect(src).toContain("aria-expanded=${this.sysPop ? 'true' : 'false'} aria-controls=${this.sysPop ? 'sys-pop' : nothing}");
    expect(src).toContain('id="sys-pop" data-sys-pop role="dialog"');
  });
  test('a keyboard open (click with detail 0) moves the focus into the note; a pointer open does not', () => {
    expect(src).toMatch(/private onSysDotClick = \(e: MouseEvent\) => \{\s*this\.sysPop = !this\.sysPop;\s*if \(!this\.sysPop \|\| e\.detail !== 0\) return;/);
    expect(src).toMatch(/\[data-sys-pop\]'\)\?\.focus\(\{ preventScroll: true \}\)/);
    expect(src).toMatch(/data-sys-pop role="dialog" aria-label="[^"]+" tabindex="-1"/);
  });
  test('Escape closes it and returns the focus to the key; Tab out of the note closes it behind the focus', () => {
    expect(src).toMatch(/e\.key === 'Escape' && this\.sysPop\) this\.closeSysPop\(true\)/);
    expect(src).toMatch(/closeSysPop\(restoreFocus = false\)[^}]*\[data-sys-static\]'\)\?\.focus/s);
    expect(src).toMatch(/onSysPopFocusOut = \(e: FocusEvent\) => \{\s*const to = e\.relatedTarget as Element \| null;\s*if \(!to\) return;/);
  });
});

test.describe('sticky save row on a phone', () => {
  test('the phone scroller keeps a focused field clear of the pinned row (row 66 px + 8 px offset)', () => {
    const src = read('shell/sw-app.ts');
    expect(src).toMatch(/main \{\s*overscroll-behavior-y: contain;[^}]*scroll-padding-block-end: calc\(var\(--sw-s-2\) \+ 66px\);/s);
  });
  test('every sticky save row is in the flow (position: sticky), none is fixed - the end of a page is never covered', () => {
    for (const f of ['styles/settings.ts', 'pwa/notifications-settings.ts', 'screens/electricity/settings-retention.ts', 'screens/system-access-messaging.ts', 'screens/system-announce-templates.ts', 'screens/system-presence.ts']) {
      const s = read(f);
      expect(s, f).toMatch(/position: sticky;\s*inset-block-end: var\(--sw-s-2\);/);
      expect(s, f).not.toMatch(/\.(foot|actions|bar)[^{]*\{[^}]*position: fixed/);
    }
  });
});
