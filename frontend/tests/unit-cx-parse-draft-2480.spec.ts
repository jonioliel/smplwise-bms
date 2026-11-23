import { test } from '@playwright/test';
import { parseDraft } from '../src/public-ticket/claim/claim-model';
import { expectRecorded } from './cx-record';

// COMPLEXITY-3-2480: characterisation of the claim form's parseDraft (public-ticket/claim/claim-model.ts) before its split. A complete
// stored draft, then every field it reads removed, nulled or given another type, the line / document / page lists broken entry by
// entry, every page state, and texts that are not a draft; the answers must equal the record taken from the unsplit function
// (tests/fixtures/cx/parse-draft.json). A line without a key gets a fresh time-based key: recorded as "<new>". Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-cx-parse-draft-2480.spec.ts --workers=1

type Obj = Record<string, unknown>;
const CRID = '1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b';
const line = (o: Obj = {}): Obj => ({ key: 'l1', kind: 'labor', description: 'עבודה', hours: '2', rate: '150', quantity: '', unit_price: '', amount: '', ...o });
const page = (o: Obj = {}): Obj => ({ key: 'p1', kind: 'photo', name: 'a.jpg', bytes: 1200, requestId: 'r1', fileId: 'f1', state: 'uploaded', error: null, ...o });
const doc = (o: Obj = {}): Obj => ({ key: 'd1', kind: 'photo', pages: [page(), page({ key: 'p2', fileId: null, state: 'local' })], finished: true, ...o });
const BASE: Obj = {
  v: 1,
  form: { lines: [line(), line({ key: 'l2', kind: 'parts', hours: '', rate: '', quantity: '3', unit_price: '40' })], currency: 'ILS', include_vat: true, no_charge: false, vendor_ref: 'INV-7', notes: 'הערה' },
  docs: { docs: [doc(), doc({ key: 'd2', kind: 'pdf', pages: [page({ key: 'p3', kind: 'pdf', state: 'failed', error: 'too_big' })], finished: false })] },
  submit: { crid: CRID, pending: true },
};
const setPath = (o: Obj, path: string, v: unknown): Obj => {
  const c = structuredClone(o);
  const keys = path.split('.');
  let x: Obj = c;
  for (const k of keys.slice(0, -1)) x = x[k] as Obj;
  if (v === undefined) delete x[keys[keys.length - 1]];
  else x[keys[keys.length - 1]] = v;
  return c;
};
const OTHER: unknown[] = [undefined, null, 0, 1, true, 'x', '', [], {}];
const PATHS = [
  'v', 'form', 'docs', 'submit', 'form.lines', 'form.currency', 'form.include_vat', 'form.no_charge', 'form.vendor_ref', 'form.notes',
  'form.lines.0', ...['key', 'kind', 'description', 'hours', 'rate', 'quantity', 'unit_price', 'amount'].map((k) => `form.lines.1.${k}`),
  'docs.docs', 'docs.docs.0', ...['key', 'kind', 'pages', 'finished'].map((k) => `docs.docs.1.${k}`),
  'docs.docs.0.pages.0', ...['key', 'kind', 'name', 'bytes', 'requestId', 'fileId', 'state', 'error'].map((k) => `docs.docs.0.pages.1.${k}`),
  'submit.crid', 'submit.pending',
];
const EXTRA: Array<[string, Obj]> = [
  ...['labor', 'parts', 'travel', 'other', 'fee', 'LABOR'].map((k): [string, Obj] => [`line-kind-${k}`, setPath(BASE, 'form.lines.0.kind', k)]),
  ...['local', 'uploading', 'uploaded', 'failed', 'refused', 'done', ''].flatMap((st): Array<[string, Obj]> => [
    [`state-${st}`, setPath(BASE, 'docs.docs.0.pages.0.state', st)], [`state-${st}-nofile`, setPath(setPath(BASE, 'docs.docs.0.pages.0.state', st), 'docs.docs.0.pages.0.fileId', undefined)],
  ]),
  ['doc-key-bad', setPath(BASE, 'docs.docs.0.key', 'has space')], ['doc-key-long', setPath(BASE, 'docs.docs.0.key', 'k'.repeat(33))], ['doc-key-32', setPath(BASE, 'docs.docs.0.key', 'k'.repeat(32))],
  ['doc-kind-pdf-page-photo', setPath(BASE, 'docs.docs.1.pages.0.kind', 'photo')], ['no-lines', setPath(BASE, 'form.lines', [])], ['no-docs', setPath(BASE, 'docs.docs', [])],
  ['no-pages', setPath(BASE, 'docs.docs.0.pages', [])], ['crid-v1', setPath(BASE, 'submit.crid', '1b4e28ba-2fa1-11d2-883f-0016d3cca427')], ['crid-upper', setPath(BASE, 'submit.crid', CRID.toUpperCase())],
  ['pending-string', setPath(BASE, 'submit.pending', 'true')], ['v-string', setPath(BASE, 'v', '1')], ['v-2', setPath(BASE, 'v', 2)], ['bytes-string', setPath(BASE, 'docs.docs.0.pages.0.bytes', '1200')],
  ['bytes-nan', setPath(BASE, 'docs.docs.0.pages.0.bytes', 1e400)], ['extra-keys', { ...BASE, extra: 1, form: { ...(BASE.form as Obj), extra: 2 } }],
];

test('parseDraft: every answer equals the record of the unsplit function', () => {
  const answer = (text: string | null | undefined) => JSON.stringify(parseDraft(text) ?? null)?.replace(/"key":"l[0-9a-z]{6,}"/g, '"key":"<new>"');
  const out: string[] = [];
  for (const t of [null, undefined, '', 'x', '{', 'null', '0', '5', '"s"', '[]', '[1]', '{}', 'true']) out.push(`text ${JSON.stringify(t)}: ${answer(t)}`);
  out.push(`base: ${answer(JSON.stringify(BASE))}`);
  for (const p of PATHS) OTHER.forEach((v, i) => out.push(`${p} ${i}: ${answer(JSON.stringify(setPath(BASE, p, v)))}`));
  for (const [k, o] of EXTRA) out.push(`${k}: ${answer(JSON.stringify(o))}`);
  expectRecorded('parse-draft', out);
});
