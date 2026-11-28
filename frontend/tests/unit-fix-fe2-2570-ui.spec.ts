import { test, expect, type Page, type Route } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// FIX-FE2-2570 (deep review 2.57 FRONTEND-CORE, second pass): the screens' behaviour, on the REAL components. The shell's step-up
// handler, the API client, the session and the screens are bundled as they are (esbuild, as unit-step-up-queue-2540) and run on a
// mocked page (no backend, no dev server); every request is answered by the route table below and recorded.
// The bundle imports only modules that exist before the fix too, so the same spec run against v2.56.0 fails test by test.
//   npx playwright test -c playwright.unit.config.ts tests/unit-fix-fe2-2570-ui.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'http://arx.test';

test.use({ serviceWorkers: 'block' });

let bundled = '';
async function bundle(): Promise<string> {
  if (bundled) return bundled;
  const out = await build({
    stdin: {
      contents: [
        "import '../design/boot';",
        "import { installStepUp } from './step-up';",
        "import * as S from '../api/session';",
        "import * as C from '../api/client';",
        "import { confirmDialog } from '../components/confirm-dialog';",
        "import { runLaunch } from '../api/launcher';",
        "import { castStore } from '../components/cast-store';",
        "import { noteServerTime } from '../api/server-clock';",
        "import { runFloorBake } from '../screens/floor-stills';",
        "import { physicalOutcome } from '../api/physical-outcome';",
        "import '../screens/scenes-panel';",
        "import '../screens/area-quick-sheet';",
        "import '../screens/wall-photo-sets';",
        "import '../screens/messaging-pacing-card';",
        "import '../screens/messaging-policy-card';",
        "import '../screens/scenarios-panel';",
        'installStepUp();',
        'Object.assign(window as unknown as Record<string, unknown>, { T: { S, C, confirmDialog, runLaunch, castStore, noteServerTime, runFloorBake, physicalOutcome } });',
      ].join('\n'),
      resolveDir: path.join(HERE, '../src/shell'), loader: 'ts',
    },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', tsconfig: path.join(HERE, '../tsconfig.json'),
    loader: { '.glb': 'empty', '.png': 'empty', '.jpg': 'empty', '.svg': 'text', '.css': 'text', '.woff2': 'empty', '.hdr': 'empty', '.ktx2': 'empty', '.wasm': 'empty' },
    define: { 'import.meta.env.BASE_URL': '"/app/"', 'import.meta.env.DEV': 'false', __ARX_BUILD__: '"test"' },
  });
  bundled = out.outputFiles[0].text;
  return bundled;
}

const PERMS = ['devices.read', 'devices.control', 'scene.manage', 'script.run', 'automation.manage', 'media.read', 'media.cast', 'system.configure', 'messaging.accounts.manage', 'presence.building.view', 'map.read', 'map.edit'];
const ME = {
  user: { id: 'u-admin', username: 'admin', display_name: 'מנהל', source: 'ingress' }, channel: 'local', remote: null, active: true,
  bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל מערכת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }],
  permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
};
const fail = (code: string, msg: string, status: number) => ({ status, body: { code, user_message: msg, retryable: false, correlation_id: 'c', details: {} } });

type Sent = { method: string; path: string; body: unknown };
type Answer = { status?: number; body?: unknown } | Promise<{ status?: number; body?: unknown }>;
type Handler = (s: Sent) => Answer | undefined;

async function setup(page: Page, handler: Handler): Promise<Sent[]> {
  const sent: Sent[] = [];
  await page.routeWebSocket(/.*/, () => undefined);
  await page.route(`${ORIGIN}/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === '/app/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="he" dir="rtl"><head><title>t</title></head><body></body></html>' });
    const p = url.pathname.replace('/app/api/v1/', '') + url.search;
    let body: unknown = null;
    try {
      body = req.postDataJSON();
    } catch {
      body = req.postData() ? 'form' : null;
    }
    const s = { method: req.method(), path: p, body };
    if (p === 'me') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(ME) });
    sent.push(s);
    const a = await handler(s);
    if (a) return route.fulfill({ status: a.status ?? 200, contentType: 'application/json', body: JSON.stringify(a.body ?? {}) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'not_found', user_message: 'x', retryable: false, correlation_id: 'c', details: {} }) });
  });
  await page.goto(`${ORIGIN}/app/`);
  await page.addScriptTag({ content: await bundle(), type: 'module' });
  await page.waitForFunction(() => 'T' in window);
  await page.evaluate(async () => {
    await (window as unknown as { T: { S: { loadSession(): Promise<unknown> } } }).T.S.loadSession();
  });
  return sent;
}

/** A held answer: the request waits until `release` is called. */
function held<T>(): { promise: Promise<T>; release: (v: T) => void } {
  let release: (v: T) => void = () => undefined;
  const promise = new Promise<T>((r) => (release = r));
  return { promise, release };
}

function scene(over: Record<string, unknown> = {}) {
  return {
    kind: 'scene', id: 'entity:scene.leave', config_id: null, entity_id: 'scene.leave', name: 'יציאה מהבית', description: '', icon: null, source: 'integration', state: 'scene', sentence: '',
    floors: [], areas: [], targets: [{ entity_id: 'lock.front', name: 'דלת כניסה', floor: null, area: null, class: 'lock', sensitive: true, missing: false }],
    sensitive: true, sensitive_classes: ['lock'], locked_count: 0, unknown_effects: false, mode: null, extras: [], labels: [], category: null, last_run: null, runs_7d: null,
    created_via: 'external', owner: null, updated_at: null, revision: null, pinned: false, favourite: false, hidden: false,
    can: { edit: false, code_view: false, toggle: false, run: true, delete: false, copy: false }, read_only: null, warnings: [], ...over,
  };
}
const applies = (sent: Sent[]) => sent.filter((s) => s.method === 'POST' && /^automations\/scene\/.+\/apply$/.test(s.path));
const applyAnswer = (s: Sent): Answer | undefined => {
  if (!/\/apply$/.test(s.path)) return undefined;
  return (s.body as { confirm?: boolean }).confirm === true ? { status: 202, body: { run_id: null, op_id: 'op1', note: 'הבקשה נשלחה.' } } : fail('confirmation_required', 'פעולה זו דורשת אישור מפורש.', 409);
};
const confirmBox = (page: Page) => page.locator('sw-confirm-dialog');

// ------------------------------------------------------------------------------------------------ FE2-01 / FE2-04: the scenes panel

test.describe('FE2-01: the scenes panel runs a sensitive scene through the shared confirmation', () => {
  async function mount(page: Page, item: Record<string, unknown>) {
    await page.evaluate((it) => {
      const el = document.createElement('scenes-panel') as HTMLElement & { items: unknown[] };
      el.items = [it];
      document.body.append(el);
    }, item);
    await expect(page.locator('scenes-panel [data-scene-activate]')).toBeVisible();
  }

  test('a sensitive scene asks first (naming what it touches); cancel sends nothing; confirm sends ONE apply with confirm: true; the card says "נשלחה"', async ({ page }) => {
    const sent = await setup(page, applyAnswer);
    await mount(page, scene());
    await page.locator('scenes-panel [data-scene-activate]').click();
    await expect(confirmBox(page)).toHaveCount(1);
    await expect(confirmBox(page).locator('[data-confirm-text]')).toContainText('דלת כניסה');
    await confirmBox(page).locator('[data-confirm-cancel]').click();
    await expect(confirmBox(page)).toHaveCount(0);
    expect(applies(sent)).toHaveLength(0);
    await page.locator('scenes-panel [data-scene-activate]').click();
    await confirmBox(page).locator('[data-confirm-ok]').click();
    await expect.poll(() => applies(sent).length).toBe(1);
    expect((applies(sent)[0].body as { confirm?: boolean }).confirm).toBe(true);
    await expect(page.locator('scenes-panel [data-scene-activate]')).toHaveText('נשלחה'); // FE2-04: sent, not "activated"
    await page.waitForTimeout(300);
    expect(applies(sent)).toHaveLength(1);
  });

  test('the server asks (a door step the list does not show): the same question, then one more apply with confirm: true and the same request id', async ({ page }) => {
    const sent = await setup(page, applyAnswer);
    await mount(page, scene({ sensitive: false, sensitive_classes: [], targets: [] }));
    await page.locator('scenes-panel [data-scene-activate]').click();
    await expect(confirmBox(page)).toHaveCount(1);
    expect(applies(sent)).toHaveLength(1);
    await confirmBox(page).locator('[data-confirm-ok]').click();
    await expect.poll(() => applies(sent).length).toBe(2);
    const [a, b] = applies(sent).map((s) => s.body as { confirm?: boolean; client_request_id: string });
    expect(a.confirm).toBeFalsy();
    expect(b.confirm).toBe(true);
    expect(b.client_request_id).toBe(a.client_request_id);
  });
});

test('FE2-01: the home launcher asks before a sensitive scene and sends it with confirm: true', async ({ page }) => {
  const sent = await setup(page, (s) => (s.method === 'GET' && s.path.startsWith('automations?') ? { body: { items: [scene()], total: 1 } } : applyAnswer(s)));
  const out = page.evaluate(async () => {
    const T = (window as unknown as { T: { runLaunch: (i: unknown, ask?: unknown) => Promise<unknown>; confirmDialog: (o: unknown) => Promise<boolean> } }).T;
    try {
      return await T.runLaunch({ kind: 'scene', id: 'scene.leave', label: '' }, (t: { name: string }) => T.confirmDialog({ body: t.name }));
    } catch (e) {
      return `threw:${(e as { body?: { code?: string } })?.body?.code ?? String(e)}`;
    }
  });
  await expect(confirmBox(page)).toHaveCount(1);
  await confirmBox(page).locator('[data-confirm-ok]').click();
  expect(await out).toBe('sent');
  expect(applies(sent)).toHaveLength(1);
  expect((applies(sent)[0].body as { confirm?: boolean }).confirm).toBe(true);
});

test('FE2-01 (area quick sheet): a refused scene is SHOWN under the chips, not swallowed', async ({ page }) => {
  await setup(page, (s) => (/\/apply$/.test(s.path) ? fail('forbidden', 'אין לך הרשאה לפעולה הזו.', 403) : undefined));
  const note = await page.evaluate(async (it) => {
    const el = document.createElement('area-quick-sheet') as HTMLElement & { runScene(i: unknown): Promise<void>; sceneNote?: { text: string; bad: boolean } | null };
    await el.runScene(it);
    return el.sceneNote ?? null;
  }, scene({ sensitive: false, targets: [] }));
  expect(note?.bad).toBe(true);
  expect(note?.text ?? '').not.toBe('');
});

// ------------------------------------------------------------------------------------------------ VD2-05: honest outcomes of a scene press

test.describe('VD2-05: a scene that got no answer is "unknown - check on site", never "not run"; a sensitive scene can be saved', () => {
  test('the scenes panel: a lost answer is an amber note, a refusal a red one', async ({ page }) => {
    await setup(page, (s) => (/\/apply$/.test(s.path) ? fail('run_too_soon', 'הסצנה הופעלה ממש עכשיו.', 409) : undefined));
    await page.route(`${ORIGIN}/app/api/v1/automations/scene/entity%3Ascene.calm/apply`, (r) => r.abort('connectionreset'));
    const tones = await page.evaluate(async ([a, b]) => {
      const el = document.createElement('scenes-panel') as HTMLElement & { items: unknown[]; activate(i: unknown): Promise<void> };
      const seen: string[] = [];
      el.addEventListener('result', (e) => seen.push((e as CustomEvent<{ tone: string }>).detail.tone));
      el.items = [a, b];
      document.body.append(el);
      await el.activate(a);
      await el.activate(b);
      return seen;
    }, [scene({ id: 'entity:scene.calm', entity_id: 'scene.calm', sensitive: false, targets: [] }), scene({ id: 'entity:scene.tv', entity_id: 'scene.tv', sensitive: false, targets: [] })]);
    expect(tones).toEqual(['warn', 'error']);
  });

  test('the area quick sheet: a lost answer is shown amber (not as a failure)', async ({ page }) => {
    await setup(page, () => undefined);
    await page.route(`${ORIGIN}/app/api/v1/automations/**`, (r) => r.abort('connectionreset'));
    const note = await page.evaluate(async (it) => {
      const el = document.createElement('area-quick-sheet') as HTMLElement & { runScene(i: unknown): Promise<void>; sceneNote?: { text: string; bad: boolean; warn?: boolean } | null };
      await el.runScene(it);
      return el.sceneNote ?? null;
    }, scene({ sensitive: false, targets: [] }));
    expect(note).toMatchObject({ bad: false, warn: true });
  });

  test('the launcher: a failure before the run request is "not run" (refused); a lost run answer is "unknown"', async ({ page }) => {
    await setup(page, (s) => (s.method === 'GET' && s.path.startsWith('automations?') ? { body: { items: [scene({ sensitive: false, targets: [] })], total: 1 } } : undefined));
    await page.route(`${ORIGIN}/app/api/v1/automations/scene/**`, (r) => r.abort('connectionreset'));
    const out = await page.evaluate(async () => {
      const T = (window as unknown as { T: { runLaunch: (i: unknown, ask?: unknown) => Promise<unknown>; physicalOutcome: (e: unknown) => string } }).T;
      const kind = (p: Promise<unknown>) => p.then(() => 'ok', (e) => T.physicalOutcome(e));
      return [await kind(T.runLaunch({ kind: 'scene', id: 'scene.missing', label: '' })), await kind(T.runLaunch({ kind: 'scene', id: 'scene.leave', label: '' }))];
    });
    expect(out).toEqual(['refused', 'unknown']);
  });

  test('saving a scene the server calls sensitive: asked, then sent once more with confirm: true', async ({ page }) => {
    const sent = await setup(page, (s) => {
      if (s.method === 'POST' && s.path === 'automations/scene') return (s.body as { confirm?: boolean }).confirm ? { status: 201, body: { id: 'n1', revision: 'r1' } } : fail('confirmation_required', 'פעולה זו דורשת אישור מפורש.', 409);
      return { body: { items: [], total: 0 } };
    });
    const done = page.evaluate(async () => {
      const el = document.createElement('scenes-panel') as HTMLElement & { onSave(e: CustomEvent): Promise<void> };
      document.body.append(el);
      await el.onSave(new CustomEvent('save', { detail: { name: 'יציאה', members: [{ entity_id: 'lock.front', state: 'locked', attributes: {} }] } }));
    });
    await expect(confirmBox(page)).toHaveCount(1);
    await confirmBox(page).locator('[data-confirm-ok]').click();
    await done;
    const creates = sent.filter((s) => s.method === 'POST' && s.path === 'automations/scene').map((s) => (s.body as { confirm?: boolean }).confirm ?? null);
    expect(creates).toEqual([null, true]);
  });
});

// ------------------------------------------------------------------------------------------------ FE2-02 / FE2-05: the wall photos dialog

test.describe('FE2-02 / FE2-05: wall photo folders', () => {
  const SETS = { sets: [{ id: 'A', name: 'פרטי', count: 0, used_by: [] }, { id: 'B', name: 'לובי', count: 0, used_by: ['מסך לובי'] }], limits: { max_files: 200, max_bytes: 8 * 1024 * 1024 } };
  const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

  async function mount(page: Page) {
    await page.evaluate(() => {
      const el = document.createElement('sw-wall-photo-sets') as HTMLElement & { open: boolean };
      document.body.append(el);
      el.open = true;
    });
    await expect(page.locator('sw-wall-photo-sets [data-wall-set="A"]')).toBeVisible();
  }

  test('an upload stays in the folder it started in; the folders are locked while it runs and the progress line names the folder', async ({ page }) => {
    const first = held<{ status?: number; body?: unknown }>();
    let uploads = 0;
    const sent = await setup(page, (s) => {
      if (s.path === 'wall/photo-sets') return { body: SETS };
      if (/^wall\/photo-sets\/[AB]\/photos$/.test(s.path)) return { body: { photos: [] } };
      if (/\/upload$/.test(s.path)) return ++uploads === 1 ? first.promise : { body: { id: `p${uploads}`, w: 1, h: 1 } };
      return undefined;
    });
    await mount(page);
    await page.locator('sw-wall-photo-sets [data-wall-upload]').setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: PNG }, { name: 'b.png', mimeType: 'image/png', buffer: PNG }]);
    await expect.poll(() => uploads).toBe(1);
    await expect(page.locator('sw-wall-photo-sets [data-wall-set="B"]')).toBeDisabled();
    await expect(page.locator('sw-wall-photo-sets [data-wall-progress]')).toContainText('פרטי');
    // the folder changes under the running upload (any way it can): the rest still goes to A
    await page.evaluate(() => {
      (document.querySelector('sw-wall-photo-sets') as unknown as { current: string }).current = 'B';
    });
    first.release({ body: { id: 'p1', w: 1, h: 1 } });
    await expect.poll(() => uploads).toBe(2);
    const targets = sent.filter((s) => /\/upload$/.test(s.path)).map((s) => s.path);
    expect(targets).toEqual(['wall/photo-sets/A/upload', 'wall/photo-sets/A/upload']);
  });

  test('a late answer of folder A never shows under folder B; deleting a photo asks first', async ({ page }) => {
    let slowA: ReturnType<typeof held<{ status?: number; body?: unknown }>> | null = null;
    let readsA = 0;
    const sent = await setup(page, (s) => {
      if (s.path === 'wall/photo-sets') return { body: SETS };
      if (s.path === 'wall/photo-sets/A/photos') {
        readsA += 1;
        if (readsA === 2) return (slowA = held()).promise;
        return { body: { photos: [{ id: 'pa', w: 1, h: 1 }] } };
      }
      if (s.path === 'wall/photo-sets/B/photos') return { body: { photos: [{ id: 'pb', w: 1, h: 1 }] } };
      if (s.method === 'DELETE') return { body: {} };
      return undefined;
    });
    await mount(page);
    await expect(page.locator('sw-wall-photo-sets [data-wall-photo="pa"]')).toBeVisible();
    await page.locator('sw-wall-photo-sets [data-wall-set="A"]').click(); // held
    await expect.poll(() => readsA).toBe(2);
    await page.locator('sw-wall-photo-sets [data-wall-set="B"]').click();
    await expect(page.locator('sw-wall-photo-sets [data-wall-photo="pb"]')).toBeVisible();
    slowA!.release({ body: { photos: [{ id: 'pa', w: 1, h: 1 }] } });
    await page.waitForTimeout(300);
    await expect(page.locator('sw-wall-photo-sets [data-wall-photo="pa"]')).toHaveCount(0);
    await expect(page.locator('sw-wall-photo-sets [data-wall-photo="pb"]')).toBeVisible();
    // one tap on "x" no longer deletes a stored photo for good
    await page.locator('sw-wall-photo-sets [data-wall-photo-del="pb"]').click();
    await expect(confirmBox(page)).toHaveCount(1);
    await confirmBox(page).locator('[data-confirm-cancel]').click();
    await page.waitForTimeout(200);
    expect(sent.filter((s) => s.method === 'DELETE')).toHaveLength(0);
    await page.locator('sw-wall-photo-sets [data-wall-photo-del="pb"]').click();
    await confirmBox(page).locator('[data-confirm-ok]').click();
    await expect.poll(() => sent.filter((s) => s.method === 'DELETE').map((s) => s.path)).toEqual(['wall/photo-sets/B/photos/pb']);
  });
});

// ------------------------------------------------------------------------------------------------ FE2-07 / FE2-08: messaging cards

test('FE2-07: the pacing card puts the mode and the rate back to what is saved when the server refuses', async ({ page }) => {
  const VIEW = {
    mode: 'conservative', wiskey_shared: true, max_wait_min: { alert: 60, code: 5, ticket: 360, reminder: 720 }, budget: { per_minute: 10, burst: 5, burst_window_s: 10 },
    share_pct: { alert: 100, code: 95, ticket: 80, reminder: 60 }, per_minute: null, burst: null, shared_budget_guaranteed: false, accounts: [], can_manage: true, applies: true,
  };
  await setup(page, (s) => (s.path === 'messaging/whatsapp/pacing' ? (s.method === 'GET' ? { body: VIEW } : fail('validation', 'הערך נדחה', 422)) : undefined));
  await page.evaluate(() => document.body.append(document.createElement('messaging-pacing-card')));
  const mode = page.locator('messaging-pacing-card [data-pacing-mode]');
  await expect(mode).toHaveValue('conservative');
  await mode.selectOption('standard');
  await expect(page.locator('messaging-pacing-card [data-error]')).toBeVisible();
  await expect(mode).toHaveValue('conservative');
  const rate = page.locator('messaging-pacing-card [data-rate="per_minute"]');
  await rate.fill('30');
  await rate.dispatchEvent('change');
  await expect(rate).toHaveValue('10');
});

test('FE2-08: switching enforcement on with an empty list, and removing a recipient while it is on, ask first', async ({ page }) => {
  const view = (enforce: boolean, allow: unknown[]) => ({ enforce, can_manage: true, max_entries: 500, allow, self_messages: { active: false, until: null, minutes_default: 30, minutes_range: [1, 240] } });
  let current = view(false, []);
  const sent = await setup(page, (s) => (s.path.startsWith('messaging/whatsapp/policy') ? { body: current } : undefined));
  await page.evaluate(() => document.body.append(document.createElement('messaging-policy-card')));
  await expect(page.locator('messaging-policy-card [data-policy-enforce]')).toBeVisible();
  await page.locator('messaging-policy-card [data-policy-enforce]').click();
  await expect(confirmBox(page)).toHaveCount(1);
  await confirmBox(page).locator('[data-confirm-cancel]').click();
  await page.waitForTimeout(200);
  expect(sent.filter((s) => s.method !== 'GET')).toHaveLength(0);
  // enforcement on, one recipient: removing it would stop every message
  current = view(true, [{ id: 'e1', label: 'דנה', role: 'handler', last4: '0191' }]);
  await page.evaluate(() => (document.querySelector('messaging-policy-card') as unknown as { load(): Promise<void> }).load());
  await page.locator('messaging-policy-card [data-remove]').click();
  await expect(confirmBox(page)).toHaveCount(1);
  await expect(confirmBox(page)).toContainText('דנה');
  await confirmBox(page).locator('[data-confirm-cancel]').click();
  await page.waitForTimeout(200);
  expect(sent.filter((s) => s.method === 'DELETE')).toHaveLength(0);
});

// ------------------------------------------------------------------------------------------------ FE2-09: the scenario editor

test.describe('FE2-09: the scenario editor', () => {
  const sc = (id: string) => ({ id, name: `תרחיש ${id}`, description: '', enabled: false, version: 1, state: 'off', state_reason: null, state_reason_text: '', last_eval_at: null, last_result: null, last_fire_at: null, fires_today: 0, definition: null });

  test('open A then B on a slow link: A\'s late answer never fills the editor of B', async ({ page }) => {
    const slowA = held<{ status?: number; body?: unknown }>();
    await setup(page, (s) => (s.path === 'scenarios/A' ? slowA.promise : s.path === 'scenarios/B' ? { body: sc('B') } : undefined));
    const done = page.evaluate(async () => {
      const el = document.createElement('scenarios-panel') as HTMLElement & { openEditor(id: string): Promise<void>; editing: { id: string } | null };
      (window as unknown as { panel: unknown }).panel = el;
      const a = el.openEditor('A');
      await el.openEditor('B');
      return a;
    });
    await page.waitForFunction(() => ((window as unknown as { panel?: { editing?: { id: string } | null } }).panel?.editing?.id ?? '') === 'B');
    slowA.release({ body: sc('A') });
    await done;
    expect(await page.evaluate(() => (window as unknown as { panel: { editing: { id: string } | null } }).panel.editing?.id)).toBe('B');
  });

  test('a double click on "delete" sends ONE delete', async ({ page }) => {
    const sent = await setup(page, (s) => (s.method === 'DELETE' ? { status: 204 } : { body: { scenarios: [], can_manage: true } }));
    await page.evaluate(async (s) => {
      const el = document.createElement('scenarios-panel') as HTMLElement & { removeScenario(): Promise<void>; editing: unknown };
      el.editing = s;
      await Promise.all([el.removeScenario(), el.removeScenario()]);
    }, sc('S'));
    await page.waitForTimeout(200);
    expect(sent.filter((s) => s.method === 'DELETE')).toHaveLength(1);
  });
});

// ------------------------------------------------------------------------------------------------ FE2-03: a queued step-up dialog and a route change

test('FE2-03: a refusal that waits behind another dialog never opens after the address changed, and nothing more is sent', async ({ page }) => {
  const gate = (action: string) => ({ status: 403, body: { code: 'step_up_required', user_message: 'נדרש אישור', retryable: false, correlation_id: 'c', details: { action, methods: ['totp'], minutes: 5, verify_path: 'auth/step-up/verify' } } });
  const sent = await setup(page, (s) => (s.path === 'settings' ? gate('system.configure') : s.path === 'access-control/doors/d1/open' ? gate('door.open') : undefined));
  const done = page.evaluate(async () => {
    const C = (window as unknown as { T: { C: { patch(p: string, b: unknown): Promise<unknown>; post(p: string, b?: unknown): Promise<unknown> } } }).T.C;
    const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: { body?: { code?: string } }) => e?.body?.code ?? 'error');
    return Promise.all([code(C.patch('settings', { a: 1 })), code(C.post('access-control/doors/d1/open', {}))]);
  });
  await expect(page.locator('sw-step-up-dialog')).toHaveCount(1);
  await page.evaluate(() => (location.hash = '#/somewhere-else'));
  await page.waitForTimeout(600);
  await expect(page.locator('sw-step-up-dialog')).toHaveCount(0);
  expect(await done).toEqual(['step_up_required', 'step_up_required']);
  expect(sent.filter((s) => s.path === 'settings' || s.path === 'access-control/doors/d1/open')).toHaveLength(2);
});

// ------------------------------------------------------------------------------------------------ FE2-10: the cast countdown clock

test('FE2-10: the cast countdown runs on the server clock, not the device clock', async ({ page }) => {
  await setup(page, (s) => (s.path.startsWith('cast') ? { body: { sessions: [], max_sessions: 2 } } : undefined));
  const lag = await page.evaluate(() => {
    const T = (window as unknown as { T: { noteServerTime(ms: number, a: number, b: number): void; castStore: { now: number; put(s: unknown): void } } }).T;
    const t = Date.now();
    T.noteServerTime(t - 180_000, t - 20, t + 20); // this device runs 3 minutes ahead of the server
    T.castStore.put({ session_id: 'x', state: 'ended' });
    return Date.now() - T.castStore.now;
  });
  expect(lag).toBeGreaterThan(170_000);
  expect(lag).toBeLessThan(190_000);
});

// ------------------------------------------------------------------------------------------------ FE2-11: a bake that fails after the claim

test('FE2-11: a bake that throws after the claim reports the job failed (it is not left locked for the lease)', async ({ page }) => {
  const job = { id: 'j1', status: 'claimed', bake_key: 'k', scope: { levels: ['L0'], presets: [], styles: [], bands: [], lightmap: false }, requested_by: null, requested_at: '2026-11-28T10:00:00Z', claimed_by: null, claimed_at: null, lease_until: null };
  const sent = await setup(page, (s) => {
    if (s.path === 'floors/f1/bakes') return { body: { floor_id: 'f1', bake_key: 'k', geometry_key: 'g', doc_hash: 'h', levels: ['L0'], setting: {}, size: [10, 10], bakes: [], expected: [] } };
    if (s.path === 'floors/f1/bakes/regenerate') return { body: { job, created: true, expected: [] } };
    if (/\/claim$/.test(s.path)) return { body: { job, expected: [] } };
    if (/\/finish$/.test(s.path)) return { body: { job } };
    return undefined;
  });
  const line = await page.evaluate(async () => {
    const T = (window as unknown as { T: { runFloorBake(c: unknown): Promise<string> } }).T;
    // a bundle the page holds from before an update: its shape no longer matches (no zones) - the bake throws after the claim
    return T.runFloorBake({ bundle: { floorId: 'f1', geometryRef: { doc_hash: 'h' }, width: 10, height: 10 }, geometry: {}, catalog: null, live: null, onProgress: () => undefined, cancelled: () => false });
  });
  expect(line).not.toBe('');
  const fin = sent.filter((s) => /\/finish$/.test(s.path));
  expect(fin).toHaveLength(1);
  expect((fin[0].body as { status: string }).status).toBe('failed');
});

// ------------------------------------------------------------------------------------------------ compare-page screenshots (SW_SHOTS_DIR only)

const SHOTS = process.env.SW_SHOTS_DIR || '';
for (const scheme of ['light', 'dark'] as const) {
  for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
    test(`shots: ${vp.name} ${scheme}`, async ({ page }) => {
      test.skip(!SHOTS, 'SW_SHOTS_DIR not set');
      const fs = await import('node:fs');
      fs.mkdirSync(SHOTS, { recursive: true });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      const SETS = { sets: [{ id: 'A', name: 'פרטי', count: 1, used_by: [] }], limits: { max_files: 200, max_bytes: 8 * 1024 * 1024 } };
      const view = { enforce: false, can_manage: true, max_entries: 500, allow: [], self_messages: { active: false, until: null, minutes_default: 30, minutes_range: [1, 240] } };
      await setup(page, (s) => {
        if (s.path === 'wall/photo-sets') return { body: SETS };
        if (s.path === 'wall/photo-sets/A/photos') return { body: { photos: [{ id: 'pa', w: 1, h: 1 }] } };
        if (s.path.startsWith('messaging/whatsapp/policy')) return { body: view };
        return applyAnswer(s);
      });
      await page.evaluate((dark) => {
        if (dark) document.documentElement.setAttribute('data-theme', 'dark');
        document.body.style.background = 'var(--sw-bg, Canvas)';
        document.body.style.padding = '16px';
      }, scheme === 'dark');
      const shot = (name: string) => page.screenshot({ path: path.join(SHOTS, `${vp.name}-${scheme}-${name}.png`) });
      const clear = async () => {
        await page.keyboard.press('Escape');
        await page.evaluate(() => document.querySelectorAll('body > *:not(script)').forEach((e) => e.remove()));
      };
      // 1. a sensitive scene: the shared confirmation
      await page.evaluate((it) => {
        const el = document.createElement('scenes-panel') as HTMLElement & { items: unknown[] };
        el.items = [it];
        document.body.append(el);
      }, scene());
      await page.locator('scenes-panel [data-scene-activate]').click();
      await page.waitForTimeout(500);
      await shot('scene');
      await clear();
      // 2. deleting a wall photo
      await page.evaluate(() => {
        const el = document.createElement('sw-wall-photo-sets') as HTMLElement & { open: boolean };
        document.body.append(el);
        el.open = true;
      });
      await page.locator('sw-wall-photo-sets [data-wall-photo-del="pa"]').click();
      await page.waitForTimeout(500);
      await shot('wall-photo');
      await clear();
      // 3. the WhatsApp policy: enforcement on with an empty list
      await page.evaluate(() => document.body.append(document.createElement('messaging-policy-card')));
      await page.locator('messaging-policy-card [data-policy-enforce]').click();
      await page.waitForTimeout(500);
      await shot('policy');
    });
  }
}
