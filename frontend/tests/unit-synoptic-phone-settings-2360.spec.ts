import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  litPercent, normalizeXs, phoneLightApplies, phoneLightGauge, phoneSummaryParts, xsFromParams,
  PHONE_MAX_SEGMENTS, XS_DEFAULT, XS_SYN_PHONE_LIGHT, XS_SYN_PHONE_SUMMARY, XS_SYN_PHONE_VIEW,
} from '../src/xsection/xs-model';
import { xt } from '../src/i18n/xsection';

// SYNOPTIC-PHONE-SETTINGS-2360 (owner 02.11 round 14): "תאורה בטלפון" (ui.xs syn_phone_light: bar - default / segments / number) and
// "שורת סיכום בטלפון" (ui.xs syn_phone_summary: button - default / line / off), the two choices of the phone mock-up that 2.34.2 built as
// fixed behaviour. Node only: the setting -> rendering mapping is pure (xs-model) and the template wiring is read from the source.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');
const lit = (l: number | null, n: number | null) => ({ lit: l, lights: n });

test('the options: the 2.34.2 behaviour is the default, the values are listed in the card order, anything else reads as the default', () => {
  expect(XS_SYN_PHONE_LIGHT).toEqual(['bar', 'segments', 'number']);
  expect(XS_SYN_PHONE_SUMMARY).toEqual(['button', 'line', 'off']);
  expect(XS_DEFAULT.syn_phone_light).toBe('bar');
  expect(XS_DEFAULT.syn_phone_summary).toBe('button');
  const old = normalizeXs({ syn_phone_view: 'cards' }); // a value stored before the keys existed
  expect([old.syn_phone_light, old.syn_phone_summary]).toEqual(['bar', 'button']);
  for (const v of XS_SYN_PHONE_LIGHT) expect(normalizeXs({ syn_phone_light: v }).syn_phone_light).toBe(v);
  for (const v of XS_SYN_PHONE_SUMMARY) expect(normalizeXs({ syn_phone_summary: v }).syn_phone_summary).toBe(v);
  for (const bad of ['dots', 'Bar', 2, null, true]) expect(normalizeXs({ syn_phone_light: bad }).syn_phone_light).toBe('bar');
  for (const bad of ['footer', 'Line', 0, null, false]) expect(normalizeXs({ syn_phone_summary: bad }).syn_phone_summary).toBe('button');
  const demo = xsFromParams(XS_DEFAULT, new URLSearchParams('xs_syn_phone_light=segments&xs_syn_phone_summary=off'));
  expect([demo.syn_phone_light, demo.syn_phone_summary]).toEqual(['segments', 'off']);
  expect(demo.syn_phone_view).toBe('table'); // the new keys do not move the existing one
});

test('the lights gauge: bar = the share (the 2.34.2 bar), number = nothing, segments = one per light, eight at most', () => {
  expect(phoneLightGauge('bar', lit(2, 10))).toEqual({ kind: 'bar', percent: 20, on: 0, total: 0 });
  expect(phoneLightGauge('bar', lit(2, 10)).percent).toBe(litPercent(lit(2, 10)));
  expect(phoneLightGauge('bar', lit(null, 10)).percent).toBe(0);
  expect(phoneLightGauge('number', lit(2, 10)).kind).toBe('none');
  expect(phoneLightGauge('number', lit(null, null)).kind).toBe('none');
  expect(PHONE_MAX_SEGMENTS).toBe(8);
  // one segment a light up to eight
  expect(phoneLightGauge('segments', lit(1, 1))).toMatchObject({ kind: 'segments', on: 1, total: 1 });
  expect(phoneLightGauge('segments', lit(0, 3))).toMatchObject({ on: 0, total: 3 });
  expect(phoneLightGauge('segments', lit(2, 3))).toMatchObject({ on: 2, total: 3 });
  expect(phoneLightGauge('segments', lit(3, 3))).toMatchObject({ on: 3, total: 3 });
  // more than eight lights: eight segments, rounded
  expect(phoneLightGauge('segments', lit(5, 10))).toMatchObject({ on: 4, total: 8 });
  expect(phoneLightGauge('segments', lit(2, 10))).toMatchObject({ on: 2, total: 8 });
  expect(phoneLightGauge('segments', lit(10, 10))).toMatchObject({ on: 8, total: 8 });
  // a light on is never invisible, a light off is never a full strip
  expect(phoneLightGauge('segments', lit(1, 40)).on).toBe(1);
  expect(phoneLightGauge('segments', lit(39, 40)).on).toBe(7);
  expect(phoneLightGauge('segments', lit(0, 40)).on).toBe(0);
  // no lights / no source: an empty strip, never NaN
  expect(phoneLightGauge('segments', lit(null, null))).toMatchObject({ kind: 'segments', on: 0, total: 1 });
  expect(phoneLightGauge('segments', lit(0, 0))).toMatchObject({ on: 0, total: 1 });
  for (let n = 1; n <= 30; n++) {
    for (let l = 0; l <= n; l++) {
      const g = phoneLightGauge('segments', lit(l, n));
      expect(g.total).toBeLessThanOrEqual(8);
      expect(g.on).toBeGreaterThanOrEqual(0);
      expect(g.on).toBeLessThanOrEqual(g.total);
    }
  }
});

test('the summary: the info button (default), the line, or neither - and where the lights setting applies', () => {
  expect(phoneSummaryParts('button')).toEqual({ button: true, line: false, settings: false });
  expect(phoneSummaryParts('line')).toEqual({ button: false, line: true, settings: false });
  expect(phoneSummaryParts('off')).toEqual({ button: false, line: false, settings: false });
  // "off" keeps a small settings button, only for whoever may open the map settings; the other two values never draw it
  expect(phoneSummaryParts('off', true)).toEqual({ button: false, line: false, settings: true });
  expect(phoneSummaryParts('button', true).settings).toBe(false);
  expect(phoneSummaryParts('line', true).settings).toBe(false);
  // the lights gauge lives in the table and the cards; the cross-section colours its slabs itself
  expect(XS_SYN_PHONE_VIEW.filter(phoneLightApplies)).toEqual(['table', 'cards']);
});

test('the board draws what the settings say: the gauge in the table cell and the card tile, the info button / sheet / line by the summary', () => {
  const src = read('src/screens/devices-synoptic.ts');
  // the default markup of the bar is the one 2.34.2 drew (the data attribute is the only addition)
  expect(src).toMatch(/<span class="mb" aria-hidden="true" data-syn-gauge="bar"><i style="inline-size:\$\{g\.percent\}%"><\/i><\/span>/);
  expect(src).toMatch(/phoneLightGauge\(o\.syn_phone_light, f\)/);
  // both places that drew the bar by hand now ask the gauge (the section keeps litPercent for its slab fill only)
  const cell = src.slice(src.indexOf('private phoneCell'), src.indexOf('private phonePill'));
  expect(cell).not.toMatch(/litPercent/);
  expect((cell.match(/this\.lightGauge\(f, o\)/g) ?? []).length).toBe(2);
  expect(src).toMatch(/<span class="sl [^"]*"[^>]*><i style="inline-size:\$\{litPercent\(f\)\}%">/);
  // the summary: one decision (`sum`) drives the head button, the section strip's details button, the sheet and the line
  expect(src).toMatch(/\$\{sum\.button \? html`<button class="ib" data-syn-info/);
  expect(src).toMatch(/\$\{sum\.button \? html`<sw-button size="sm" variant="ghost" data-syn-details/);
  expect(src).toMatch(/\$\{sum\.button \? this\.renderInfo\(b, sigs, cols, pc, hiddenEmpty, noFloor\) : nothing\}/);
  expect(src).toMatch(/phoneSummaryParts\(o\.syn_phone_summary, this\.canOpenMapSettings\(\)\)/);
  expect(src).toMatch(/\$\{sum\.settings \? html`<button class="ib" data-syn-map-settings aria-label=\$\{xt\('synInfoSettings'\)\}/);
  expect(src).toMatch(/navigate\('\/system\/diagnostics', \{ focus: 'xs' \}\)\}>\$\{xi\('wrench'\)\}/);
  expect(src).toMatch(/return !this\.wall && \(!isApi\(\) \|\| can\('system\.configure'\)\)/);
  expect(src).toMatch(/const sumLine = sum\.line \? this\.summaryLine\(b, sigs, hiddenEmpty, noFloor, view !== 'section'\) : nothing/);
  // the line closes all three layouts, after the list (the list stays the only scrolling part)
  expect(src).toMatch(/<div class="pbl" \?data-dense=\$\{dense\}>\$\{items\}<\/div>\$\{sumLine\}<\/section>/);
  expect(src).toMatch(/<div class="dstrip" data-syn-strip>\$\{strip\}<\/div>\$\{sumLine\}<\/section>/);
  expect(src).toMatch(/<div class="plist" \?data-dense=\$\{dense\}>\$\{rows\}<\/div>\$\{sumLine\}<\/section>/);
  for (const v of ['cards', 'section', 'table']) expect(src).toContain(`data-syn-phone="${v}" data-sum=\${o.syn_phone_summary}`);
  // the wide board and the wall do not read the new keys
  const render = src.slice(src.indexOf('  render() {'), src.indexOf('if (!this.wall && window.innerWidth < 768)'));
  expect(render).not.toMatch(/syn_phone_(light|summary)/);
});

test('the line is a grid row under the list in each layout, wraps, and keeps a 44 px touch target on its links', () => {
  const css = read('src/screens/devices-synoptic-phone-css.ts');
  expect(css).toMatch(/\.pboard\.pa\[data-sum='line'\] \{ grid-template-rows: auto auto auto minmax\(0, 1fr\) auto; \}/);
  expect(css).toMatch(/\.pboard\.pb\[data-sum='line'\] \{ grid-template-rows: auto auto minmax\(0, 1fr\) auto; \}/);
  expect(css).toMatch(/\.pboard\.pc\[data-sum='line'\] \{ grid-template-rows: auto auto minmax\(0, 1fr\) auto auto;/);
  expect(css).toMatch(/\.psum \{[^}]*flex-wrap: wrap/);
  expect(css).toMatch(/\.psum \.lnk::after \{ content: ''; position: absolute; inset: -14px -6px; \}/);
  // the segment strip has the bar's footprint (flex children of the same 34 px, no fixed segment width that could spill into a neighbour)
  expect(css).toMatch(/\.mb\.seg \{ display: flex; gap: 1px;/);
  expect(css).toMatch(/\.mb\.seg i \{ flex: 1 1 0; min-inline-size: 0;/);
  expect(css).not.toMatch(/\.mb\.seg i \{[^}]*(?<![-\w])inline-size: \d/);
});

test('the settings card lists both rows next to the phone layout, the default first, each with a hint', () => {
  const card = read('src/screens/system-xs-options.ts');
  expect(card).toMatch(/key: 'syn_phone_light', kind: 'enum', label: 'optSynPhoneLight', options: \[\['bar', 'optSynPhoneLightBar'\], \['segments', 'optSynPhoneLightSegments'\], \['number', 'optSynPhoneLightNumber'\]\], hint: 'optSynPhoneLightHint'/);
  expect(card).toMatch(/key: 'syn_phone_summary', kind: 'enum', label: 'optSynPhoneSummary', options: \[\['button', 'optSynPhoneSummaryButton'\], \['line', 'optSynPhoneSummaryLine'\], \['off', 'optSynPhoneSummaryOff'\]\], hint: 'optSynPhoneSummaryHint'/);
  const at = (k: string) => card.indexOf(`key: '${k}'`);
  expect(at('syn_phone_view')).toBeGreaterThan(0);
  expect(at('syn_phone_light')).toBeGreaterThan(at('syn_phone_view'));
  expect(at('syn_phone_summary')).toBeGreaterThan(at('syn_phone_light'));
  expect(at('syn_events')).toBeGreaterThan(at('syn_phone_summary'));
});

test('the words: Hebrew labels as the owner asked, an English twin that differs, no platform name, and the hint says where the gauge does not apply', () => {
  expect(xt('optSynPhoneLight', undefined, 'he')).toBe('תאורה בטלפון');
  expect([xt('optSynPhoneLightBar', undefined, 'he'), xt('optSynPhoneLightSegments', undefined, 'he'), xt('optSynPhoneLightNumber', undefined, 'he')]).toEqual(['פס קטן', 'פס מקטעים', 'מספר בלבד']);
  expect(xt('optSynPhoneSummary', undefined, 'he')).toBe('שורת סיכום בטלפון');
  expect([xt('optSynPhoneSummaryLine', undefined, 'he'), xt('optSynPhoneSummaryButton', undefined, 'he'), xt('optSynPhoneSummaryOff', undefined, 'he')]).toEqual(['שורה', 'כפתור מידע', 'כבויה']);
  expect(xt('optSynPhoneLightHint', undefined, 'he')).toContain('חתך בניין');
  expect(xt('optSynPhoneLightHint', undefined, 'he')).toContain('לא חלה');
  expect(xt('optSynPhoneSummaryHint', undefined, 'he')).toContain('שלוש התצוגות');
  for (const k of ['optSynPhoneLight', 'optSynPhoneLightBar', 'optSynPhoneLightSegments', 'optSynPhoneLightNumber', 'optSynPhoneLightHint', 'optSynPhoneSummary', 'optSynPhoneSummaryButton', 'optSynPhoneSummaryLine', 'optSynPhoneSummaryOff', 'optSynPhoneSummaryHint'] as const) {
    expect(xt(k, undefined, 'en'), k).not.toBe(xt(k, undefined, 'he'));
    expect(xt(k, undefined, 'he')).not.toMatch(/home assistant/i);
  }
});

test('the server and the frontend agree on the keys, the values and the defaults', () => {
  const py = readFileSync(path.resolve(ROOT, '../smplwise_vms/backend/smplwise/services/xs_options.py'), 'utf8');
  const tuple = (key: string) => [...(py.match(new RegExp(`"${key}": \\(([^)]*)\\)`))?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  expect(tuple('syn_phone_light')).toEqual([...XS_SYN_PHONE_LIGHT]);
  expect(tuple('syn_phone_summary')).toEqual([...XS_SYN_PHONE_SUMMARY]);
  expect(py).toContain(`"syn_phone_light": "${XS_DEFAULT.syn_phone_light}"`);
  expect(py).toContain(`"syn_phone_summary": "${XS_DEFAULT.syn_phone_summary}"`);
});
