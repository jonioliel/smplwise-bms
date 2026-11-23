import { test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAPS, configToDraft, validateDraft, walkDraft, type AnyDraft, type ItemKind, type ModelContext } from '../src/api/automations';
import { expectRecorded } from './cx-record';

// COMPLEXITY-3-2480: characterisation of validateDraft (api/automations.ts) before its split. The raw triggers / conditions / actions of
// the 2450 parse records (tests/fixtures/cx/parse-*.json, inputs only) are read into automations and scripts through configToDraft, next
// to hand-made scenes, scripts with fields and drafts at and over every cap; each draft goes through every option set. The answers must
// equal the record taken from the unsplit function (tests/fixtures/cx/validate-draft.json). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-cx-validate-draft-2480.spec.ts --workers=1

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'cx');
const rawsOf = (name: string): unknown[] => {
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const r of JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8')) as Array<{ raw: unknown }>) {
    const key = JSON.stringify(r.raw);
    if (!seen.has(key)) { seen.add(key); out.push(r.raw); }
  }
  return out;
};
const TRIGGERS = rawsOf('parse-trigger');
const CONDITIONS = rawsOf('parse-condition');
const ACTIONS = rawsOf('parse-action');

const ON = { action: 'light.turn_on', target: { entity_id: ['light.hall'] } };
const STATE = { trigger: 'state', entity_id: 'light.hall', to: 'on', id: 'a' };
const auto = (o: Record<string, unknown> = {}) => ({ alias: 'ערב', description: '', triggers: [STATE], conditions: [], actions: [ON], ...o });
const nest = (depth: number): unknown => (depth === 0 ? ON : { if: [{ condition: 'sun', after: 'sunset' }], then: [nest(depth - 1)] });
const many = <T>(n: number, f: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => f(i));

const AUTOMATIONS: unknown[] = [
  {}, auto(), auto({ alias: '' }), auto({ alias: '   ' }), auto({ alias: 'א'.repeat(CAPS.alias_max) }), auto({ alias: 'א'.repeat(CAPS.alias_max + 1) }),
  auto({ description: 'x'.repeat(CAPS.description_max) }), auto({ description: 'x'.repeat(CAPS.description_max + 1) }), auto({ triggers: [] }), auto({ actions: [] }),
  auto({ triggers: many(CAPS.triggers_max, (i) => ({ ...STATE, id: `t${i}` })) }), auto({ triggers: many(CAPS.triggers_max + 1, (i) => ({ ...STATE, id: `t${i}` })) }),
  auto({ conditions: many(CAPS.conditions_max + 1, () => ({ condition: 'sun', after: 'sunset' })) }), auto({ actions: many(CAPS.steps_max, () => ON) }),
  auto({ actions: many(CAPS.steps_max + 1, () => ON) }), auto({ actions: [nest(CAPS.depth_max)] }), auto({ actions: [nest(CAPS.depth_max + 1)] }), auto({ actions: [nest(CAPS.depth_max + 3)] }),
  auto({ actions: [{ action: 'light.turn_on', target: { entity_id: many(CAPS.targets_max + 1, (i) => `light.l${i}`) } }] }),
  auto({ triggers: [STATE, { ...STATE, to: 'off' }] }), auto({ triggers: [STATE, { trigger: 'device', device_id: 'd', domain: 'mqtt', type: 'action', subtype: 'single', id: 'a' }] }),
  auto({ triggers: [STATE], conditions: [{ condition: 'trigger', id: ['a', 'zz'] }] }), auto({ triggers: [STATE], conditions: [{ condition: 'trigger', id: [] }] }),
  auto({ actions: [{ choose: many(CAPS.choose_options_max + 1, () => ({ conditions: [{ condition: 'sun', after: 'sunset' }], sequence: [ON] })) }] }),
  auto({ actions: [{ repeat: { count: 1001, sequence: [ON] } }, { repeat: { count: 1000, sequence: [ON] } }] }),
  auto({ actions: [{ action: 'notify.mobile_app_yoni', data: { message: '  ' } }, { action: 'notify.mobile_app_dana', data: { message: 'x' } }, { action: 'notify.other_target', data: {} }] }),
  auto({ actions: [{ action: 'scene.turn_on', target: { entity_id: ['scene.a', 'scene.b'] } }, { action: 'script.turn_on' }, { action: 'automation.trigger', target: { entity_id: 'automation.a' } }] }),
  ...TRIGGERS.map((t) => auto({ triggers: [t] })),
  ...CONDITIONS.map((c) => auto({ conditions: [c] })),
  ...ACTIONS.map((a) => auto({ actions: [a] })),
];
const field = (o: Record<string, unknown> = {}) => ({ name: 'שדה', selector: { text: {} }, ...o });
const SCRIPTS: unknown[] = [
  {}, { alias: 'בוקר', sequence: [ON] }, { alias: 'בוקר', sequence: [] }, { alias: '', description: 'x'.repeat(CAPS.description_max + 1), sequence: [ON] },
  { alias: 'בוקר', sequence: [ON], fields: Object.fromEntries(many(CAPS.fields_max + 1, (i) => [`f${i}`, field()])) },
  { alias: 'בוקר', sequence: [ON], fields: { good_key: field(), 'Bad Key': field({ name: '' }), _x9: field({ name: ' ' }), '9no': field(), '': field() } },
  { alias: 'בוקר', sequence: [ON], fields: { n1: field({ selector: { number: { min: 1, max: 5 } } }), n2: field({ selector: { number: { min: 5, max: 5 } } }), n3: field({ selector: { number: { min: 6, max: 2 } } }) } },
  { alias: 'בוקר', sequence: [ON], fields: { s1: field({ selector: { select: { options: [] } } }), s2: field({ selector: { select: { options: ['a'] } } }), b: field({ selector: { boolean: {} } }), l: field({ selector: { x: 1, y: 2 } }) } },
  { alias: 'בוקר', sequence: many(CAPS.steps_max + 1, () => ON) }, { alias: 'בוקר', sequence: [nest(CAPS.depth_max + 1)] },
  ...ACTIONS.map((a) => ({ alias: 'תסריט', sequence: [a] })),
];
const member = (state: unknown, attrs: Record<string, unknown> = {}) => ({ state, ...attrs });
const SCENES: unknown[] = [
  {}, { name: 'סלון', entities: { 'light.a': 'on' } }, { name: '', entities: { 'light.a': 'on' } }, { name: ' ', entities: {} }, { name: 'א'.repeat(CAPS.alias_max + 1), entities: {} },
  { name: 'סלון', entities: Object.fromEntries(many(CAPS.members_max + 1, (i) => [`light.l${i}`, 'on'])) },
  { name: 'סלון', entities: { 'alarm_control_panel.home': 'armed_away', 'sensor.t': '21', 'lock.front': member('locked', { code: '1234' }), 'light.b': member(''), 'switch.c': null, 'cover.d': member('open', { api_key: 'k' }) } },
  { name: 'סלון', entities: { 'fan.a': member('on', { percentage: 40 }), 'climate.b': member('heat', { temperature: 22 }), 'media_player.c': member('playing', { password: 'x' }) } },
];

const OPTIONS: Array<[string, Parameters<typeof validateDraft>[2]]> = [
  ['none', undefined], ['empty', {}], ['shabbat', { shabbatSensor: 'binary_sensor.shabbat' }],
  ['strict', { shabbatSensor: 'binary_sensor.shabbat', notifyTargets: ['notify.mobile_app_yoni'], allowedActions: ['light.turn_on', 'notify.mobile_app_yoni', 'scene.turn_on'] }],
  ['no-targets', { notifyTargets: [], allowedActions: [] }], ['null-targets', { notifyTargets: null, shabbatSensor: null }],
];

// what an editor can leave in a typed block that a stored config never reads into (the parse locks it instead)
const EDITS: Record<string, Array<Record<string, unknown>>> = {
  'trigger:state': [{ entity_ids: [] }], 'trigger:numeric_state': [{ entity_ids: [], above: null, below: null }, { above: null }],
  'trigger:time': [{ at: '' }, { at: '24:00' }, { at: '7:05' }], 'trigger:time_pattern': [{ hours: null, minutes: null, seconds: null }, { hours: null, minutes: 0, seconds: null }],
  'condition:state': [{ entity_ids: [] }], 'condition:numeric_state': [{ above: null, below: null }], 'condition:time': [{ after: '25:00' }, { after: '', before: 'x' }, { after: null, before: null }],
  'condition:trigger': [{ ids: [] }, { ids: ['a', 'nope'] }], 'condition:and': [{ conditions: [] }], 'condition:or': [{ conditions: [] }], 'condition:not': [{ conditions: [] }],
  'action:service': [{ data: { password: 'x' } }, { data: { code: '1', api_key: 'k' } }, { data: { nested: [{ pin_code: 1 }] } }, { entity_ids: [] }, { data: {} }, { action: 'notify.mobile_app_yoni', role: 'notify', data: { message: 'x' } }],
  'action:delay': [{ delay: { hours: 0, minutes: 0, seconds: 0 } }, { delay: { hours: 0, minutes: 0, seconds: 1 } }], 'action:choose': [{ options: [] }],
  'action:if': [{ conditions: [], then: [] }, { then: [] }], 'action:repeat_count': [{ count: 0 }, { count: 1.5 }, { count: 1000 }, { count: 1001 }],
};
const edited = (draft: AnyDraft): AnyDraft[] => {
  const out: AnyDraft[] = [];
  if (walkDraft(draft).length > 8) return out; // the cap drafts (60 steps, 50 targets...) are not edited block by block: keeps the record small
  walkDraft(draft).forEach((w, k) => {
    if (w.block.kind !== 'typed') return;
    for (const patch of EDITS[`${w.section}:${(w.block as { type: string }).type}`] ?? []) {
      const copy = structuredClone(draft);
      Object.assign(walkDraft(copy)[k].block, patch);
      out.push(copy);
    }
  });
  return out;
};

test('validateDraft: every answer equals the record of the unsplit function', () => {
  const drafts: Array<[ItemKind, string, AnyDraft]> = [];
  const read = (kind: ItemKind, configs: unknown[], label: string, base: Omit<ModelContext, 'uid'> = {}) => configs.forEach((c, i) => {
    let n = 0;
    const ctx: ModelContext = { ...base, uid: () => `u${++n}` };
    const draft = configToDraft(kind, c, ctx).draft;
    drafts.push([kind, `${label}${i}`, draft]);
    edited(draft).forEach((e, j) => drafts.push([kind, `${label}${i}.e${j}`, e]));
  });
  read('automation', AUTOMATIONS, 'a');
  read('automation', [...CONDITIONS.map((c) => auto({ conditions: [c] })), auto({ conditions: [{ condition: 'state', entity_id: 'binary_sensor.shabbat', state: 'off' }] })], 's', { shabbatSensor: 'binary_sensor.shabbat' });
  read('script', SCRIPTS, 'c');
  read('scene', SCENES, 'n');
  const sc = configToDraft('script', SCRIPTS[1]).draft;
  drafts.push(['script', 'dup', { ...sc, fields: [{ key: 'a', name: 'א', required: false, default: undefined, selector: { kind: 'boolean' } }, { key: 'a', name: '', required: true, default: 1, selector: { kind: 'text' } }] }]);
  // an issue is recorded as "path code #n": n indexes the list of distinct messages (first seen first), the last element of the record
  const messages: string[] = [];
  const msg = (m: string) => { const k = messages.indexOf(m); return k >= 0 ? k : messages.push(m) - 1; };
  const out: unknown[] = drafts.flatMap(([kind, i, draft]) => OPTIONS.map(([o, opts]) => {
    const issues = opts === undefined ? validateDraft(kind, draft) : validateDraft(kind, draft, opts);
    return `${kind} ${i} ${o}: ${issues.map((x) => `${x.path} ${x.code} #${msg(x.message)}${Object.keys(x).length === 3 ? '' : ` ${JSON.stringify(x)}`}`).join(' | ')}`;
  }));
  out.push(messages);
  expectRecorded('validate-draft', out);
});
