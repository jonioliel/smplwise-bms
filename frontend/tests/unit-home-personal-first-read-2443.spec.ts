import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ApiError, describeError } from '../src/api/client';
import { loadPersonal } from '../src/api/home';
import { firstRead, noChoices, readOwnChoices } from '../src/shell/home-personal-read';

// CR-UI-POLISH-2443 (docs/changes/CR-FE-PROMISES-2442.md, lead question 2 a): "החשבון שלי › המסך שלי" shows the reason when its
// first read fails. Two parts, both run here without a browser page:
//   - readOwnChoices(): the user's own choices from one read of /me/prefs that REJECTS when it fails. The readers the section
//     used before (loadPersonal, loadPersonalRow) answer "no choices" on a failure, so the section showed the installation's
//     defaults as if nothing was stored, and the next change replaced the stored choices;
//   - firstRead(): runs the reads, never rejects, and answers the reason for the section's one red note.
//   npx playwright test -c playwright.unit.config.ts tests/unit-home-personal-first-read-2443.spec.ts

const source = readFileSync(new URL('../src/shell/sw-home-personal.ts', import.meta.url), 'utf8');

type Reply = { status: number; body: unknown };
/** A server for the client: every request gets `reply`; the addresses asked are collected. */
async function withServer<T>(reply: Reply, run: (asked: string[]) => Promise<T>): Promise<T> {
  const g = globalThis as { document?: unknown };
  const fetchBefore = globalThis.fetch;
  const docBefore = g.document;
  g.document = { baseURI: 'http://h/app/' };
  const asked: string[] = [];
  globalThis.fetch = (async (url: string | URL) => {
    asked.push(String(url));
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  }) as typeof fetch;
  try {
    return await run(asked);
  } finally {
    globalThis.fetch = fetchBefore;
    if (docBefore === undefined) delete g.document;
    else g.document = docBefore;
  }
}

test.describe('readOwnChoices: the user\'s own choices for the editor', () => {
  test('one read of /me/prefs answers both values', async () => {
    const prefs = { 'home.personal': { direction: 'b', widgets: { weather: { on: false } } }, 'devices.area_row': { items: ['climate', 'lights'] } };
    await withServer({ status: 200, body: { prefs, stored: [], updated_at: null } }, async (asked) => {
      const own = await readOwnChoices();
      expect(asked).toEqual(['http://h/app/api/v1/me/prefs']);
      expect(own.personal.direction).toBe('b');
      expect(own.personal.widgets.weather).toEqual({ on: false });
      expect(own.row).toEqual({ items: ['climate', 'lights'] });
    });
  });

  test('a user who never chose: the empty value, the same as the demo mode\'s', async () => {
    const own = await readOwnChoices(async () => ({ prefs: {} }));
    expect(own).toEqual(noChoices());
    expect(own.personal.direction).toBeNull();
    expect(own.row).toEqual({});
  });

  test('a read the server fails REJECTS with the server\'s error - it is not "no choices"', async () => {
    await withServer({ status: 503, body: { code: 'unavailable', user_message: 'השרת אינו זמין כרגע', retryable: true, correlation_id: 'c1', details: {} } }, async () => {
      const failure: unknown = await readOwnChoices().then(() => null, (e: unknown) => e);
      expect(failure).toBeInstanceOf(ApiError);
      expect(describeError(failure)).toBe('השרת אינו זמין כרגע');
      // and through firstRead: nothing is applied, the section gets the reason
      let applied = 0;
      await expect(firstRead(() => Promise.all([readOwnChoices(), Promise.resolve('settings')]), () => applied++)).resolves.toBe('השרת אינו זמין כרגע');
      expect(applied).toBe(0);
    });
  });

  test('no connection rejects too, and the reason is the client\'s own sentence', async () => {
    const offline = new TypeError('Failed to fetch');
    await expect(firstRead(() => readOwnChoices(() => Promise.reject(offline)), () => undefined)).resolves.toBe(describeError(offline));
    expect(describeError(offline)).toBe('אין חיבור לשרת.');
  });

  test('the reader of the other screens still never rejects (they only apply the choices)', async () => {
    // outside the API mode it does not ask at all; the point is that its contract did not change
    await expect(loadPersonal()).resolves.toEqual(noChoices().personal);
  });
});

test.describe('firstRead', () => {
  test('reads that arrive are applied, and there is no reason to show', async () => {
    const got: number[][] = [];
    await expect(firstRead(() => Promise.all([Promise.resolve(1), Promise.resolve(2)]), (v) => got.push(v))).resolves.toBe('');
    expect(got).toEqual([[1, 2]]);
  });

  test('a read the server refused: nothing is applied and the answer is the reason, as describeError words it', async () => {
    const refused = new ApiError(403, { code: 'forbidden', user_message: 'אין הרשאה למסך האישי', retryable: false, correlation_id: 'c2', details: {} });
    let applied = 0;
    const reason = await firstRead(() => Promise.all([Promise.resolve(1), Promise.reject(refused)]), () => applied++);
    expect(applied).toBe(0);
    expect(reason).toBe('אין הרשאה למסך האישי');
    expect(reason).toBe(describeError(refused));
  });

  test('a read that throws before it returns a promise is a reason too, and the call itself never rejects', async () => {
    await expect(firstRead<number>(() => { throw new Error('no session'); }, () => undefined)).resolves.toBe('no session');
  });

  test('a fault while applying the answer is shown as well', async () => {
    await expect(firstRead(() => Promise.resolve({}), () => { throw new Error('bad home settings'); })).resolves.toBe('bad home settings');
  });
});

test.describe('the section "המסך שלי" (sw-home-personal.ts)', () => {
  const connected = source.slice(source.indexOf('connectedCallback() {'), source.indexOf('/** The elevators widget'));

  test('its first reads go through firstRead, and the reason lands in the note\'s state', () => {
    expect(connected).toContain('void firstRead(');
    expect(connected).toContain('() => Promise.all([isApi() ? readOwnChoices() : noChoices(), loadHomeSettings(true), productSettings().catch(() => null)]),');
    expect(connected).toContain(').then((reason) => (this.failed = reason));');
    // the bare chain that had no rejection handler is gone
    expect(source).not.toContain('void Promise.all([loadPersonal()');
  });

  test('the editor does not read its own values through the readers that hide a failure', () => {
    expect(source).not.toMatch(/\bloadPersonal\(|\bloadPersonalRow\(/);
    expect(connected).toContain('this.personal = own.personal;');
    expect(connected).toContain('this.row = own.row;');
  });

  test('with no data it renders the note (nothing while the read is on its way), not always nothing', () => {
    expect(source).toContain('if (!this.base) return this.errorNote();');
    expect(source).not.toContain('if (!this.base) return nothing;');
  });

  test('one red note for a failed read and a failed save: role="alert", the same hook, the reason as text', () => {
    const note = source.slice(source.indexOf('private errorNote()'), source.indexOf('render() {'));
    expect(note).toContain('this.failed ? html`<p class="err" role="alert" data-home-personal-error>${this.failed}</p>` : nothing');
    expect(source.match(/data-home-personal-error/g)?.length).toBe(1);
    expect(source.match(/this\.errorNote\(\)/g)?.length).toBe(2);
    expect(source).toMatch(/\.err \{[^}]*color: var\(--sw-danger\);/);
  });
});
