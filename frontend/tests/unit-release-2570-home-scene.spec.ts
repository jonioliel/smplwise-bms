import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../src/api/client';
import { runHomeScene } from '../src/home/home-scene-run';

// RELEASE-2570-TRAIN (lead 28.11): the simple home screen's scene buttons use FIX-FE2-2570's run-with-confirmation rule
// (api/run-confirm.ts) and the shared unknown-outcome reading (api/physical-outcome.ts): a lost answer is "unknown" (amber), never
// "did not run", never sent again; after a run the screen says "request sent", not "scene ... ran". Node only.

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f: string) => readFileSync(path.join(here, '..', 'src', f), 'utf8');
const scene = (o: { sensitive?: boolean; unknown_effects?: boolean } = {}) =>
  ({ id: 's1', name: 'יציאה', sensitive: !!o.sensitive, unknown_effects: !!o.unknown_effects, targets: [] });
const apiErr = (status: number, code: string, details: Record<string, unknown> = {}) =>
  new ApiError(status, { code, user_message: `msg:${code}`, retryable: false, correlation_id: 'c', details });
const describe = (e: unknown) => (e instanceof ApiError ? e.body.user_message : 'no answer');
type Sent = { confirm?: boolean; client_request_id: string };

test('a sensitive scene asked on screen is sent once with confirm: true; a "no" sends nothing', async () => {
  const sent: Sent[] = [];
  const send = async (o: Sent) => { sent.push(o); return { run_id: null }; };
  expect(await runHomeScene(scene({ sensitive: true }), send, async () => false, describe)).toEqual({ ok: false, sent: false, unknown: false, note: null });
  expect(sent).toEqual([]);
  expect(await runHomeScene(scene({ unknown_effects: true }), send, async () => true, describe)).toEqual({ ok: true, sent: true, unknown: false, note: null });
  expect(sent).toHaveLength(1);
  expect(sent[0].confirm).toBe(true);
});

test('a 409 confirmation_required asks, and on yes sends ONE more time with confirm and the same request id', async () => {
  const sent: Sent[] = [];
  let asked = 0;
  const send = async (o: Sent) => { sent.push(o); if (!o.confirm) throw apiErr(409, 'confirmation_required'); return { run_id: 'r' }; };
  const out = await runHomeScene(scene(), send, async () => { asked += 1; return true; }, describe);
  expect(out).toEqual({ ok: true, sent: true, unknown: false, note: null });
  expect(asked).toBe(1);
  expect(sent.map((o) => o.confirm)).toEqual([undefined, true]);
  expect(sent[1].client_request_id).toBe(sent[0].client_request_id);
});

test('a lost answer is unknown and is never sent again (504 config_timeout outcome unknown, no answer at all)', async () => {
  for (const fail of [apiErr(504, 'config_timeout', { outcome: 'unknown', error: 'ReadTimeout' }), new TypeError('Failed to fetch')]) {
    let n = 0;
    const out = await runHomeScene(scene(), async () => { n += 1; throw fail; }, async () => true, describe);
    expect(out).toEqual({ ok: false, sent: true, unknown: true, note: null });
    expect(n).toBe(1);
  }
});

test('a refusal is a failure with the server sentence (grant, members unknown), sent once', async () => {
  for (const fail of [apiErr(403, 'grant_required', { grant: 'door.unlock', entity_id: 'lock.front', path: 'members' }),
    apiErr(403, 'forbidden', { reason: 'scene_members_unknown' })]) {
    let n = 0;
    const out = await runHomeScene(scene(), async () => { n += 1; throw fail; }, async () => true, describe);
    expect(out).toEqual({ ok: false, sent: true, unknown: false, note: `msg:${fail.body.code}` });
    expect(n).toBe(1);
  }
});

test('the home screen wires it: home-actions uses runHomeScene, the screen says "request sent" and amber for unknown', () => {
  const actions = src('home/home-actions.ts');
  expect(actions).toContain('runHomeScene(');
  expect(actions).not.toMatch(/confirm:\s*s\.sensitive/);
  const home = src('home/sw-home.ts');
  expect(home).not.toContain("'סצנת {name} הופעלה'");
  expect(home).toContain("tr('הבקשה להפעלת {name} נשלחה'");
  expect(home).toMatch(/tr\('לא ידוע אם הסצנה הופעלה · בדקו במקום'\), null, 'warn'\)/);
});
