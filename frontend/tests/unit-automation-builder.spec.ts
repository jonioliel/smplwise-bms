import { test, expect } from '@playwright/test';
import {
  canonicalJson, changedLockedBlocks, codeToDraft, createItem, draftToCode, draftToConfig, emitBlock, fingerprintOf, lockedBlocks, mapAutomationError, replaceItem, saveCode, sensitiveSteps, validateDraft, walkDraft,
  type ActionBlock, type AutomationDraft, type Block, type SceneDraft, type ScriptDraft, type TriggerBlock,
} from '../src/api/automations';
import { resetAutomationsMock, SHABBAT_SENSOR } from '../src/api/automations-mock';
import { ApiError } from '../src/api/client';
import {
  ACTION_TYPES, CONDITION_TYPES, EMPTY_CATALOG, ROOT, TRIGGER_TYPES, addBlock, allLists, blockIcon, buildEnv, canMove, capReached, clone, codeLines, deriveScope, diffDrafts, duplicateBlock, fieldSummary, freshDraftUids, grantNoun,
  grantText, issueLine, locate, lockedFingerprints, lockedLineRanges, lockedWhy, makeBlock, memberFields, memberNumber, mergeIssues, moveBlock, moveBlockTo, newField, placeChips, presenceOf, removeBlock,
  replaceFirstTemplate, resolveList, saveRoute, scanJson, scanErrorText, setMemberField, stateChoices, storedConfigOf, subtreeUids, updateBlock, withTemplateText, canonicalOf, personIds, entityIcon, stepCount,
  type EditorEnv,
} from '../src/screens/automation-editor-logic';

// CR-017 S4: the pure logic of the editors (src/screens/automation-editor-logic.ts) against the S0 mock store's fixture house (the same data the
// evidence spec renders). No browser page: tree operations, locked blocks round trip, the type chooser's factories, presence, the code view's
// serialiser and scanner, the conflict diff, the save route, scope derivation, scene fields. The Lit elements are covered by the evidence spec.

const stripUids = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (k, x) => (k === 'uid' ? undefined : x)));

async function envFor(user: 'installer' | 'household' | 'viewer' = 'installer'): Promise<{ env: EditorEnv; store: ReturnType<typeof resetAutomationsMock> }> {
  const store = resetAutomationsMock({ user });
  const status = await store.status();
  const catalog = await store.catalog().catch(() => EMPTY_CATALOG);
  return { env: buildEnv(status, catalog), store };
}
const draftOf = (store: ReturnType<typeof resetAutomationsMock>, entity: string) => store.draftFor('automation', store.idOf(entity)) as AutomationDraft;

test.describe('editors: environment and scope', () => {
  test('the installer is installation-wide, the household editor is scoped to its floor, names resolve from the catalogue', async () => {
    const inst = await envFor('installer');
    expect(inst.env.scope.floors).toBeNull();
    expect(inst.env.scoped).toBe(false);
    expect(inst.env.ctx.names!('light.hall')).toBe('תאורת פרוזדור');
    expect(inst.env.ctx.names!('scene.salon_evening')).toBe('סלון · ערב');
    expect(inst.env.ctx.names!('script.good_morning')).toBe('בוקר טוב');
    expect(inst.env.ctx.notifyName!('notify.mobile_app_yoni')).toBe('הטלפון של יוני');
    expect(inst.env.catalog.shabbat_sensor).toBe(SHABBAT_SENSOR);
    const hh = await envFor('household');
    expect(hh.env.scope.floors).toEqual(['f1']);
    expect(hh.env.scoped).toBe(true);
    expect(hh.env.catalog.entities.some((e) => e.entity_id === 'light.entry')).toBe(false);
    expect(hh.env.catalog.entities.some((e) => e.entity_id === 'light.hall')).toBe(true);
  });

  test('the viewer has no authoring catalogue: the editor falls back to the empty one and stays read-only', async () => {
    const store = resetAutomationsMock({ user: 'viewer' });
    await expect(store.catalog()).rejects.toBeInstanceOf(ApiError);
    const env = buildEnv(await store.status(), EMPTY_CATALOG);
    expect(env.catalog.entities).toEqual([]);
    expect(deriveScope(EMPTY_CATALOG)).toEqual({ floors: null, areas: null });
    expect(env.ctx.names!('light.hall')).toBe('light.hall');
  });

  test('the sensitive chip colour and visibility come from the status echo (settings automations.sensitive_chip / sensitive_warning)', async () => {
    const store = resetAutomationsMock();
    store.settingsValue = { ...store.settingsValue, sensitive_chip: 'red', sensitive_warning: false };
    const env = buildEnv(await store.status(), await store.catalog());
    expect(env.sensitiveChip).toBe('red');
    expect(env.sensitiveWarning).toBe(false);
    const dflt = buildEnv(await resetAutomationsMock().status(), EMPTY_CATALOG);
    expect(dflt.sensitiveChip).toBe('amber');
    expect(dflt.sensitiveWarning).toBe(true);
  });
});

test.describe('editors: block tree operations (a clone each time; locked blocks stay byte-identical)', () => {
  test('add / remove / move / duplicate on the root lists and on nested lists', async () => {
    const { env, store } = await envFor();
    const d = draftOf(store, 'automation.bed_ac_clock'); // choose with two branches
    const choose = d.actions[0] as ActionBlock & { type: 'choose' };
    expect(choose.options).toHaveLength(2);
    const add = makeBlock('action', 'delay', env)!;
    const d2 = addBlock(d, choose.uid, 'choose.0.sequence', add);
    expect(((d2.actions[0] as ActionBlock & { type: 'choose' }).options[0].sequence)).toHaveLength(2);
    expect(((d.actions[0] as ActionBlock & { type: 'choose' }).options[0].sequence)).toHaveLength(1); // the original is untouched
    const at = locate(d2, add.uid)!;
    expect(at.owner).toBe(choose.uid);
    expect(at.name).toBe('choose.0.sequence');
    expect(at.index).toBe(1);
    const d3 = removeBlock(d2, add.uid);
    expect(canonicalJson(draftToConfig('automation', d3, null, env.ctx, { id: '1' }))).toBe(canonicalJson(draftToConfig('automation', d, null, env.ctx, { id: '1' })));
    expect(canMove(d, d.triggers[0].uid, -1)).toBe(false);
    expect(canMove(d, d.triggers[0].uid, 1)).toBe(true);
    const m = moveBlock(d, d.triggers[0].uid, 1);
    expect(m.triggers.map((t) => (t as TriggerBlock).id)).toEqual(['morning', 'night']);
    expect(moveBlock(m, m.triggers[1].uid, 1).triggers.map((t) => (t as TriggerBlock).id)).toEqual(['morning', 'night']);
    const dup = duplicateBlock(d, d.triggers[0].uid);
    expect(dup.triggers).toHaveLength(3);
    expect(new Set(dup.triggers.map((t) => t.uid)).size).toBe(3);
    expect(stripUids(dup.triggers[0])).toEqual(stripUids(dup.triggers[1]));
  });

  test('else / default lists are created on the first add', async () => {
    const { env, store } = await envFor();
    const d = draftOf(store, 'automation.alarm_morning'); // an `if` with else
    const ifB = d.actions[1] as ActionBlock & { type: 'if' };
    expect(ifB.else).toHaveLength(1);
    const blank: AutomationDraft = { alias: 'x', description: '', mode: 'single', max: null, triggers: [], conditions: [], actions: [makeBlock('action', 'if', env)! as ActionBlock, makeBlock('action', 'choose', env)! as ActionBlock] };
    const i = blank.actions[0] as ActionBlock & { type: 'if' };
    const c = blank.actions[1] as ActionBlock & { type: 'choose' };
    expect(i.else).toBeNull();
    expect(resolveList(blank, i.uid, 'else')).toBeNull();
    const withElse = addBlock(blank, i.uid, 'else', makeBlock('action', 'delay', env)!);
    expect((withElse.actions[0] as ActionBlock & { type: 'if' }).else).toHaveLength(1);
    const withDefault = addBlock(blank, c.uid, 'default', makeBlock('action', 'stop', env)!);
    expect((withDefault.actions[1] as ActionBlock & { type: 'choose' }).default).toHaveLength(1);
  });

  test('moving a locked block, and a block that contains locked blocks, keeps every raw byte-identical (the CR §6.2 invariant)', async () => {
    const { env, store } = await envFor();
    const id = store.idOf('automation.salon_buttons');
    const stored = store.storedConfig('automation', id)!;
    const d = draftOf(store, 'automation.salon_buttons');
    expect(lockedBlocks(d)).toHaveLength(2);
    const swapped = moveBlock(d, d.triggers[0].uid, 1);
    expect(swapped.triggers.map((t) => (t.raw as { type: string }).type)).toEqual(['button_1_long', 'button_1_short']);
    const cfg = draftToConfig('automation', swapped, stored, env.ctx);
    expect((cfg.triggers as unknown[])[0]).toEqual((stored.triggers as unknown[])[1]);
    expect((cfg.triggers as unknown[])[1]).toEqual((stored.triggers as unknown[])[0]);
    expect(cfg.actions).toEqual(stored.actions);
    const dupd = duplicateBlock(d, d.triggers[0].uid);
    expect(dupd.triggers).toHaveLength(3);
    expect(dupd.triggers[1].kind).toBe('locked');
    expect(canonicalJson(emitBlock(dupd.triggers[1], 'trigger', env.ctx))).toBe(canonicalJson(stored.triggers && (stored.triggers as unknown[])[0]));
    const gone = removeBlock(d, d.triggers[1].uid);
    expect(lockedBlocks(gone)).toHaveLength(1);
    // no save-profile change: the locked blocks are the stored item's
    expect(saveRoute(false, swapped, d)).toBe('replace');
    expect(changedLockedBlocks(gone, d)).toHaveLength(0);
  });

  test('drag and drop: within a list, across lists of the same kind, never across kinds and never into itself', async () => {
    const { env, store } = await envFor();
    const d = draftOf(store, 'automation.alarm_morning');
    const ifB = d.actions[1] as ActionBlock & { type: 'if' };
    const first = d.actions[0];
    const moved = moveBlockTo(d, first.uid, ifB.uid, 'then', 0)!;
    expect(locate(moved, first.uid)!.name).toBe('then');
    expect(moved.actions).toHaveLength(1);
    const afterIf = moveBlockTo(d, first.uid, ROOT, 'actions', 2)!; // to the end: index adjusted for the removal
    expect(afterIf.actions.map((a) => a.uid)).toEqual([ifB.uid, first.uid]);
    expect(moveBlockTo(d, first.uid, ROOT, 'conditions', 0)).toBeNull(); // an action never becomes a condition
    expect(moveBlockTo(d, ifB.uid, ifB.uid, 'then', 0)).toBeNull(); // not into itself
    const nested = addBlock(d, ifB.uid, 'then', makeBlock('action', 'if', env)!);
    const inner = (nested.actions[1] as ActionBlock & { type: 'if' }).then.at(-1)!;
    expect(moveBlockTo(nested, ifB.uid, inner.uid, 'then', 0)).toBeNull(); // not into its own descendant
    expect(subtreeUids(ifB).has(ifB.then[0].uid)).toBe(true);
  });

  test('updateBlock finds any block, the inner condition of a condition step included', async () => {
    const { env } = await envFor();
    const step = makeBlock('action', 'condition', env)! as ActionBlock & { type: 'condition' };
    const d: AutomationDraft = { alias: 'x', description: '', mode: 'single', max: null, triggers: [], conditions: [], actions: [step] };
    const d2 = updateBlock(d, step.condition.uid, (b) => { (b as { state: string }).state = 'off'; });
    expect(((d2.actions[0] as ActionBlock & { type: 'condition' }).condition as unknown as { state: string }).state).toBe('off');
    expect(allLists(d).map((l) => `${l.owner}.${l.name}`)).toEqual([`${ROOT}.triggers`, `${ROOT}.conditions`, `${ROOT}.actions`]);
    expect(stepCount(d2)).toBe(1);
  });

  test('uids are fresh after a template or a duplicate, and the caps stop the add buttons', async () => {
    const { store } = await envFor();
    const t = (await store.templates()).templates[0];
    const a = freshDraftUids(clone(t.draft));
    expect(walkDraft(a).every((w, i) => w.block.uid !== walkDraft(t.draft)[i].block.uid)).toBe(true);
    const d = draftOf(store, 'automation.hall_motion');
    expect(capReached(d, 'trigger', 20)).toBe(true);
    expect(capReached(d, 'trigger', 19)).toBe(false);
    expect(capReached(d, 'condition', 20)).toBe(true);
    expect(capReached(d, 'action', 0)).toBe(false);
  });
});

test.describe('editors: the type chooser and block factories', () => {
  test('every type of every section builds a well-formed typed block with a sentence, and emits without throwing', async () => {
    const { env } = await envFor();
    for (const [section, types] of [['trigger', TRIGGER_TYPES], ['condition', CONDITION_TYPES], ['action', ACTION_TYPES]] as const) {
      for (const t of types) {
        const b = makeBlock(section, t.id, env);
        expect(b, `${section}:${t.id}`).not.toBeNull();
        expect(b!.kind).toBe('typed');
        expect(b!.raw).toBeNull();
        expect(typeof b!.sentence).toBe('string');
        expect(() => emitBlock(b!, section, env.ctx), `${section}:${t.id}`).not.toThrow();
        expect(blockIcon(b!, section)).toBeTruthy();
      }
    }
    expect(makeBlock('action', 'nope', env)).toBeNull();
  });

  test('a new automation from scratch fails validation exactly where the pickers are empty; filling them makes it valid and saves through the mock', async () => {
    const { env, store } = await envFor();
    let d: AutomationDraft = { alias: '', description: '', mode: 'single', max: null, triggers: [], conditions: [], actions: [] };
    expect(validateDraft('automation', d).map((i) => i.code).sort()).toEqual(['action_required', 'alias_required', 'trigger_required']);
    d = addBlock(d, ROOT, 'triggers', makeBlock('trigger', 'state', env)!);
    d = addBlock(d, ROOT, 'actions', makeBlock('action', 'device', env)!);
    expect(validateDraft('automation', d).map((i) => i.code)).toContain('entity_required');
    d.alias = 'בדיקה';
    d = updateBlock(d, d.triggers[0].uid, (b) => { (b as unknown as { entity_ids: string[] }).entity_ids = ['binary_sensor.hall_motion']; });
    d = updateBlock(d, d.actions[0].uid, (b) => { (b as unknown as { entity_ids: string[] }).entity_ids = ['light.hall']; });
    expect(validateDraft('automation', d, { shabbatSensor: SHABBAT_SENSOR })).toEqual([]);
    const r = await createItem('automation', d);
    expect(r.item!.name).toBe('בדיקה');
    expect(canonicalJson(store.storedConfig('automation', r.item!.id))).toContain('binary_sensor.hall_motion');
    void env;
  });

  test('the type chooser hides what does not apply: "מה הפעיל" needs a trigger id, "שבת וחג" needs the sensor, scenes and scripts need some', async () => {
    const { env, store } = await envFor();
    const blank: AutomationDraft = { alias: '', description: '', mode: 'single', max: null, triggers: [], conditions: [], actions: [] };
    const trig = CONDITION_TYPES.find((t) => t.id === 'trigger')!;
    const sab = CONDITION_TYPES.find((t) => t.id === 'shabbat')!;
    expect(trig.available!(env, blank)).toBe(false);
    expect(trig.available!(env, draftOf(store, 'automation.bed_ac_clock'))).toBe(true);
    expect(sab.available!(env, blank)).toBe(true);
    expect(sab.available!({ ...env, catalog: { ...env.catalog, shabbat_sensor: null } }, blank)).toBe(false);
    expect(ACTION_TYPES.find((t) => t.id === 'scene')!.available!({ ...env, catalog: { ...env.catalog, scenes: [] } }, blank)).toBe(false);
    expect(ACTION_TYPES.find((t) => t.id === 'notify')!.available!(env, blank)).toBe(true);
    const sens = ACTION_TYPES.find((t) => t.id === 'sensitive')!;
    expect(sens.sensitive).toBe(true);
    const b = makeBlock('action', 'sensitive', env)! as ActionBlock & { type: 'service' };
    expect(b.action).toBe('alarm_control_panel.alarm_arm_away');
    expect(sensitiveSteps({ ...blank, actions: [{ ...b, entity_ids: ['alarm_control_panel.home'] }] }, (id) => env.byId.get(id)?.class ?? null)).toHaveLength(1);
  });
});

test.describe('editors: presence, states, icons', () => {
  test('presence is read from the typed blocks the model has: everyone left = zone.home below 1, someone home = persons to home', async () => {
    const { env, store } = await envFor();
    expect(presenceOf(draftOf(store, 'automation.all_left').triggers[0])).toBe('all_left');
    const p = makeBlock('trigger', 'presence', env)!;
    expect(presenceOf(p)).toBe('all_left');
    expect(presenceOf(draftOf(store, 'automation.hall_motion').triggers[0])).toBeNull();
    const home = { ...makeBlock('trigger', 'state', env)!, entity_ids: personIds(env), to: 'home' } as TriggerBlock;
    expect(personIds(env)).toEqual(['person.yoni', 'person.dana']);
    expect(presenceOf(home)).toBe('someone_home');
    expect(presenceOf({ ...home, entity_ids: ['person.yoni', 'light.hall'] } as TriggerBlock)).toBeNull();
  });

  test('state choices follow the domain and the sensor kind; icons follow the entity', () => {
    expect(stateChoices('binary_sensor.hall_motion').map((c) => c.label)).toEqual(['זוהתה תנועה', 'אין תנועה']);
    expect(stateChoices('binary_sensor.front_door')[0].label).toBe('פתוח');
    expect(stateChoices('binary_sensor.leak')[0].label).toBe('יש מים');
    expect(stateChoices('person.yoni').map((c) => c.value)).toEqual(['home', 'not_home']);
    expect(stateChoices('climate.salon').map((c) => c.value)).toContain('heat_cool');
    expect(stateChoices('lock.front').map((c) => c.value)).toEqual(['locked', 'unlocked']);
    expect(stateChoices(undefined).map((c) => c.value)).toEqual(['on', 'off']);
    expect(entityIcon('binary_sensor.hall_motion')).toBe('motion');
    expect(entityIcon('cover.gate')).toBe('gate');
    expect(entityIcon('cover.salon_shutter')).toBe('blind');
    expect(entityIcon('alarm_control_panel.home')).toBe('alarm');
    expect(entityIcon('person.dana')).toBe('users');
  });

  test('locked blocks have a "why" line per reason and an icon; typed blocks have their own', async () => {
    const { env, store } = await envFor();
    const d = draftOf(store, 'automation.light_by_lux');
    const locked = lockedBlocks(d);
    expect(locked.length).toBeGreaterThan(0);
    for (const b of locked) { expect(lockedWhy(b)).toMatch(/נשמר|לא מוצג/); expect(blockIcon(b, 'trigger')).toBeTruthy(); }
    expect(blockIcon(d.triggers[0], 'trigger')).toBe('template');
    expect(blockIcon(draftOf(store, 'automation.entry_sunset').triggers[0], 'trigger')).toBe('sunset');
    expect(blockIcon(makeBlock('action', 'delay', env)!, 'action')).toBe('timer');
  });
});

test.describe('editors: the code view', () => {
  test('codeLines is exactly JSON.stringify(value, null, 2), line for line, for every fixture item', async () => {
    const { store } = await envFor();
    for (const kindId of [...['automation.hall_motion', 'automation.salon_buttons', 'automation.light_by_lux', 'automation.alarm_morning', 'automation.leak_alert'].map((e) => ['automation', store.idOf(e)] as const),
      ['script', store.idOf('script.shutters')] as const, ['scene', store.idOf('scene.arx_welcome')] as const]) {
      const cfg = store.storedConfig(kindId[0], kindId[1])!;
      expect(codeLines(cfg, new Set()).map((l) => l.text).join('\n'), `${kindId[0]}:${kindId[1]}`).toBe(JSON.stringify(cfg, null, 2));
    }
    expect(codeLines({ a: [], b: {} }, new Set()).map((l) => l.text).join('\n')).toBe(JSON.stringify({ a: [], b: {} }, null, 2));
  });

  test('locked blocks are marked line by line, in the serialiser and (any formatting) in the scanner', async () => {
    const { env, store } = await envFor();
    const id = store.idOf('automation.salon_buttons');
    const cfg = store.storedConfig('automation', id)!;
    const d = draftOf(store, 'automation.salon_buttons');
    const fps = lockedFingerprints(d);
    expect(fps.size).toBe(2);
    const lines = codeLines(cfg, fps);
    const lockedLines = lines.map((l, i) => (l.locked ? i : -1)).filter((i) => i >= 0);
    expect(lockedLines.length).toBe(2 * 7); // two device triggers of 7 lines each: { trigger, domain, device_id, type, id }
    expect(lines.filter((l) => l.locked).every((l) => /^\s{4,}/.test(l.text))).toBe(true);
    const text = JSON.stringify(cfg, null, 2);
    const ranges = lockedLineRanges(text, fps);
    expect(ranges).toHaveLength(2);
    expect(ranges.map((r) => r.to - r.from + 1)).toEqual([7, 7]);
    // the same item compact on one line each: still found
    const compact = JSON.stringify(cfg).replace(/\},\{/g, '},\n{');
    expect(lockedLineRanges(compact, fps).length).toBe(2);
    expect(lockedLineRanges('{ not json', fps)).toEqual([]);
    void env;
  });

  test('the scanner equals JSON.parse and reports where it fails, in Hebrew', () => {
    const ok = scanJson('{"a":[1,2,{"b":"ג"}],"c":null,"d":true}');
    expect(ok.ok && ok.value).toEqual(JSON.parse('{"a":[1,2,{"b":"ג"}],"c":null,"d":true}'));
    const bad = scanJson('{\n  "a": 1,\n  "b": \n}');
    expect(bad.ok).toBe(false);
    if (!bad.ok) { expect(bad.line).toBe(4); expect(scanErrorText(bad)).toContain('שורה 4'); }
    const comma = scanJson('{"a": 1 "b": 2}');
    expect(!comma.ok && comma.message).toContain('צפוי ","');
    const trailing = scanJson('{"a": 1} x');
    expect(!trailing.ok && trailing.message).toContain('אחרי סוף');
    const open = scanJson('{"a": [1, 2');
    expect(!open.ok && open.message).toContain('סוף הקוד');
    expect(scanJson('"just a string"').ok).toBe(true);
    expect(scanJson('').ok).toBe(false);
  });

  test('builder -> code -> builder keeps every locked block and typed value (the draft round trip of the toggle)', async () => {
    const { env, store } = await envFor();
    for (const e of ['automation.salon_buttons', 'automation.light_by_lux', 'automation.vacation_freeze', 'automation.boiler_morning', 'automation.hall_motion']) {
      const id = store.idOf(e);
      const stored = store.storedConfig('automation', id)!;
      const d = draftOf(store, e);
      const text = draftToCode('automation', d, stored, env.ctx);
      expect(text, e).toBe(JSON.stringify(stored, null, 2));
      const back = codeToDraft('automation', text, env.ctx);
      expect(back.ok).toBe(true);
      if (!back.ok) continue;
      expect(canonicalJson(draftToConfig('automation', back.draft, stored, env.ctx)), e).toBe(canonicalJson(stored));
      expect(lockedBlocks(back.draft).map((b) => b.fingerprint).sort(), e).toEqual(lockedBlocks(d).map((b) => b.fingerprint).sort());
      expect(changedLockedBlocks(back.draft, d)).toHaveLength(0);
    }
  });

  test('an untouched draft writes back exactly the stored item for every fixture item in the new schema; the legacy one is rewritten only when saved', async () => {
    const { env, store } = await envFor();
    const all = (await store.list()).items.filter((i) => i.source === 'ui');
    expect(all.length).toBeGreaterThanOrEqual(15);
    for (const it of all) {
      const stored = store.storedConfig(it.kind, it.id)!;
      const d = store.draftFor(it.kind, it.id);
      const out = draftToConfig(it.kind, d, stored, env.ctx);
      if (it.id === store.idOf('automation.alarm_morning')) {
        expect(JSON.stringify(out)).not.toContain('"platform"'); // pre-2024.10 keys -> the new schema, on save only
        expect(out.triggers).toBeTruthy();
        continue;
      }
      expect(canonicalJson(out), `${it.kind}:${it.entity_id}`).toBe(canonicalJson(stored));
    }
  });

  test('a typed value changed in the code view is a builder save; a locked block changed is a code save (needs the code view permission)', async () => {
    const { env, store } = await envFor();
    const id = store.idOf('automation.light_by_lux');
    const stored = store.storedConfig('automation', id)!;
    const d = draftOf(store, 'automation.light_by_lux');
    const edited = JSON.parse(JSON.stringify(stored)) as Record<string, unknown>;
    ((edited.conditions as Array<Record<string, unknown>>)[0]).after = '16:00:00';
    const typedEdit = codeToDraft('automation', JSON.stringify(edited), env.ctx);
    expect(typedEdit.ok && saveRoute(false, typedEdit.draft, d)).toBe('replace');
    ((edited.triggers as Array<Record<string, unknown>>)[0]).value_template = '{{ 1 == 1 }}';
    const lockedEdit = codeToDraft('automation', JSON.stringify(edited), env.ctx);
    expect(lockedEdit.ok && saveRoute(false, lockedEdit.draft, d)).toBe('code');
    expect(saveRoute(true, d, null)).toBe('create');
  });

  test('a locked template text is editable inline: the raw changes, the fingerprint changes, the save route becomes the code route', async () => {
    const { env, store } = await envFor();
    const d = draftOf(store, 'automation.light_by_lux');
    const t = d.triggers[0];
    expect(t.kind === 'locked' && t.reason).toBe('template');
    if (t.kind !== 'locked') return;
    expect(t.template_text).toContain("states('sensor.lux')");
    const next = withTemplateText(t, "{{ states('sensor.lux') | int < 40 }}");
    expect(next.fingerprint).not.toBe(t.fingerprint);
    expect(next.fingerprint).toBe(fingerprintOf(next.raw));
    expect((next.raw as { value_template: string }).value_template).toBe("{{ states('sensor.lux') | int < 40 }}");
    expect((next.raw as { trigger: string }).trigger).toBe('template');
    const edited = { ...d, triggers: [next] } as AutomationDraft;
    expect(saveRoute(false, edited, d)).toBe('code');
    expect(replaceFirstTemplate({ a: 'x', b: ['{{ y }}', '{{ z }}'] }, 'NEW')).toEqual({ a: 'x', b: ['NEW', '{{ z }}'] });
    void env;
  });

  test('the stored config reaches the code view only when the server sends it (`ItemDetail.config`)', async () => {
    const { store } = await envFor();
    const detail = await store.get('automation', store.idOf('automation.hall_motion'));
    expect(storedConfigOf(detail)).toBeNull();
    expect(storedConfigOf({ ...detail, config: { alias: 'x' } } as never)).toEqual({ alias: 'x' });
    expect(detail.extras).toContain('trace');
  });
});

test.describe('editors: the save paths against the mock (what the buttons call)', () => {
  test('replace with the server revision; a stale revision is the conflict (409 with the current item) and diffDrafts shows what differs', async () => {
    const { env, store } = await envFor();
    const id = store.idOf('automation.hall_motion');
    const detail = await store.get('automation', id);
    const mine = clone(detail.draft) as AutomationDraft;
    mine.alias = 'תנועה בפרוזדור (שלי)';
    store.conflictNext = true;
    let conflict: ApiError | null = null;
    try { await replaceItem('automation', id, mine, detail.revision); } catch (e) { conflict = e as ApiError; }
    expect(conflict?.code).toBe('item_changed');
    const f = mapAutomationError(conflict);
    expect(f.kind).toBe('conflict');
    expect(f.current?.draft).toBeTruthy();
    const rows = diffDrafts('automation', mine, f.current!.draft, env.ctx);
    expect(rows.map((r) => r.group)).toEqual(expect.arrayContaining(['שם', 'תיאור']));
    expect(rows.find((r) => r.group === 'שם')).toMatchObject({ change: 'changed', mine: 'תנועה בפרוזדור (שלי)', theirs: 'תנועה בפרוזדור' });
    // "keep mine" = the same draft on the current revision
    const kept = await replaceItem('automation', id, mine, f.current!.revision);
    expect(kept.item!.name).toBe('תנועה בפרוזדור (שלי)');
  });

  test('diffDrafts pairs identical blocks, reports changed / added / removed ones, and handles scripts and scenes', async () => {
    const { env, store } = await envFor();
    const d = draftOf(store, 'automation.hall_motion');
    const other = clone(d);
    expect(diffDrafts('automation', d, other, env.ctx)).toEqual([]);
    other.actions = other.actions.slice(0, 2);
    other.conditions = [];
    const mine = clone(d);
    mine.actions = [...mine.actions, makeBlock('action', 'stop', env)! as ActionBlock];
    const rows = diffDrafts('automation', mine, other, env.ctx);
    expect(rows.filter((r) => r.group === 'אז').map((r) => r.change).sort()).toEqual(['added', 'added']);
    expect(rows.filter((r) => r.group === 'אם').map((r) => r.change)).toEqual(['added']);
    expect(diffDrafts('automation', other, mine, env.ctx).filter((r) => r.group === 'אז').map((r) => r.change)).toEqual(['removed', 'removed']);
    const sc = store.draftFor('scene', store.idOf('scene.arx_welcome')) as SceneDraft;
    const sc2 = clone(sc);
    sc2.members[0].attributes = { ...sc2.members[0].attributes, brightness: 10 };
    sc2.members.pop();
    const srows = diffDrafts('scene', sc2, sc, env.ctx);
    expect(srows.map((r) => r.change).sort()).toEqual(['changed', 'removed']);
    const sp = store.draftFor('script', store.idOf('script.shutters')) as ScriptDraft;
    const sp2 = clone(sp);
    sp2.fields.pop();
    expect(diffDrafts('script', sp2, sp, env.ctx).map((r) => r.group)).toEqual(['שדות']);
  });

  test('a household editor adding a sensitive step without the grant is refused with "אין לך הרשאה", before and after the server says it', async () => {
    const { env, store } = await envFor('household');
    const id = store.idOf('automation.hall_motion');
    const detail = await store.get('automation', id);
    // the caller's grants: door.unlock only. An alarm step needs alarm.disarm: the preview says so per step, the save refuses it
    const d = clone(detail.draft) as AutomationDraft;
    const alarm = { ...(makeBlock('action', 'sensitive', env)! as ActionBlock & { type: 'service' }), entity_ids: ['alarm_control_panel.home'] };
    d.actions.push(alarm);
    // the household catalogue is scoped: the alarm panel is on the ground floor, so even the picker would not offer it; the contract's refusal is the second wall
    expect(env.byId.has('alarm_control_panel.home')).toBe(false);
    const preview = await store.preview({ kind: 'automation', id, draft: d });
    expect(preview.sensitive_steps.some((s) => !s.granted)).toBe(true);
    let err: ApiError | null = null;
    try { await replaceItem('automation', id, d, detail.revision); } catch (e) { err = e as ApiError; }
    expect(err?.status).toBe(403);
    expect(['grant_required', 'entity_not_controllable']).toContain(err?.code);
    const f = mapAutomationError(err);
    expect(f.message).toMatch(/אין לך הרשאה|הרשאת שליטה/);
    expect(grantText('alarm_control_panel.alarm_disarm', 'אזעקה')).toBe('אין לך הרשאה לנטרול ב־אזעקה');
    expect(grantNoun('alarm_control_panel.alarm_arm_away')).toBe('דריכה');
    expect(grantNoun('lock.unlock')).toBe('פתיחת מנעול');
    expect(grantNoun('cover.close_cover')).toBe('סגירת שער');
    expect(grantNoun('light.turn_on')).toBe('שליטה');
  });

  test('delegation off: the household editor can preview but the save is refused; the installer is not affected; a locked change needs the code route', async () => {
    const { env, store } = await envFor('household');
    store.delegation = false;
    const status = await store.status();
    expect(status.write_block).toBe('delegation_off');
    expect(status.delegation).toEqual({ on: false, needed: true });
    const id = store.idOf('automation.hall_motion');
    const detail = await store.get('automation', id);
    expect(detail.read_only?.reasons[0].code).toBe('delegation_off');
    const d = clone(detail.draft) as AutomationDraft;
    d.alias = 'שם חדש';
    await expect(store.preview({ kind: 'automation', id, draft: d })).resolves.toMatchObject({ valid: true });
    const e = await replaceItem('automation', id, d, detail.revision).catch((x) => x as ApiError);
    expect((e as ApiError).code).toBe('delegation_off');
    const inst = resetAutomationsMock({ user: 'installer', delegation: false });
    const idI = inst.idOf('automation.hall_motion');
    const detI = await inst.get('automation', idI);
    const dI = clone(detI.draft) as AutomationDraft;
    dI.alias = 'שם חדש';
    await expect(replaceItem('automation', idI, dI, detI.revision)).resolves.toBeTruthy();
    void env;
  });

  test('a code save with a changed locked block works for the installer and is refused to everyone else (code_view_required / not_ha_admin)', async () => {
    const { env, store } = await envFor();
    const id = store.idOf('automation.salon_buttons');
    const stored = store.storedConfig('automation', id)!;
    const edited = JSON.parse(JSON.stringify(stored)) as Record<string, unknown>;
    ((edited.triggers as Array<Record<string, unknown>>)[0]).type = 'button_2_short';
    const detail = await store.get('automation', id);
    const ok = await saveCode('automation', id, edited, detail.revision);
    expect(ok.item!.locked_count).toBe(2);
    store.setUser('household');
    const e = await saveCode('automation', id, edited, ok.item!.revision).catch((x) => x as ApiError);
    expect((e as ApiError).code).toBe('code_view_required');
    void env;
  });
});

test.describe('editors: header chips, issues, scene members, script fields', () => {
  test('place chips: the item\'s floors and areas (three areas and "N+"), or the targets of a new draft', async () => {
    const { env, store } = await envFor();
    const detail = await store.get('automation', store.idOf('automation.all_left'));
    const chips = placeChips(detail, detail.draft, env);
    expect(chips.floors).toBe('קומת קרקע · קומה 1');
    expect(chips.areas.split(' · ')).toHaveLength(3);
    expect(chips.more).toBeGreaterThan(0);
    const fresh = draftOf(store, 'automation.entry_sunset');
    expect(placeChips(null, fresh, env)).toMatchObject({ floors: 'קומת קרקע', areas: 'כניסה', more: 0 });
  });

  test('issues are merged by path and code and labelled by section; saves of canonical forms are stable', async () => {
    const a = [{ path: 'actions.0', code: 'entity_required', message: 'בחרו מכשיר' }];
    const b = [{ path: 'actions.0', code: 'entity_required', message: 'בחרו מכשיר' }, { path: 'alias', code: 'alias_required', message: 'תנו שם' }];
    expect(mergeIssues(a, b)).toHaveLength(2);
    expect(issueLine(a[0])).toEqual({ where: 'אז', what: 'בחרו מכשיר' });
    expect(issueLine(b[1])).toEqual({ where: 'שם', what: 'תנו שם' });
    expect(issueLine({ path: 'triggers[1]', code: 'x', message: 'm' }).where).toBe('כאשר');
    expect(issueLine({ path: 'fields.0', code: 'x', message: 'm' }).where).toBe('שדות');
    const { env, store } = await envFor();
    const d = draftOf(store, 'automation.hall_motion');
    expect(canonicalOf('automation', d, env.ctx, d.alias ? store.idOf('automation.hall_motion') : null)).toBe(canonicalOf('automation', clone(d), env.ctx, store.idOf('automation.hall_motion')));
    const changed = clone(d);
    changed.alias = 'אחר';
    expect(canonicalOf('automation', changed, env.ctx)).not.toBe(canonicalOf('automation', d, env.ctx));
  });

  test('scene member fields by domain: brightness and volume convert, an off light drops its colour, climate keeps its mode', async () => {
    const { store } = await envFor();
    const sc = store.draftFor('scene', store.idOf('scene.arx_welcome')) as SceneDraft;
    const light = sc.members.find((m) => m.entity_id === 'light.entry')!;
    const bf = memberFields('light.entry').find((f) => f.key === 'brightness')!;
    expect(memberNumber(light, bf)).toBe(80);
    const half = setMemberField(light, bf, 50);
    expect(half.attributes.brightness).toBe(128);
    expect(memberNumber(half, bf)).toBe(50);
    const off = setMemberField(half, memberFields('light.entry')[0], 'off');
    expect(off.state).toBe('off');
    expect(off.attributes.brightness).toBeUndefined();
    expect(off.attributes.color_temp_kelvin).toBeUndefined();
    const tv = sc.members.find((m) => m.entity_id === 'media_player.salon_tv')!;
    const vf = memberFields('media_player.salon_tv').find((f) => f.key === 'volume_level')!;
    expect(setMemberField(tv, vf, 30).attributes.volume_level).toBe(0.3);
    expect(memberNumber(setMemberField(tv, vf, 30), vf)).toBe(30);
    expect(setMemberField(light, bf, null).attributes.brightness).toBeUndefined();
    expect(memberFields('cover.salon_shutter').map((f) => f.key)).toEqual(['state', 'current_position']);
    expect(memberFields('climate.salon').find((f) => f.key === 'state')!.options!.map((o) => o.value)).toContain('cool');
    expect(memberFields('switch.irrigation')).toHaveLength(1);
  });

  test('script fields: new fields per kind, a one-line summary, the locked selector kept', async () => {
    const { store } = await envFor();
    const sp = store.draftFor('script', store.idOf('script.shutters')) as ScriptDraft;
    expect(sp.fields.map((f) => f.selector.kind)).toEqual(['number', 'entity', 'boolean', 'select']);
    expect(fieldSummary(sp.fields[0])).toBe('מספר 0–100%');
    expect(fieldSummary(sp.fields[3])).toContain('שניהם');
    const f = newField('select', ['field_1']);
    expect(f.key).toBe('field_2');
    expect(f.selector).toMatchObject({ kind: 'select' });
    expect(fieldSummary({ ...f, selector: { kind: 'locked', raw: {} } })).toContain('נעול');
    expect(validateDraft('script', { ...sp, fields: [...sp.fields, { ...newField('number', []), key: 'Bad Key', name: '' }] }).map((i) => i.code)).toEqual(expect.arrayContaining(['field_key_invalid', 'alias_required']));
  });

  test('every typed block type of the contract has a form in the registry (a later typed reason adds one entry, nothing else)', async () => {
    const forms = await import('../src/screens/automation-block-forms');
    for (const key of forms.TYPED_FORM_KEYS) expect(typeof forms.FORMS[key], key).toBe('function');
    expect(Object.keys(forms.FORMS).sort()).toEqual([...forms.TYPED_FORM_KEYS].sort());
    // and the typed types the model can produce are exactly those keys
    const { store } = await envFor();
    const seen = new Set<string>();
    for (const e of ['automation.entry_sunset', 'automation.hall_motion', 'automation.all_left', 'automation.door_open', 'automation.bed_ac_clock', 'automation.boiler_morning', 'automation.alarm_morning', 'automation.leak_alert']) {
      for (const w of walkDraft(draftOf(store, e))) if (w.block.kind === 'typed') seen.add(`${w.section}:${(w.block as Block & { type: string }).type}`);
    }
    for (const k of seen) expect(forms.FORMS[k], `a form for ${k}`).toBeTruthy();
  });
});
