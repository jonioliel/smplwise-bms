import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openFile } from '../src/public-ticket/rfq/rfq-files';

// CR-FE-PROMISES-2442 (docs/changes/CR-FE-PROMISES-2442.md): the 27 ESLint reports that FE-6 counted in eslint-suppressions.json
// are fixed - a rejected promise is shown the screen's usual way, or dropped on purpose with the reason next to it. No browser page.
//   npx playwright test -c playwright.unit.config.ts tests/unit-fe-promises-2442.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = (f: string) => fs.readFileSync(path.join(HERE, '..', f), 'utf8');
const src = (f: string) => root(path.join('src', f));
const blob = () => new Blob(['x']);

test('the suppression file is empty: every promise / lit report is an error from now on', () => {
  expect(JSON.parse(root('eslint-suppressions.json'))).toEqual({});
});

test.describe('RFQ files: opening a picture or a document', () => {
  test('a fetched file is handed on, and nothing is reported', async () => {
    const got: Blob[] = [];
    let errors = 0;
    const b = blob();
    await openFile(async () => b, (x) => got.push(x), () => errors++);
    expect(got).toEqual([b]);
    expect(errors).toBe(0);
  });

  test('a file the server did not give says so in the card', async () => {
    let used = 0;
    let errors = 0;
    await openFile(async () => null, () => used++, () => errors++);
    expect([used, errors]).toEqual([0, 1]);
  });

  test('a failure while showing or saving the file says so too (it used to vanish) - once, and the click never rejects', async () => {
    let errors = 0;
    await expect(openFile(async () => blob(), () => { throw new Error('showModal refused'); }, () => errors++)).resolves.toBeUndefined();
    expect(errors).toBe(1);
  });

  test('a fetch that rejects is the same line', async () => {
    let errors = 0;
    await expect(openFile(() => Promise.reject(new Error('offline')), () => undefined, () => errors++)).resolves.toBeUndefined();
    expect(errors).toBe(1);
  });

  test('both buttons of the card go through it', () => {
    const s = src('public-ticket/rfq/rfq-files.ts');
    expect(s.match(/void openFile\(/g)?.length).toBe(2);
    expect(s).not.toMatch(/click['"]?,?\s*:?\s*async/);
  });
});

test.describe('the camera player: a WebRTC start that throws', () => {
  const s = src('components/sw-live-player.ts');

  test('startWebrtc() is never started without a handler', () => {
    const calls = s.match(/this\.startWebrtc\(\)[^\n]*/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c, c).toMatch(/^this\.startWebrtc\(\)\.catch\(/);
  });

  test('the handler ends the attempt the usual way (next step / MSE / the error with its retry), only for the current connection', () => {
    const at = s.indexOf('this.startWebrtc().catch(');
    const handler = s.slice(at, at + 200);
    expect(handler).toContain('gen === this.generation');
    expect(handler).toContain('this.webrtcFailed(');
  });
});

test.describe('my home screen: every choice is saved through commit()', () => {
  const s = src('shell/sw-home-personal.ts');

  test('commit() shows a failed save and puts the previous choice back', () => {
    const body = s.slice(s.indexOf('private async commit('), s.indexOf('private async commitRow('));
    expect(body).toMatch(/catch \(err\) \{\s*this\.personal = before;\s*this\.failed = describeError\(err\);/);
    expect(s).toContain('data-home-personal-error');
  });

  test('no setter starts it as a bare statement', () => {
    expect(s).not.toMatch(/^\s*this\.commit\(/m);
    expect(s.match(/^\s*void this\.commit\(/gm)?.length).toBe(5);
  });
});

test('timers and listeners of the other screens take a plain function (the async work inside ends in a handler)', () => {
  for (const f of ['calendars/view-calendar.ts', 'notices/compose-dialog.ts', 'screens/explore-sites.ts', 'screens/investigate-event-detail.ts',
    'screens/wiskey-access-diag.ts', 'screens/wiskey-people.ts', 'temperature/report.ts', 'temperature/whatsapp.ts']) {
    const s = src(f);
    expect(s, f).not.toMatch(/set(Timeout|Interval)\(async /);
    expect(s, f).not.toMatch(/addEventListener\('[a-z]+', async /);
    expect(s, f).toMatch(/\}\)\(\)\.catch\(/);
  }
});

test('the remote-access card writes its angle brackets as entities (the text shown is unchanged)', () => {
  const s = src('screens/system-diagnostics.ts');
  // I18N-EN-2490: the subheading is a tr() text now - a JS string bound with ${...}, never parsed as markup, so its brackets are plain
  expect(s).toContain("subheading=${tr('כניסה דרך https://<שם ה־Home Assistant>/arx");
  expect(s).not.toContain('subheading="כניסה דרך https://<שם');
});
