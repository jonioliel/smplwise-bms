import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { activateKeydown, isActivateKey, type ActivateKeyEvent } from '../src/components/activate-keys';

// CR-A11Y-ROWS-2443 (code review 2026-11-13, D14 / 06:A11Y-1): rows and cards that open something on a click must be reachable and
// usable from the keyboard (Tab to it, Enter or Space runs the click), and a key pressed on a control INSIDE such a row must not run the
// row as well. Node only: the helper's behaviour, then a keyboard pass over the sources of the eight screens of the row - every
// non-native element with an @click either carries tabindex="0" + activateKeydown, or is reachable another way that is pinned here.
//   npx playwright test -c playwright.unit.config.ts tests/unit-a11y-rows-2443.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');

function ev(over: Partial<ActivateKeyEvent> & { key: string }, self = true): ActivateKeyEvent & { prevented: number } {
  const row = { id: 'row' } as unknown as EventTarget;
  const inner = { id: 'inner' } as unknown as EventTarget;
  const e: ActivateKeyEvent & { prevented: number } = { target: self ? row : inner, currentTarget: row, prevented: 0, preventDefault() { e.prevented++; }, ...over };
  return e;
}

test.describe('activateKeydown', () => {
  test('Enter and Space on the row itself run it once and stop the page scroll', () => {
    for (const key of ['Enter', ' ']) {
      let runs = 0;
      const e = ev({ key });
      activateKeydown(() => runs++)(e);
      expect(runs).toBe(1);
      expect(e.prevented).toBe(1);
    }
  });

  test('a key pressed on a control inside the row is left to that control', () => {
    let runs = 0;
    const e = ev({ key: 'Enter' }, false);
    activateKeydown(() => runs++)(e);
    expect(runs).toBe(0);
    expect(e.prevented).toBe(0);
  });

  test('other keys, modifiers and auto-repeat do nothing', () => {
    for (const e of [ev({ key: 'a' }), ev({ key: 'Tab' }), ev({ key: 'Escape' }), ev({ key: 'Enter', ctrlKey: true }), ev({ key: 'Enter', shiftKey: true }),
      ev({ key: ' ', altKey: true }), ev({ key: 'Enter', metaKey: true }), ev({ key: 'Enter', repeat: true })]) {
      expect(isActivateKey(e)).toBe(false);
      let runs = 0;
      activateKeydown(() => runs++)(e);
      expect(runs).toBe(0);
    }
  });
});

/** Each `<tr|div|span|li|sw-card ...>` opening tag on one line that carries an @click, with the rest of its line. */
function clickTags(source: string): { tag: string; line: number; text: string }[] {
  const out: { tag: string; line: number; text: string }[] = [];
  source.split('\n').forEach((l, i) => {
    const re = /<(tr|div|span|li|article|section|sw-card)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(l))) {
      const rest = l.slice(m.index);
      const next = rest.indexOf('<', 1);
      const own = next < 0 ? rest : rest.slice(0, next);
      if (own.includes('@click=')) out.push({ tag: m[1], line: i + 1, text: own });
    }
  });
  return out;
}
const keyboardRow = (t: string) => t.includes('tabindex="0"') && t.includes('@keydown=${activateKeydown(');
const stopOnly = (t: string) => /@click=\$\{stop\}/.test(t) || /@click=\$\{\(e: Event\) => e\.stopPropagation\(\)\}/.test(t);

test.describe('keyboard pass over the screens of the row', () => {
  test('system-notices: the boards table row and the phone board card', () => {
    const s = read('screens/system-notices.ts');
    expect(s).toMatch(/<tr class="go" tabindex="0" data-board=\$\{b\.slug\} @click=\$\{\(\) => this\.goBoard\(b\)\} @keydown=\$\{activateKeydown\(\(\) => this\.goBoard\(b\)\)\}>/);
    expect(s).toMatch(/<div class="card" tabindex="0" role="link" data-board-card=\$\{b\.slug\} @click=\$\{\(\) => this\.goBoard\(b\)\} @keydown=\$\{activateKeydown\(\(\) => this\.goBoard\(b\)\)\}>/);
    // the old handler took Enter from the row's own buttons too (edit / delete navigated to the board)
    expect(s).not.toMatch(/e\.key === 'Enter' && this\.goBoard/);
    for (const t of clickTags(s)) expect(keyboardRow(t.text) || stopOnly(t.text), `system-notices.ts:${t.line} ${t.text.slice(0, 80)}`).toBe(true);
  });

  test('explore-sites: the site cards and the building rows', () => {
    const s = read('screens/explore-sites.ts');
    expect(s).toMatch(/<sw-card flush interactive tabindex="0" role=\$\{buildings\.length \? 'link' : 'button'\} aria-label=\$\{s\.name\} data-site-card=/);
    expect(s).toMatch(/@keydown=\$\{activateKeydown\(\(\) => this\.openSite\(s\)\)\}/);
    expect(s).toMatch(/<sw-card class="brow" tabindex="0" role="link" aria-label=\$\{b\.name\} data-building-card=/);
    for (const t of clickTags(s)) expect(keyboardRow(t.text) || stopOnly(t.text), `explore-sites.ts:${t.line} ${t.text.slice(0, 80)}`).toBe(true);
  });

  test('investigate-incidents: the recent-incidents table row (the phone cards are buttons already)', () => {
    const s = read('screens/investigate-incidents.ts');
    expect(s).toMatch(/<tr tabindex="0" data-incident-row=\$\{i\.id\}[^\n]*@keydown=\$\{activateKeydown\(\(\) => navigate\(`\/investigate\/incidents\/\$\{i\.id\}`\)\)\}>/);
    expect(s).toMatch(/<button type="button" class="c" data-incident-card=/);
    for (const t of clickTags(s)) {
      const ok = keyboardRow(t.text) || stopOnly(t.text) || /@keydown=\$\{\(e: KeyboardEvent\) => \{ if \(e\.key === 'Enter' \|\| e\.key === ' '\)/.test(t.text);
      expect(ok, `investigate-incidents.ts:${t.line} ${t.text.slice(0, 80)}`).toBe(true);
    }
  });

  test('schedule-table-view: a slot row selects from the keyboard; its fields keep their own keys', () => {
    const s = read('screens/schedule-table-view.ts');
    expect(s).toMatch(/data-row=\$\{slot\.uid\} tabindex="0" @click=\$\{\(\) => this\.fire\('slot-select', \{ uid: slot\.uid \}\)\} @keydown=\$\{activateKeydown\(\(\) => this\.fire\('slot-select', \{ uid: slot\.uid \}\)\)\}>/);
    for (const t of clickTags(s)) expect(keyboardRow(t.text) || stopOnly(t.text), `schedule-table-view.ts:${t.line} ${t.text.slice(0, 80)}`).toBe(true);
  });

  test('water accounts / bills / customers: each clickable row holds a real link to the same page (already a tab stop; no second one added)', () => {
    for (const [file, attr] of [['screens/water/page-accounts.ts', 'data-account-row'], ['screens/water/page-accounts.ts', 'data-bill-row'], ['screens/water/page-customers.ts', 'data-customer-row']] as const) {
      const s = read(file);
      const at = s.indexOf(`<tr class="go" ${attr}=`);
      expect(at, `${file} ${attr}`).toBeGreaterThan(0);
      expect(s.slice(at, at + 600), `${file} ${attr}`).toMatch(/<a class="rowlink[^"]*" href=\$\{`#/);
      for (const t of clickTags(s)) {
        const ok = stopOnly(t.text) || (t.tag === 'tr' && t.text.includes('class="go"') && s.split('\n').slice(t.line - 1, t.line + 1).join('\n').includes('class="rowlink'));
        expect(ok, `${file}:${t.line} ${t.text.slice(0, 80)}`).toBe(true);
      }
    }
  });

  test('infra-report: the report delegates clicks from its own links only (a[data-go], keyboard-reachable)', () => {
    expect(read('screens/infra-report.ts')).toMatch(/closest\('\[data-go\]'\)/);
    const preview = read('insights/report-preview.ts');
    const gos = preview.match(/<[a-z-]+ [^\n]*?data-go="/g) ?? [];
    expect(gos.length).toBeGreaterThan(0);
    for (const g of gos) expect(g.startsWith('<a ')).toBe(true);
  });

  test('devices-synoptic: the lights cell is inside the row button; the keyboard path is the row, then the floor-lights button', () => {
    const s = read('screens/devices-synoptic.ts');
    expect(s).toMatch(/<button class="srow sgrid"/);
    expect(s).toMatch(/data-syn-lights-open=\$\{sf\.id\} @click=\$\{\(\) => this\.openLights\(null, sf\)\}/);
    // a tab stop INSIDE a <button> would be nested interactive content: the cell stays a pointer shortcut
    expect(s).not.toMatch(/class="cell \$\{can \? 'lights-hit' : ''\}"[^\n]*tabindex/);
  });
});
