import { test } from '@playwright/test';
import { BUILTIN_PALETTES, SCHEMA, schemaErrors } from '../src/design/palette';
import { expectRecorded } from './cx-record';

// COMPLEXITY-3-2480: characterisation of schemaErrors (design/palette.ts) before its split. The ten ready palettes as they are, the
// top-level shape broken in every way the function reads, and two palettes with every token of each scheme replaced by each kind of
// bad value (plus the opacity / blur ranges and unknown tokens); the answers must equal the record taken from the unsplit function
// (tests/fixtures/cx/schema-errors.json). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-cx-schema-errors-2480.spec.ts --workers=1

type Obj = Record<string, unknown>;
const clone = <T>(v: T): T => structuredClone(v);
const setPath = (o: Obj, path: string, v: unknown): Obj => {
  const keys = path.split('.');
  let x = o;
  for (const k of keys.slice(0, -1)) {
    if (!x[k] || typeof x[k] !== 'object') x[k] = {};
    x = x[k] as Obj;
  }
  if (v === undefined) delete x[keys[keys.length - 1]];
  else x[keys[keys.length - 1]] = v;
  return o;
};
const P0 = BUILTIN_PALETTES[0] as unknown as Obj;
const with_ = (path: string, v: unknown, from: Obj = P0): Obj => setPath(clone(from), path, v);

const TOP: Array<[string, unknown]> = [
  ['null', null], ['undefined', undefined], ['string', 'x'], ['array', []], ['number', 3], ['empty', {}],
  ['extra-keys', { ...clone(P0), a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }], ['id-missing', with_('id', undefined)], ['id-upper', with_('id', 'Ocean')], ['id-short', with_('id', 'a')],
  ['id-long', with_('id', `a${'b'.repeat(41)}`)], ['id-number', with_('id', 7)], ['id-custom', with_('id', 'custom-x')],
  ['name-missing', with_('name', undefined)], ['name-string', with_('name', 'x')], ['name-he-blank', with_('name.he', '  ')], ['name-en-number', with_('name.en', 3)],
  ['name-extra', with_('name.fr', 'x')], ['name-he-long', with_('name.he', 'א'.repeat(41))], ['name-en-40', with_('name.en', 'e'.repeat(40))], ['name-array', with_('name', [])],
  ['character-ok', with_('character', 'x'.repeat(200))], ['character-long', with_('character', 'x'.repeat(201))], ['character-number', with_('character', 5)], ['character-undefined', { ...clone(P0), character: undefined }],
  ['schemes-missing', with_('schemes', undefined)], ['schemes-one', with_('schemes.dark', undefined)], ['schemes-three', with_('schemes.dim', {})], ['schemes-renamed', { ...clone(P0), schemes: { light: {}, night: {} } }],
  ['schemes-string', with_('schemes', 'x')], ['scheme-null', with_('schemes.light', null)], ['scheme-array', with_('schemes.dark', [])], ['scheme-empty', with_('schemes.light', {})],
  ['both-bad', { id: 'X', name: null, schemes: { light: 1, dark: 'x' } }],
  ['opacity-order', with_('schemes.light.glass.opacity', { min: 0.6, default: 0.5, max: 0.9 })], ['opacity-zero', with_('schemes.dark.glass.opacity', { min: 0, default: 0.5, max: 0.9 })],
  ['opacity-over', with_('schemes.dark.glass.opacity.max', 1.2)], ['opacity-partial', with_('schemes.light.glass.opacity', { min: 0.2, default: 'x', max: 0.9 })],
  ['opacity-extra', with_('schemes.light.glass.opacity.mid', 0.4)], ['blur-neg', with_('schemes.light.glass.blurPx', -1)], ['blur-over', with_('schemes.dark.glass.blurPx', 61)],
  ['blur-60', with_('schemes.dark.glass.blurPx', 60)], ['unknown-token', with_('schemes.light.extraToken', '#ffffff')],
  ['unknown-nested', with_('schemes.dark.state.extra.deep', 1)], ['unknown-long', with_(`schemes.light.${'k'.repeat(60)}`, 1)], ['glass-not-object', with_('schemes.light.glass', 'x')],
  ['state-array', with_('schemes.dark.state', ['#ffffff'])],
];
const BAD: unknown[] = [undefined, null, '', 'x', '#abc', '#ABCDEF', '#abcdeg', 'rgba(0,0,0,0.5)', 'red', 5, NaN, Infinity, '5', [], ['#ffffff'], ['#ffffff', '#000000'],
  [['#ffffff', '#000000'], ['#111111', '#222222']], [['#ffffff']], new Array(6).fill('#ffffff'), new Array(9).fill(['#ffffff', '#000000']), {}, true];

test('schemaErrors: every answer equals the record of the unsplit function', () => {
  const out: string[] = [];
  BUILTIN_PALETTES.forEach((p) => out.push(`builtin ${p.id}: ${JSON.stringify(schemaErrors(p))}`));
  TOP.forEach(([k, v]) => out.push(`top ${k}: ${JSON.stringify(schemaErrors(v))}`));
  for (const p of [BUILTIN_PALETTES[0], BUILTIN_PALETTES[BUILTIN_PALETTES.length - 1]]) {
    for (const sc of ['light', 'dark']) {
      for (const path of Object.keys(SCHEMA)) {
        BAD.forEach((v, i) => out.push(`${p.id} ${sc} ${path} ${i}: ${JSON.stringify(schemaErrors(with_(`schemes.${sc}.${path}`, clone(v), p as unknown as Obj)))}`));
      }
    }
  }
  expectRecorded('schema-errors', out);
});
