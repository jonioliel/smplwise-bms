import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import {
  AUTOMATION_ERROR_LABEL, AUTOMATION_SETTINGS_DEFAULT, CAPS, DEFAULT_ALLOWED_ACTIONS, INSTALLATION_WIDE, REVIEW_LABEL,
  activateScene, automationErrorText, automationSettingsOf, automationSettingsPatch, automationSentence, automations, automationsTabVisible, blockAtPath, blockPathOf, blockSentences, canonicalJson,
  captureMember, captureMembers, changedLockedBlocks, classifyAction, codeFromConfig, codeToDraft, codeViewMode, conditionSentence, configToDraft, controlsSchedules, countByKind, createItem, delegationState,
  deleteItem, draftSentence, draftTargets, draftToCode, draftToConfig, durationText, emitBlock, entityInScope, extraKeys, filterItems, findBlock, fingerprintOf, formatDuration, groupPicker,
  hasUnknownEffects, httpAutomations, isSecretKey, issuesByUid, itemChips, itemVisibleTo, joinNames, lastRunText, lockedBlocks, manageRight, mapAutomationError, maskSecrets, memberSummary,
  needsConfirmation, normalisePath, parseAction, parseCode, parseCondition, parseSelector, parseTrigger, pickerEntities, preservedFingerprints, previewSaveBlocker, readOnlyChip, refreshSentences,
  replaceItem, revisionOf, runAutomation, runNeedsConfirm, saveBlocker, saveProfile, sceneCaptureDiff, secretKind, selectorOut, sensitiveClassOf, sensitiveSteps, sha256Hex, shortRunSentence,
  sortItems, stepsOfDraft, suggestSchedule, toggleAutomation, traceView, traceWho, tracePathToBlockPath, triggerEntities, triggerSentence, validateDraft, variableLines, visibleKinds, walkDraft,
  type ActionBlock, type AutomationDraft, type AutomationsStatus, type Item, type ModelContext, type RunTrace, type SceneMember, type ScriptDraft, type TriggerBlock,
} from '../src/api/automations';
import { automationsMock, resetAutomationsMock, SHABBAT_SENSOR, type AutomationsMockStore } from '../src/api/automations-mock';
import { ApiError } from '../src/api/client';

// CR-017 S0: the typed client's pure helpers (block model with LOCKED blocks, sentences, validation, scope, traces, scene capture, schedule
// suggestion, permissions), the MOCK adapter (the fixture house, three users, delegation / conflict knobs), the error mapping and the HTTP
// adapter's routes (docs/architecture/AUTOMATIONS_API.md). No browser page. This spec imports the client first, then the mock: the order that
// would expose a load-time cycle (there is none: the client reaches the mock only through a dynamic import).

const NAMES: Record<string, string> = {
  'light.hall': 'תאורת פרוזדור', 'light.entry': 'תאורת כניסה', 'light.garden': 'תאורת גינה', 'binary_sensor.hall_motion': 'חיישן תנועה פרוזדור', 'binary_sensor.front_door': 'דלת הכניסה',
  'person.yoni': 'יוני', 'person.dana': 'דנה', 'zone.home': 'הבית', 'climate.bed': 'מזגן חדר שינה', 'climate.salon': 'מזגן סלון', 'alarm_control_panel.home': 'אזעקה', 'switch.irrigation': 'השקיה',
  'light.salon': 'תאורת סלון', 'light.kitchen': 'תאורת מטבח', 'scene.salon_evening': 'סלון · ערב', 'script.good_morning': 'בוקר טוב', 'sensor.bed_temp': 'טמפרטורה חדר שינה',
};
const ctx: ModelContext = { names: (id) => NAMES[id] ?? id, shabbatSensor: SHABBAT_SENSOR, notifyName: (a) => (a === 'notify.mobile_app_yoni' ? 'הטלפון של יוני' : null) };

const code = async (p: Promise<unknown>): Promise<string | null> => {
  try { await p; return null; } catch (e) { return e instanceof ApiError ? e.code : `other:${String(e)}`; }
};
const fail = async (p: Promise<unknown>): Promise<ApiError> => {
  try { await p; } catch (e) { if (e instanceof ApiError) return e; throw e; }
  throw new Error('expected an ApiError');
};
let rq = 0;
const rid = () => `req-${++rq}-abcdefgh`;
const S = (m: AutomationsMockStore, entity: string) => m.idOf(entity);
const autoDraft = (c: unknown) => configToDraft('automation', c, ctx).draft;
const svc = (b: unknown): ActionBlock & { type: 'service' } => b as ActionBlock & { type: 'service' };
const stripUids = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (k, x) => (k === 'uid' ? undefined : x)));

// ---------------------------------------------------------------------------------------------------------------- primitives

test.describe('automations client: primitives', () => {
  test('sha256Hex equals node crypto for short, boundary, long and non-ASCII text', () => {
    for (const s of ['', 'abc', 'עברית ✓ שלום', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(63), 'x'.repeat(64), 'x'.repeat(119), 'x'.repeat(1000)]) {
      expect(sha256Hex(s)).toBe(createHash('sha256').update(s, 'utf8').digest('hex'));
    }
  });

  test('canonical JSON sorts keys at every depth; fingerprint and revision are 16 hex and ignore key order', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [{ z: 1, y: 2 }] } })).toBe('{"a":{"c":[{"y":2,"z":1}],"d":2},"b":1}');
    const a = { alias: 'א', actions: [{ action: 'x.y', data: { b: 1, a: 2 } }] };
    const b = { actions: [{ data: { a: 2, b: 1 }, action: 'x.y' }], alias: 'א' };
    expect(fingerprintOf(a)).toMatch(/^[0-9a-f]{16}$/);
    expect(fingerprintOf(a)).toBe(fingerprintOf(b));
    expect(revisionOf(a)).toBe(createHash('sha256').update(canonicalJson(a)).digest('hex').slice(0, 16));
    expect(fingerprintOf({ ...a, alias: 'ב' })).not.toBe(fingerprintOf(a));
  });

  test('secret-like keys are matched as whole words (snake, kebab, camel case); values are masked at any depth', () => {
    for (const k of ['code', 'password', 'passwd', 'token', 'access_token', 'api_key', 'apikey', 'apiKey', 'secret', 'pin', 'alarm-code', 'PIN']) expect(isSecretKey(k), k).toBe(true);
    for (const k of ['shipping', 'unicode', 'encoded', 'message', 'entity_id', 'brightness_pct', 'tokenizer_x']) expect(isSecretKey(k), k).toBe(false);
    expect(secretKind({ data: { code: '1234' } })).toBe('code');
    expect(secretKind({ a: [{ api_key: 'x' }] })).toBe('secret');
    expect(secretKind({ data: { message: 'hi' } })).toBeNull();
    expect(maskSecrets({ a: { token: 't', n: 1 }, l: [{ code: 1 }], ok: 'x' })).toEqual({ a: { token: '••••', n: 1 }, l: [{ code: '••••' }], ok: 'x' });
  });

  test('sensitive classes: by service, and cover.* only by the entity class; each has a grant', () => {
    expect(sensitiveClassOf('alarm_control_panel.alarm_disarm')).toBe('alarm');
    expect(sensitiveClassOf('lock.unlock')).toBe('lock');
    expect(sensitiveClassOf('siren.turn_on')).toBe('siren');
    expect(sensitiveClassOf('cover.open_cover')).toBeNull();
    expect(sensitiveClassOf('cover.open_cover', 'gate')).toBe('gate');
    expect(sensitiveClassOf('light.turn_on', null)).toBeNull();
  });

  test('action classification: roles, never-typed services, core vs custom domains, notify allow-list', () => {
    expect(classifyAction('light.turn_on')).toEqual({ ok: true, role: 'device' });
    expect(classifyAction('scene.turn_on')).toEqual({ ok: true, role: 'scene' });
    expect(classifyAction('script.turn_on')).toEqual({ ok: true, role: 'script' });
    expect(classifyAction('script.good_morning')).toEqual({ ok: true, role: 'script' });
    expect(classifyAction('automation.trigger')).toEqual({ ok: true, role: 'automation' });
    expect(classifyAction('automation.reload')).toEqual({ ok: false, reason: 'service_not_allowed' });
    expect(classifyAction('notify.anything')).toEqual({ ok: true, role: 'notify' });
    expect(classifyAction('notify.anything', { allowedActions: ['notify.mobile_app_yoni'] })).toEqual({ ok: false, reason: 'service_not_allowed' });
    expect(classifyAction('notify.mobile_app_yoni', { allowedActions: ['notify.mobile_app_yoni'] })).toEqual({ ok: true, role: 'notify' });
    for (const a of ['homeassistant.turn_off', 'shell_command.blink', 'rest_command.x', 'hassio.host_reboot', 'recorder.purge', 'smplwise_bridge.execute', 'light.reload', 'scheduler.reload']) expect(classifyAction(a), a).toEqual({ ok: false, reason: 'service_not_allowed' });
    expect(classifyAction('light.some_new_service')).toEqual({ ok: false, reason: 'service_not_allowed' });
    expect(classifyAction('scheduler.run_action')).toEqual({ ok: false, reason: 'custom_service' });
    expect(classifyAction('browser_mod.popup')).toEqual({ ok: false, reason: 'custom_service' });
    expect(classifyAction('not a service')).toEqual({ ok: false, reason: 'unknown' });
    expect(classifyAction('light.turn_on', { allowedActions: ['switch.turn_on'] })).toEqual({ ok: false, reason: 'service_not_allowed' });
    expect(DEFAULT_ALLOWED_ACTIONS).toContain('alarm_control_panel.alarm_disarm');
  });
});

// ---------------------------------------------------------------------------------------------------------------- the block model

test.describe('automations client: reading blocks (typed and locked)', () => {
  test('typed triggers: state with for/from/to and id, numeric_state, time, time_pattern, sun with offset, HA start', () => {
    const s = parseTrigger({ trigger: 'state', entity_id: ['binary_sensor.front_door'], to: 'on', for: { hours: 0, minutes: 5, seconds: 0 }, id: 'door' }, ctx) as TriggerBlock;
    expect(s).toMatchObject({ kind: 'typed', type: 'state', entity_ids: ['binary_sensor.front_door'], to: 'on', for: { minutes: 5 }, id: 'door' });
    expect(s.sentence).toBe('כשדלת הכניסה נפתח/ת במשך 5 דקות');
    // a single entity string, a "HH:MM:SS" for, and a legacy `platform` key
    const l = parseTrigger({ platform: 'state', entity_id: 'person.yoni', to: 'home', for: '00:10:00' }, ctx) as TriggerBlock & { type: 'state' };
    expect(l).toMatchObject({ type: 'state', entity_ids: ['person.yoni'], for: { hours: 0, minutes: 10, seconds: 0 } });
    expect(parseTrigger({ trigger: 'numeric_state', entity_id: 'sensor.bed_temp', above: 26 }, ctx)).toMatchObject({ type: 'numeric_state', above: 26 });
    expect(parseTrigger({ trigger: 'time', at: '06:30' }, ctx)).toMatchObject({ type: 'time', at: '06:30' });
    expect(parseTrigger({ trigger: 'time_pattern', minutes: '/15' }, ctx)).toMatchObject({ type: 'time_pattern', minutes: '/15' });
    expect(parseTrigger({ trigger: 'sun', event: 'sunset', offset: '-00:20:00' }, ctx)).toMatchObject({ type: 'sun', event: 'sunset', offset_min: -20 });
    expect(parseTrigger({ trigger: 'sun', event: 'sunrise', offset: 600 }, ctx)).toMatchObject({ offset_min: 10 });
    expect(parseTrigger({ trigger: 'homeassistant', event: 'start' }, ctx)).toMatchObject({ type: 'homeassistant', event: 'start' });
  });

  test('locked triggers: device, template, purpose-specific, other platforms, disabled, with reason, label and fingerprint', () => {
    const dev = parseTrigger({ trigger: 'device', domain: 'wall_switch', device_id: 'abc', type: 'button_1_short' }, { ...ctx, deviceName: () => 'מפסק סלון' });
    expect(dev).toMatchObject({ kind: 'locked', reason: 'device', label: 'כפתור · מפסק סלון', effects: 'none', masked: false });
    expect((dev as { fingerprint: string }).fingerprint).toBe(fingerprintOf((dev as { raw: unknown }).raw));
    const tpl = parseTrigger({ trigger: 'template', value_template: "{{ states('sensor.lux') | int < 20 }}" }, ctx);
    expect(tpl).toMatchObject({ kind: 'locked', reason: 'template', label: 'תבנית', template_text: "{{ states('sensor.lux') | int < 20 }}" });
    expect(parseTrigger({ trigger: 'template', value_template: '{{ x }}' }, { ...ctx, templateText: false })).toMatchObject({ template_text: null });
    expect(parseTrigger({ trigger: 'switch.turned_on', target: { entity_id: 'switch.x' } }, ctx)).toMatchObject({ reason: 'purpose_trigger', label: 'טריגר ייעודי · switch.turned_on' });
    expect(parseTrigger({ trigger: 'event', event_type: 'x' }, ctx)).toMatchObject({ kind: 'locked', reason: 'unsupported_step' });
    expect(parseTrigger({ trigger: 'zone', entity_id: 'person.yoni', zone: 'zone.home', event: 'enter' }, ctx)).toMatchObject({ kind: 'locked' });
    expect(parseTrigger({ trigger: 'state', entity_id: 'light.hall', to: 'on', enabled: false }, ctx)).toMatchObject({ kind: 'locked', reason: 'disabled_step', label: 'צעד מושבת' });
    expect(parseTrigger({ trigger: 'state', entity_id: 'light.hall', attribute: 'brightness' }, ctx)).toMatchObject({ kind: 'locked', reason: 'unsupported_step' });
    expect(parseTrigger({ trigger: 'state', entity_id: '{{ x }}', to: 'on' }, ctx)).toMatchObject({ kind: 'locked', reason: 'template' });
    expect(parseTrigger({ trigger: 'sun', event: 'sunset', offset: '00:00:30' }, ctx)).toMatchObject({ kind: 'locked' });
    expect(parseTrigger({ nothing: true }, ctx)).toMatchObject({ kind: 'locked', reason: 'unknown' });
    expect(parseTrigger('{{ trigger }}', ctx)).toMatchObject({ kind: 'locked', reason: 'template' });
  });

  test('conditions: typed kinds, the Shabbat preset on the configured sensor, one nesting level, shorthand templates', () => {
    expect(parseCondition({ condition: 'state', entity_id: ['climate.bed'], state: 'cool' }, ctx)).toMatchObject({ type: 'state', state: 'cool' });
    expect(parseCondition({ condition: 'state', entity_id: ['climate.bed'], state: ['cool', 'heat'] }, ctx)).toMatchObject({ state: ['cool', 'heat'] });
    expect(parseCondition({ condition: 'state', entity_id: [SHABBAT_SENSOR], state: 'on' }, ctx)).toMatchObject({ type: 'shabbat', mode: 'only_holy_days' });
    expect(parseCondition({ condition: 'state', entity_id: SHABBAT_SENSOR, state: 'off' }, ctx)).toMatchObject({ type: 'shabbat', mode: 'not_holy_days' });
    expect(parseCondition({ condition: 'state', entity_id: [SHABBAT_SENSOR], state: 'on' }, { ...ctx, shabbatSensor: null })).toMatchObject({ type: 'state' });
    expect(parseCondition({ condition: 'time', after: '17:00:00', before: '23:30:00', weekday: ['sun', 'mon'] }, ctx)).toMatchObject({ type: 'time', weekday: ['sun', 'mon'] });
    expect(parseCondition({ condition: 'time', after: 'input_datetime.x' }, ctx)).toMatchObject({ kind: 'locked' });
    expect(parseCondition({ condition: 'sun', after: 'sunset' }, ctx)).toMatchObject({ type: 'sun', after: 'sunset' });
    expect(parseCondition({ condition: 'trigger', id: 'night' }, ctx)).toMatchObject({ type: 'trigger', ids: ['night'] });
    const g = parseCondition({ condition: 'not', conditions: [{ condition: 'state', entity_id: 'person.yoni', state: 'home' }, { condition: 'or', conditions: [] }] }, ctx) as { type: string; conditions: Array<{ kind: string; type?: string }> };
    expect(g.type).toBe('not');
    expect(g.conditions[0]).toMatchObject({ kind: 'typed', type: 'state' });
    expect(g.conditions[1]).toMatchObject({ kind: 'locked', reason: 'unsupported_step' }); // a second nesting level stays locked
    expect(parseCondition('{{ is_state("light.x", "on") }}', ctx)).toMatchObject({ kind: 'locked', reason: 'template' });
    expect(parseCondition({ condition: 'template', value_template: '{{ true }}' }, ctx)).toMatchObject({ kind: 'locked', reason: 'template' });
    expect(parseCondition({ condition: 'device', device_id: 'x', domain: 'light', type: 'is_on' }, ctx)).toMatchObject({ kind: 'locked', reason: 'device', label: 'תנאי מכשיר · מכשיר' });
  });

  test('actions: roles, containers, delays; everything else is locked with its reason', () => {
    const a = parseAction({ action: 'light.turn_on', target: { entity_id: ['light.hall'] }, data: { brightness_pct: 40 } }, ctx) as ActionBlock;
    expect(a).toMatchObject({ kind: 'typed', type: 'service', role: 'device', entity_ids: ['light.hall'], data: { brightness_pct: 40 } });
    expect(a.sentence).toBe('הדלק תאורת פרוזדור ל־40%');
    expect(parseAction({ action: 'scene.turn_on', target: { entity_id: 'scene.salon_evening' } }, ctx)).toMatchObject({ role: 'scene', entity_ids: ['scene.salon_evening'] });
    expect(parseAction({ action: 'script.good_morning' }, ctx)).toMatchObject({ role: 'script', entity_ids: ['script.good_morning'] });
    expect(parseAction({ action: 'notify.mobile_app_yoni', data: { message: 'שלום' } }, ctx)).toMatchObject({ role: 'notify', entity_ids: [] });
    expect(parseAction({ service: 'light.turn_off', entity_id: 'light.hall' }, ctx)).toMatchObject({ type: 'service', entity_ids: ['light.hall'] }); // legacy keys read in memory
    expect(parseAction({ delay: { hours: 0, minutes: 3, seconds: 0 } }, ctx)).toMatchObject({ type: 'delay', delay: { minutes: 3 } });
    expect(parseAction({ delay: '00:00:10' }, ctx)).toMatchObject({ type: 'delay', delay: { seconds: 10 } });
    expect(parseAction({ stop: 'סיום' }, ctx)).toMatchObject({ type: 'stop', message: 'סיום' });
    expect(parseAction({ repeat: { count: 3, sequence: [{ delay: { seconds: 1 } }] } }, ctx)).toMatchObject({ type: 'repeat_count', count: 3 });
    expect(parseAction({ condition: 'state', entity_id: 'person.yoni', state: 'home' }, ctx)).toMatchObject({ type: 'condition', condition: { type: 'state' } });
    const ch = parseAction({ choose: [{ conditions: [{ condition: 'trigger', id: ['a'] }], sequence: [{ action: 'light.turn_on', target: { entity_id: 'light.hall' } }] }], default: [{ stop: 'x' }] }, ctx) as ActionBlock & { type: 'choose' };
    expect(ch.options).toHaveLength(1);
    expect(ch.options[0].sequence[0]).toMatchObject({ type: 'service' });
    expect(ch.default).toHaveLength(1);
    expect(parseAction({ if: [{ condition: 'state', entity_id: 'person.yoni', state: 'home' }], then: [{ stop: 'a' }] }, ctx)).toMatchObject({ type: 'if', else: null });

    const lockedReasons: Array<[unknown, string]> = [
      [{ action: 'scheduler.run_action' }, 'custom_service'], [{ action: 'browser_mod.popup', data: { title: 'x' } }, 'custom_service'], [{ action: 'shell_command.blink' }, 'service_not_allowed'],
      [{ action: 'homeassistant.restart' }, 'service_not_allowed'], [{ action: 'light.reload' }, 'service_not_allowed'], [{ action: 'light.turn_on', target: { entity_id: '{{ x }}' } }, 'template'],
      [{ action: 'light.turn_on', data: { brightness: '{{ b }}' }, target: { entity_id: 'light.hall' } }, 'template'], [{ action: 'light.turn_on', target: { area_id: 'salon' } }, 'unsupported_step'],
      [{ action: 'light.turn_on', target: { device_id: 'abc' } }, 'unsupported_step'], [{ action: 'light.turn_on', target: { entity_id: 'light.hall' }, continue_on_error: true }, 'disabled_step'],
      [{ action: 'light.turn_on', target: { entity_id: 'light.hall' }, enabled: false }, 'disabled_step'], [{ action: 'alarm_control_panel.alarm_disarm', target: { entity_id: 'alarm_control_panel.home' }, data: { code: '1234' } }, 'code'],
      [{ action: 'x.y', data: { api_key: 'k' } }, 'secret'], [{ type: 'turn_on', domain: 'light', device_id: 'abc', entity_id: 'abcdef' }, 'device'], [{ variables: { a: 1 } }, 'unsupported_step'],
      [{ wait_template: '{{ true }}' }, 'template'], [{ wait_for_trigger: [{ trigger: 'state', entity_id: 'light.hall' }] }, 'unsupported_step'], [{ parallel: [{ delay: { seconds: 1 } }] }, 'unsupported_step'],
      [{ repeat: { while: [{ condition: 'state', entity_id: 'light.hall', state: 'on' }], sequence: [] } }, 'unsupported_step'], [{ repeat: { for_each: ['a'], sequence: [] } }, 'unsupported_step'],
      [{ stop: 'x', error: true }, 'unsupported_step'], [{ delay: { milliseconds: 10 } }, 'unsupported_step'], [{ event: 'my_event' }, 'unsupported_step'], ['{{ x }}', 'template'],
    ];
    for (const [raw, reason] of lockedReasons) expect(parseAction(raw, ctx), JSON.stringify(raw)).toMatchObject({ kind: 'locked', reason });
    // labels and flags of locked actions
    expect(parseAction({ action: 'scheduler.run_action' }, ctx)).toMatchObject({ label: 'שירות מיוחד · scheduler', effects: 'unknown', sensitive: false });
    expect(parseAction({ action: 'light.turn_on', target: { entity_id: 'light.hall' }, continue_on_error: true }, ctx)).toMatchObject({ label: 'צעד עם המשך בשגיאה', effects: ['light.hall'] });
    expect(parseAction({ action: 'alarm_control_panel.alarm_disarm', target: { entity_id: 'alarm_control_panel.home' }, data: { code: '1' } }, ctx)).toMatchObject({ masked: true, sensitive: true, label: 'קוד חסוי', template_text: null });
    expect(parseAction({ action: 'shell_command.blink' }, ctx)).toMatchObject({ label: 'שירות לא מותר · shell_command.blink' });
  });

  test('the whole fixture house reads: the 42-automation shapes become typed or locked blocks, never dropped', async () => {
    const m = resetAutomationsMock();
    const items = (await m.list()).items;
    expect(items.filter((i) => i.kind === 'automation')).toHaveLength(12);
    expect(items.filter((i) => i.kind === 'script')).toHaveLength(3);
    const counts: Record<string, number> = {};
    for (const i of items.filter((x) => x.kind !== 'scene' || x.config_id)) {
      const cfg = m.storedConfig(i.kind, i.id);
      if (!cfg) continue;
      const draft = configToDraft(i.kind, cfg, ctx).draft;
      for (const b of lockedBlocks(draft)) counts[b.reason] = (counts[b.reason] ?? 0) + 1;
    }
    expect(counts).toMatchObject({ device: 2, template: 3, custom_service: 1, disabled_step: 1 });
  });
});

test.describe('automations client: writing blocks and the round trip (CR §6.2)', () => {
  test('write(read(c)) is byte-identical for every stored fixture item in the new schema (locked blocks and unknown top-level keys included)', async () => {
    const m = resetAutomationsMock();
    const items = (await m.list()).items.filter((i) => i.source === 'ui');
    expect(items.length).toBeGreaterThanOrEqual(15);
    let checked = 0;
    for (const i of items) {
      const cfg = m.storedConfig(i.kind, i.id)!;
      const read = configToDraft(i.kind, cfg, ctx);
      if (read.legacy) continue;
      const out = draftToConfig(i.kind, read.draft, cfg, ctx);
      expect(JSON.stringify(out), `${i.kind}:${i.id}`).toBe(JSON.stringify(cfg));
      expect(canonicalJson(out)).toBe(canonicalJson(cfg));
      expect(revisionOf(out)).toBe(i.revision);
      checked++;
    }
    expect(checked).toBe(items.length - 1); // all but the one legacy item
  });

  test('every locked block comes out byte-for-byte as it went in, wherever it sits (nested in choose, in any order)', async () => {
    const m = resetAutomationsMock();
    const id = S(m, 'automation.salon_buttons');
    const cfg = m.storedConfig('automation', id)!;
    const draft = autoDraft(cfg);
    const raws = lockedBlocks(draft).map((b) => JSON.stringify(b.raw));
    expect(raws).toHaveLength(2);
    // move and re-emit: the order may change, the content may not
    draft.triggers.reverse();
    const out = draftToConfig('automation', draft, cfg, ctx);
    expect(JSON.stringify((out.triggers as unknown[])[0])).toBe(raws[1]);
    expect(JSON.stringify((out.triggers as unknown[])[1])).toBe(raws[0]);
    // the template item: a locked trigger, a locked action, a top-level `variables` key
    const t = m.storedConfig('automation', S(m, 'automation.light_by_lux'))!;
    const td = autoDraft(t);
    expect(lockedBlocks(td).map((b) => b.reason)).toEqual(['template', 'template']);
    const to = draftToConfig('automation', td, t, ctx);
    expect(JSON.stringify(to.actions)).toBe(JSON.stringify(t.actions));
    expect(JSON.stringify(to.triggers)).toBe(JSON.stringify(t.triggers));
    expect(to.variables).toEqual({ room: 'salon' });
    expect(extraKeys('automation', t)).toEqual(['variables']);
  });

  test('editing one typed block rebuilds only that block; the others, the unknown keys and the key order stay', async () => {
    const m = resetAutomationsMock();
    const id = S(m, 'automation.hall_motion');
    const cfg = m.storedConfig('automation', id)!;
    const draft = autoDraft(cfg);
    svc(draft.actions[0]).data.brightness_pct = 60;
    const out = draftToConfig('automation', draft, cfg, ctx);
    expect((out.actions as Array<Record<string, unknown>>)[0]).toEqual({ action: 'light.turn_on', target: { entity_id: ['light.hall'] }, data: { brightness_pct: 60 } });
    expect(JSON.stringify((out.actions as unknown[])[1])).toBe(JSON.stringify((cfg.actions as unknown[])[1]));
    expect(JSON.stringify((out.actions as unknown[])[2])).toBe(JSON.stringify((cfg.actions as unknown[])[2]));
    expect(out.trace).toEqual({ stored_traces: 10 });
    expect(Object.keys(out)).toEqual(Object.keys(cfg));
    // a changed alias / mode / max, and a new block appended
    draft.alias = 'חדש';
    draft.mode = 'queued';
    draft.max = 5;
    draft.actions.push(parseAction({ action: 'switch.turn_on', target: { entity_id: ['switch.irrigation'] } }, ctx)); // a parsed block keeps its raw, so it is re-emitted as it is
    const added = { ...draft.actions[3], raw: null } as ActionBlock;
    draft.actions[3] = added;
    const out2 = draftToConfig('automation', draft, cfg, ctx);
    expect(out2).toMatchObject({ alias: 'חדש', mode: 'queued', max: 5 });
    expect((out2.actions as unknown[])[3]).toEqual({ action: 'switch.turn_on', target: { entity_id: ['switch.irrigation'] } });
    expect(Object.keys(out2)).toEqual([...Object.keys(cfg), 'max']);
  });

  test('a new automation is written in HA order and the new schema; empty optional keys are left out', () => {
    const draft: AutomationDraft = { alias: 'חדשה', description: '', mode: 'single', max: null, triggers: [], conditions: [], actions: [] };
    draft.triggers.push(parseTrigger({ trigger: 'time', at: '20:00' }, ctx));
    draft.triggers[0] = { ...(draft.triggers[0] as TriggerBlock), raw: null } as TriggerBlock;
    draft.actions.push({ ...(parseAction({ action: 'light.turn_on', target: { entity_id: ['light.entry'] } }, ctx) as ActionBlock), raw: null } as ActionBlock);
    const out = draftToConfig('automation', draft, null, ctx, { id: '1727700009999' });
    expect(Object.keys(out)).toEqual(['id', 'alias', 'description', 'triggers', 'conditions', 'actions', 'mode']);
    expect(out.triggers).toEqual([{ trigger: 'time', at: '20:00:00' }]);
    expect(out.conditions).toEqual([]);
    expect(out.mode).toBe('single');
  });

  test('legacy keys are rewritten in the new schema when the item is written; the result is stable and reads the same', async () => {
    const m = resetAutomationsMock();
    const cfg = m.storedConfig('automation', S(m, 'automation.alarm_morning'))!;
    const read = configToDraft('automation', cfg, ctx);
    expect(read.legacy).toBe(true);
    const out = draftToConfig('automation', read.draft, cfg, ctx);
    const text = JSON.stringify(out);
    expect(text).not.toContain('"platform"');
    expect(text).not.toContain('"service"');
    expect(Object.keys(out)).toEqual(['id', 'alias', 'description', 'triggers', 'conditions', 'actions', 'mode']);
    expect(out.triggers).toEqual([{ trigger: 'time', at: '06:45:00' }]);
    expect((out.actions as Array<Record<string, unknown>>)[0]).toEqual({ action: 'alarm_control_panel.alarm_disarm', target: { entity_id: ['alarm_control_panel.home'] } });
    expect(JSON.stringify(draftToConfig('automation', configToDraft('automation', out, ctx).draft, out, ctx))).toBe(text); // idempotent
    expect(automationSentence(configToDraft('automation', out, ctx).draft, ctx)).toBe(automationSentence(read.draft, ctx));
  });

  test('scripts keep their fields (extra keys of a field survive), scenes keep string members and metadata', async () => {
    const m = resetAutomationsMock();
    const sid = S(m, 'script.shutters');
    const cfg = m.storedConfig('script', sid)!;
    const d = configToDraft('script', cfg, ctx).draft;
    expect(d.fields.map((f) => [f.key, f.selector.kind])).toEqual([['percent', 'number'], ['shutters', 'entity'], ['slow', 'boolean'], ['side', 'select']]);
    expect(d.fields[0]).toMatchObject({ name: 'אחוז פתיחה', required: true, default: 50, selector: { kind: 'number', min: 0, max: 100, step: 10, unit: '%' } });
    d.fields[0].selector = { kind: 'number', min: 0, max: 90, step: 10, unit: '%' };
    const out = draftToConfig('script', d, cfg, ctx);
    const f0 = (out.fields as Record<string, Record<string, unknown>>).percent;
    expect(f0.description).toBe('מ־0 עד 100'); // not modelled, carried
    expect(f0.selector).toEqual({ number: { min: 0, max: 90, step: 10, unit_of_measurement: '%', mode: 'slider' } });
    expect((out.fields as Record<string, Record<string, unknown>>).side.selector).toEqual({ select: { options: ['שניהם', 'ימין', 'שמאל'] } });
    const scfg = m.storedConfig('scene', S(m, 'scene.arx_welcome'))!;
    const sd = configToDraft('scene', scfg, ctx).draft;
    expect(sd.members[0]).toMatchObject({ entity_id: 'light.entry', state: 'on', attributes: { brightness: 204, color_temp_kelvin: 3000 } });
    expect(sd.members.map((x) => x.entity_id)).toHaveLength(5);
    expect(configToDraft('scene', { name: 'x', entities: { 'light.a': 'on' } }, ctx).draft.members[0]).toEqual({ entity_id: 'light.a', state: 'on', attributes: {} });
    expect(draftToConfig('scene', configToDraft('scene', { name: 'x', entities: { 'light.a': 'on' } }, ctx).draft, { name: 'x', entities: { 'light.a': 'on' } }, ctx)).toEqual({ name: 'x', entities: { 'light.a': 'on' } });
    expect(parseSelector({ time: {} })).toEqual({ kind: 'locked', raw: { time: {} } });
    expect(parseSelector({ select: { options: [{ value: 'a', label: 'A' }] } })).toMatchObject({ kind: 'locked' });
    expect(selectorOut({ kind: 'text', max: 20 })).toEqual({ text: { maxlength: 20 } });
  });

  test('changing a locked block is detected by fingerprint; the save profile follows the content, not the view', async () => {
    const m = resetAutomationsMock();
    const cfg = m.storedConfig('automation', S(m, 'automation.salon_buttons'))!;
    const stored = autoDraft(cfg);
    const draft = autoDraft(cfg);
    expect(changedLockedBlocks(draft, stored)).toEqual([]);
    expect(saveProfile(draft, stored)).toBe('builder');
    expect(preservedFingerprints(draft)).toHaveLength(2);
    // removing and reordering locked blocks is still the builder
    draft.triggers.pop();
    expect(saveProfile(draft, stored)).toBe('builder');
    // editing a locked block's content (the code view) is a `code` save
    const edited = autoDraft({ ...cfg, triggers: [{ trigger: 'device', domain: 'wall_switch', device_id: '2f1c9a07', type: 'button_2_short', id: 'short' }] });
    expect(changedLockedBlocks(edited, stored)).toHaveLength(1);
    expect(saveProfile(edited, stored)).toBe('code');
    // a brand-new locked block (a template written in the code view) is a `code` save too
    expect(saveProfile(autoDraft({ ...cfg, actions: [...(cfg.actions as unknown[]), { action: 'light.turn_on', target: { entity_id: '{{ x }}' } }] }), stored)).toBe('code');
  });

  test('builder <-> code: the code view text re-parses into blocks; JSON mode round-trips; bad text is reported', async () => {
    const m = resetAutomationsMock();
    const cfg = m.storedConfig('automation', S(m, 'automation.bed_ac_clock'))!;
    const draft = autoDraft(cfg);
    const text = draftToCode('automation', draft, cfg, ctx);
    expect(text).toBe(codeFromConfig(cfg));
    const back = codeToDraft('automation', text, ctx);
    expect(back.ok).toBe(true);
    if (back.ok) expect(stripUids(back.draft)).toEqual(stripUids(draft));
    // a change typed in the code view shows as a block
    const edited = codeToDraft('automation', text.replace('"temperature": 24', '"temperature": 22'), ctx);
    expect(edited.ok && svc(((edited.draft as AutomationDraft).actions[0] as unknown as { options: Array<{ sequence: unknown[] }> }).options[0].sequence[0]).data.temperature).toBe(22);
    expect(parseCode('{ not json').ok).toBe(false);
    expect(parseCode('[1]').ok).toBe(false);
    expect(parseCode('{"alias":"x"}')).toEqual({ ok: true, config: { alias: 'x' } });
  });

  test('walking: dotted paths, lookup by uid and by an issue path (either separator style), the parts of a block', async () => {
    const m = resetAutomationsMock();
    const draft = autoDraft(m.storedConfig('automation', S(m, 'automation.bed_ac_clock'))!);
    const paths = walkDraft(draft).map((w) => w.path);
    expect(paths).toContain('triggers.1');
    expect(paths).toContain('actions.0');
    expect(paths).toContain('actions.0.choose.1.conditions.0');
    expect(paths).toContain('actions.0.choose.1.sequence.0');
    const inner = findBlock(draft, walkDraft(draft).find((w) => w.path === 'actions.0.choose.1.sequence.0')!.block.uid)!;
    expect(inner.sentence).toBe('כבה מזגן חדר שינה');
    expect(blockPathOf(draft, inner.uid)).toBe('actions.0.choose.1.sequence.0');
    expect(blockAtPath(draft, 'actions[0].choose[1].sequence[0]')?.uid).toBe(inner.uid);
    expect(blockAtPath(draft, 'action/0/choose/1/sequence/0/data/x')?.uid).toBe(inner.uid);
    expect(normalisePath('trigger/0')).toBe('triggers.0');
    expect(tracePathToBlockPath('action/0/choose/1/sequence/0')).toBe('actions.0.choose.1.sequence.0');
    expect(blockAtPath(draft, 'alias')).toBeNull();
    expect(draftTargets(draft)).toEqual(['climate.bed']);
    expect(triggerEntities(draft)).toEqual([]);
    expect(emitBlock(draft.triggers[0], 'trigger', ctx)).toEqual({ trigger: 'time', at: '22:00:00', id: 'night' });
  });
});

// ---------------------------------------------------------------------------------------------------------------- sentences

test.describe('automations client: Hebrew sentences', () => {
  test('whole-item sentences of the fixture house (golden)', async () => {
    const m = resetAutomationsMock();
    const sentence = (entity: string) => automationSentence(autoDraft(m.storedConfig('automation', S(m, entity))!), { ...ctx, names: (id) => (automationsNames(m)[id] ?? id) });
    expect(sentence('automation.hall_motion')).toBe('כשחיישן תנועה פרוזדור מזהה תנועה, אם אחרי השקיעה – הדלק תאורת פרוזדור ל־40%; המתן 3 דקות; כבה תאורת פרוזדור');
    expect(sentence('automation.entry_sunset')).toBe('20 דק׳ לפני השקיעה או כשהמערכת עולה – הדלק תאורת כניסה ותאורת גינה ל־70%');
    expect(sentence('automation.all_left')).toBe('כשכולם יוצאים מהבית – כבה תאורת סלון, תאורת מטבח ותאורת חדר ילדים; כבה מזגן סלון ומזגן חדר שינה; דרוך את אזעקה (מלא)');
    expect(sentence('automation.door_open')).toBe('כשדלת הכניסה נפתח/ת במשך 5 דקות – שלח להטלפון של יוני "דלת הכניסה פתוחה כבר 5 דקות"');
    expect(sentence('automation.bed_ac_clock')).toBe('בשעה 22:00 או בשעה 06:30 – אם הטריגר הוא "night" – כוון טמפרטורה של מזגן חדר שינה ל־24°; אם הטריגר הוא "morning" – כבה מזגן חדר שינה');
    expect(sentence('automation.salon_buttons')).toBe('כפתור · מכשיר או כפתור · מכשיר – אם הטריגר הוא "short" – הפעל סצנה "סלון · ערב"; אם הטריגר הוא "long" – הפעל סצנה "סלון · הכל כבוי"');
    expect(sentence('automation.light_by_lux')).toBe('תבנית, אם בין 17:00 ל־23:30 – פעולה מתקדמת');
    expect(sentence('automation.vacation_freeze')).toBe('כשיוני ודנה יוצא/ת מהבית במשך 24 שעות – שלח להטלפון של יוני "התזמונים הוקפאו" ופעולה מתקדמת');
    expect(sentence('automation.alarm_morning')).toBe('בשעה 06:45, אם יוני בבית – נטרל את אזעקה; אם טמפרטורה חדר שינה מעל 26 – פתח תריס סלון, אחרת – הדלק תאורת מטבח');
  });

  test('pieces: names, durations, triggers, conditions, actions, patterns, presence, locked labels', () => {
    expect(joinNames([], ctx)).toBe('…');
    expect(joinNames(['light.hall'], ctx)).toBe('תאורת פרוזדור');
    expect(joinNames(['light.hall', 'light.entry'], ctx)).toBe('תאורת פרוזדור ותאורת כניסה');
    expect(joinNames(['light.hall', 'light.entry', 'light.garden'], ctx)).toBe('תאורת פרוזדור, תאורת כניסה ותאורת גינה');
    expect(durationText({ hours: 1, minutes: 30 })).toBe('שעה ו30 דקות');
    expect(durationText({ minutes: 2, seconds: 1 })).toBe('שתי דקות ושנייה');
    expect(durationText({ hours: 3 })).toBe('3 שעות');
    expect(durationText(null)).toBe('');
    const t = (raw: unknown) => triggerSentence(parseTrigger(raw, ctx), ctx);
    expect(t({ trigger: 'time_pattern', minutes: '/15' })).toBe('כל 15 דקות');
    expect(t({ trigger: 'time_pattern', hours: '/1' })).toBe('כל שעה');
    expect(t({ trigger: 'time_pattern', minutes: '30' })).toBe('בדקה 30 של כל שעה');
    expect(t({ trigger: 'sun', event: 'sunrise', offset: '00:10:00' })).toBe('10 דק׳ אחרי הזריחה');
    expect(t({ trigger: 'sun', event: 'sunset' })).toBe('בשקיעה');
    expect(t({ trigger: 'numeric_state', entity_id: 'sensor.bed_temp', above: 26, for: { minutes: 10 } })).toBe('כשטמפרטורה חדר שינה מעל 26 במשך 10 דקות');
    expect(t({ trigger: 'state', entity_id: 'person.yoni', from: 'not_home', to: 'home' })).toBe('כשיוני חוזר/ת הביתה');
    expect(t({ trigger: 'state', entity_id: 'light.hall' })).toBe('כשתאורת פרוזדור משתנה');
    const c = (raw: unknown) => conditionSentence(parseCondition(raw, ctx), ctx);
    expect(c({ condition: 'time', weekday: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] })).toBe('בכל יום');
    expect(c({ condition: 'time', weekday: ['sun', 'thu'] })).toBe('בימים א׳, ה׳');
    expect(c({ condition: 'sun', after: 'sunrise', before: 'sunset' })).toBe('בין הזריחה לשקיעה');
    expect(c({ condition: 'not', conditions: [{ condition: 'state', entity_id: 'person.yoni', state: 'home' }] })).toBe('לא (יוני בבית)');
    expect(c({ condition: 'or', conditions: [{ condition: 'sun', after: 'sunset' }, { condition: 'time', before: '06:00:00' }] })).toBe('אחרי השקיעה או לפני 06:00');
    expect(c({ condition: 'state', entity_id: [SHABBAT_SENSOR], state: 'off' })).toBe('לא בשבת וחג');
    const a = (raw: unknown, short = true) => (parseAction(raw, ctx) as ActionBlock).sentence || String(short);
    expect(a({ action: 'climate.set_temperature', target: { entity_id: 'climate.bed' }, data: { temperature: 23.5 } })).toBe('כוון טמפרטורה של מזגן חדר שינה ל־23.5°');
    expect(a({ action: 'alarm_control_panel.alarm_arm_home', target: { entity_id: 'alarm_control_panel.home' } })).toBe('דרוך את אזעקה (בית)');
    expect(a({ action: 'lock.unlock', target: { entity_id: 'lock.front' } })).toBe('פתח את lock.front');
    expect(a({ repeat: { count: 3, sequence: [{ action: 'light.turn_on', target: { entity_id: 'light.hall' } }] } })).toBe('חזור 3 פעמים: הדלק תאורת פרוזדור');
    expect(a({ stop: 'סוף' })).toBe('עצור: סוף');
    expect(a({ delay: { seconds: 10 } })).toBe('המתן 10 שניות');
    expect(a({ condition: 'sun', after: 'sunset' })).toBe('המשך רק אם אחרי השקיעה');
    expect(a({ action: 'scheduler.run_action' })).toBe('שירות מיוחד · scheduler');
  });

  test('draft sentences: refresh recomputes every block; block_sentences are by uid; scripts and scenes have their own', async () => {
    const m = resetAutomationsMock();
    const draft = autoDraft(m.storedConfig('automation', S(m, 'automation.hall_motion'))!);
    for (const w of walkDraft(draft)) w.block.sentence = 'x';
    refreshSentences(draft, ctx);
    expect(draft.triggers[0].sentence).toBe('כשחיישן תנועה פרוזדור מזהה תנועה');
    const bs = blockSentences(draft, ctx);
    expect(Object.keys(bs)).toHaveLength(walkDraft(draft).length);
    expect(bs[draft.actions[1].uid]).toBe('המתן 3 דקות');
    const script = configToDraft('script', m.storedConfig('script', S(m, 'script.good_morning'))!, ctx).draft;
    expect(draftSentence('script', script, ctx)).toBe('פתח cover.salon_shutter; הדלק תאורת מטבח; כוון טמפרטורה של מזגן סלון ל־23°');
    expect(draftSentence('scene', { name: 'x', icon: null, members: [] }, ctx)).toBe('סצנה ריקה');
    expect(draftSentence('automation', { alias: '', description: '', mode: 'single', max: null, triggers: [], conditions: [], actions: [] }, ctx)).toBe('כש… – …');
  });
});

function automationsNames(_m: AutomationsMockStore): Record<string, string> {
  return {
    ...NAMES, 'cover.salon_shutter': 'תריס סלון', 'switch.boiler': 'דוד שמש', 'light.kids': 'תאורת חדר ילדים', 'climate.bed': 'מזגן חדר שינה', 'scene.salon_off': 'סלון · הכל כבוי',
  };
}

// ---------------------------------------------------------------------------------------------------------------- validation

test.describe('automations client: validation (§2.2 caps)', () => {
  const base = (): AutomationDraft => autoDraft({ alias: 'בדיקה', description: '', triggers: [{ trigger: 'time', at: '20:00:00' }], conditions: [], actions: [{ action: 'light.turn_on', target: { entity_id: ['light.hall'] } }], mode: 'single' });
  const codes = (d: AutomationDraft | ScriptDraft, kind: 'automation' | 'script' = 'automation', o = {}) => validateDraft(kind, d, { shabbatSensor: SHABBAT_SENSOR, ...o }).map((i) => i.code);

  test('a valid draft has no issues; the basics are required', () => {
    expect(validateDraft('automation', base(), {})).toEqual([]);
    const d = base();
    d.alias = '  ';
    d.triggers = [];
    d.actions = [];
    expect(codes(d)).toEqual(['alias_required', 'trigger_required', 'action_required']);
    d.alias = 'א'.repeat(121);
    d.description = 'ב'.repeat(1001);
    expect(codes(d)).toEqual(['alias_too_long', 'description_too_long', 'trigger_required', 'action_required']);
  });

  test('per-block rules: entities, values, time, trigger ids, notify message and target, delay, repeat, options', () => {
    const d = base();
    d.triggers = [parseTrigger({ trigger: 'state', entity_id: [], to: 'on', id: 'a' }, ctx), parseTrigger({ trigger: 'numeric_state', entity_id: ['sensor.bed_temp'] }, ctx), parseTrigger({ trigger: 'time', at: '20:00', id: 'a' }, ctx)];
    d.conditions = [parseCondition({ condition: 'trigger', id: ['zzz'] }, ctx), parseCondition({ condition: 'state', entity_id: [SHABBAT_SENSOR], state: 'on' }, ctx), parseCondition({ condition: 'and', conditions: [] }, ctx)];
    d.actions = [
      parseAction({ action: 'light.turn_on', target: { entity_id: [] } }, ctx), parseAction({ action: 'notify.mobile_app_yoni', data: {} }, ctx), parseAction({ delay: { hours: 0, minutes: 0, seconds: 0 } }, ctx),
      parseAction({ repeat: { count: 3, sequence: [] } }, ctx), parseAction({ choose: [] }, ctx), parseAction({ if: [], then: [] }, ctx),
    ];
    (d.actions[3] as ActionBlock & { type: 'repeat_count' }).count = 0;
    const is = validateDraft('automation', d, { shabbatSensor: null, notifyTargets: ['notify.other'] });
    const got = is.map((i) => `${i.path}:${i.code}`);
    expect(got).toEqual(expect.arrayContaining([
      'triggers.0:entity_required', 'triggers.1:value_required', 'conditions.0:trigger_id_unknown', 'conditions.1:shabbat_sensor_missing', 'conditions.2:conditions_required',
      'actions.0:entity_required', 'actions.1:message_required', 'actions.1:notify_target_not_allowed', 'actions.2:duration_required', 'actions.3:count_invalid', 'actions.4:option_required',
      'actions.5:conditions_required', 'actions.5:action_required', 'triggers.2:duplicate_trigger_id',
    ]));
    const byUid = issuesByUid(d, is);
    expect(byUid[d.triggers[0].uid].map((i) => i.code)).toEqual(['entity_required']);
    expect(byUid[''] ?? []).toEqual([]);
    expect(issuesByUid(d, [{ path: 'alias', code: 'alias_required', message: 'x' }])['']).toHaveLength(1);
  });

  test('codes are never stored: a code in the data of a typed step is `code_not_allowed`, any other secret is `secret_not_allowed`', () => {
    const d = base();
    svc(d.actions[0]).data = { code: '1234' };
    expect(codes(d)).toEqual(['code_not_allowed']);
    svc(d.actions[0]).data = { api_key: 'x' };
    expect(codes(d)).toEqual(['secret_not_allowed']);
    svc(d.actions[0]).action = 'homeassistant.turn_off';
    svc(d.actions[0]).data = {};
    expect(codes(d)).toEqual(['action_not_allowed']);
  });

  test('caps: triggers, conditions, steps in total, nesting depth, target entities, script fields, scene members', () => {
    const d = base();
    d.triggers = Array.from({ length: 21 }, () => parseTrigger({ trigger: 'homeassistant', event: 'start' }, ctx));
    d.conditions = Array.from({ length: 21 }, () => parseCondition({ condition: 'sun', after: 'sunset' }, ctx));
    expect(codes(d)).toEqual(['too_many_triggers', 'too_many_conditions']);
    const e = base();
    e.actions = Array.from({ length: 61 }, () => parseAction({ delay: { seconds: 1 } }, ctx));
    expect(codes(e)).toEqual(['too_many_steps']);
    let nested: unknown = { delay: { seconds: 1 } };
    for (let i = 0; i < 5; i++) nested = { if: [{ condition: 'sun', after: 'sunset' }], then: [nested] };
    const f = base();
    f.actions = [parseAction(nested, ctx)];
    expect(validateDraft('automation', f, {}).map((i) => i.code)).toEqual(['too_deep']);
    expect(validateDraft('automation', f, {})[0].path).toBe('actions.0.then.0.then.0.then.0.then.0.then.0');
    const g = base();
    g.actions = [parseAction({ action: 'light.turn_on', target: { entity_id: Array.from({ length: 51 }, (_x, i) => `light.l${i}`) } }, ctx)];
    expect(codes(g)).toEqual(['too_many_targets']);
    const s = configToDraft('script', { alias: 'ס', sequence: [{ delay: { seconds: 1 } }], fields: Object.fromEntries(Array.from({ length: 13 }, (_x, i) => [`f${i}`, { name: `n${i}`, selector: { boolean: {} } }])) }, ctx).draft;
    expect(codes(s, 'script')).toEqual(['too_many_fields']);
    s.fields = [{ key: 'Bad Key', name: '', required: false, default: undefined, selector: { kind: 'number', min: 5, max: 1 } }, { key: 'x', name: 'x', required: false, default: undefined, selector: { kind: 'select', options: [] } }, { key: 'x', name: 'y', required: false, default: undefined, selector: { kind: 'boolean' } }];
    expect(codes(s, 'script')).toEqual(['field_key_invalid', 'alias_required', 'range_invalid', 'options_required', 'duplicate_field_key']);
    const sc = { name: 'סצנה', icon: null, members: Array.from({ length: 101 }, (_x, i) => ({ entity_id: `light.l${i}`, state: 'on', attributes: {} })) };
    expect(validateDraft('scene', sc, {}).map((i) => i.code)).toEqual(['too_many_members']);
    expect(validateDraft('scene', { name: '', icon: null, members: [{ entity_id: 'alarm_control_panel.home', state: 'disarmed', attributes: {} }, { entity_id: 'sensor.x', state: '', attributes: { code: 1 } }] }, {}).map((i) => i.code))
      .toEqual(['alias_required', 'domain_not_allowed', 'domain_not_allowed', 'state_required', 'code_not_allowed']);
    expect(CAPS).toMatchObject({ alias_max: 120, steps_max: 60, depth_max: 4, targets_max: 50, fields_max: 12, members_max: 100 });
  });

  test('facts: unknown effects, sensitive steps with their grants, schedule-controlling blocks', async () => {
    const m = resetAutomationsMock();
    const lux = autoDraft(m.storedConfig('automation', S(m, 'automation.light_by_lux'))!);
    expect(hasUnknownEffects(lux)).toBe(true);
    expect(hasUnknownEffects(base())).toBe(false);
    const away = autoDraft(m.storedConfig('automation', S(m, 'automation.all_left'))!);
    expect(sensitiveSteps(away, (id) => (id.startsWith('alarm') ? 'alarm' : null), () => false)).toEqual([
      { path: 'actions.2', entity_id: 'alarm_control_panel.home', action: 'alarm_control_panel.alarm_arm_away', grant: 'alarm.disarm', granted: false },
    ]);
    const vac = autoDraft(m.storedConfig('automation', S(m, 'automation.vacation_freeze'))!);
    expect(vac.actions.map(controlsSchedules)).toEqual([true, false]);
  });
});

// ---------------------------------------------------------------------------------------------------------------- permissions, lists, scope

test.describe('automations client: permissions, delegation, lists, scope', () => {
  const status = async (u: 'installer' | 'household' | 'runner', o: { delegation?: boolean } = {}) => {
    const m = resetAutomationsMock({ user: u, delegation: o.delegation });
    return { m, s: await m.status() };
  };

  test('tabs, kinds, save blockers, delegation state and the code-view toggle per user', async () => {
    const inst = await status('installer');
    expect(automationsTabVisible(inst.s)).toBe(true);
    expect(visibleKinds(inst.s)).toEqual(['automation', 'script', 'scene']);
    expect(saveBlocker('automation', inst.s)).toBeNull();
    expect(delegationState(inst.s)).toMatchObject({ state: 'not_needed' });
    expect(codeViewMode(inst.s)).toBe('editable');
    const hh = await status('household');
    expect(saveBlocker('automation', hh.s)).toBeNull();
    expect(delegationState(hh.s)).toEqual({ state: 'on', changed_at: null });
    expect(codeViewMode(hh.s)).toBe('hidden'); // hidden completely, no read-only peek
    const off = await status('household', { delegation: false });
    expect(saveBlocker('automation', off.s)).toEqual({ code: 'delegation_off', text: 'שמירה דורשת מנהל' });
    expect(delegationState(off.s).state).toBe('off');
    // owner decision 1b: no view-only access - a script runner who controls devices sees scripts and scenes, never automations
    const rn = await status('runner');
    expect(visibleKinds(rn.s)).toEqual(['script', 'scene']);
    expect(automationsTabVisible(rn.s)).toBe(true);
    expect(saveBlocker('automation', rn.s)).toEqual({ code: 'no_permission', text: 'אין הרשאת עריכה' });
    expect(manageRight('scene', rn.s)).toBe(false);
    expect(automationsTabVisible({ ...rn.s, can: { ...rn.s.can, script_run: false, scene_run: false } })).toBe(false);
    expect(visibleKinds({ ...rn.s, can: { ...rn.s.can, scene_run: false } })).toEqual(['script']);
    expect(visibleKinds({ ...inst.s, can: { ...inst.s.can, manage: false } })).toEqual(['script', 'scene']);
    expect(automationsTabVisible({ ...inst.s, available: 'feature_disabled' })).toBe(false);
    expect(saveBlocker('script', { ...inst.s, available: 'ha_unavailable' } as AutomationsStatus)?.code).toBe('ha_unavailable');
    expect(saveBlocker('script', { ...inst.s, write_block: 'bridge_too_old' })?.text).toBe('נדרש עדכון של רכיב החיבור כדי לשמור אוטומציות');
    expect(previewSaveBlocker({ valid: true, requires: { confirm: false, code_view: false, ha_admin: true } }, hh.s)?.code).toBe('not_ha_admin');
    expect(previewSaveBlocker({ valid: true, requires: { confirm: false, code_view: true, ha_admin: true } }, hh.s)?.code).toBe('code_view_required');
    expect(previewSaveBlocker({ valid: true, requires: { confirm: false, code_view: false, ha_admin: true } }, inst.s)).toBeNull();
    expect(previewSaveBlocker({ valid: false, requires: { confirm: false, code_view: false, ha_admin: false } }, inst.s)?.code).toBe('invalid');
  });

  test('item chips, read-only chips, run confirmation and the last-run text', async () => {
    const m = resetAutomationsMock();
    const items = (await m.list()).items;
    const by = (e: string) => items.find((i) => i.entity_id === e)!;
    expect(itemChips(by('automation.alarm_morning')).map((c) => c.id)).toEqual(['off', 'sensitive', 'changed_outside']);
    expect(itemChips(by('automation.alarm_morning'), { sensitiveWarning: false }).map((c) => c.id)).toEqual(['off', 'changed_outside']);
    expect(itemChips(by('automation.boiler_morning')).map((c) => c.id)).toEqual(['missing', 'locked']);
    expect(itemChips(by('automation.irrigation_shabbat')).map((c) => c.label)).toEqual(['צפייה בלבד']);
    expect(itemChips(by('scene.salon_evening')).map((c) => c.label)).toEqual(['הפעלה בלבד']);
    expect(itemChips(by('script.good_morning'))).toEqual([]); // an idle script is not "כבויה"
    expect(readOnlyChip(by('automation.irrigation_shabbat'))).toEqual({ code: 'yaml_managed', text: 'מוגדרת בקובץ תצורה – לצפייה בלבד' });
    expect(readOnlyChip(by('automation.hall_motion'))).toBeNull();
    expect(readOnlyChip({ read_only: { reasons: [{ code: 'grant_required', message: 'אין לך הרשאה לנטרול ב־אזעקה', entity_id: 'x' }] } })?.text).toBe('אין לך הרשאה לנטרול ב־אזעקה');
    expect(runNeedsConfirm(by('automation.all_left'))).toBe(true);
    expect(runNeedsConfirm(by('automation.light_by_lux'))).toBe(true);
    expect(runNeedsConfirm(by('automation.hall_motion'))).toBe(false);
    const now = new Date('2026-10-01T15:46:00Z');
    expect(lastRunText({ at: '2026-10-01T15:34:00Z', result: 'ok' }, now)).toBe('לפני 12 דק׳');
    expect(lastRunText({ at: '2026-10-01T14:40:00Z', result: 'ok' }, now)).toBe('לפני שעה');
    expect(lastRunText({ at: '2026-10-01T10:40:00Z', result: 'ok' }, now)).toBe('לפני 5 שע׳');
    expect(lastRunText({ at: '2026-09-30T10:40:00Z', result: 'ok' }, now)).toBe('אתמול');
    expect(lastRunText({ at: '2026-09-28T10:40:00Z', result: 'ok' }, now)).toBe('לפני 3 ימים');
    expect(lastRunText({ at: '2026-10-01T15:46:00Z', result: 'running' }, now)).toBe('רץ עכשיו');
    expect(lastRunText(null, now)).toBe('');
  });

  test('filters and sorts: text over name / description / sentence / target names, floor, area, state, sensitive, source, kind', async () => {
    const m = resetAutomationsMock();
    const items = (await m.list()).items;
    const names = (l: Item[]) => l.map((i) => i.entity_id);
    expect(names(filterItems(items, { q: 'פרוזדור', kind: 'automation' }))).toEqual(['automation.hall_motion']);
    expect(names(filterItems(items, { q: 'בתשתית' }))).toEqual([]);
    expect(names(filterItems(items, { q: 'מזגן חדר שינה', kind: 'automation' })).sort()).toEqual(['automation.all_left', 'automation.bed_ac_clock']);
    expect(names(filterItems(items, { kind: 'automation', sensitive: true })).sort()).toEqual(['automation.alarm_morning', 'automation.all_left', 'automation.leak_alert']);
    expect(names(filterItems(items, { kind: 'automation', state: 'off' })).sort()).toEqual(['automation.alarm_morning', 'automation.vacation_freeze']);
    expect(names(filterItems(items, { kind: 'automation', source: 'yaml' }))).toEqual(['automation.irrigation_shabbat']);
    expect(names(filterItems(items, { kind: 'automation', floor: 'f1' })).sort()).toEqual(['automation.all_left', 'automation.bed_ac_clock', 'automation.hall_motion']);
    expect(names(filterItems(items, { kind: 'automation', area: 'laundry' })).sort()).toEqual(['automation.boiler_morning', 'automation.leak_alert']);
    expect(countByKind(items)).toEqual({ automation: 12, script: 3, scene: 6 });
    // sorts
    const autos = items.filter((i) => i.kind === 'automation');
    expect(sortItems(autos, 'last_run')[0].entity_id).toBe('automation.hall_motion');
    expect(sortItems(autos, 'last_run').slice(-2).map((i) => i.last_run)).toEqual([null, null]); // never-run items last
    expect(sortItems(autos, 'name').map((i) => i.name)).toEqual([...autos.map((i) => i.name)].sort((a, b) => a.localeCompare(b, 'he')));
    expect(sortItems(autos, 'updated')[0].entity_id).toBe('automation.hall_motion');
    expect(filterItems(items, { limit: 3 })).toHaveLength(3);
    expect(filterItems(items, { mine: true }, { me: 'דנה' }).map((i) => i.entity_id)).toEqual(['automation.door_open']);
  });

  test('scope: entities by floor / area, unplaced ones may be watched but not controlled; groups; item visibility', async () => {
    const m = resetAutomationsMock({ user: 'household' });
    const cat = await m.catalog();
    const scope = { floors: ['f1'], areas: null };
    const inScope = (id: string, p: 'target' | 'watch') => entityInScope(cat.entities.find((e) => e.entity_id === id)!, scope, p);
    expect(inScope('light.hall', 'target')).toBe(true);
    expect(inScope('person.yoni', 'watch')).toBe(true);
    expect(inScope('person.yoni', 'target')).toBe(false);
    expect(entityInScope({ floor: { id: 'g' }, area: { id: 'salon' } }, scope, 'target')).toBe(false);
    expect(entityInScope({ floor: { id: 'g' }, area: { id: 'salon' } }, { floors: null, areas: ['salon'] }, 'target')).toBe(true);
    expect(entityInScope({ floor: null, area: null }, INSTALLATION_WIDE, 'target')).toBe(true);
    // the picker: scoped, searchable, by domain / action / control
    expect(cat.entities.every((e) => !e.floor || e.floor.id === 'f1')).toBe(true);
    expect(pickerEntities(cat.entities, scope, { controllable: true, domains: ['light'] }).map((e) => e.entity_id)).toEqual(['light.hall', 'light.bed', 'light.kids'].sort((a, b) => (cat.entities.find((e) => e.entity_id === a)!.name).localeCompare(cat.entities.find((e) => e.entity_id === b)!.name, 'he')));
    expect(pickerEntities(cat.entities, scope, { purpose: 'watch', onlyTriggerable: true, q: 'תנועה' }).map((e) => e.entity_id)).toEqual(['binary_sensor.hall_motion']);
    expect(pickerEntities(cat.entities, scope, { actionId: 'light.turn_on' }).every((e) => e.domain === 'light')).toBe(true);
    expect(pickerEntities(cat.entities, scope, { controllable: true }).some((e) => e.entity_id === 'person.yoni')).toBe(false);
    const groups = groupPicker(pickerEntities(cat.entities, scope, { purpose: 'watch' }));
    expect(groups.map((g) => g.floor?.name ?? null)).toEqual(['קומה 1', null]);
    expect(groups[0].areas.map((a) => a.area?.name)).toEqual([...groups[0].areas.map((a) => a.area?.name)].sort((a, b) => (a ?? '').localeCompare(b ?? '', 'he')));
    expect(groups[1].areas[0].area).toBeNull();
    // visibility (CR §7)
    const place = (id: string) => { const e = cat.entities.find((x) => x.entity_id === id); return e ? { floor: e.floor, area: e.area } : null; };
    const hall = autoDraft(m.storedConfig('automation', S(m, 'automation.hall_motion'))!);
    expect(itemVisibleTo(hall, scope, place)).toBe(true);
    const away = autoDraft(m.storedConfig('automation', S(m, 'automation.all_left'))!);
    expect(itemVisibleTo(away, scope, () => ({ floor: { id: 'g' }, area: { id: 'salon' } }))).toBe(false);
    expect(itemVisibleTo(away, INSTALLATION_WIDE, () => null)).toBe(true);
    const onlyNotify = autoDraft({ alias: 'x', triggers: [{ trigger: 'state', entity_id: ['person.yoni'] }], actions: [{ action: 'notify.notify', data: { message: 'x' } }] });
    expect(itemVisibleTo(onlyNotify, scope, () => null)).toBe(false);
    expect(itemVisibleTo(autoDraft({ alias: 'x', triggers: [], actions: [{ action: 'scheduler.run_action' }] }), scope, () => null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------- traces

test.describe('automations client: traces ("למה זה רץ")', () => {
  const sample = (over: Partial<RunTrace> = {}): RunTrace => ({
    run_id: 'r1', at: '2026-10-01T15:42:10.214Z', finished_at: '2026-10-01T15:45:14.726Z', duration_ms: 184512, result: 'ok', sentence: '',
    trigger: { sentence: 'חיישן תנועה פרוזדור עבר מ"אין תנועה" ל"תנועה"', path: 'triggers.0', description: null },
    conditions: [{ path: 'conditions.0', sentence: 'אחרי השקיעה (17:58)', passed: true }],
    steps: [
      { path: 'actions.0', depth: 0, sentence: 'הדלק תאורת פרוזדור ל־40%', result: 'done', started_at: '2026-10-01T15:42:10.219Z', duration_ms: 41, error: null, changed_variables: { 'light.hall': 'off → on', access_token: 'secret!' } },
      { path: 'actions.1', depth: 0, sentence: 'המתן 3 דקות', result: 'done', started_at: '2026-10-01T15:42:10.262Z', duration_ms: 180004, error: null, changed_variables: null },
      { path: 'actions.2', depth: 0, sentence: 'כבה', result: 'error', started_at: null, duration_ms: 12, error: 'לא זמין', changed_variables: null },
      { path: 'actions.3', depth: 1, sentence: 'עוד', result: 'not_run', started_at: null, duration_ms: null, error: null, changed_variables: null },
    ],
    variables: { 'trigger.id': 'motion', api_key: 'k', nested: { code: '1' } }, context: { user: null, parent: 'automation' }, ...over,
  });

  test('durations, who ran it, variables are masked, the view model orders sections with status and counts', () => {
    expect(formatDuration(41)).toBe('41 מ״ש');
    expect(formatDuration(1500)).toBe('1.5 שנ׳');
    expect(formatDuration(45000)).toBe('45 שנ׳');
    expect(formatDuration(180004)).toBe('3 דק׳');
    expect(formatDuration(184512)).toBe('3 דק׳ 5 שנ׳');
    expect(formatDuration(3_900_000)).toBe('1 שע׳ 5 דק׳');
    expect(formatDuration(null)).toBe('');
    expect(traceWho({ user: 'יוני', parent: 'user' })).toBe('יוני (ידנית)');
    expect(traceWho({ user: null, parent: 'automation' })).toBe('אוטומציה');
    expect(traceWho({ user: null, parent: null })).toBe('הטריגר');
    expect(variableLines({ a: 1, token: 't', o: { x: 1 } })).toEqual([['a', '1'], ['token', '••••'], ['o', '{"x":1}']]);
    const v = traceView(sample(), { timeZone: 'UTC' });
    expect(v.result).toEqual({ id: 'ok', label: 'הושלמה' });
    expect(v.duration).toBe('3 דק׳ 5 שנ׳');
    expect(v.who).toBe('אוטומציה');
    expect(v.at).toBe('15:42:10');
    expect(v.counts).toEqual({ conditions_passed: 1, conditions: 1, steps_done: 2, steps: 4 });
    expect(v.conditions[0]).toMatchObject({ status: 'ok', tag: 'עבר' });
    expect(v.steps.map((s) => [s.status, s.tag, s.depth])).toEqual([['ok', 'בוצע', 0], ['ok', 'בוצע', 0], ['bad', 'נכשל', 0], ['skip', 'לא רץ', 1]]);
    expect(v.steps[0].vars).toEqual([['light.hall', 'off → on'], ['access_token', '••••']]);
    expect(v.steps[0].time).toBe('15:42:10');
    expect(v.steps[2].error).toBe('לא זמין');
    expect(v.variables).toEqual([['trigger.id', 'motion'], ['api_key', '••••'], ['nested', '{"code":"••••"}']]);
    expect(JSON.stringify(v)).not.toContain('secret!');
    expect(v.sentence).toBe(shortRunSentence(sample(), { timeZone: 'UTC' })); // no server sentence: composed
    expect(traceView(sample({ sentence: 'משפט השרת' })).sentence).toBe('משפט השרת');
  });

  test('the short sentence: a normal run, a failed condition, a manual run, an error, a skipped condition', () => {
    const tz = { timeZone: 'UTC' };
    expect(shortRunSentence(sample({ steps: sample().steps.slice(0, 2) }), tz)).toBe('רצה ב־15:42 כי חיישן תנועה פרוזדור עבר מ"אין תנועה" ל"תנועה"; התנאי "אחרי השקיעה (17:58)" עבר; הדלק תאורת פרוזדור ל־40%, המתן 3 דקות.');
    expect(shortRunSentence(sample({ conditions: [{ path: 'conditions.0', sentence: 'אחרי השקיעה (17:58)', passed: false }], steps: [], result: 'not_triggered' }), tz))
      .toBe('הופעלה ב־15:42 כי חיישן תנועה פרוזדור עבר מ"אין תנועה" ל"תנועה", אבל התנאי "אחרי השקיעה (17:58)" נכשל ולכן לא בוצעה פעולה.');
    expect(shortRunSentence(sample({ context: { user: 'יוני', parent: 'user' }, conditions: [], steps: sample().steps.slice(0, 1) }), tz)).toBe('הורצה ידנית ב־15:42 על ידי יוני; הדלק תאורת פרוזדור ל־40%.');
    expect(shortRunSentence(sample({ result: 'error' }), tz)).toContain('כבה נכשל (לא זמין) והריצה נעצרה');
    expect(shortRunSentence(sample({ steps: [], conditions: [{ path: 'conditions.0', sentence: 'x', passed: null }] }), tz)).toBe('רצה ב־15:42 כי חיישן תנועה פרוזדור עבר מ"אין תנועה" ל"תנועה".');
  });
});

// ---------------------------------------------------------------------------------------------------------------- scenes and the schedule suggestion

test.describe('automations client: scene capture and the schedule suggestion', () => {
  test('capture keeps the per-domain attributes only (light by colour mode), skips alarm panels and unavailable devices', () => {
    expect(captureMember({ entity_id: 'light.a', state: 'on', attributes: { brightness: 128, color_mode: 'color_temp', color_temp_kelvin: 2700, hs_color: [1, 2], friendly_name: 'x' } }))
      .toEqual({ entity_id: 'light.a', state: 'on', attributes: { brightness: 128, color_temp_kelvin: 2700 } });
    expect(captureMember({ entity_id: 'light.a', state: 'on', attributes: { brightness: 10, color_mode: 'hs', hs_color: [30, 50], color_temp_kelvin: 3000 } })?.attributes).toEqual({ brightness: 10, hs_color: [30, 50] });
    expect(captureMember({ entity_id: 'light.a', state: 'on', attributes: { brightness: 10, color_mode: 'rgb', rgb_color: [1, 2, 3] } })?.attributes).toEqual({ brightness: 10, rgb_color: [1, 2, 3] });
    expect(captureMember({ entity_id: 'light.a', state: 'off', attributes: { brightness: 10 } })?.attributes).toEqual({});
    expect(captureMember({ entity_id: 'cover.a', state: 'open', attributes: { current_position: 70, current_tilt_position: 20, x: 1 } })?.attributes).toEqual({ current_position: 70, current_tilt_position: 20 });
    expect(captureMember({ entity_id: 'climate.a', state: 'cool', attributes: { temperature: 23, fan_mode: 'auto', current_temperature: 25 } })?.attributes).toEqual({ temperature: 23, fan_mode: 'auto' });
    expect(captureMember({ entity_id: 'media_player.a', state: 'on', attributes: { volume_level: 0.3, source: 'HDMI', media_title: 'x' } })?.attributes).toEqual({ volume_level: 0.3, source: 'HDMI' });
    expect(captureMember({ entity_id: 'media_player.a', state: 'off', attributes: { volume_level: 0.3 } })?.attributes).toEqual({});
    expect(captureMember({ entity_id: 'fan.a', state: 'on', attributes: { percentage: 50 } })?.attributes).toEqual({ percentage: 50 });
    expect(captureMember({ entity_id: 'lock.a', state: 'locked', attributes: { code_format: '^\\d{4}$' } })?.attributes).toEqual({});
    expect(captureMember({ entity_id: 'sensor.a', state: '4' })).toBeNull();
    const r = captureMembers([{ entity_id: 'alarm_control_panel.a', state: 'disarmed' }, { entity_id: 'light.a', state: 'unavailable' }, { entity_id: 'sensor.a', state: '1' }, { entity_id: 'lock.a', state: 'locked' }]);
    expect(r.members.map((x) => x.entity_id)).toEqual(['lock.a']);
    expect(r.skipped).toEqual([{ entity_id: 'alarm_control_panel.a', reason: 'alarm_not_capturable' }, { entity_id: 'light.a', reason: 'unavailable' }, { entity_id: 'sensor.a', reason: 'domain_not_supported' }]);
  });

  test('member summaries and the capture diff (added / removed / changed / same, with the changed fields)', () => {
    const light = (b: number, k = 3000): SceneMember => ({ entity_id: 'light.entry', state: 'on', attributes: { brightness: b, color_temp_kelvin: k } });
    expect(memberSummary(light(204))).toBe('דלוק · בהירות 80% · 3000K');
    expect(memberSummary({ entity_id: 'climate.a', state: 'cool', attributes: { temperature: 23 } })).toBe('קירור · 23°');
    expect(memberSummary({ entity_id: 'cover.a', state: 'open', attributes: { current_position: 100 } })).toBe('פתוח · 100%');
    expect(memberSummary({ entity_id: 'lock.a', state: 'locked', attributes: {} })).toBe('נעול');
    const from: SceneMember[] = [light(204), { entity_id: 'light.old', state: 'off', attributes: {} }, { entity_id: 'lock.front', state: 'locked', attributes: {} }];
    const to: SceneMember[] = [light(128, 3000), { entity_id: 'lock.front', state: 'locked', attributes: {} }, { entity_id: 'cover.new', state: 'open', attributes: { current_position: 50 } }];
    const d = sceneCaptureDiff(from, to);
    expect(d.map((x) => [x.entity_id, x.change])).toEqual([['light.entry', 'changed'], ['lock.front', 'same'], ['cover.new', 'added'], ['light.old', 'removed']]);
    expect(d[0].fields).toEqual([{ key: 'brightness', from: 204, to: 128 }]);
    expect(d[0]).toMatchObject({ from: 'דלוק · בהירות 80% · 3000K', to: 'דלוק · בהירות 50% · 3000K' });
    expect(d[2]).toMatchObject({ from: null, to: 'פתוח · 50%' });
    expect(d[3]).toMatchObject({ from: 'כבוי', to: null });
  });

  test('the schedule suggestion: only time/sun triggers with plain device control; weekdays, Shabbat, several slots; anything else is no suggestion', () => {
    const opts = { schedulerPresent: true, shabbatSensor: SHABBAT_SENSOR };
    const draft = (extra: Record<string, unknown> = {}) => autoDraft({ alias: 'מזגן בלילה', triggers: [{ trigger: 'time', at: '22:00:00' }, { trigger: 'sun', event: 'sunset', offset: '-00:20:00' }],
      conditions: [{ condition: 'time', weekday: ['sun', 'mon', 'tue'] }, { condition: 'state', entity_id: [SHABBAT_SENSOR], state: 'off' }],
      actions: [{ action: 'climate.set_temperature', target: { entity_id: ['climate.bed'] }, data: { temperature: 24 } }, { action: 'light.turn_off', target: { entity_id: ['light.hall', 'light.entry'] } }], ...extra });
    const s = suggestSchedule(draft(), opts)!.schedule_draft;
    expect(s).toMatchObject({ name: 'מזגן בלילה', weekdays: ['sun', 'mon', 'tue'], repeat: 'repeat', start_date: null, end_date: null, tags: [] });
    expect(s.slots.map((x) => x.start)).toEqual(['22:00:00', 'sunset-00:20:00']);
    expect(s.slots[0].actions).toEqual([
      { service: 'climate.set_temperature', entity_id: 'climate.bed', data: { temperature: 24 } }, { service: 'light.turn_off', entity_id: 'light.hall', data: {} }, { service: 'light.turn_off', entity_id: 'light.entry', data: {} },
    ]);
    expect(s.conditions).toEqual({ items: [{ entity_id: SHABBAT_SENSOR, attribute: 'state', match_type: 'is', value: 'off' }], type: null, track: false });
    expect(suggestSchedule(draft({ conditions: [] }), opts)!.schedule_draft).toMatchObject({ weekdays: ['daily'], conditions: { items: [] } });
    expect(suggestSchedule(draft({ conditions: [] }), { ...opts, schedulerPresent: false })).toBeNull();
    expect(suggestSchedule(draft({ conditions: [{ condition: 'sun', after: 'sunset' }] }), opts)).toBeNull();
    expect(suggestSchedule(draft({ conditions: [{ condition: 'time', after: '17:00:00' }] }), opts)).toBeNull();
    expect(suggestSchedule(draft({ triggers: [{ trigger: 'state', entity_id: ['light.hall'], to: 'on' }] }), opts)).toBeNull();
    expect(suggestSchedule(draft({ triggers: [{ trigger: 'device', domain: 'x', device_id: 'y', type: 'z' }] }), opts)).toBeNull();
    expect(suggestSchedule(draft({ actions: [{ action: 'light.turn_on', target: { entity_id: ['light.hall'] } }, { delay: { seconds: 5 } }] }), opts)).toBeNull();
    expect(suggestSchedule(draft({ actions: [{ action: 'notify.notify', data: { message: 'x' } }] }), opts)).toBeNull();
    expect(suggestSchedule(draft({ actions: [{ action: 'alarm_control_panel.alarm_arm_away', target: { entity_id: ['alarm_control_panel.home'] } }] }), opts)).toBeNull();
    expect(suggestSchedule(draft({ actions: [{ action: 'cover.open_cover', target: { entity_id: ['cover.gate'] } }] }), { ...opts, classOf: () => 'gate' })).toBeNull();
    expect(suggestSchedule(draft({ actions: [{ action: 'media_player.turn_off', target: { entity_id: ['media_player.tv'] } }] }), opts)).toBeNull();
    expect(suggestSchedule(draft({ conditions: [{ condition: 'state', entity_id: [SHABBAT_SENSOR], state: 'on' }] }), { schedulerPresent: true })).toBeNull(); // no sensor: the condition is a plain state one
  });
});

// ---------------------------------------------------------------------------------------------------------------- errors and settings

test.describe('automations client: error mapping and settings', () => {
  const api = (status: number, code: string, details: Record<string, unknown> = {}, msg = 'שרת') => new ApiError(status, { code, user_message: msg, retryable: false, correlation_id: 'c', details });

  test('every code of §3.3 has its Hebrew line, with the placeholders filled from the details', () => {
    expect(Object.keys(AUTOMATION_ERROR_LABEL)).toHaveLength(26);
    expect(automationErrorText(api(403, 'forbidden'))).toBe('אין הרשאה לפעולה זו בהיקף המבוקש.');
    expect(automationErrorText(api(403, 'entity_not_controllable', { name: 'תאורת סלון' }))).toBe('אין לך הרשאת שליטה ב־תאורת סלון.');
    expect(automationErrorText(api(403, 'grant_required', { name: 'אזעקה', action: 'נטרול' }))).toBe('אין לך הרשאה לנטרול ב־אזעקה.');
    expect(automationErrorText(api(422, 'validation', { errors: [{ path: 'alias', code: 'alias_required', message: 'תנו שם' }] }))).toBe('ערך לא תקין — alias: תנו שם');
    expect(automationErrorText(api(422, 'ha_validation', { what: 'trigger 0 is invalid' }))).toBe('תשתית המערכת דחתה את ההגדרה: trigger 0 is invalid');
    expect(automationErrorText(api(409, 'item_changed'))).toBe('הפריט שונה במקום אחר. טענו את הגרסה העדכנית והחליטו מה לשמור.');
    expect(automationErrorText(api(504, 'config_timeout'))).toBe('תשתית המערכת לא ענתה בזמן; ייתכן שהשינוי נשמר. רעננו לפני ניסיון נוסף.');
    expect(automationErrorText(api(503, 'bridge_not_paired', {}, 'גשר לא מצומד'))).toBe('גשר לא מצומד'); // "existing": the server's own message
    expect(automationErrorText(api(422, 'validation', {}, 'שדה חסר'))).toBe('שדה חסר'); // placeholders without details fall back to the server's text
    expect(automationErrorText(api(500, 'something_else', {}, 'מה זה'))).toBe('מה זה');
    expect(automationErrorText(new TypeError('x'))).toBe('אין חיבור לשרת.');
  });

  test('mapAutomationError: kind, conflict item, issues, grant, maybe-saved, confirm', () => {
    expect(mapAutomationError(api(409, 'item_changed', { current: { kind: 'automation', id: '1', revision: 'abc' } }))).toMatchObject({ code: 'item_changed', kind: 'conflict', status: 409, current: { revision: 'abc' }, maybe_saved: false });
    expect(mapAutomationError(api(409, 'item_changed')).current).toBeNull();
    expect(mapAutomationError(api(422, 'validation', { errors: [{ path: 'actions.0', code: 'entity_required', message: 'בחרו מכשיר' }] }))).toMatchObject({ kind: 'validation', issues: [{ path: 'actions.0' }] });
    expect(mapAutomationError(api(403, 'grant_required', { grant: 'alarm.disarm', path: 'actions.2' })).grant).toEqual({ grant: 'alarm.disarm', path: 'actions.2' });
    expect(mapAutomationError(api(504, 'config_timeout'))).toMatchObject({ kind: 'timeout', maybe_saved: true });
    expect(mapAutomationError(api(409, 'confirmation_required')).kind).toBe('confirm');
    expect(needsConfirmation(api(409, 'confirmation_required'))).toBe(true);
    expect(needsConfirmation(api(409, 'item_changed'))).toBe(false);
    expect(mapAutomationError(api(429, 'run_too_soon')).kind).toBe('rate');
    expect(mapAutomationError(api(403, 'locked_block_changed')).kind).toBe('locked');
    expect(mapAutomationError(api(404, 'trash_not_found')).kind).toBe('not_found');
    expect(mapAutomationError(api(502, 'config_refused', { error: 'ha_invalid' })).kind).toBe('refused');
    expect(mapAutomationError(api(418, 'teapot')).kind).toBe('unknown');
    expect(mapAutomationError(new TypeError('failed'))).toMatchObject({ code: 'network', kind: 'unavailable', retryable: true, message: 'אין חיבור לשרת.' });
  });

  test('settings: defaults, reading the keys, the patch of what differs, including the two display settings', () => {
    expect(AUTOMATION_SETTINGS_DEFAULT).toMatchObject({ enabled: true, trash_days: 30, versions_keep: 20, phone_filter: 'fold', sensitive_chip: 'amber', code_view_roles: ['site_admin', 'system_admin'] });
    expect(AUTOMATION_SETTINGS_DEFAULT.limits).toEqual({ writes_per_min: 30, preview_per_min: 60, run_interval_s: 10, scene_apply_interval_s: 3, storm_item_per_min: 20, storm_total_per_min: 200 });
    expect(automationSettingsOf(null)).toEqual(AUTOMATION_SETTINGS_DEFAULT);
    const s = automationSettingsOf({ 'automations.enabled': 'false', 'automations.trash_days': 7, 'automations.versions_keep': 99, 'automations.phone_filter': 'rows', 'automations.sensitive_chip': 'red', 'automations.code_view_roles': '["system_admin"]',
      'automations.limits': '{"writes_per_min": 10}', 'automations.templates_hidden': ['t2'], 'automations.storm_auto_disable': 'true' });
    expect(s).toMatchObject({ enabled: false, trash_days: 7, versions_keep: 20, phone_filter: 'rows', sensitive_chip: 'red', code_view_roles: ['system_admin'], templates_hidden: ['t2'], storm_auto_disable: true });
    expect(s.limits.writes_per_min).toBe(10);
    expect(s.limits.preview_per_min).toBe(60);
    expect(automationSettingsOf({ 'automations.phone_filter': 'weird', 'automations.sensitive_chip': 'blue' })).toMatchObject({ phone_filter: 'fold', sensitive_chip: 'amber' });
    expect(automationSettingsPatch(AUTOMATION_SETTINGS_DEFAULT, AUTOMATION_SETTINGS_DEFAULT)).toEqual({});
    expect(automationSettingsPatch(AUTOMATION_SETTINGS_DEFAULT, { ...AUTOMATION_SETTINGS_DEFAULT, phone_filter: 'rows', sensitive_chip: 'red', trash_days: 45, notify_targets: ['x'], limits: { ...AUTOMATION_SETTINGS_DEFAULT.limits, writes_per_min: 5 } }))
      .toEqual({ 'automations.phone_filter': 'rows', 'automations.sensitive_chip': 'red', 'automations.trash_days': 45, 'automations.notify_targets': ['x'], 'automations.limits': { ...AUTOMATION_SETTINGS_DEFAULT.limits, writes_per_min: 5 } });
    expect(Object.keys(REVIEW_LABEL)).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------------------------------------------- the mock adapter

test.describe('automations mock: reads (the fixture house, three users)', () => {
  test('the installer sees everything: 12 automations, 3 scripts, 6 scenes; status carries the counts and the admin block', async () => {
    const m = resetAutomationsMock();
    const { items, total } = await m.list();
    expect(total).toBe(21);
    expect(countByKind(items)).toEqual({ automation: 12, script: 3, scene: 6 });
    const s = await m.status();
    expect(s).toMatchObject({ available: 'ok', writable: true, write_block: null, scheduler_present: true, delegation: { on: true, needed: false }, ui: { sensitive_warning: true, phone_filter: 'fold', sensitive_chip: 'amber' } });
    expect(s.counts).toMatchObject({ automations: 12, scripts: 3, scenes: 6, running: 0, hidden: 1 });
    expect(s.admin).toMatchObject({ ha_version: '2026.9.4', bridge_version: '0.6.0', caller_is_ha_admin: true, config_api: 'ok' });
    const by = (e: string) => items.find((i) => i.entity_id === e)!;
    expect(by('automation.hall_motion')).toMatchObject({
      name: 'תנועה בפרוזדור', state: 'on', mode: 'restart', source: 'ui', extras: ['trace'], created_via: 'arx', owner: { display_name: 'יוני' }, runs_7d: 38,
      floors: [{ id: 'f1', name: 'קומה 1' }], areas: [{ id: 'hall', name: 'פרוזדור' }], sensitive: false, locked_count: 0, unknown_effects: false, can: { edit: true, code_view: true, toggle: true, run: true, delete: true, copy: true }, read_only: null,
    });
    expect(by('automation.hall_motion').sentence).toBe('כשחיישן תנועה פרוזדור מזהה תנועה, אם אחרי השקיעה – הדלק תאורת פרוזדור ל־40%; המתן 3 דקות; כבה תאורת פרוזדור');
    expect(by('automation.hall_motion').revision).toMatch(/^[0-9a-f]{16}$/);
    expect(by('automation.hall_motion').targets).toEqual([{ entity_id: 'light.hall', name: 'תאורת פרוזדור', floor: 'קומה 1', area: 'פרוזדור', class: null, sensitive: false, missing: false }]);
    expect(by('automation.all_left')).toMatchObject({ sensitive: true, sensitive_classes: ['alarm'] });
    expect(by('automation.vacation_freeze')).toMatchObject({ state: 'off', unknown_effects: true, locked_count: 1 });
    expect(by('automation.light_by_lux')).toMatchObject({ unknown_effects: true, locked_count: 2, mode: 'queued', extras: ['variables'] });
    expect(by('automation.salon_buttons')).toMatchObject({ locked_count: 2, mode: 'parallel' });
    expect(by('automation.boiler_morning').warnings.map((w) => w.code)).toContain('missing_entity');
    expect(by('automation.boiler_morning').last_run).toMatchObject({ result: 'error' });
    expect(by('automation.alarm_morning')).toMatchObject({ state: 'off', sensitive: true });
    expect(by('automation.alarm_morning').warnings.map((w) => w.code)).toEqual(expect.arrayContaining(['changed_outside', 'sensitive']));
    expect(by('automation.irrigation_shabbat')).toMatchObject({ id: 'entity:automation.irrigation_shabbat', config_id: null, source: 'yaml', revision: null, can: { edit: false, code_view: false, delete: false }, read_only: { reasons: [{ code: 'yaml_managed' }] } });
    expect(by('script.shutters')).toMatchObject({ kind: 'script', mode: 'single', state: 'off' });
    expect(by('scene.arx_welcome')).toMatchObject({ kind: 'scene', source: 'ui', can: { edit: true }, mode: null, favourite: true });
    expect(by('scene.salon_evening')).toMatchObject({ source: 'integration', sentence: '', can: { edit: false, run: true }, read_only: { reasons: [{ code: 'integration_scene' }] }, favourite: true });
    expect(by('scene.bed_night').hidden).toBe(true);
  });

  test('the household editor (floor 1) sees only floor 1; the 404 for the rest; the runner never sees an automation (403); rights per user', async () => {
    const m = resetAutomationsMock({ user: 'household' });
    const l = (await m.list()).items;
    expect(l.map((i) => i.entity_id).sort()).toEqual(['automation.bed_ac_clock', 'automation.hall_motion']); // the hidden scene is the installer's
    const hall = S(m, 'automation.hall_motion');
    expect((await m.get('automation', hall)).can).toEqual({ edit: true, code_view: false, toggle: true, run: true, delete: true, copy: true });
    expect(await code(m.get('automation', S(m, 'automation.entry_sunset')))).toBe('item_not_found');
    expect(await code(m.get('script', S(m, 'script.good_morning')))).toBe('item_not_found');
    const s = await m.status();
    expect(s.counts).toMatchObject({ automations: 2, scripts: 0, scenes: 0, hidden: null });
    expect(s.admin).toBeUndefined();
    const v = resetAutomationsMock({ user: 'runner' });
    expect(await code(v.get('automation', S(v, 'automation.hall_motion')))).toBe('forbidden');
    expect((await v.list()).items.filter((i) => i.kind === 'automation')).toEqual([]);
    expect((await v.status()).counts.automations).toBe(0);
  });

  test('the delegation knob decides whether a non-admin may save: read-only reason, write_block, then the write itself', async () => {
    const m = resetAutomationsMock({ user: 'household', delegation: false });
    const hall = S(m, 'automation.hall_motion');
    const d = await m.get('automation', hall);
    expect(d.can.edit).toBe(false);
    expect(d.read_only?.reasons[0]).toMatchObject({ code: 'delegation_off', message: 'שמירה דורשת מנהל' });
    expect(d.can.run).toBe(true); // view, run and enable still work
    expect(await m.status()).toMatchObject({ writable: false, write_block: 'delegation_off', delegation: { on: false, needed: true } });
    expect(await code(m.replace('automation', hall, { draft: d.draft, base_revision: d.revision, client_request_id: rid() }))).toBe('delegation_off');
    m.delegation = true;
    expect(await code(m.replace('automation', hall, { draft: d.draft, base_revision: d.revision, client_request_id: rid() }))).toBeNull();
  });

  test('detail: draft blocks with sentences, the locked view for what the caller may not see, versions count', async () => {
    const m = resetAutomationsMock();
    const d = await m.get('automation', S(m, 'automation.salon_buttons'));
    const draft = d.draft as AutomationDraft;
    expect(draft.triggers.map((t) => t.kind)).toEqual(['locked', 'locked']);
    expect(draft.triggers[0]).toMatchObject({ reason: 'device', label: 'כפתור · מכשיר' });
    expect(d.versions).toBe(1);
    const hall = await m.get('automation', S(m, 'automation.hall_motion'));
    expect(hall.versions).toBe(4);
    // a household editor sees a trigger on an entity outside floor 1 as a locked view (by name), with the raw preserved
    const hm = resetAutomationsMock({ user: 'household' });
    const id = S(hm, 'automation.hall_motion');
    hm.externalEdit('automation', id, (c) => { ((c.triggers as Array<Record<string, unknown>>)[0]).entity_id = ['binary_sensor.front_door']; });
    const hd = (await hm.get('automation', id)).draft as AutomationDraft;
    expect(hd.triggers[0]).toMatchObject({ kind: 'locked', reason: 'unknown', label: 'כשדלת הכניסה נפתח/ת' });
    const saved = await hm.replace('automation', id, { draft: hd, base_revision: (await hm.get('automation', id)).revision, client_request_id: rid() });
    expect(saved.item?.versions).toBeGreaterThan(4);
    expect((hm.storedConfig('automation', id)!.triggers as Array<Record<string, unknown>>)[0].entity_id).toEqual(['binary_sensor.front_door']); // untouched
  });

  test('catalogue: entities with placement and typed actions, scoped per user; notify targets; scripts with fields; unplaced entities are not control targets for a scoped caller', async () => {
    const m = resetAutomationsMock();
    const c = await m.catalog();
    expect(c.shabbat_sensor).toBe(SHABBAT_SENSOR);
    expect(c.notify_targets).toEqual([{ action: 'notify.mobile_app_yoni', name: 'הטלפון של יוני' }, { action: 'notify.mobile_app_dana', name: 'הטלפון של דנה' }, { action: 'notify.notify', name: 'כל המכשירים' }]);
    expect(c.entities.find((e) => e.entity_id === 'lock.front')).toMatchObject({ class: 'lock', domain: 'lock', floor: { id: 'g' }, actions: ['lock.lock', 'lock.unlock'] });
    expect(c.entities.find((e) => e.entity_id === 'person.yoni')).toMatchObject({ actions: [], triggers: ['state'], floor: null });
    expect(c.actions.light.map((a) => a.action)).toEqual(['light.turn_on', 'light.turn_off', 'light.toggle']);
    expect(c.actions.alarm_control_panel.every((a) => a.sensitive)).toBe(true);
    expect(c.actions.light[0].args.map((a) => a.key)).toEqual(['brightness_pct', 'color_temp_kelvin']);
    expect(c.scripts.find((s) => s.entity_id === 'script.shutters')!.fields).toHaveLength(4);
    expect(c.scenes.find((s) => s.entity_id === 'scene.salon_evening')).toMatchObject({ integration: true, area: 'סלון' });
    expect(c.floors).toHaveLength(3);
    const h = await resetAutomationsMock({ user: 'household' }).catalog();
    expect(h.floors).toEqual([{ id: 'f1', name: 'קומה 1' }]);
    expect(h.entities.every((e) => !e.floor || e.floor.id === 'f1')).toBe(true);
    expect(h.entities.find((e) => e.entity_id === 'person.yoni')).toBeTruthy();
    expect(h.entities.find((e) => e.entity_id === 'light.entry')).toBeUndefined();
    expect(await code(resetAutomationsMock({ user: 'runner' }).catalog())).toBe('forbidden');
  });

  test('templates: seven drafts with empty pickers, the time-only ones offer the schedule; hide and order come from the settings', async () => {
    const m = resetAutomationsMock();
    const { templates } = await m.templates();
    expect(templates.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4', 't5', 't6', 't7']);
    expect(templates.filter((t) => t.suggest_schedule).map((t) => t.id)).toEqual(['t6', 't7']);
    expect(templates[0].draft).toMatchObject({ mode: 'restart', alias: 'תאורה לפי תנועה' });
    expect(templates[0].draft.triggers[0]).toMatchObject({ type: 'state', entity_ids: [] });
    expect(templates.find((t) => t.id === 't3')).toMatchObject({ sensitive: true });
    expect(templates.every((t) => t.target === 'automation')).toBe(true);
    expect(validateDraft('automation', templates[0].draft, {}).map((i) => i.code)).toContain('entity_required'); // nothing is saved without review
    const s = await m.settings();
    await m.saveSettings({ ...s, templates_hidden: ['t2'], templates_order: ['t7', 't1'] });
    expect((await m.templates()).templates.map((t) => t.id)).toEqual(['t7', 't1', 't3', 't4', 't5', 't6']);
    await m.saveSettings({ ...s, templates_enabled: false });
    expect((await m.templates()).templates).toEqual([]);
    expect(await code(resetAutomationsMock({ user: 'runner' }).templates())).toBe('forbidden');
  });

  test('runs and traces: authored traces, a synthetic one for an item that ran, masked secrets, hidden from callers who cannot see the item', async () => {
    const m = resetAutomationsMock();
    const hall = S(m, 'automation.hall_motion');
    const runs = await m.runs('automation', hall);
    expect(runs.map((r) => [r.run_id, r.result])).toEqual([['r1', 'ok'], ['r2', 'not_triggered'], ['r3', 'ok'], ['r4', 'error']]);
    expect(runs[1].sentence).toContain('אבל התנאי "אחרי השקיעה (17:58)" נכשל ולכן לא בוצעה פעולה');
    const t = await m.runTrace('automation', hall, 'r4');
    expect(t).toMatchObject({ result: 'error', context: { user: 'יוני', parent: 'user' }, trigger: { path: 'trigger' }, duration_ms: 2210 });
    expect(t.variables).toEqual({ 'trigger.platform': 'manual', skip_condition: true, access_token: '••••' });
    expect(t.steps.map((s) => s.result)).toEqual(['error', 'not_run', 'not_run']);
    expect(t.steps[0]).toMatchObject({ error: 'המכשיר לא זמין', started_at: expect.any(String) });
    expect(t.steps[1].started_at).toBeNull();
    expect(JSON.stringify(t)).not.toMatch(/abc123secret/);
    expect(traceView(t, { timeZone: 'Asia/Jerusalem' }).who).toBe('יוני (ידנית)');
    const full = await m.runTrace('automation', S(m, 'automation.bed_ac_clock'), 'r1');
    expect(full.steps.map((s) => [s.depth, s.result])).toEqual([[0, 'done'], [1, 'skipped'], [1, 'done'], [2, 'done']]);
    const door = await m.runs('automation', S(m, 'automation.door_open'));
    expect(door).toHaveLength(1);
    expect((await m.runTrace('automation', S(m, 'automation.door_open'), 'r1')).steps[0].sentence).toContain('שלח');
    expect(await m.runs('automation', S(m, 'automation.vacation_freeze'))).toEqual([]); // never ran
    expect(await code(m.runTrace('automation', hall, 'nope'))).toBe('item_not_found');
    expect(await code(resetAutomationsMock({ user: 'household' }).runs('automation', S(m, 'automation.entry_sunset')))).toBe('item_not_found');
  });

  test('versions: newest first with the origin (Arx or outside); status carries the current one', async () => {
    const m = resetAutomationsMock();
    const v = await m.versions('automation', S(m, 'automation.hall_motion'));
    expect(v.map((x) => [x.version_id, x.via, x.current])).toEqual([['v12', 'arx', true], ['v11', 'external', false], ['v10', 'arx', false], ['v9', 'arx', false]]);
    expect(v[1]).toMatchObject({ actor: null, summary: 'השהיה 2 → 3 דקות' });
    expect(v[3].summary).toBe('נוצרה מתבנית "תאורה לפי תנועה"');
    expect((await m.versions('automation', S(m, 'automation.door_open'))).map((x) => x.version_id)).toEqual(['v1']);
  });
});

test.describe('automations mock: writes follow §3.2 in order and answer with the contract codes', () => {
  test('create: validate -> scope -> grant -> locked rule -> confirm -> delegation -> write; a new item is Arx-made, versioned, audited and idempotent', async () => {
    const m = resetAutomationsMock();
    const draft = autoDraft({ alias: 'תאורה בלילה', description: 'בדיקה', triggers: [{ trigger: 'time', at: '23:00:00' }], conditions: [], actions: [{ action: 'light.turn_off', target: { entity_id: ['light.kitchen'] } }], mode: 'single' });
    const bad = { ...draft, alias: '' };
    const e = await fail(m.create('automation', { draft: bad, client_request_id: rid() }));
    expect(e).toMatchObject({ status: 422, code: 'validation' });
    expect(mapAutomationError(e).issues[0]).toMatchObject({ path: 'alias', code: 'alias_required' });
    const id = rid();
    const r = await m.create('automation', { draft, enabled: false, client_request_id: id });
    expect(r.item).toMatchObject({ kind: 'automation', name: 'תאורה בלילה', state: 'off', created_via: 'arx', owner: { display_name: 'יוני' }, sentence: 'בשעה 23:00 – כבה תאורת מטבח', versions: 1 });
    expect(r.item!.id).toMatch(/^\d{13,}$/);
    expect(m.storedConfig('automation', r.item!.id)).toMatchObject({ id: r.item!.id, alias: 'תאורה בלילה', mode: 'single', triggers: [{ trigger: 'time', at: '23:00:00' }] });
    expect(Object.keys(m.storedConfig('automation', r.item!.id)!)).toEqual(['id', 'alias', 'description', 'triggers', 'conditions', 'actions', 'mode']);
    expect(m.audit.at(-1)).toMatchObject({ action: 'automation.create', delegated: false, user: 'יוני' });
    const again = await m.create('automation', { draft, enabled: false, client_request_id: id });
    expect(again.op_id).toBe(r.op_id);
    expect((await m.list({ kind: 'automation' })).items).toHaveLength(13);
    // scripts get an `arx_` id, scenes a numeric one
    const sc = await m.create('script', { draft: configToDraft('script', { alias: 'ס', sequence: [{ action: 'light.turn_on', target: { entity_id: ['light.kitchen'] } }] }, ctx).draft, client_request_id: rid() });
    expect(sc.item!.id).toMatch(/^arx_\d+$/);
    expect(sc.item!.entity_id).toBe(`script.${sc.item!.id}`);
    expect(m.storedConfig('script', sc.item!.id)).toEqual({ alias: 'ס', description: '', mode: 'single', sequence: [{ action: 'light.turn_on', target: { entity_id: ['light.kitchen'] } }] });
    // no right, no write
    expect(await code(resetAutomationsMock({ user: 'runner' }).create('automation', { draft, client_request_id: rid() }))).toBe('forbidden');
  });

  test('create by a household editor: scope (entity_not_controllable), the delegation audit flag, locked blocks are refused in the builder', async () => {
    const m = resetAutomationsMock({ user: 'household' });
    const outside = autoDraft({ alias: 'מטבח', triggers: [{ trigger: 'time', at: '23:00:00' }], actions: [{ action: 'light.turn_off', target: { entity_id: ['light.kitchen'] } }] });
    const e = await fail(m.create('automation', { draft: outside, client_request_id: rid() }));
    expect(e).toMatchObject({ status: 403, code: 'entity_not_controllable' });
    expect(automationErrorText(e)).toBe('אין לך הרשאת שליטה ב־תאורת מטבח.');
    const mine = autoDraft({ alias: 'חדר שינה', triggers: [{ trigger: 'time', at: '23:00:00' }], actions: [{ action: 'light.turn_off', target: { entity_id: ['light.bed'] } }] });
    const r = await m.create('automation', { draft: mine, client_request_id: rid() });
    expect(m.audit.at(-1)).toMatchObject({ action: 'automation.create', delegated: true, user: 'דנה' });
    expect(r.item!.owner).toEqual({ display_name: 'דנה' });
    // a template or an unknown service is not builder content
    const locked = autoDraft({ alias: 'x', triggers: [{ trigger: 'time', at: '23:00:00' }], actions: [{ action: 'light.turn_off', target: { entity_id: ['light.bed'] } }, { action: 'browser_mod.popup' }] });
    expect(await code(m.create('automation', { draft: locked, client_request_id: rid() }))).toBe('locked_block_changed');
    // an unplaced entity is never a control target of a scoped caller
    expect(await code(m.create('automation', { draft: autoDraft({ alias: 'x', triggers: [{ trigger: 'time', at: '23:00:00' }], actions: [{ action: 'switch.turn_on', target: { entity_id: ['switch.unplaced'] } }] }), client_request_id: rid() }))).toBe('entity_not_controllable');
  });

  test('sensitive steps use the manual-control grants: grant_required names the grant and the first missing step; an alarm step is typed and allowed with the grant', async () => {
    const m = resetAutomationsMock();
    const draft = autoDraft({ alias: 'דרוך', triggers: [{ trigger: 'time', at: '23:00:00' }], actions: [{ action: 'light.turn_off', target: { entity_id: ['light.kitchen'] } }, { action: 'alarm_control_panel.alarm_arm_away', target: { entity_id: ['alarm_control_panel.home'] } }] });
    expect((await m.preview({ kind: 'automation', draft })).sensitive_steps).toEqual([{ path: 'actions.1', entity_id: 'alarm_control_panel.home', action: 'alarm_control_panel.alarm_arm_away', grant: 'alarm.disarm', granted: true }]);
    m.user.grants.delete('alarm.disarm');
    const e = await fail(m.create('automation', { draft, client_request_id: rid() }));
    expect(e).toMatchObject({ status: 403, code: 'grant_required' });
    expect(automationErrorText(e)).toBe('אין לך הרשאה לדריכה ב־אזעקה.');
    expect(mapAutomationError(e).grant).toEqual({ grant: 'alarm.disarm', path: 'actions.1' });
    expect((await m.preview({ kind: 'automation', draft })).sensitive_steps[0].granted).toBe(false);
    const hall = (await m.list()).items.find((i) => i.entity_id === 'automation.all_left')!;
    expect(hall.read_only?.reasons[0]).toMatchObject({ code: 'grant_required', entity_id: 'alarm_control_panel.home' });
    expect(hall.can).toMatchObject({ edit: false, toggle: false, run: false });
    expect(await code(m.setEnabled(hall.id, true, { client_request_id: rid() }))).toBe('grant_required');
    expect(await code(m.run(hall.id, { skip_condition: true, confirm: true, client_request_id: rid() }))).toBe('grant_required');
    m.user.grants.add('alarm.disarm');
    expect(await code(m.create('automation', { draft, client_request_id: rid() }))).toBeNull();
    // a code in an alarm step is refused, never stored
    const withCode = autoDraft({ alias: 'קוד', triggers: [{ trigger: 'time', at: '23:00:00' }], actions: [{ action: 'light.turn_off', target: { entity_id: ['light.kitchen'] } }] });
    svc(withCode.actions[0]).data = { code: '1234' };
    expect(await code(m.create('automation', { draft: withCode, client_request_id: rid() }))).toBe('code_not_allowed');
  });

  test('replace: revision check (409 with the current item), the conflict knob, unknown effects need confirm, extras and key order survive, one version per change', async () => {
    const m = resetAutomationsMock();
    const id = S(m, 'automation.hall_motion');
    const d = await m.get('automation', id);
    const draft = d.draft as AutomationDraft;
    svc(draft.actions[0]).data.brightness_pct = 55;
    const stale = await fail(m.replace('automation', id, { draft, base_revision: 'deadbeefdeadbeef', client_request_id: rid() }));
    expect(stale).toMatchObject({ status: 409, code: 'item_changed' });
    expect(mapAutomationError(stale).current).toMatchObject({ id, revision: d.revision });
    m.conflictNext = true;
    const conflict = await fail(m.replace('automation', id, { draft, base_revision: d.revision, client_request_id: rid() }));
    expect(conflict.code).toBe('item_changed');
    const cur = mapAutomationError(conflict).current!;
    expect(cur.revision).not.toBe(d.revision);
    expect(cur.warnings.map((w) => w.code)).toContain('changed_outside');
    const before = (await m.versions('automation', id)).length;
    const ok = await m.replace('automation', id, { draft, base_revision: cur.revision, client_request_id: rid() });
    expect(ok.item!.revision).not.toBe(cur.revision);
    expect(ok.item!.warnings.map((w) => w.code)).not.toContain('changed_outside');
    expect((await m.versions('automation', id)).length).toBe(before + 1);
    expect(m.storedConfig('automation', id)!.trace).toEqual({ stored_traces: 10 });
    expect(Object.keys(m.storedConfig('automation', id)!)).toEqual(Object.keys(fixtureKeys()));
    // unknown effects (a template action) need the explicit confirmation
    const lux = S(m, 'automation.light_by_lux');
    const ld = await m.get('automation', lux);
    expect(await code(m.replace('automation', lux, { draft: ld.draft, base_revision: ld.revision, client_request_id: rid() }))).toBe('confirmation_required');
    const lok = await m.replace('automation', lux, { draft: ld.draft, base_revision: ld.revision, confirm: true, client_request_id: rid() });
    expect(lok.item!.revision).toBe(ld.revision); // nothing changed: the same revision, no new version
    expect((await m.versions('automation', lux)).length).toBe(1);
    // not editable: a configuration-file item and an integration scene
    expect(await code(m.replace('automation', 'entity:automation.irrigation_shabbat', { draft, base_revision: null, client_request_id: rid() }))).toBe('not_editable');
    expect(await code(m.remove('scene', 'entity:scene.salon_evening', { base_revision: null, client_request_id: rid() }))).toBe('not_editable');
    // the same request id answers the same result without writing again
    const rq1 = rid();
    const a = await m.replace('automation', id, { draft, base_revision: ok.item!.revision, client_request_id: rq1 });
    const b = await m.replace('automation', id, { draft, base_revision: 'ignored-on-replay', client_request_id: rq1 });
    expect(b.op_id).toBe(a.op_id);
  });

  test('locked blocks: the builder may move or delete them but not change them; the code view may (an installer / HA admin)', async () => {
    const m = resetAutomationsMock();
    const id = S(m, 'automation.salon_buttons');
    const d = await m.get('automation', id);
    const draft = d.draft as AutomationDraft;
    // reorder (allowed): the content of every locked block is untouched
    const keep = { ...draft, triggers: [draft.triggers[1], draft.triggers[0]] };
    const del = await m.replace('automation', id, { draft: keep, base_revision: d.revision, client_request_id: rid() });
    expect(((m.storedConfig('automation', id)!.triggers) as Array<Record<string, unknown>>).map((t) => t.type)).toEqual(['button_1_long', 'button_1_short']);
    // delete one (allowed): a locked action of another item
    const vid = S(m, 'automation.vacation_freeze');
    const vd = await m.get('automation', vid);
    const vdraft = vd.draft as AutomationDraft;
    const dropped = await m.replace('automation', vid, { draft: { ...vdraft, actions: [vdraft.actions[1]] }, base_revision: vd.revision, client_request_id: rid() });
    expect(dropped.item).toMatchObject({ unknown_effects: false, locked_count: 0 });
    expect(m.storedConfig('automation', vid)!.actions).toEqual([{ action: 'notify.mobile_app_yoni', data: { message: 'התזמונים הוקפאו' } }]);
    // change one (refused in the builder)
    const changed = autoDraft({ ...m.storedConfig('automation', id)!, triggers: [{ trigger: 'device', domain: 'wall_switch', device_id: 'other', type: 'button_9', id: 'long' }, { trigger: 'device', domain: 'wall_switch', device_id: '2f1c9a07', type: 'button_1_short', id: 'short' }] });
    expect(await code(m.replace('automation', id, { draft: changed, base_revision: del.item!.revision, client_request_id: rid() }))).toBe('locked_block_changed');
    // through the code view the installer may
    const cfg = { ...m.storedConfig('automation', id)!, triggers: [{ trigger: 'device', domain: 'wall_switch', device_id: 'other', type: 'button_9', id: 'long' }, { trigger: 'device', domain: 'wall_switch', device_id: '2f1c9a07', type: 'button_1_short', id: 'short' }] };
    const r = await m.putCode('automation', id, { config: cfg, base_revision: del.item!.revision, client_request_id: rid() });
    expect(r.item!.revision).toBe(revisionOf(cfg));
    expect(m.audit.at(-1)!.action).toBe('automation.code_edit');
    // a secret in the code is refused
    expect(await code(m.putCode('automation', id, { config: { ...cfg, actions: [{ action: 'x.y', data: { code: '1' } }] }, base_revision: r.item!.revision, client_request_id: rid() }))).toBe('code_not_allowed');
    expect(await code(m.putCode('automation', id, { config: [1], base_revision: r.item!.revision, client_request_id: rid() }))).toBe('validation');
  });

  test('code save: the profile comes from the content. Household editors have no code view; a non-admin may not save content the builder cannot express', async () => {
    const hh = resetAutomationsMock({ user: 'household' });
    const id = S(hh, 'automation.hall_motion');
    const d = await hh.get('automation', id);
    expect(await code(hh.putCode('automation', id, { config: hh.storedConfig('automation', id)!, base_revision: d.revision, client_request_id: rid() }))).toBe('code_view_required');
    // an installer who is NOT an HA admin (the settings roles gave them the code view): typed content = builder profile; a new template = code profile
    const m = resetAutomationsMock({ delegation: true });
    m.users.installer.ha_admin = false;
    const hid = S(m, 'automation.hall_motion');
    const cfg = m.storedConfig('automation', hid)!;
    const typed = { ...cfg, description: 'ערוך בקוד' };
    const r = await m.putCode('automation', hid, { config: typed, base_revision: revisionOf(cfg), client_request_id: rid() });
    expect(m.audit.at(-1)).toMatchObject({ action: 'automation.code_edit', delegated: true });
    const tpl = { ...typed, actions: [...(cfg.actions as unknown[]), { action: 'light.turn_on', target: { entity_id: '{{ x }}' } }] };
    expect(await code(m.putCode('automation', hid, { config: tpl, base_revision: r.item!.revision, confirm: true, client_request_id: rid() }))).toBe('not_ha_admin');
    m.users.installer.ha_admin = true;
    expect(await code(m.putCode('automation', hid, { config: tpl, base_revision: r.item!.revision, confirm: true, client_request_id: rid() }))).toBeNull();
  });

  test('delete goes to the trash and restores with the same id; a taken id restores under a new one; purge needs installation-wide manage; the trash is scope-filtered', async () => {
    const m = resetAutomationsMock();
    const id = S(m, 'automation.door_open');
    const d = await m.get('automation', id);
    const del = await m.remove('automation', id, { base_revision: d.revision, client_request_id: rid() });
    expect(Date.parse(del.expires_at) - m.clock().getTime()).toBe(30 * 86400000);
    expect(await code(m.get('automation', id))).toBe('item_not_found');
    const t = await m.trash();
    expect(t.map((x) => x.name)).toEqual(['דלת פתוחה יותר מ־5 דקות', 'תאורת מרפסת בלילה', 'בדיקת צופר']);
    expect(t[0]).toMatchObject({ trash_id: del.trash_id, kind: 'automation', config_id: id, deleted_by: 'יוני', can_restore: true, sensitive: false, sentence: expect.stringContaining('שלח') });
    expect(t[2]).toMatchObject({ sensitive: true });
    const back = await m.restoreTrash(del.trash_id, { client_request_id: rid() });
    expect(back.item!.id).toBe(id);
    expect(back.id_changed).toBe(false);
    expect(back.item!.revision).toBe(d.revision);
    expect(await code(m.restoreTrash(del.trash_id, { client_request_id: rid() }))).toBe('trash_not_found');
    // an old entry restores with its own id while that id is free
    await m.create('automation', { draft: autoDraft({ alias: 'תפס', triggers: [{ trigger: 'time', at: '23:00:00' }], actions: [{ action: 'light.turn_on', target: { entity_id: ['light.garden'] } }] }), client_request_id: rid() });
    const r2 = await m.restoreTrash('x1', { client_request_id: rid() });
    expect(r2.item!.id).toBe('1727600000001');
    expect(r2.id_changed).toBe(false);
    const hh = resetAutomationsMock({ user: 'household' });
    expect((await hh.trash()).map((x) => x.trash_id)).toEqual([]); // both fixtures touch floors outside floor 1
    expect(await code(hh.purgeTrash('x1'))).toBe('forbidden');
    expect(await m.purgeTrash('x2')).toEqual({ ok: true });
    expect(await code(m.purgeTrash('x2'))).toBe('trash_not_found');
    // an expired entry is gone
    const old = resetAutomationsMock();
    old.clock = () => new Date('2026-12-01T00:00:00Z');
    expect(await code(old.restoreTrash('x1', { client_request_id: rid() }))).toBe('trash_not_found');
  });

  test('versions restore, copy, enable / disable, meta', async () => {
    const m = resetAutomationsMock();
    const id = S(m, 'automation.hall_motion');
    const cur = await m.get('automation', id);
    const r = await m.restoreVersion('automation', id, 'v9', { base_revision: cur.revision, client_request_id: rid() });
    expect(r.item!.sentence).toContain('המתן שתי דקות');
    expect((await m.versions('automation', id))[0]).toMatchObject({ version_id: 'v13', current: true, summary: 'שוחזרה גרסה' });
    expect(await code(m.restoreVersion('automation', id, 'v99', { base_revision: r.item!.revision, client_request_id: rid() }))).toBe('item_not_found');
    const c = await m.copy('automation', id, { name: 'עותק של תנועה', client_request_id: rid() });
    expect(c.item).toMatchObject({ name: 'עותק של תנועה', created_via: 'arx', versions: 1 });
    expect(c.item!.id).not.toBe(id);
    expect(m.storedConfig('automation', c.item!.id)!.id).toBe(c.item!.id);
    expect(m.storedConfig('automation', c.item!.id)!.trace).toEqual({ stored_traces: 10 });
    const off = await m.setEnabled(id, false, { client_request_id: rid() });
    expect(off).toMatchObject({ changed: true, item: { state: 'off' } });
    expect((await m.setEnabled(id, false, { client_request_id: rid() })).changed).toBe(false);
    expect((await m.setEnabled(id, true, { client_request_id: rid() })).item.state).toBe('on');
    expect(await code(m.setEnabled(S(m, 'automation.light_by_lux'), true, { client_request_id: rid() }))).toBe('confirmation_required');
    expect((await m.setEnabled(S(m, 'automation.light_by_lux'), true, { confirm: true, client_request_id: rid() })).changed).toBe(false);
    expect(await code(resetAutomationsMock({ user: 'runner' }).setEnabled(id, false, { client_request_id: rid() }))).toBe('forbidden');
    expect((await m.setMeta('automation', id, { pinned: true })).pinned).toBe(true);
    expect((await m.setMeta('scene', 'entity:scene.salon_movie', { hidden: true })).hidden).toBe(true);
    const hh = resetAutomationsMock({ user: 'household' });
    expect(await code(hh.setMeta('automation', S(hh, 'automation.hall_motion'), { hidden: true }))).toBe('forbidden');
    expect((await hh.setMeta('automation', S(hh, 'automation.hall_motion'), { favourite: true })).favourite).toBe(true);
  });

  test('run now: confirmation for sensitive / unknown effects, the rate limit, the manual trace, test-the-conditions; scripts with fields, running state, stop', async () => {
    const m = resetAutomationsMock();
    const hall = S(m, 'automation.hall_motion');
    const first = await m.run(hall, { skip_condition: true, client_request_id: rid() });
    expect(first.run_id).toBeTruthy();
    expect(await code(m.run(hall, { skip_condition: true, client_request_id: rid() }))).toBe('run_too_soon');
    const cl = m.clock();
    m.clock = () => new Date(cl.getTime() + 11000);
    m.conditionsPass = false;
    await m.run(hall, { skip_condition: false, client_request_id: rid() });
    const runs = await m.runs('automation', hall);
    expect(runs[0].result).toBe('not_triggered');
    expect(runs[1]).toMatchObject({ result: 'ok', sentence: expect.stringContaining('הורצה ידנית') });
    expect((await m.get('automation', hall)).last_run).toMatchObject({ result: 'not_triggered' });
    const away = S(m, 'automation.all_left');
    expect(await code(m.run(away, { skip_condition: true, client_request_id: rid() }))).toBe('confirmation_required');
    expect(await code(m.run(away, { skip_condition: true, confirm: true, client_request_id: rid() }))).toBeNull();
    expect(await code(m.run(S(m, 'automation.light_by_lux'), { skip_condition: true, client_request_id: rid() }))).toBe('confirmation_required');
    expect(await code(resetAutomationsMock({ user: 'runner' }).run(hall, { skip_condition: true, client_request_id: rid() }))).toBe('forbidden');
    // scripts
    const sh = S(m, 'script.shutters');
    expect(await code(m.runScript(sh, { fields: { percent: 30 }, client_request_id: rid() }))).toBe('confirmation_required'); // a template action: unknown effects
    expect(await code(m.runScript(sh, { fields: { percent: 30 }, confirm: true, client_request_id: rid() }))).toBeNull();
  });

  test('scripts: fields, the running state, stop; scenes: apply and its rate limit; capture with scope and the lock grant', async () => {
    const m = resetAutomationsMock();
    const gm = S(m, 'script.good_morning');
    expect((await m.get('script', gm)).state).toBe('off');
    await m.runScript(gm, { fields: {}, client_request_id: rid() });
    expect((await m.get('script', gm)).state).toBe('running');
    expect((await m.status()).counts.running).toBe(1);
    expect(await code(m.runScript(gm, { fields: {}, client_request_id: rid() }))).toBe('run_too_soon');
    await m.stopScript(gm, { client_request_id: rid() });
    expect((await m.get('script', gm)).state).toBe('off');
    const vac = S(m, 'script.vacation');
    expect(await code(m.runScript(vac, { fields: {}, client_request_id: rid() }))).toBe('confirmation_required'); // an alarm step
    expect(await code(m.runScript(vac, { fields: {}, confirm: true, client_request_id: rid() }))).toBeNull();
    m.finishScript(vac);
    const hh = resetAutomationsMock({ user: 'household' });
    expect(await code(hh.get('script', S(hh, 'script.good_morning')))).toBe('item_not_found');
    // scenes
    const ev = 'entity:scene.salon_evening';
    expect((await m.applyScene(ev, { client_request_id: rid() })).run_id).toBeNull();
    expect(await code(m.applyScene(ev, { client_request_id: rid() }))).toBe('run_too_soon');
    expect((await m.get('scene', ev)).last_run?.result).toBe('ok');
    expect(await code(m.applyScene('entity:scene.nope', { client_request_id: rid() }))).toBe('item_not_found');
    // capture
    const cap = await m.capture({ entity_ids: ['light.salon', 'climate.salon', 'alarm_control_panel.home', 'light.hall', 'lock.front', 'cover.salon_shutter', 'sensor.bed_temp'] });
    expect(cap.members.map((x) => x.entity_id)).toEqual(['light.salon', 'climate.salon', 'light.hall', 'lock.front', 'cover.salon_shutter']);
    expect(cap.members[0]).toEqual({ entity_id: 'light.salon', state: 'on', attributes: { brightness: 128, color_temp_kelvin: 2700 } });
    expect(cap.members[1].attributes).toEqual({ temperature: 23, fan_mode: 'auto' });
    m.user.grants.delete('door.unlock');
    expect(await code(m.capture({ entity_ids: ['lock.front'] }))).toBe('grant_required');
    expect(await code(hh.capture({ entity_ids: ['light.salon'] }))).toBe('entity_not_controllable');
    expect((await hh.capture({ entity_ids: ['light.hall', 'light.bed'] })).members).toHaveLength(2);
    expect(await code(resetAutomationsMock({ user: 'runner' }).capture({ entity_ids: ['light.hall'] }))).toBe('forbidden');
    // a captured scene saved through the table
    const draft = { name: 'לילה', icon: null, members: [...(await hh.capture({ entity_ids: ['light.hall', 'light.bed'] })).members] };
    draft.members[0].attributes = { brightness: 25 };
    draft.members[0].state = 'on';
    const saved = await hh.create('scene', { draft, client_request_id: rid() });
    expect(saved.item).toMatchObject({ kind: 'scene', name: 'לילה', state: 'scene', floors: [{ id: 'f1' }] });
    expect(hh.storedConfig('scene', saved.item!.id)).toMatchObject({ name: 'לילה', entities: { 'light.hall': { state: 'on', brightness: 25 }, 'light.bed': { state: 'off' } } });
  });

  test('preview: sentence, block sentences, effects with from -> to, the schedule suggestion, self-trigger warning, what the save will require', async () => {
    const m = resetAutomationsMock();
    const t7 = (await m.templates()).templates.find((t) => t.id === 't7')!;
    const p = await m.preview({ kind: 'automation', draft: t7.draft });
    expect(p).toMatchObject({ valid: true, ha_validation: 'ok', sentence: 'בשעה 22:00 – כוון טמפרטורה של מזגן חדר שינה ל־24°', sensitive: false, requires: { confirm: false, code_view: false, ha_admin: false } });
    expect(p.effects).toEqual({ entities: [{ entity_id: 'climate.bed', name: 'מזגן חדר שינה', floor: 'קומה 1', area: 'חדר שינה', from: 'כבוי', to: '24°' }], unknown: false });
    expect(p.suggest_schedule!.schedule_draft).toMatchObject({ weekdays: ['daily'], slots: [{ start: '22:00:00' }] });
    expect(Object.keys(p.block_sentences)).toHaveLength(2);
    m.schedulerPresent = false;
    expect((await m.preview({ kind: 'automation', draft: t7.draft })).suggest_schedule).toBeNull();
    // errors are data, not an exception
    const bad = await m.preview({ kind: 'automation', draft: { ...t7.draft, alias: '' } });
    expect(bad).toMatchObject({ valid: false, ha_validation: 'skipped' });
    expect(bad.errors[0].code).toBe('alias_required');
    // self trigger
    const self = autoDraft({ alias: 'לולאה', triggers: [{ trigger: 'state', entity_id: ['light.hall'], to: 'on' }], actions: [{ action: 'light.turn_off', target: { entity_id: ['light.hall'] } }] });
    expect((await m.preview({ kind: 'automation', draft: self })).warnings.map((w) => w.code)).toEqual(['self_trigger']);
    expect((await m.get('automation', (await m.create('automation', { draft: self, client_request_id: rid() })).item!.id)).warnings.map((w) => w.code)).toContain('self_trigger');
    // a draft with a template needs the code view and an HA admin, and confirmation
    const lux = (await m.get('automation', S(m, 'automation.light_by_lux'))).draft as AutomationDraft;
    expect((await m.preview({ kind: 'automation', id: S(m, 'automation.light_by_lux'), draft: lux })).requires).toEqual({ confirm: true, code_view: false, ha_admin: false });
    expect((await m.preview({ kind: 'automation', draft: lux })).requires).toEqual({ confirm: true, code_view: true, ha_admin: true });
    // dry run: typed conditions answer, locked ones cannot be tested
    expect((await m.dryRun('automation', S(m, 'automation.hall_motion')))).toMatchObject({ conditions: [{ sentence: 'אחרי השקיעה', passed: true }] });
    m.conditionsPass = false;
    expect((await m.dryRun('automation', S(m, 'automation.hall_motion'))).conditions[0].passed).toBe(false);
    expect((await m.dryRun('automation', S(m, 'automation.hall_motion'))).effects.entities[0]).toMatchObject({ entity_id: 'light.hall', from: 'כבוי', to: 'דלוק 40%' });
  });

  test('knobs and failures: failNext, rate limit, availability, timeout (maybe saved), settings, review list', async () => {
    const m = resetAutomationsMock();
    const draft = autoDraft({ alias: 'א', triggers: [{ trigger: 'time', at: '23:00:00' }], actions: [{ action: 'light.turn_off', target: { entity_id: ['light.kitchen'] } }] });
    m.failNext('config_timeout');
    const to = await fail(m.create('automation', { draft, client_request_id: rid() }));
    expect(mapAutomationError(to)).toMatchObject({ status: 504, code: 'config_timeout', maybe_saved: true, kind: 'timeout' });
    expect((await m.list({ kind: 'automation' })).items).toHaveLength(12); // nothing written
    m.failNext('ha_validation', undefined, { what: 'bad trigger' });
    expect(automationErrorText(await fail(m.create('automation', { draft, client_request_id: rid() })))).toBe('תשתית המערכת דחתה את ההגדרה: bad trigger');
    m.failNext('config_refused', 502, { error: 'stale' });
    expect((await fail(m.create('automation', { draft, client_request_id: rid() }))).status).toBe(502);
    // rate limit: 30 writes a minute per user
    const r = resetAutomationsMock();
    for (let i = 0; i < 30; i++) await r.create('automation', { draft, client_request_id: rid() });
    const e = await fail(r.create('automation', { draft, client_request_id: rid() }));
    expect(e).toMatchObject({ status: 429, code: 'rate_limited' });
    expect(automationErrorText(e)).toBe('יותר מדי שינויים ברצף; נסו שוב בעוד רגע.');
    const c = r.clock();
    r.clock = () => new Date(c.getTime() + 61000);
    expect(await code(r.create('automation', { draft, client_request_id: rid() }))).toBeNull();
    // availability
    const u = resetAutomationsMock({ available: 'feature_disabled' });
    expect(await code(u.create('automation', { draft, client_request_id: rid() }))).toBe('feature_disabled');
    expect((await u.status()).write_block).toBe('feature_disabled');
    const h = resetAutomationsMock({ available: 'ha_unavailable' });
    expect(await code(h.list())).toBe('ha_unavailable');
    // settings: only `system.configure`, ranges validated, echoed by the status
    const s = resetAutomationsMock();
    const cur = await s.settings();
    expect(await code(s.saveSettings({ ...cur, trash_days: 5 }))).toBe('validation');
    expect(await code(s.saveSettings({ ...cur, versions_keep: 51 }))).toBe('validation');
    const saved = await s.saveSettings({ ...cur, sensitive_warning: false, phone_filter: 'rows', sensitive_chip: 'red', trash_days: 45, ask_when_on_new: true });
    expect(saved).toMatchObject({ phone_filter: 'rows', sensitive_chip: 'red', trash_days: 45 });
    expect((await s.status()).ui).toEqual({ sensitive_warning: false, ask_when_on_new: true, templates_enabled: true, phone_filter: 'rows', sensitive_chip: 'red' });
    const del = await s.remove('automation', S(s, 'automation.door_open'), { base_revision: (await s.get('automation', S(s, 'automation.door_open'))).revision, client_request_id: rid() });
    expect(Date.parse(del.expires_at) - s.clock().getTime()).toBe(45 * 86400000);
    expect(await code(resetAutomationsMock({ user: 'household' }).settings())).toBe('forbidden');
    expect(await code(resetAutomationsMock({ user: 'household' }).review())).toBe('forbidden');
    // review: sensitive external change, missing entity, delegated writes
    const rv = resetAutomationsMock();
    const rows = await rv.review();
    expect(rows.map((x) => x.issue)).toEqual(['missing_entity', 'sensitive_external']);
    expect(rows[0]).toMatchObject({ name: 'דוד שמש בבוקר', detail: 'דוד שמש' });
    expect(rows[1]).toMatchObject({ name: 'נטרול אזעקה בבוקר', detail: 'פעולה רגישה שונתה מחוץ למערכת' });
  });
});

function fixtureKeys(): Record<string, unknown> {
  const m = resetAutomationsMock();
  return m.storedConfig('automation', m.idOf('automation.hall_motion'))!;
}

// ---------------------------------------------------------------------------------------------------------------- selector and the HTTP adapter

test.describe('automations client: the selector and the HTTP routes', () => {
  test('without a backend the selector answers from the mock through a dynamic import (no import cycle); the thin calls make fresh request ids', async () => {
    expect(automations()).not.toBe(httpAutomations);
    resetAutomationsMock();
    const s = await automations().status();
    expect(s.available).toBe('ok');
    expect(automationsMock().userId).toBe('installer');
    expect((await automations().list({ kind: 'script' })).items).toHaveLength(3);
    const id = automationsMock().idOf('automation.hall_motion');
    const d = await automations().get('automation', id);
    const r1 = await replaceItem('automation', id, d.draft as AutomationDraft, d.revision, {});
    expect(r1.item).toBeTruthy();
    expect((await toggleAutomation(id, false)).changed).toBe(true);
    expect((await runAutomation(id)).run_id).toBeTruthy();
    expect((await createItem('automation', autoDraft({ alias: 'ח', triggers: [{ trigger: 'time', at: '23:00:00' }], actions: [{ action: 'light.turn_off', target: { entity_id: ['light.kitchen'] } }] }), { enabled: false })).item?.state).toBe('off');
    expect(await code(deleteItem('automation', id, 'stale'))).toBe('item_changed');
    expect(await code(activateScene('entity:scene.salon_evening'))).toBeNull();
    expect(stepsOfDraft('automation', autoDraft({ alias: 'x', triggers: [], actions: [{ delay: { seconds: 1 } }, { if: [], then: [{ delay: { seconds: 2 } }] }] }))).toBe(3);
  });

  test('every route: method, path, query and body of the real endpoints (§3.1)', async () => {
    const g = globalThis as unknown as { fetch: unknown; document?: unknown };
    const saved = { fetch: g.fetch, document: g.document };
    g.document = { baseURI: 'http://127.0.0.1:4611/' };
    const calls: string[] = [];
    let next: { status: number; body: unknown } = { status: 200, body: {} };
    g.fetch = async (url: string, init: RequestInit = {}) => {
      calls.push(`${init.method ?? 'GET'} ${url.replace('http://127.0.0.1:4611/api/v1/', '')}${init.body ? ` ${String(init.body)}` : ''}`);
      return { status: next.status, ok: next.status < 400, statusText: 'x', text: async () => JSON.stringify(next.body) } as unknown as Response;
    };
    try {
      const h = httpAutomations;
      const w = { client_request_id: 'r' };
      await h.status();
      await h.list({ kind: 'automation', q: 'תנועה', floor: 'f1', sensitive: true, sort: 'name', limit: 20 });
      await h.get('automation', '1727');
      await h.get('automation', 'entity:automation.x');
      await h.catalog();
      await h.templates();
      await h.preview({ kind: 'script', id: null, draft: { alias: 'x', description: '', icon: null, mode: 'single', max: null, fields: [], sequence: [] } });
      await h.create('scene', { draft: { name: 'x', icon: null, members: [] }, enabled: true, ...w });
      await h.replace('automation', '1', { draft: { alias: 'x', description: '', mode: 'single', max: null, triggers: [], conditions: [], actions: [] }, base_revision: 'abc', ...w });
      await h.putCode('script', 'arx_1', { config: { alias: 'x' }, base_revision: 'abc', ...w });
      await h.remove('automation', '1', { base_revision: 'abc', confirm: true, ...w });
      await h.copy('automation', '1', { name: 'עותק', ...w });
      await h.setEnabled('1', true, w);
      await h.setEnabled('1', false, w);
      await h.run('1', { skip_condition: true, ...w });
      await h.runScript('s', { fields: { a: 1 }, ...w });
      await h.stopScript('s', w);
      await h.applyScene('entity:scene.x', w);
      await h.capture({ entity_ids: ['light.a'] });
      await h.dryRun('automation', '1');
      await h.runs('automation', '1');
      await h.runTrace('automation', '1', 'r 1');
      await h.versions('script', 's');
      await h.restoreVersion('automation', '1', 'v9', { base_revision: 'abc', ...w });
      await h.trash();
      await h.restoreTrash('x1', w);
      await h.purgeTrash('x1');
      await h.setMeta('scene', 'entity:scene.x', { favourite: true });
      await h.review();
      next = { status: 200, body: { settings: { 'automations.phone_filter': 'rows' } } };
      expect((await h.settings()).phone_filter).toBe('rows');
      await h.saveSettings({ ...AUTOMATION_SETTINGS_DEFAULT, sensitive_chip: 'red', trash_days: 40 }, AUTOMATION_SETTINGS_DEFAULT);
      expect(await h.saveSettings(AUTOMATION_SETTINGS_DEFAULT, AUTOMATION_SETTINGS_DEFAULT)).toEqual(AUTOMATION_SETTINGS_DEFAULT); // nothing to send
    } finally {
      g.fetch = saved.fetch;
      g.document = saved.document;
    }
    expect(calls).toEqual([
      'GET automations/status',
      `GET automations?kind=automation&q=${encodeURIComponent('תנועה')}&floor=f1&sensitive=1&sort=name&limit=20`,
      'GET automations/automation/1727',
      `GET automations/automation/${encodeURIComponent('entity:automation.x')}`,
      'GET automations/catalog',
      'GET automations/templates',
      'POST automations/preview {"kind":"script","id":null,"draft":{"alias":"x","description":"","icon":null,"mode":"single","max":null,"fields":[],"sequence":[]}}',
      'POST automations/scene {"draft":{"name":"x","icon":null,"members":[]},"enabled":true,"client_request_id":"r"}',
      'PUT automations/automation/1 {"draft":{"alias":"x","description":"","mode":"single","max":null,"triggers":[],"conditions":[],"actions":[]},"base_revision":"abc","client_request_id":"r"}',
      'PUT automations/script/arx_1/code {"config":{"alias":"x"},"base_revision":"abc","client_request_id":"r"}',
      'POST automations/automation/1/delete {"base_revision":"abc","confirm":true,"client_request_id":"r"}',
      `POST automations/automation/1/copy {"name":"${'עותק'}","client_request_id":"r"}`,
      'POST automations/automation/1/enable {"client_request_id":"r"}',
      'POST automations/automation/1/disable {"client_request_id":"r"}',
      'POST automations/automation/1/run {"skip_condition":true,"client_request_id":"r"}',
      'POST automations/script/s/run {"fields":{"a":1},"client_request_id":"r"}',
      'POST automations/script/s/stop {"fields":{},"client_request_id":"r"}',
      `POST automations/scene/${encodeURIComponent('entity:scene.x')}/apply {"client_request_id":"r"}`,
      'POST automations/scene/capture {"entity_ids":["light.a"]}',
      'POST automations/automation/1/dry-run {}',
      'GET automations/automation/1/runs',
      `GET automations/automation/1/runs/${encodeURIComponent('r 1')}`,
      'GET automations/script/s/versions',
      'POST automations/automation/1/versions/v9/restore {"base_revision":"abc","client_request_id":"r"}',
      'GET automations/trash',
      'POST automations/trash/x1/restore {"client_request_id":"r"}',
      'POST automations/trash/x1/purge {}',
      `PUT automations/scene/${encodeURIComponent('entity:scene.x')}/meta {"favourite":true}`,
      'GET automations/review',
      'GET settings',
      'PATCH settings {"automations.trash_days":40,"automations.sensitive_chip":"red"}',
    ]);
  });

  test('wire envelopes are tolerated (`{items}`, `{runs}`, a bare array) and an error body becomes the contract error', async () => {
    const g = globalThis as unknown as { fetch: unknown; document?: unknown };
    const saved = { fetch: g.fetch, document: g.document };
    g.document = { baseURI: 'http://127.0.0.1:4611/' };
    let next: { status: number; body: unknown } = { status: 200, body: {} };
    g.fetch = async () => ({ status: next.status, ok: next.status < 400, statusText: 'x', text: async () => JSON.stringify(next.body) }) as unknown as Response;
    try {
      next = { status: 200, body: { items: [{ id: 'a' }], total: 7 } };
      expect(await httpAutomations.list()).toEqual({ items: [{ id: 'a' }], total: 7 });
      next = { status: 200, body: [{ id: 'a' }, { id: 'b' }] };
      expect((await httpAutomations.list()).total).toBe(2);
      next = { status: 200, body: { runs: [{ run_id: 'r1' }] } };
      expect(await httpAutomations.runs('automation', '1')).toEqual([{ run_id: 'r1' }]);
      next = { status: 200, body: { versions: [{ version_id: 'v1' }] } };
      expect(await httpAutomations.versions('automation', '1')).toEqual([{ version_id: 'v1' }]);
      next = { status: 200, body: { items: [{ trash_id: 'x' }] } };
      expect(await httpAutomations.trash()).toEqual([{ trash_id: 'x' }]);
      next = { status: 200, body: {} };
      expect(await httpAutomations.review()).toEqual([]);
      next = { status: 409, body: { code: 'item_changed', user_message: 'שונה', retryable: false, correlation_id: 'c', details: { current: { id: '1', revision: 'zzz' } } } };
      const e = await fail(httpAutomations.replace('automation', '1', { draft: { alias: 'x', description: '', mode: 'single', max: null, triggers: [], conditions: [], actions: [] }, base_revision: 'a', client_request_id: 'r' }));
      expect(mapAutomationError(e)).toMatchObject({ kind: 'conflict', status: 409, current: { revision: 'zzz' } });
      next = { status: 504, body: { code: 'config_timeout', user_message: 'x', retryable: false, correlation_id: 'c', details: {} } };
      expect(mapAutomationError(await fail(httpAutomations.create('automation', { draft: { alias: 'x', description: '', mode: 'single', max: null, triggers: [], conditions: [], actions: [] }, client_request_id: 'r' }))).maybe_saved).toBe(true);
      next = { status: 502, body: null };
      expect(mapAutomationError(await fail(httpAutomations.status())).code).toBe('http_502');
    } finally {
      g.fetch = saved.fetch;
      g.document = saved.document;
    }
  });
});
