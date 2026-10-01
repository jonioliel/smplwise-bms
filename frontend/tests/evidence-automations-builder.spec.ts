import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../src/api/client';
import { resetAutomationsMock, type AutomationsMockStore, type MockUserId } from '../src/api/automations-mock';
import { AUTOMATION_SETTINGS_DEFAULT, type AutomationDraft, type ItemKind } from '../src/api/automations';

// CR-017 S4: the editors - `<automation-builder>`, `<script-editor>`, `<scene-editor>` - in the static preview with a MOCKED backend (page.route on
// api/v1, the pattern of evidence-media-screens.spec.ts): every `automations/*` route is answered by the S0 client's own MOCK store (the fixture house,
// three users, the delegation / conflict knobs), so the shapes are the contract's and the editors run through the real HTTP adapter. What is checked
// is what the editors do with the permissions and answers they get and what they send. The server's rules are S1's tests. S3's lists are not merged
// here: the elements are mounted into the page the way S3 mounts them (a tag with `.itemId` / `.mode`), and the events (`saved`, `cancel`, `deleted`)
// are recorded. Screenshots: docs/design/evidence/CR-017/s4/ at 1440, 820 and 390, light and dark.
//   SW_BASE_URL=http://127.0.0.1:4721/ npx playwright test tests/evidence-automations-builder.spec.ts --project=desktop --workers=1

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/CR-017/s4');
const SIZES = { '1440': { width: 1440, height: 900 }, '820': { width: 820, height: 1180 }, '390': { width: 390, height: 844 } } as const;
type Size = keyof typeof SIZES;

interface Call { method: string; path: string; body: unknown }
interface St {
  user: MockUserId;
  store: AutomationsMockStore;
  calls: Call[];
  /** extra latency of the status route (loading state) and a forced failure of the item read */
  statusDelay: number;
  failGet: boolean;
  eventLog: boolean;
}

const fresh = (user: MockUserId = 'installer', opts: { delegation?: boolean; schedulerPresent?: boolean } = {}): St => ({
  user, store: resetAutomationsMock({ user, ...opts }), calls: [], statusDelay: 0, failGet: false, eventLog: true,
});

async function install(page: Page, st: St) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body = req.postData() ? (req.postDataJSON() as Record<string, unknown>) : null;
    const json = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (p === 'me') {
      return json({
        channel: 'local', remote: null, user: { id: 'u-test', username: 'u-test', display_name: '׳™׳•׳ ׳™', source: 'ingress' }, active: true,
        bindings: [{ id: 'b1', role_id: 'r', role_name: '׳‘׳“׳™׳§׳”', scope_type: 'installation', scope_id: '*', scope_name: '׳›׳ ׳”׳”׳×׳§׳ ׳”', effect: 'allow' }],
        permissions_installation: ['devices.read', 'map.read', 'entity.state.read'], permissions_any: ['devices.read'], has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full',
      });
    }
    if (p === 'me/prefs') return json({ prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json({ settings: { 'devices.scheme': 'light' } });
    if (!p.startsWith('automations')) return json({ code: 'not_found', user_message: '׳׳ ׳ ׳׳¦׳', retryable: false, correlation_id: '', details: {} }, 404);
    st.calls.push({ method, path: p + url.search, body });
    const m = st.store;
    m.setUser(st.user);
    const err = (e: ApiError) => json({ code: e.body.code, user_message: e.body.user_message, retryable: false, correlation_id: '', details: e.body.details ?? {} }, e.status);
    try {
      const seg = p.split('/').slice(1);
      const kind = seg[0] as ItemKind;
      const id = seg[1] ? decodeURIComponent(seg[1]) : '';
      if (p === 'automations/status') { if (st.statusDelay) await new Promise((r) => setTimeout(r, st.statusDelay)); return json(await m.status()); }
      if (p === 'automations/catalog') return json(await m.catalog());
      if (p === 'automations/templates') return json(await m.templates());
      if (p === 'automations/preview') return json(await m.preview(body as never));
      if (p === 'automations/scene/capture') return json(await m.capture(body as never));
      if (method === 'POST' && seg.length === 1) return json(await m.create(kind, body as never), 201);
      if (method === 'GET' && seg.length === 2) { if (st.failGet) return json({ code: 'ha_unavailable', user_message: '׳×׳©׳×׳™׳× ׳”׳׳¢׳¨׳›׳× ׳׳™׳ ׳” ׳–׳׳™׳ ׳” ׳›׳¨׳’׳¢.', retryable: true, correlation_id: '', details: {} }, 503); return json(await m.get(kind, id)); }
      if (method === 'PUT' && seg.length === 2) return json(await m.replace(kind, id, body as never));
      if (method === 'PUT' && seg[2] === 'code') return json(await m.putCode(kind, id, body as never));
      if (seg[2] === 'delete') return json(await m.remove(kind, id, body as never));
      if (seg[2] === 'enable' || seg[2] === 'disable') return json(await m.setEnabled(id, seg[2] === 'enable', body as never));
      if (seg[2] === 'run') return json(kind === 'script' ? await m.runScript(id, body as never) : await m.run(id, body as never), 202);
      if (seg[2] === 'dry-run') return json(await m.dryRun(kind, id));
    } catch (e) {
      if (e instanceof ApiError) return err(e);
      throw e;
    }
    return json({ code: 'not_found', user_message: '׳׳ ׳ ׳׳¦׳', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

type Tag = 'automation-builder' | 'script-editor' | 'scene-editor';
interface Mount { itemId?: string; mode?: 'edit' | 'create'; scheme?: 'light' | 'dark'; draft0?: unknown }

/** Boots the static app with the mocked backend and mounts an editor the way S3's lists do. */
async function mount(page: Page, st: St, tag: Tag, o: Mount = {}, size: Size = '1440') {
  await page.setViewportSize(SIZES[size]);
  await install(page, st);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    const w = window as unknown as { __ev: unknown[]; __setItems: Array<[string, string]> };
    w.__ev = []; w.__setItems = [];
    try { sessionStorage.clear(); } catch { /* about:blank */ }
    try { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k: string, v: string) { w.__setItems.push([k, v]); return orig.call(this, k, v); }; } catch { /* no storage */ }
  });
  await page.goto('about:blank');
  await page.goto('/?design=a#/system/styleguide');
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined); // the shell polls: a busy machine may never go idle
  await page.evaluate(({ tag, o }) => {
    for (const name of ['saved', 'cancel', 'deleted', 'item-changed']) document.addEventListener(name, (e) => (window as unknown as { __ev: unknown[] }).__ev.push({ name, detail: (e as CustomEvent).detail }));
    const el = document.createElement(tag) as unknown as HTMLElement & Record<string, unknown>;
    Object.assign(el, o);
    el.id = 'ev';
    document.body.append(el);
  }, { tag, o });
  return { tag, errors, ed: page.locator(`${tag}`) };
}

const ready = async (page: Page, tag: string) => { await page.locator(`${tag} [data-sentence]`).first().waitFor({ timeout: 15_000 }); };
const events = (page: Page) => page.evaluate(() => (window as unknown as { __ev: Array<{ name: string; detail: unknown }> }).__ev);

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}
/** Presses the save button; a save that needs a confirmation (a locked step with unknown effects) is confirmed. */
const saveIt = async (page: Page, tag: string) => {
  await page.locator(`${tag} [data-editor-save]`).click();
  const ok = page.locator(`${tag} [data-confirm-save]`);
  if (await ok.waitFor({ state: 'visible', timeout: 1500 }).then(() => true, () => false)) await ok.click();
};
const lastCall = (st: St, method: string, re: RegExp) => [...st.calls].reverse().find((c) => c.method === method && re.test(c.path));
const idOf = (st: St, entity: string) => st.store.idOf(entity);

// ---------------------------------------------------------------------------------------------------------------------------- the installer

const tog = (page: Page, tag: string) => page.locator(`${tag} [data-view-toggle]:visible`);
const card = (page: Page, tag: string, section: 'trigger' | 'condition' | 'action') => page.locator(`${tag} [data-section="${section}"] > .blist > .slot > sw-block-card`);
const openCard = async (page: Page, tag: string, section: 'trigger' | 'condition' | 'action', i: number) => {
  await card(page, tag, section).nth(i).locator('[data-block-main]').click();
  await expect(card(page, tag, section).nth(i)).toHaveAttribute('open', '');
};

test.describe('automation builder: the installer', () => {
  for (const size of ['1440', '820', '390'] as Size[]) {
    test(`an existing automation opens with its sentence, the three sections and a sensitive-step chip (${size}, light)`, async ({ page }) => {
      const st = fresh();
      const { tag, errors } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.all_left') }, size);
      await ready(page, tag);
      await expect(page.locator(`${tag} [data-sentence]`)).toContainText('כשכולם יוצאים מהבית');
      await expect(card(page, tag, 'trigger')).toHaveCount(1);
      await expect(card(page, tag, 'action')).toHaveCount(3);
      await expect(card(page, tag, 'action').nth(2)).toContainText('פעולה רגישה');
      await expect(tog(page, tag)).toBeVisible();
      await expect(page.locator(`${tag} [data-name-input]`)).toHaveValue('כולם יצאו');
      await expect(page.locator(`${tag} [data-editor-save]`)).toBeDisabled(); // nothing changed yet
      await expect(page.locator(`${tag} [data-sentence]`)).toContainText('כולל פעולה רגישה אחת');
      await shot(page, `01-builder-installer-${size}-light`);
      expect(errors).toEqual([]);
    });
  }

  test('dark scheme (devices.scheme) and the sensitive chip colour setting (amber | red)', async ({ page }) => {
    const st = fresh();
    st.store.settingsValue = { ...AUTOMATION_SETTINGS_DEFAULT, sensitive_chip: 'red' };
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.all_left'), scheme: 'dark' });
    await ready(page, tag);
    await expect(page.locator(tag)).toHaveAttribute('data-devices-scheme', 'dark');
    await expect(page.locator(tag)).toHaveAttribute('data-chip', 'red');
    const chip = card(page, tag, 'action').nth(2).locator('.tag.sens');
    await expect(chip).toBeVisible();
    const red = await chip.evaluate((el) => getComputedStyle(el).color);
    expect(red).not.toBe('rgb(255, 196, 107)'); // the amber of the dark scheme
    await shot(page, '02-builder-installer-1440-dark-red-chip');
    const st2 = fresh();
    const m2 = await mount(page, st2, 'automation-builder', { itemId: idOf(st2, 'automation.hall_motion'), scheme: 'dark' });
    await ready(page, m2.tag);
    await shot(page, '02-builder-installer-1440-dark');
  });

  test('opening every card of every fixture automation (typed forms and locked blocks alike) changes nothing: no dirty draft, no save, the stored item untouched', async ({ page }) => {
    test.setTimeout(420_000);
    const st = fresh();
    const entities = ['entry_sunset', 'hall_motion', 'all_left', 'door_open', 'bed_ac_clock', 'salon_buttons', 'light_by_lux', 'vacation_freeze', 'boiler_morning', 'alarm_morning', 'leak_alert'];
    await install(page, st);
    await page.setViewportSize(SIZES['1440']);
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/styleguide');
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined); // the shell polls: a busy machine may never go idle
    for (const e of entities) {
      const id = idOf(st, `automation.${e}`);
      const before = JSON.stringify(st.store.storedConfig('automation', id));
      await page.evaluate((id) => { document.getElementById('ev')?.remove(); const el = document.createElement('automation-builder') as unknown as HTMLElement & Record<string, unknown>; el.id = 'ev'; el.itemId = id; document.body.append(el); }, id);
      const tag = 'automation-builder';
      await ready(page, tag);
      // every card of the three sections, nested ones included (opening a parent shows its children)
      let n = await page.locator(`${tag} sw-block-card`).count();
      for (let round = 0; round < 3; round++) {
        n = await page.locator(`${tag} sw-block-card`).count();
        for (let i = 0; i < n; i++) {
          const c = page.locator(`${tag} sw-block-card`).nth(i);
          if (!(await c.isVisible())) continue;
          await c.locator('[data-block-main]').first().click();
          await expect(page.locator(`${tag} [data-editor-save]`), `${e} card ${i}`).toBeDisabled();
        }
      }
      await page.waitForTimeout(500);
      await expect(page.locator(`${tag} [data-editor-save]`), e).toBeDisabled();
      expect(JSON.stringify(st.store.storedConfig('automation', id)), e).toBe(before);
    }
    expect(st.calls.some((c) => c.method === 'PUT' || (c.method === 'POST' && /automations\/automation$/.test(c.path)))).toBe(false);
  });

  test('the sensitive warning chip can be switched off by the setting', async ({ page }) => {
    const st = fresh();
    st.store.settingsValue = { ...AUTOMATION_SETTINGS_DEFAULT, sensitive_warning: false };
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.all_left') });
    await ready(page, tag);
    await expect(page.locator(`${tag} .tag.sens`)).toHaveCount(0);
    await expect(page.locator(`${tag} [data-sentence] small`)).toHaveCount(0);
  });

  test('editing a value updates the block sentence and the whole sentence at once; save sends the draft with the server revision and closes', async ({ page }) => {
    const st = fresh();
    const id = idOf(st, 'automation.hall_motion');
    const rev = (await st.store.get('automation', id)).revision;
    const { tag, errors } = await mount(page, st, 'automation-builder', { itemId: id });
    await ready(page, tag);
    await openCard(page, tag, 'action', 0);
    const bright = page.locator(`${tag} [data-fld="data.brightness_pct"]`);
    await expect(bright).toHaveValue('40');
    await bright.fill('60');
    await bright.press('Tab');
    await expect(card(page, tag, 'action').nth(0)).toContainText('ל־60%');
    await expect(page.locator(`${tag} [data-sentence]`)).toContainText('ל־60%');
    await expect(page.locator(`${tag} [data-editor-save]`)).toBeEnabled();
    await page.waitForTimeout(600);
    expect(lastCall(st, 'POST', /automations\/preview/)).toBeTruthy(); // the debounced live preview
    await page.locator(`${tag} [data-editor-save]`).click();
    await expect(page.locator(`${tag} dialog.sheet`)).toBeHidden();
    const put = lastCall(st, 'PUT', /automations\/automation\/[^/]+$/)!;
    const body = put.body as { base_revision: string; draft: AutomationDraft; client_request_id: string };
    expect(body.base_revision).toBe(rev);
    expect(body.client_request_id.length).toBeGreaterThanOrEqual(8);
    expect(body.draft.actions[0]).toMatchObject({ type: 'service', action: 'light.turn_on', data: { brightness_pct: 60 } });
    const ev = await events(page);
    expect(ev.find((e) => e.name === 'saved')?.detail).toMatchObject({ kind: 'automation', id, created: false, status: 'ok' });
    expect(st.store.storedConfig('automation', id)!.actions).toMatchObject([{ data: { brightness_pct: 60 } }, {}, {}]);
    expect(errors).toEqual([]);
  });

  test('the type chooser lists the v1 block set per section; a new trigger needs a device, the picker is grouped by floor and area', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') });
    await ready(page, tag);
    await page.locator(`${tag} [data-add="trigger"]`).click();
    const pop = page.locator(`${tag} [data-typepop]`);
    await expect(pop.locator('[data-type]')).toHaveCount(7);
    for (const t of ['state', 'time', 'time_pattern', 'sun', 'numeric', 'presence', 'start']) await expect(pop.locator(`[data-type="${t}"]`)).toBeVisible();
    await shot(page, '03-builder-typepop-1440-light');
    await page.keyboard.press('Escape');
    await expect(pop).toBeHidden();
    await expect(page.locator(`${tag} dialog.sheet`)).toBeVisible(); // Escape closed the chooser, not the editor
    await page.locator(`${tag} [data-add="action"]`).click();
    await expect(page.locator(`${tag} [data-typepop] [data-type]`)).toHaveCount(11);
    await page.locator(`${tag} [data-type="sensitive"]`).click();
    await expect(card(page, tag, 'action')).toHaveCount(4);
    await expect(card(page, tag, 'action').nth(3)).toContainText('דרוך את');
    await expect(card(page, tag, 'action').nth(3).locator('.tag.sens')).toBeVisible();
    await page.locator(`${tag} [data-entity-add]`).click();
    const picker = page.locator(`${tag} automation-entity-picker`);
    await expect(picker.locator('[data-picker-item]')).toHaveCount(4); // alarm, lock, gate, siren: only the sensitive devices for a sensitive step
    await expect(picker.locator('[data-picker-item="alarm_control_panel.home"] .tag.sens')).toBeVisible();
    await picker.locator('[data-picker-item="alarm_control_panel.home"]').click();
    await picker.locator('[data-picker-done]').click();
    await expect(picker).toBeHidden();
    await expect(card(page, tag, 'action').nth(3)).toContainText('אזעקה');
    await expect(page.locator(`${tag} [data-sentence] small`)).toContainText('פעולה רגישה'); // the live preview counted it
    await shot(page, '04-builder-sensitive-step-1440-light');
  });

  test('the picker offers every device of the house to the installer, grouped floor > area, with search (and a bottom sheet on a phone)', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') }, '390');
    await ready(page, tag);
    await openCard(page, tag, 'action', 0);
    await page.locator(`${tag} [data-entity-add]`).click();
    const picker = page.locator(`${tag} automation-entity-picker`);
    await expect(picker.locator('[data-picker-item="light.entry"]')).toBeVisible();
    await expect(picker.locator('h5.floor')).toHaveCount(2); // lights exist on the ground floor and on floor 1
    await picker.locator('[data-picker-search]').fill('סלון');
    await expect(picker.locator('[data-picker-item]')).toHaveCount(2); // תאורת סלון, ספוטים סלון (the action drives lights only)
    await shot(page, '05-builder-picker-390-light');
    const box = await picker.locator('[data-picker-item]').first().boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('a time trigger, a sun trigger, "every N minutes", numeric and presence forms edit their block and the sentence', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.entry_sunset') });
    await ready(page, tag);
    await openCard(page, tag, 'trigger', 0);
    await expect(page.locator(`${tag} [data-fld="event"]`)).toHaveValue('sunset');
    await expect(page.locator(`${tag} [data-fld="when"]`)).toHaveValue('before');
    await expect(page.locator(`${tag} [data-fld="offset"]`)).toHaveValue('20');
    await page.locator(`${tag} [data-fld="offset"]`).fill('45');
    await page.locator(`${tag} [data-fld="offset"]`).press('Tab');
    await expect(card(page, tag, 'trigger').nth(0)).toContainText('45 דק׳ לפני השקיעה');
    await page.locator(`${tag} [data-fld="event"]`).selectOption('sunrise');
    await expect(card(page, tag, 'trigger').nth(0)).toContainText('לפני הזריחה');
    // a new time trigger
    await page.locator(`${tag} [data-add="trigger"]`).click();
    await page.locator(`${tag} [data-type="time"]`).click();
    await page.locator(`${tag} [data-fld="at"]`).fill('06:45');
    await expect(card(page, tag, 'trigger').nth(2)).toContainText('בשעה 06:45');
    await page.locator(`${tag} [data-add="trigger"]`).click();
    await page.locator(`${tag} [data-type="time_pattern"]`).click();
    await expect(card(page, tag, 'trigger').nth(3)).toContainText('כל 5 דקות');
    await page.locator(`${tag} [data-fld="every"]`).fill('10');
    await page.locator(`${tag} [data-fld="every"]`).press('Tab');
    await expect(card(page, tag, 'trigger').nth(3)).toContainText('כל 10 דקות');
    await page.locator(`${tag} [data-fld="unit"]`).selectOption('hours');
    await expect(card(page, tag, 'trigger').nth(3)).toContainText('כל 10 שעות');
    await page.locator(`${tag} [data-add="trigger"]`).click();
    await page.locator(`${tag} [data-type="presence"]`).click();
    await expect(card(page, tag, 'trigger').nth(4)).toContainText('כשכולם יוצאים מהבית');
    await page.locator(`${tag} [data-fld="who"]`).selectOption('someone_home');
    await expect(card(page, tag, 'trigger').nth(4)).toContainText('בבית');
    await expect(page.locator(`${tag} [data-entity="person.yoni"]`)).toBeVisible();
    await page.locator(`${tag} [data-add="trigger"]`).click();
    await page.locator(`${tag} [data-type="numeric"]`).click();
    await expect(page.locator(`${tag} [data-sentence]`)).toContainText('כשהמערכת עולה'); // the HA-start trigger of the fixture is in the sentence
    await expect(card(page, tag, 'trigger').nth(5).locator('[data-fld="above"]')).toBeVisible();
  });

  test('conditions: state, time with weekdays, sun, trigger id, Shabbat; the shabbat entry needs the configured sensor', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.bed_ac_clock') });
    await ready(page, tag);
    await page.locator(`${tag} [data-add="condition"]`).click();
    await expect(page.locator(`${tag} [data-typepop] [data-type]`)).toHaveCount(9);
    await page.locator(`${tag} [data-type="time"]`).click();
    await page.locator(`${tag} [data-fld="after"]`).fill('17:00');
    await page.locator(`${tag} [data-weekday="sun"]`).click();
    await page.locator(`${tag} [data-weekday="mon"]`).click();
    await expect(card(page, tag, 'condition').nth(0)).toContainText('אחרי 17:00');
    await expect(card(page, tag, 'condition').nth(0)).toContainText('ימים א׳, ב׳');
    await page.locator(`${tag} [data-add="condition"]`).click();
    await page.locator(`${tag} [data-type="shabbat"]`).click();
    await expect(card(page, tag, 'condition').nth(1)).toContainText('לא בשבת וחג');
    await page.locator(`${tag} [data-fld="mode"]`).first().selectOption('only_holy_days');
    await expect(card(page, tag, 'condition').nth(1)).toContainText('בשבת וחג בלבד');
    await page.locator(`${tag} [data-add="condition"]`).click();
    await page.locator(`${tag} [data-type="trigger"]`).click();
    await expect(page.locator(`${tag} [data-validation]`)).toContainText('בחרו טריגר');
    await page.locator(`${tag} .rolechips button`, { hasText: 'night' }).click();
    await expect(card(page, tag, 'condition').nth(2)).toContainText('night');
    await page.locator(`${tag} [data-add="condition"]`).click();
    await page.locator(`${tag} [data-type="or"]`).click();
    await expect(card(page, tag, 'condition').nth(3)).toBeVisible();
    // an `or` group holds conditions (one level: no group inside a group)
    await page.locator(`${tag} sw-block-card[open] [data-add="condition"]`).click();
    await expect(page.locator(`${tag} [data-typepop] [data-type]`)).toHaveCount(6);
    await expect(page.locator(`${tag} [data-typepop] [data-type="or"]`)).toHaveCount(0);
  });

  test('nested blocks: a choose branch takes steps of its own, an if has then / else, a repeat holds a sequence; the branch count is capped at six', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.bed_ac_clock') });
    await ready(page, tag);
    await openCard(page, tag, 'action', 0);
    await expect(page.locator(`${tag} [data-choose-option]`)).toHaveCount(2);
    await expect(page.locator(`${tag} [data-choose-option="0"] sw-block-card`)).toHaveCount(2); // the branch's condition and its step
    await page.locator(`${tag} [data-option-add]`).click();
    await expect(page.locator(`${tag} [data-choose-option]`)).toHaveCount(3);
    await page.locator(`${tag} [data-choose-option="2"] [data-add="action"]`).click();
    await page.locator(`${tag} [data-type="delay"]`).click();
    await expect(page.locator(`${tag} [data-choose-option="2"] sw-block-card[open]`)).toContainText('המתן');
    for (let i = 0; i < 3; i++) await page.locator(`${tag} [data-option-add]`).click();
    await expect(page.locator(`${tag} [data-choose-option]`)).toHaveCount(6);
    await expect(page.locator(`${tag} [data-option-add]`)).toHaveCount(0);
    await page.locator(`${tag} [data-option-remove="5"]`).click();
    await expect(page.locator(`${tag} [data-choose-option]`)).toHaveCount(5);
    await page.locator(`${tag} [data-default-add]`).click();
    await expect(page.locator(`${tag} [data-default-add]`)).toHaveCount(0);
    // if / else
    await page.locator(`${tag} [data-add-list="root|actions"]`).click();
    await page.locator(`${tag} [data-type="if"]`).click();
    await expect(page.locator(`${tag} sw-block-card[open] .sub-h`)).toHaveCount(3);
    await shot(page, '06-builder-nested-1440-light');
  });

  test('reorder: the buttons of an open card, Alt + arrows on the header, and drag and drop by the grip', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') });
    await ready(page, tag);
    const heads = () => card(page, tag, 'action').evaluateAll((els) => els.map((e) => (e as HTMLElement & { heading: string }).heading));
    expect(await heads()).toEqual(['הדלק תאורת פרוזדור ל־40%', 'המתן 3 דקות', 'כבה תאורת פרוזדור']);
    await openCard(page, tag, 'action', 1);
    await page.locator(`${tag} [data-block-up]`).click();
    expect(await heads()).toEqual(['המתן 3 דקות', 'הדלק תאורת פרוזדור ל־40%', 'כבה תאורת פרוזדור']);
    await card(page, tag, 'action').nth(0).locator('[data-block-main]').focus();
    await page.keyboard.press('Alt+ArrowDown');
    expect(await heads()).toEqual(['הדלק תאורת פרוזדור ל־40%', 'המתן 3 דקות', 'כבה תאורת פרוזדור']);
    await page.keyboard.press('Alt+ArrowUp');
    expect(await heads()).toEqual(['המתן 3 דקות', 'הדלק תאורת פרוזדור ל־40%', 'כבה תאורת פרוזדור']);
    await card(page, tag, 'action').nth(0).locator('[data-block-main]').click(); // close it
    const grip = card(page, tag, 'action').nth(2).locator('.grip');
    const target = card(page, tag, 'action').nth(0);
    await grip.dragTo(target, { targetPosition: { x: 40, y: 4 } });
    expect(await heads()).toEqual(['כבה תאורת פרוזדור', 'המתן 3 דקות', 'הדלק תאורת פרוזדור ל־40%']);
    await card(page, tag, 'action').nth(2).locator('[data-block-remove]').click();
    expect(await heads()).toHaveLength(2);
    await openCard(page, tag, 'action', 0);
    await page.locator(`${tag} [data-block-dup]`).click();
    expect(await heads()).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------- locked blocks and the code view

test.describe('automation builder: locked blocks and the builder <-> code toggle', () => {
  test('device buttons are LOCKED blocks: shown with their reason, movable and deletable, never editable; saving keeps them byte-identical', async ({ page }) => {
    const st = fresh();
    const id = idOf(st, 'automation.salon_buttons');
    const stored = st.store.storedConfig('automation', id)!;
    const { tag } = await mount(page, st, 'automation-builder', { itemId: id });
    await ready(page, tag);
    await expect(card(page, tag, 'trigger')).toHaveCount(2);
    const first = card(page, tag, 'trigger').nth(0);
    await expect(first).toHaveAttribute('locked', '');
    await expect(first.locator('.tag.lock', { hasText: 'נעול' })).toBeVisible();
    await expect(first.locator('.tag.lock', { hasText: 'מכשיר' })).toBeVisible(); // the "why locked" chip
    await expect(first.locator('code', { hasText: 'id: short' })).toBeVisible();
    await expect(page.locator(`${tag} [data-sentence]`)).toContainText('כפתור');
    await openCard(page, tag, 'trigger', 0);
    await expect(page.locator(`${tag} [data-locked-note]`)).toContainText('נשמר כמו שהוא');
    await expect(page.locator(`${tag} [data-locked-code]`)).toContainText('"device_id"');
    await expect(first.locator('input, select, textarea')).toHaveCount(0); // not editable
    await shot(page, '07-builder-locked-1440-light');
    await page.locator(`${tag} [data-block-down]`).click();
    await card(page, tag, 'trigger').nth(0).locator('[data-block-main]').click();
    await expect(page.locator(`${tag} [data-editor-save]`)).toBeEnabled();
    await page.locator(`${tag} [data-editor-save]`).click();
    await expect(page.locator(`${tag} dialog.sheet`)).toBeHidden();
    const put = lastCall(st, 'PUT', /automations\/automation\/[^/]+$/)!;
    expect(put).toBeTruthy();
    const now = st.store.storedConfig('automation', id)!;
    expect(now.triggers).toEqual([(stored.triggers as unknown[])[1], (stored.triggers as unknown[])[0]]); // moved, byte-identical
    expect(now.actions).toEqual(stored.actions);
    expect(lastCall(st, 'PUT', /\/code$/)).toBeUndefined(); // moving a locked block is a builder save
  });

  test('a locked block can be deleted by a normal editor; a template block is also shown with its {{ }} badge', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.light_by_lux') });
    await ready(page, tag);
    const t = card(page, tag, 'trigger').nth(0);
    await expect(t).toHaveAttribute('locked', '');
    await expect(t.locator('code', { hasText: '{{ }}' })).toBeVisible();
    await expect(card(page, tag, 'action').nth(0)).toHaveAttribute('locked', '');
    await expect(page.locator(`${tag} [data-sentence]`)).toContainText('פעולה מתקדמת');
    await t.locator('[data-block-remove]').click();
    await expect(card(page, tag, 'trigger')).toHaveCount(0);
    await expect(page.locator(`${tag} [data-editor-save]`)).toBeDisabled(); // a trigger is required
  });

  test('the toggle is shown to code-view holders: JSON with the locked lines shaded, parse errors inline, switching back keeps the locked blocks (1440 dark, 390 light)', async ({ page }) => {
    const st = fresh();
    const id = idOf(st, 'automation.salon_buttons');
    const { tag } = await mount(page, st, 'automation-builder', { itemId: id, scheme: 'dark' });
    await ready(page, tag);
    await tog(page, tag).locator('[data-view="code"]').click();
    const code = page.locator(`${tag} automation-code`);
    await expect(code).toBeVisible();
    await expect(code.locator('textarea')).toHaveValue(JSON.stringify(st.store.storedConfig('automation', id), null, 2));
    await expect(code.locator('[data-locked-band]')).toHaveCount(2);
    await expect(code.getByText('2 חלקים נעולים')).toBeVisible();
    await shot(page, '08-code-1440-dark');
    // an error: the position and a Hebrew message, inline; the editor stays in the code view
    const text = await code.locator('textarea').inputValue();
    await code.locator('textarea').fill(text.replace('"mode"', 'mode'));
    await expect(code.locator('[data-code-error]')).toContainText('שורה');
    await expect(code.locator('[data-error-band]')).toHaveCount(1);
    await expect(page.locator(`${tag} [data-editor-save]`)).toBeDisabled();
    await shot(page, '09-code-error-1440-dark');
    await tog(page, tag).locator('[data-view="builder"]').click();
    await expect(code).toBeVisible(); // a text that does not parse cannot become blocks
    await code.locator('textarea').fill(text);
    await expect(code.locator('[data-code-error]')).toHaveCount(0);
    await tog(page, tag).locator('[data-view="builder"]').click();
    await expect(card(page, tag, 'trigger')).toHaveCount(2);
    await expect(card(page, tag, 'trigger').nth(0)).toHaveAttribute('locked', '');
    await expect(page.locator(`${tag} [data-editor-save]`)).toBeDisabled(); // nothing changed
  });

  test('code view on a phone', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.salon_buttons') }, '390');
    await ready(page, tag);
    await tog(page, tag).locator('[data-view="code"]').click();
    await expect(page.locator(`${tag} automation-code textarea`)).toBeVisible();
    await shot(page, '10-code-390-light');
    const box = await page.locator(`${tag} [data-editor-save]`).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('a typed value changed in the code view is a builder save (the replace route); a locked block changed is the code route; the stored item follows', async ({ page }) => {
    const st = fresh();
    const id = idOf(st, 'automation.hall_motion');
    const cfg0 = st.store.storedConfig('automation', id)!;
    const { tag } = await mount(page, st, 'automation-builder', { itemId: id });
    await ready(page, tag);
    await tog(page, tag).locator('[data-view="code"]').click();
    const ta = page.locator(`${tag} automation-code textarea`);
    const edited = JSON.parse(JSON.stringify(cfg0)) as Record<string, unknown>;
    edited.alias = 'תנועה בפרוזדור (קוד)';
    await ta.fill(JSON.stringify(edited, null, 2));
    await expect(page.locator(`${tag} [data-editor-save]`)).toBeEnabled();
    await page.locator(`${tag} [data-editor-save]`).click();
    await expect(page.locator(`${tag} dialog.sheet`)).toBeHidden();
    expect(lastCall(st, 'PUT', /automations\/automation\/[^/]+$/)).toBeTruthy();
    expect(lastCall(st, 'PUT', /\/code$/)).toBeUndefined();
    expect(st.store.storedConfig('automation', id)!.alias).toBe('תנועה בפרוזדור (קוד)');
    expect(st.store.storedConfig('automation', id)!.trace).toEqual({ stored_traces: 10 }); // the keys the draft does not model are kept
  });

  test('editing the text of a locked template inline (code-view permission): the save goes through the code route', async ({ page }) => {
    const st = fresh();
    const id = idOf(st, 'automation.light_by_lux');
    const e = st.store.entry('automation', id)!;
    delete (e.config as Record<string, unknown>).variables; // the full config reaches the code view only when the server sends it; without extra keys the save is exact
    const { tag } = await mount(page, st, 'automation-builder', { itemId: id });
    await ready(page, tag);
    await openCard(page, tag, 'trigger', 0);
    const area = page.locator(`${tag} [data-template-text]`);
    await expect(area).toHaveValue("{{ states('sensor.lux') | int < 20 }}");
    await area.fill("{{ states('sensor.lux') | int < 35 }}");
    await area.press('Tab');
    await expect(page.locator(`${tag} [data-editor-save]`)).toBeEnabled();
    await shot(page, '11-builder-template-edit-1440-light');
    await saveIt(page, tag);
    await expect(page.locator(`${tag} dialog.sheet`)).toBeHidden();
    expect(lastCall(st, 'PUT', /\/code$/)).toBeTruthy();
    expect(JSON.stringify(st.store.storedConfig('automation', id)!.triggers)).toContain('int < 35');
  });

  test('without the code-view permission the toggle is not rendered at all, and a locked block offers no way to edit it', async ({ page }) => {
    const st = fresh('household');
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') });
    await ready(page, tag);
    await expect(page.locator(`${tag} [data-view-toggle]`)).toHaveCount(0);
    await expect(page.locator(`${tag} automation-code`)).toHaveCount(0);
    await expect(page.locator(`${tag} [data-goto-code]`)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------- the household editor, delegation, no view-only access

test.describe('automation builder: scoped editors, delegation, grants, no view-only access', () => {
  test('the household editor sees only the devices of its floor; no code toggle (1440 light, 390 picker sheet)', async ({ page }) => {
    const st = fresh('household');
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') });
    await ready(page, tag);
    await expect(page.locator(`${tag} [data-view-toggle]`)).toHaveCount(0);
    await openCard(page, tag, 'action', 0);
    await page.locator(`${tag} [data-entity-add]`).click();
    const picker = page.locator(`${tag} automation-entity-picker`);
    await expect(picker.locator('[data-picker-item="light.hall"]')).toBeVisible();
    await expect(picker.locator('[data-picker-item="light.entry"]')).toHaveCount(0);
    await expect(picker.locator('[data-picker-item="light.salon"]')).toHaveCount(0);
    await expect(picker.locator('.tag.acc')).toContainText('קומה 1');
    await expect(picker.locator('h5.floor')).toHaveCount(0); // one floor: no floor heading
    await shot(page, '12-builder-household-picker-1440-light');
    await page.keyboard.press('Escape');
    await expect(picker).toBeHidden();
    await shot(page, '13-builder-household-nocode-1440-light');
  });

  test('the household editor on a phone: blocks stack, the picker is a sheet', async ({ page }) => {
    const st = fresh('household');
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') }, '390');
    await ready(page, tag);
    await openCard(page, tag, 'action', 0);
    await page.locator(`${tag} [data-entity-add]`).click();
    await expect(page.locator(`${tag} automation-entity-picker [data-picker-item="light.hall"]`)).toBeVisible();
    await shot(page, '14-builder-household-picker-390-light');
  });

  test('a sensitive step without the manual-control grant: the banner names it and the save is off; the 403 of the server is shown too', async ({ page }) => {
    const st = fresh('household');
    st.store.users.household.scope = { floors: ['g', 'f1'], areas: null }; // the alarm panel is on the ground floor; the household editor holds door.unlock only
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') });
    await ready(page, tag);
    await page.locator(`${tag} [data-add="action"]`).click();
    await page.locator(`${tag} [data-type="sensitive"]`).click();
    await page.locator(`${tag} [data-entity-add]`).click();
    await page.locator(`${tag} automation-entity-picker [data-picker-item="alarm_control_panel.home"]`).click();
    await page.locator(`${tag} automation-entity-picker [data-picker-done]`).click();
    const banner = page.locator(`${tag} [data-banner="grant"]`);
    await expect(banner).toContainText('אין לך הרשאה לדריכה ב־אזעקה');
    await expect(page.locator(`${tag} [data-editor-save]`)).toBeDisabled();
    await expect(page.locator(`${tag} [data-editor-save]`)).toHaveAttribute('title', /אין לך הרשאה/);
    await page.locator(`${tag} [data-editor-body]`).evaluate((el) => { el.scrollTop = 0; });
    await shot(page, '15-builder-grant-missing-1440-light');
    // a light step instead: the save works; the server answering 403 grant_required is shown as an error banner
    await card(page, tag, 'action').nth(3).locator('[data-block-remove]').click();
    await expect(banner).toHaveCount(0);
    await openCard(page, tag, 'action', 0);
    await page.locator(`${tag} [data-fld="data.brightness_pct"]`).fill('55');
    await page.locator(`${tag} [data-fld="data.brightness_pct"]`).press('Tab');
    st.store.failNext('grant_required', 403, { name: 'אזעקה', action: 'דריכה', grant: 'alarm.disarm', path: 'actions.0' });
    await page.locator(`${tag} [data-editor-save]`).click();
    await expect(page.locator(`${tag} [data-banner="error"]`)).toContainText('אין לך הרשאה לדריכה ב־אזעקה');
    await expect(page.locator(`${tag} dialog.sheet`)).toBeVisible();
  });

  test('delegation off: the household editor edits and previews, the banner says save needs an administrator, the save is disabled (dark; phone)', async ({ page }) => {
    const st = fresh('household', { delegation: false });
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion'), scheme: 'dark' });
    await ready(page, tag);
    const b = page.locator(`${tag} [data-banner="delegation"]`);
    await expect(b).toContainText('שמירה דורשת מנהל');
    await openCard(page, tag, 'action', 0);
    await page.locator(`${tag} [data-fld="data.brightness_pct"]`).fill('55');
    await page.locator(`${tag} [data-fld="data.brightness_pct"]`).press('Tab');
    await expect(card(page, tag, 'action').nth(0)).toContainText('ל־55%'); // editing works
    await expect(page.locator(`${tag} [data-editor-save]`)).toBeDisabled();
    await expect(page.locator(`${tag} [data-editor-save]`)).toHaveAttribute('title', 'שמירה דורשת מנהל');
    await page.locator(`${tag} [data-dry-run]`).click(); // a dry-run still works
    await expect(page.locator(`${tag} [data-dry-result]`)).toBeVisible();
    await page.locator(`${tag} [data-dry-close]`).click();
    await shot(page, '16-builder-delegation-off-1440-dark');
  });

  test('delegation off on a phone', async ({ page }) => {
    const st = fresh('household', { delegation: false });
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') }, '390');
    await ready(page, tag);
    await expect(page.locator(`${tag} [data-banner="delegation"]`)).toBeVisible();
    await shot(page, '17-builder-delegation-off-390-light');
  });

  test('a script runner (no automation.manage) never sees an automation: the editor answers the forbidden state, no draft, no retry (decision 1b)', async ({ page }) => {
    const st = fresh('runner');
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') });
    await expect(page.locator(`${tag} [data-editor-state="forbidden"]`)).toContainText('אין הרשאה');
    await expect(page.locator(`${tag} [data-block-main]`)).toHaveCount(0);
    await expect(page.locator(`${tag} [data-editor-state="forbidden"] button`)).toHaveCount(0);
    await expect(page.locator(`${tag} [data-editor-save]`)).toHaveCount(0);
    await shot(page, '18-builder-runner-forbidden-1440-light');
  });
  test('a configuration-file automation is view-only; its chip says so', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { itemId: 'entity:automation.irrigation_shabbat' });
    await ready(page, tag);
    await expect(page.locator(`${tag} [data-banner="readonly"]`)).toContainText('מוגדרת בקובץ תצורה');
    await expect(page.locator(`${tag} [data-editor-save]`)).toBeDisabled();
    await expect(page.locator(`${tag} [data-view-toggle]`)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------- conflict, validation, templates, schedule suggestion

test.describe('automation builder: conflict, validation, templates, the schedule suggestion', () => {
  test('an edit made elsewhere meanwhile: the save finds the item changed; compare, reload the new one or keep mine', async ({ page }) => {
    const st = fresh();
    const id = idOf(st, 'automation.hall_motion');
    const { tag } = await mount(page, st, 'automation-builder', { itemId: id });
    await ready(page, tag);
    await page.locator(`${tag} [data-name-input]`).fill('תנועה בפרוזדור (שלי)');
    st.store.conflictNext = true;
    await page.locator(`${tag} [data-editor-save]`).click();
    const banner = page.locator(`${tag} [data-banner="conflict"]`);
    await expect(banner).toContainText('הפריט שונה במקום אחר');
    await expect(page.locator(`${tag} dialog.sheet`)).toBeVisible();
    await shot(page, '19-builder-conflict-1440-light');
    await banner.locator('[data-conflict="compare"]').click();
    const cmp = page.locator(`${tag} [data-compare]`);
    await expect(cmp).toContainText('תנועה בפרוזדור (שלי)');
    await expect(cmp).toContainText('(עודכן)');
    await shot(page, '20-builder-conflict-compare-1440-light');
    await page.keyboard.press('Escape');
    await expect(cmp).toBeHidden();
    await expect(page.locator(`${tag} dialog.sheet`)).toBeVisible();
    // keep mine: the same draft on the current revision
    const cur = (await st.store.get('automation', id)).revision;
    await banner.locator('[data-conflict="mine"]').click();
    await expect(page.locator(`${tag} dialog.sheet`)).toBeHidden();
    const put = lastCall(st, 'PUT', /automations\/automation\/[^/]+$/)!;
    expect((put.body as { base_revision: string }).base_revision).toBe(cur);
    expect(st.store.storedConfig('automation', id)!.alias).toBe('תנועה בפרוזדור (שלי)');
  });

  test('conflict: "load the new one" replaces the draft; the banner also appears when a push says the item changed (no save needed)', async ({ page }) => {
    const st = fresh();
    const id = idOf(st, 'automation.hall_motion');
    const { tag } = await mount(page, st, 'automation-builder', { itemId: id });
    await ready(page, tag);
    st.store.externalEdit('automation', id, (c) => { c.alias = 'שונה ב־HA'; });
    await page.evaluate(() => (document.getElementById('ev') as unknown as { notifyExternalChange(): Promise<void> }).notifyExternalChange());
    const banner = page.locator(`${tag} [data-banner="conflict"]`);
    await expect(banner).toBeVisible();
    await banner.locator('[data-conflict="reload"]').click();
    await expect(banner).toHaveCount(0);
    await expect(page.locator(`${tag} [data-name-input]`)).toHaveValue('שונה ב־HA');
    await expect(page.locator(`${tag} [data-editor-save]`)).toBeDisabled();
  });

  test('a new automation: the gallery first (from scratch + templates), then a template with its pickers empty; the validation box lists what is missing by section', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { mode: 'create' });
    const gallery = page.locator(`${tag} [data-templates]`);
    await expect(gallery).toBeVisible();
    await expect(gallery.locator('[data-template]')).toHaveCount(8);
    await expect(gallery.locator('[data-template="blank"]')).toContainText('מאפס');
    await expect(gallery.locator('[data-template="t3"] .tag.sens')).toBeVisible();
    await expect(gallery.locator('[data-template="t6"] .tag.acc')).toContainText('גם כתזמון');
    await shot(page, '21-templates-1440-light');
    await gallery.locator('[data-template="t2"]').click();
    await ready(page, tag);
    await expect(page.locator(`${tag} .shh small`)).toContainText('מתבנית "דלת או חלון פתוחים זמן רב"');
    const box = page.locator(`${tag} [data-validation]`);
    await expect(box).toBeVisible();
    await expect(box).toContainText('בחרו מכשיר');
    await expect(box.locator('button').first()).toContainText('כאשר');
    await expect(page.locator(`${tag} [data-editor-save]`)).toBeDisabled();
    await expect(card(page, tag, 'trigger').nth(0)).toHaveAttribute('invalid', '');
    await shot(page, '22-builder-validation-1440-light');
    await box.locator('button').first().click(); // the line opens its block
    await expect(card(page, tag, 'trigger').nth(0)).toHaveAttribute('open', '');
    await expect(card(page, tag, 'trigger').nth(0).locator('[data-block-error]')).toContainText('בחרו מכשיר');
    // fill it: the box goes away, the save is on, a new automation is created (POST) and the editor reports `created`
    await page.locator(`${tag} [data-entity-add]`).click();
    await page.locator(`${tag} automation-entity-picker [data-picker-item="binary_sensor.front_door"]`).click();
    await page.locator(`${tag} automation-entity-picker [data-picker-done]`).click();
    await expect(page.locator(`${tag} [data-validation]`)).toHaveCount(0);
    await expect(page.locator(`${tag} [data-editor-save]`)).toBeEnabled();
    await page.locator(`${tag} [data-editor-save]`).click();
    await expect(page.locator(`${tag} dialog.sheet`)).toBeHidden();
    const post = lastCall(st, 'POST', /automations\/automation$/)!;
    expect(post.body).toMatchObject({ enabled: true, draft: { alias: 'דלת או חלון פתוחים זמן רב' } });
    const ev = await events(page);
    expect(ev.find((e) => e.name === 'saved')?.detail).toMatchObject({ kind: 'automation', created: true, status: 'ok' });
  });

  test('templates gallery on a phone (dark); from scratch starts blank and does not nag before the first edit', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { mode: 'create', scheme: 'dark' }, '390');
    await expect(page.locator(`${tag} [data-templates]`)).toBeVisible();
    await shot(page, '23-templates-390-dark');
    await page.locator(`${tag} [data-template="blank"]`).click();
    await ready(page, tag);
    await expect(page.locator(`${tag} [data-validation]`)).toHaveCount(0);
    await expect(page.locator(`${tag} [data-editor-save]`)).toBeDisabled();
    await expect(page.locator(`${tag} .shh small`)).toContainText('אוטומציה חדשה');
    await page.locator(`${tag} [data-name-input]`).fill('בדיקה');
    await expect(page.locator(`${tag} [data-validation]`)).toBeVisible();
    await expect(page.locator(`${tag} [data-validation]`)).toContainText('2 דברים לתקן');
    await shot(page, '24-builder-blank-390-dark');
  });

  test('the "צור כתזמון" suggestion: a time-only automation with device steps offers it; the dialog opens the schedule editor with the draft and creates nothing', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { mode: 'create' });
    await page.locator(`${tag} [data-template="t6"]`).click();
    await ready(page, tag);
    await expect(page.locator(`${tag} [data-suggest-schedule]`)).toBeVisible();
    await shot(page, '25-builder-suggest-schedule-1440-light');
    await page.locator(`${tag} [data-suggest-schedule]`).click();
    await expect(page.locator(`${tag} [data-suggest-body]`)).toContainText('בתזמונים זה פשוט יותר');
    await shot(page, '26-builder-suggest-dialog-1440-light');
    await page.locator(`${tag} [data-suggest-no]`).click();
    await expect(page.locator(`${tag} dialog.sheet`)).toBeVisible(); // "השאר אוטומציה": nothing changes
    await page.locator(`${tag} [data-suggest-schedule]`).click();
    await page.locator(`${tag} [data-suggest-yes]`).click();
    await expect(page.locator(`${tag} dialog.sheet`)).toBeHidden();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/devices/schedules/new/edit?draft=1');
    const handed = (await page.evaluate(() => (window as unknown as { __setItems: Array<[string, string]> }).__setItems)).find(([k]) => k === 'sw.schedules.newdraft');
    expect(handed, 'the draft is handed to the schedule editor through sessionStorage (CR-014 NEW_DRAFT_KEY)').toBeTruthy();
    const draft = JSON.parse(handed![1]) as { slots: Array<{ start: string }>; weekdays: string[] };
    expect(draft.slots[0].start).toMatch(/^sunset/);
    expect(draft.weekdays).toEqual(['daily']);
    expect(lastCall(st, 'POST', /automations\/automation$/)).toBeUndefined(); // the automation was not created
    expect((await events(page)).filter((e) => e.name === 'saved')).toHaveLength(0);
  });

  test('no scheduler component: no suggestion chip; a non-time automation never gets one', async ({ page }) => {
    const st = fresh('installer', { schedulerPresent: false });
    const { tag } = await mount(page, st, 'automation-builder', { mode: 'create' });
    await page.locator(`${tag} [data-template="t6"]`).click();
    await ready(page, tag);
    await expect(page.locator(`${tag} [data-suggest-schedule]`)).toHaveCount(0);
    const st2 = fresh();
    const m2 = await mount(page, st2, 'automation-builder', { itemId: idOf(st2, 'automation.hall_motion') });
    await ready(page, m2.tag);
    await expect(page.locator(`${m2.tag} [data-suggest-schedule]`)).toHaveCount(0);
  });

  test('unknown-effect content needs a confirmation before it is saved', async ({ page }) => {
    const st = fresh();
    const id = idOf(st, 'automation.vacation_freeze'); // a scheduler.* call: a locked action with unknown effects
    const { tag } = await mount(page, st, 'automation-builder', { itemId: id });
    await ready(page, tag);
    await expect(card(page, tag, 'action').nth(0).locator('.tag.warn', { hasText: 'שולט בתזמונים' })).toBeVisible();
    await page.locator(`${tag} [data-name-input]`).fill('הקפאת תזמונים');
    await page.locator(`${tag} [data-editor-save]`).click();
    await expect(page.locator(`${tag} [data-confirm-save]`)).toBeVisible();
    await page.locator(`${tag} [data-confirm-save]`).click();
    await expect(page.locator(`${tag} dialog.sheet`)).toBeHidden();
    expect((lastCall(st, 'PUT', /automations\/automation\/[^/]+$/)!.body as { confirm?: boolean }).confirm).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------- dry-run, run-now, enable, delete, guard

test.describe('automation builder: dry-run, run now, enable, delete and the unsaved guard', () => {
  test('dry-run shows the current truth of the conditions and what would change, and executes nothing', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') });
    await ready(page, tag);
    await page.locator(`${tag} [data-dry-run]`).click();
    const r = page.locator(`${tag} [data-dry-result]`);
    await expect(r).toContainText('אחרי השקיעה');
    await expect(r).toContainText('מתקיים');
    await expect(r).toContainText('תאורת פרוזדור');
    await shot(page, '27-builder-dryrun-1440-light');
    expect(st.calls.some((c) => /\/run$/.test(c.path))).toBe(false);
    await page.locator(`${tag} [data-dry-close]`).click();
    st.store.conditionsPass = false;
    await page.locator(`${tag} [data-dry-run]`).click();
    await expect(r).toContainText('לא מתקיים');
    await page.locator(`${tag} [data-dry-run-then]`).click(); // "בדוק תנאים ואז הרץ"
    await expect.poll(() => lastCall(st, 'POST', /\/run$/)?.body).toMatchObject({ skip_condition: false });
  });

  test('dry-run of an edited draft uses the preview (conditions are checked after saving)', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') });
    await ready(page, tag);
    await page.locator(`${tag} [data-name-input]`).fill('אחר');
    await page.locator(`${tag} [data-dry-run]`).click();
    await expect(page.locator(`${tag} [data-dry-result]`)).toContainText('לא ניתן לבדוק');
    expect(st.calls.some((c) => /dry-run/.test(c.path))).toBe(false);
  });

  test('run now: immediate for a plain automation; a sensitive one asks first (the same confirmation manual control shows)', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') });
    await ready(page, tag);
    await page.locator(`${tag} [data-run-now]`).click();
    await expect(page.locator(`${tag} [data-note]`)).toContainText('הופעלה');
    expect(lastCall(st, 'POST', /\/run$/)!.body).toMatchObject({ skip_condition: true });
    const st2 = fresh();
    const m2 = await mount(page, st2, 'automation-builder', { itemId: idOf(st2, 'automation.all_left') }, '390');
    await ready(page, m2.tag);
    await page.locator(`${m2.tag} [data-run-now]`).click();
    await expect(page.locator(`${m2.tag} [data-run-confirm]`)).toContainText('פעולה רגישה');
    await shot(page, '28-builder-run-confirm-390-light');
    expect(st2.calls.some((c) => /\/run$/.test(c.path))).toBe(false);
    await page.locator(`${m2.tag} [data-run-confirm-ok]`).click();
    await expect.poll(() => lastCall(st2, 'POST', /\/run$/)?.body).toMatchObject({ skip_condition: true, confirm: true });
  });

  test('the enable switch (existing automations) enables and disables at once', async ({ page }) => {
    const st = fresh();
    const id = idOf(st, 'automation.hall_motion');
    const { tag } = await mount(page, st, 'automation-builder', { itemId: id });
    await ready(page, tag);
    await page.locator(`${tag} [data-enable-toggle]`).locator('button').click();
    await expect.poll(() => lastCall(st, 'POST', /\/disable$/)).toBeTruthy();
    await expect.poll(() => st.store.entry('automation', id)!.meta.enabled).toBe(false);
    await expect.poll(async () => (await events(page)).some((e) => e.name === 'item-changed')).toBe(true);
  });

  test('delete: a confirmation, then the item goes to the trash (the editor reports `deleted` and closes)', async ({ page }) => {
    const st = fresh();
    const id = idOf(st, 'automation.hall_motion');
    const rev = (await st.store.get('automation', id)).revision;
    const { tag } = await mount(page, st, 'automation-builder', { itemId: id });
    await ready(page, tag);
    await page.locator(`${tag} [data-options] summary`).click();
    await page.locator(`${tag} [data-editor-delete]`).click();
    await expect(page.locator(`${tag} sw-dialog[open]`)).toContainText('יועבר לסל המחזור');
    await page.locator(`${tag} [data-delete-confirm]`).click();
    await expect(page.locator(`${tag} dialog.sheet`)).toBeHidden();
    expect(lastCall(st, 'POST', /\/delete$/)!.body).toMatchObject({ base_revision: rev });
    expect((await events(page)).find((e) => e.name === 'deleted')?.detail).toMatchObject({ kind: 'automation', id });
    expect(st.store.trashSnapshot().some((t) => t.id === id)).toBe(true);
  });

  test('the unsaved guard: Escape or "ביטול" with changes asks first; clean, it just closes; the options show the mode and the description', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') });
    await ready(page, tag);
    await page.locator(`${tag} [data-options] summary`).click();
    await expect(page.locator(`${tag} [data-fld="mode"]`).last()).toHaveValue('restart');
    await page.locator(`${tag} [data-fld="mode"]`).last().selectOption('queued');
    await expect(page.locator(`${tag} [data-fld="max"]`)).toBeVisible();
    await page.keyboard.press('Escape');
    const dlg = page.locator(`${tag} sw-dialog[open]`);
    await expect(dlg).toContainText('לצאת בלי לשמור');
    await shot(page, '29-builder-discard-1440-light');
    await page.locator(`${tag} [data-discard="keep"]`).click();
    await expect(page.locator(`${tag} dialog.sheet`)).toBeVisible();
    await page.locator(`${tag} [data-editor-cancel]`).click();
    await page.locator(`${tag} [data-discard="leave"]`).click();
    await expect(page.locator(`${tag} dialog.sheet`)).toBeHidden();
    expect((await events(page)).some((e) => e.name === 'cancel')).toBe(true);
    // clean: closes at once
    const st2 = fresh();
    const m2 = await mount(page, st2, 'automation-builder', { itemId: idOf(st2, 'automation.hall_motion') });
    await ready(page, m2.tag);
    await page.keyboard.press('Escape');
    await expect(page.locator(`${m2.tag} dialog.sheet`)).toBeHidden();
  });

  test('the type chooser and the code view on a tablet (820) and the type chooser on a phone', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') }, '820');
    await ready(page, tag);
    await page.locator(`${tag} [data-add="action"]`).click();
    await shot(page, '35-builder-typepop-820-light');
    await page.keyboard.press('Escape');
    await tog(page, tag).locator('[data-view="code"]').click();
    await expect(page.locator(`${tag} automation-code textarea`)).toBeVisible();
    await shot(page, '36-code-820-light');
    const st2 = fresh();
    const m2 = await mount(page, st2, 'automation-builder', { itemId: idOf(st2, 'automation.hall_motion'), scheme: 'dark' }, '390');
    await ready(page, m2.tag);
    await page.locator(`${m2.tag} [data-add="trigger"]`).click();
    await expect(page.locator(`${m2.tag} [data-typepop] [data-type]`)).toHaveCount(7);
    await shot(page, '37-builder-typepop-390-dark');
  });

  test('states: loading, and an error with a retry', async ({ page }) => {
    const st = fresh();
    st.statusDelay = 2500;
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') });
    await expect(page.locator(`${tag} [data-editor-state="loading"]`)).toBeVisible();
    await shot(page, '30-builder-loading-1440-light');
    await expect(page.locator(`${tag} [data-sentence]`)).toBeVisible({ timeout: 15_000 });
    const st2 = fresh();
    st2.failGet = true;
    const m2 = await mount(page, st2, 'automation-builder', { itemId: idOf(st2, 'automation.hall_motion') }, '390');
    await expect(page.locator(`${m2.tag} [data-editor-state="error"]`)).toContainText('תשתית המערכת אינה זמינה');
    await shot(page, '31-builder-error-390-light');
    st2.failGet = false;
    await page.locator(`${m2.tag} [data-editor-state="error"] button`).click();
    await expect(page.locator(`${m2.tag} [data-sentence]`)).toBeVisible();
  });

  test('RTL and touch: the sheet is right-to-left, the controls are 44 px on a phone, focus lands inside the sheet', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'automation-builder', { itemId: idOf(st, 'automation.hall_motion') }, '390');
    await ready(page, tag);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('automation-builder')!.shadowRoot!.querySelector('dialog.sheet')!).direction)).toBe('rtl');
    for (const sel of [`${tag} [data-editor-save]`, `${tag} [data-add="trigger"]`, `${tag} [data-editor-close]`, `${tag} [data-dry-run]`, `${tag} [data-block-main] >> nth=0`]) {
      const box = await page.locator(sel).first().boundingBox();
      expect(box!.height, sel).toBeGreaterThanOrEqual(44);
    }
    const active = await page.evaluate(() => { let a: Element | null = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; return a?.closest('automation-builder') !== null || !!(a as HTMLElement | null)?.closest?.('dialog'); });
    expect(active).toBe(true);
    const tabs = await page.locator(`${tag} .shsub .seg button`).first().boundingBox();
    expect(tabs!.height).toBeGreaterThanOrEqual(40);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------- scripts and scenes

test.describe('script editor and scene editor', () => {
  for (const size of ['1440', '390'] as Size[]) {
    test(`script editor: the fields definition and the sequence built with the same block editor (${size})`, async ({ page }) => {
      const st = fresh();
      const id = idOf(st, 'script.shutters');
      const { tag } = await mount(page, st, 'script-editor', { itemId: id }, size);
      await page.locator(`${tag} [data-section="fields"]`).waitFor();
      await expect(page.locator(`${tag} [data-field]`)).toHaveCount(4);
      await expect(page.locator(`${tag} [data-field="percent"]`)).toContainText('מספר 0–100%');
      await expect(page.locator(`${tag} [data-field="slow"]`)).toContainText('כן / לא');
      await expect(card(page, tag, 'action')).toHaveCount(1);
      await expect(card(page, tag, 'action').nth(0)).toHaveAttribute('locked', ''); // the template step
      await expect(page.locator(`${tag} [data-view-toggle]:visible`)).toBeVisible();
      await shot(page, `32-script-editor-${size}-light`);
    });
  }

  test('script fields: edit one, add one of each kind, remove one; the save sends them; a script is run from the editor', async ({ page }) => {
    const st = fresh();
    const id = idOf(st, 'script.shutters');
    const { tag } = await mount(page, st, 'script-editor', { itemId: id });
    await page.locator(`${tag} [data-section="fields"]`).waitFor();
    await page.locator(`${tag} [data-field="percent"] [data-field-main]`).click();
    await page.locator(`${tag} [data-fld="field.name"]`).fill('אחוז');
    await page.locator(`${tag} [data-fld="field.max"]`).fill('90');
    await page.locator(`${tag} [data-fld="field.max"]`).press('Tab');
    await expect(page.locator(`${tag} [data-field="percent"]`)).toContainText('מספר 0–90%');
    await page.locator(`${tag} [data-add-field]`).click();
    await expect(page.locator(`${tag} [data-field-kind]`)).toHaveCount(5);
    await page.locator(`${tag} [data-field-kind="text"]`).click();
    await expect(page.locator(`${tag} [data-field]`)).toHaveCount(5);
    await expect(page.locator(`${tag} [data-validation]`)).toContainText('תנו שם לשדה');
    await page.locator(`${tag} [data-fld="field.name"]`).fill('הערה');
    await page.locator(`${tag} [data-field="side"] [data-field-remove]`).click();
    await expect(page.locator(`${tag} [data-field]`)).toHaveCount(4);
    await saveIt(page, tag);
    await expect(page.locator(`${tag} dialog.sheet`)).toBeHidden();
    const put = lastCall(st, 'PUT', /automations\/script\/[^/]+$/)!;
    const fields = (put.body as { draft: { fields: Array<{ key: string; name: string }> } }).draft.fields;
    expect(fields.map((f) => f.key)).toEqual(['percent', 'shutters', 'slow', 'field_5']);
    expect(fields[0].name).toBe('אחוז');
    const stored = st.store.storedConfig('script', id)!;
    expect((stored.fields as Record<string, { selector: { number: { max: number } } }>).percent.selector.number.max).toBe(90);
    expect(Object.keys(stored.fields as object)).not.toContain('side');
  });

  test('script: sequence blocks are the same editor as an automation\'s actions; run now with the fields\' defaults; a new script from blank', async ({ page }) => {
    const st = fresh();
    const id = idOf(st, 'script.good_morning');
    const { tag } = await mount(page, st, 'script-editor', { itemId: id });
    await page.locator(`${tag} [data-section="action"]`).waitFor();
    await expect(card(page, tag, 'action')).toHaveCount(3);
    await openCard(page, tag, 'action', 2);
    await expect(page.locator(`${tag} [data-fld="data.temperature"]`)).toHaveValue('23');
    await page.locator(`${tag} [data-run-now]`).click();
    await expect(page.locator(`${tag} [data-note]`)).toContainText('הופעל');
    expect(lastCall(st, 'POST', /script\/[^/]+\/run$/)).toBeTruthy();
    const st2 = fresh();
    const m2 = await mount(page, st2, 'script-editor', { mode: 'create' });
    await page.locator(`${m2.tag} [data-section="fields"]`).waitFor();
    await expect(page.locator(`${m2.tag} .shh small`)).toContainText('סקריפט חדש');
    await page.locator(`${m2.tag} [data-name-input]`).fill('סקריפט בדיקה');
    await page.locator(`${m2.tag} [data-add="action"]`).click();
    await page.locator(`${m2.tag} [data-type="device"]`).click();
    await page.locator(`${m2.tag} [data-entity-add]`).click();
    await page.locator(`${m2.tag} automation-entity-picker [data-picker-item="light.hall"]`).click();
    await page.locator(`${m2.tag} automation-entity-picker [data-picker-done]`).click();
    await page.locator(`${m2.tag} [data-editor-save]`).click();
    await expect(page.locator(`${m2.tag} dialog.sheet`)).toBeHidden();
    expect(lastCall(st2, 'POST', /automations\/script$/)!.body).toMatchObject({ draft: { alias: 'סקריפט בדיקה' } });
  });

  for (const size of ['1440', '390'] as Size[]) {
    test(`scene editor: the members of a native scene as a table with editable values, add by picker with capture, remove (${size})`, async ({ page }) => {
      const st = fresh();
      const id = idOf(st, 'scene.arx_welcome');
      const { tag } = await mount(page, st, 'scene-editor', { itemId: id, scheme: size === '390' ? 'dark' : 'light' }, size);
      await page.locator(`${tag} [data-section="members"]`).waitFor();
      await expect(page.locator(`${tag} [data-member]`)).toHaveCount(5);
      await expect(page.locator(`${tag} [data-view-toggle]`)).toHaveCount(0);
      await expect(page.locator(`${tag} [data-fld="light.entry.brightness"]`)).toHaveValue('80');
      await shot(page, `33-scene-editor-${size}-${size === '390' ? 'dark' : 'light'}`);
      if (size !== '1440') return;
      await page.locator(`${tag} [data-fld="light.entry.brightness"]`).fill('50');
      await page.locator(`${tag} [data-fld="light.entry.brightness"]`).press('Tab');
      await page.locator(`${tag} [data-member-remove="media_player.salon_tv"]`).click();
      await page.locator(`${tag} [data-scene-add]`).click();
      await page.locator(`${tag} automation-entity-picker [data-picker-item="light.kitchen"]`).click();
      await page.locator(`${tag} automation-entity-picker [data-picker-done]`).click();
      await expect(page.locator(`${tag} [data-member="light.kitchen"]`)).toBeVisible();
      await expect.poll(() => lastCall(st, 'POST', /scene\/capture$/)?.body).toMatchObject({ entity_ids: ['light.kitchen'] });
      await expect(page.locator(`${tag} [data-fld="light.kitchen.brightness"]`)).toHaveValue('100'); // captured from the mirror
      await page.locator(`${tag} [data-editor-save]`).click();
      await expect(page.locator(`${tag} dialog.sheet`)).toBeHidden();
      const put = lastCall(st, 'PUT', /automations\/scene\/[^/]+$/)!;
      const members = (put.body as { draft: { members: Array<{ entity_id: string; attributes: Record<string, number> }> } }).draft.members;
      expect(members.map((m) => m.entity_id)).toEqual(['light.entry', 'light.salon', 'cover.salon_shutter', 'climate.salon', 'light.kitchen']);
      expect(members[0].attributes.brightness).toBe(128);
    });
  }

  test('scene: a new scene starts empty, "צלם מצב נוכחי" is off until devices are chosen; an integration scene is activate-only', async ({ page }) => {
    const st = fresh();
    const { tag } = await mount(page, st, 'scene-editor', { mode: 'create' });
    await page.locator(`${tag} [data-section="members"]`).waitFor();
    await expect(page.locator(`${tag} [data-members-empty]`)).toBeVisible();
    await expect(page.locator(`${tag} [data-scene-capture]`)).toBeDisabled();
    await page.locator(`${tag} [data-name-input]`).fill('ערב');
    await page.locator(`${tag} [data-scene-add]`).click();
    await expect(page.locator(`${tag} automation-entity-picker [data-picker-item="alarm_control_panel.home"]`)).toHaveCount(0); // alarm panels are not a capture domain
    await expect(page.locator(`${tag} automation-entity-picker [data-picker-item="light.salon"]`)).toBeVisible();
    await shot(page, '34-scene-editor-new-picker-1440-light');
    const st2 = fresh();
    const m2 = await mount(page, st2, 'scene-editor', { itemId: 'entity:scene.salon_evening' });
    await expect(page.locator(`${m2.tag} [data-banner="readonly"]`)).toContainText('הפעלה בלבד');
    await expect(page.locator(`${m2.tag} [data-editor-save]`)).toBeDisabled();
  });
});
