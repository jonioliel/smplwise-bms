import { css, html, nothing, type TemplateResult } from 'lit';
import {
  CAPS, WEEKDAYS, controlsSchedules, sensitiveClassOf,
  type ActionBlock, type CatalogEntity, type ConditionBlock, type Duration, type Issue, type ItemKind, type LockedBlock, type PickerFilter, type TriggerBlock, type Weekday,
} from '../api/automations';
import type { Block } from '../api/automations';
import { icon } from './automation-builder-icons';
import {
  PRESENCE_ZONE, WEEKDAY_LABEL, entityIcon, lockedWhy, personIds, presenceOf, stateChoices, type Choice, type EditorEnv, type Presence, type Section,
} from './automation-editor-logic';

/**
 * CR-017 S4: one form per typed block, in a registry keyed by `section:type` (`trigger:state`, `condition:time`, `action:service` ...). A typed
 * schema that arrives later for a locked reason (device buttons, templates, purpose-specific triggers: CR §14.1) adds ONE entry here and one in the
 * type chooser; the builder itself does not change. Every form is a pure function of a `FormCtx` (the editor owns the state): it renders controls and
 * calls `fc.patch` with a mutation of the block; the editor clones the draft, applies it and refreshes the sentences.
 */

export interface PickerRequest {
  uid: string;
  filter: PickerFilter;
  where?: (e: CatalogEntity) => boolean;
  selected: string[];
  multi?: boolean;
  apply: (ids: string[]) => void;
}

export interface FormCtx {
  env: EditorEnv;
  kind: ItemKind;
  block: Block;
  section: Section;
  /** Mutates this block (on a clone of the draft); the editor re-renders and refreshes the sentences. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch: (fn: (b: any) => void) => void;
  pick: (req: PickerRequest) => void;
  /** The ids the triggers define (for "מה הפעיל"). */
  triggerIds: string[];
  /** The nested list `owner/name` of this block, with its add button. */
  nested: (owner: string, name: string, section: Section, title?: string) => TemplateResult;
  /** A form context for another block (the inner condition of a condition step). */
  child: (b: Block, section: Section) => FormCtx;
  issues: Issue[];
  /** The caller holds the code view's permission (locked template text may be edited, "ערוך בקוד" is offered). */
  canCode: boolean;
  gotoCode: () => void;
  /** Locked block: the template text was edited (code view permission). */
  editTemplate: (uid: string, text: string) => void;
}

export type FormFn = (fc: FormCtx) => TemplateResult;

// ------------------------------------------------------------------------------------------------ control helpers

const fld = (label: string, inner: unknown, cls = ''): TemplateResult => html`<div class="fld ${cls}"><label>${label}</label>${inner}</div>`;
/** The accessible name of a control: the Hebrew label of its field (the data-fld token is only a test hook). */
const FLD_LABEL: Record<string, string> = {
  to: 'עובר ל־', from: 'מ־', event: 'אירוע', when: 'מתי', offset: 'דקות', at: 'שעה', every: 'כל', unit: 'יחידה', who: 'מי', above: 'מעל', below: 'מתחת', after: 'אחרי', before: 'לפני', state: 'במצב', mode: 'מצב',
  sun: 'שמש', action: 'פעולה', scene: 'סצנה', script: 'סקריפט', target: 'אל', message: 'הודעה', count: 'פעמים', id: 'מזהה', hours: 'שעות', minutes: 'דקות', seconds: 'שניות', brightness_pct: 'בהירות', temperature: 'טמפרטורה',
  position: 'מיקום', volume_level: 'עוצמה', percentage: 'מהירות',
};
const aria = (attr: string | undefined, label?: string): string => label ?? FLD_LABEL[attr ?? ''] ?? FLD_LABEL[(attr ?? '').split('.').pop() ?? ''] ?? '';
function sel(value: string, opts: readonly Choice[], on: (v: string) => void, attr = '', cls = '', label?: string): TemplateResult {
  const list = opts.some((o) => o.value === value) || value === '' ? opts : [...opts, { value, label: value }];
  return html`<select class="selx ${cls}" data-fld=${attr} aria-label=${aria(attr, label)} @change=${(e: Event) => on((e.target as HTMLSelectElement).value)}>${list.map((o) => html`<option value=${o.value} ?selected=${o.value === value}>${o.label}</option>`)}</select>`;
}
function numIn(value: number | null | undefined, on: (n: number | null) => void, o: { unit?: string; min?: number; max?: number; step?: number; attr?: string; ph?: string; label?: string } = {}): TemplateResult {
  return html`<label class="inp"><input class="n" type="text" inputmode="decimal" data-fld=${o.attr ?? ''} aria-label=${aria(o.attr, o.label)} placeholder=${o.ph ?? ''} .value=${value === null || value === undefined ? '' : String(value)}
    @change=${(e: Event) => { const t = (e.target as HTMLInputElement).value.trim().replace(',', '.'); const n = t === '' ? null : Number(t); on(n === null || !Number.isFinite(n) ? null : o.min !== undefined && n < o.min ? o.min : o.max !== undefined && n > o.max ? o.max : n); }} />${o.unit ? html`<span class="u">${o.unit}</span>` : nothing}</label>`;
}
const textIn = (value: string, on: (v: string) => void, o: { ph?: string; attr?: string; ltr?: boolean; label?: string } = {}): TemplateResult =>
  html`<label class="inp"><input type="text" data-fld=${o.attr ?? ''} aria-label=${aria(o.attr, o.label)} dir=${o.ltr ? 'ltr' : 'auto'} placeholder=${o.ph ?? ''} .value=${value} @input=${(e: Event) => on((e.target as HTMLInputElement).value)} /></label>`;
const timeIn = (value: string | null | undefined, on: (v: string) => void, attr: string): TemplateResult =>
  html`<label class="inp"><input class="n" type="time" step="60" data-fld=${attr} aria-label=${aria(attr)} .value=${(value ?? '').slice(0, 5)} @change=${(e: Event) => on((e.target as HTMLInputElement).value)} /></label>`;

function durationFields(d: Duration | null | undefined, on: (d: Duration | undefined) => void, tag: string): TemplateResult {
  const set = (k: 'hours' | 'minutes' | 'seconds', n: number | null) => {
    const next = { hours: d?.hours ?? 0, minutes: d?.minutes ?? 0, seconds: d?.seconds ?? 0, [k]: n ?? 0 };
    on(next.hours || next.minutes || next.seconds ? next : undefined);
  };
  return html`<div class="frow">
    <div class="fld sm"><label>שעות</label>${numIn(d?.hours ?? 0, (n) => set('hours', n), { min: 0, max: 999, attr: `${tag}.hours` })}</div>
    <div class="fld sm"><label>דקות</label>${numIn(d?.minutes ?? 0, (n) => set('minutes', n), { min: 0, max: 59, attr: `${tag}.minutes` })}</div>
    <div class="fld sm"><label>שניות</label>${numIn(d?.seconds ?? 0, (n) => set('seconds', n), { min: 0, max: 59, attr: `${tag}.seconds` })}</div>
  </div>`;
}
const durText = (d: Duration | null | undefined): string => (d ? [d.hours ? `${d.hours} שע׳` : '', d.minutes ? `${d.minutes} דק׳` : '', d.seconds ? `${d.seconds} שנ׳` : ''].filter(Boolean).join(' ') : '');

function entityChips(fc: FormCtx, ids: string[], o: { filter: PickerFilter; where?: (e: CatalogEntity) => boolean; apply: (ids: string[]) => void; multi?: boolean; add?: string }): TemplateResult {
  const names = fc.env.ctx.names!;
  return html`<div class="entpick" data-entity-chips>
    ${ids.map((id) => {
      const e = fc.env.byId.get(id);
      return html`<span class="ent ${e?.class ? 'sens' : ''}" title=${id} data-entity=${id}>${icon(entityIcon(id))}<span>${names(id)}</span>${e?.area ? html`<small>${e.area.name}</small>` : nothing}${e?.missing ? html`<small class="bad">לא נמצא</small>` : nothing}
        <button class="rm" type="button" aria-label=${`הסרת ${names(id)}`} data-entity-remove=${id} @click=${() => o.apply(ids.filter((x) => x !== id))}>${icon('close')}</button></span>`;
    })}
    <button class="ent add" type="button" data-entity-add @click=${() => fc.pick({ uid: fc.block.uid, filter: o.filter, where: o.where, selected: ids, multi: o.multi ?? true, apply: o.apply })}>${icon('plus')}${ids.length ? 'עוד' : o.add ?? 'בחרו מכשיר'}</button>
  </div>`;
}

const errLine = (fc: FormCtx): TemplateResult | typeof nothing => {
  const own = fc.issues.slice(0, 3);
  return own.length ? html`${own.map((i) => html`<div class="err" role="alert" data-block-error>${icon('warning')}${i.message}</div>`)}` : nothing;
};

const domainOf = (id: string | undefined): string => (id ?? '').split('.')[0];
const clean = <T extends Record<string, unknown>>(o: T, ...keys: string[]): T => { for (const k of keys) if (o[k] === undefined || o[k] === null) delete o[k]; return o; };
const idField = (fc: FormCtx): TemplateResult => {
  const b = fc.block as TriggerBlock;
  return html`<details class="opts" ?open=${!!b.id}><summary>${icon('chevronDown')}מזהה לטריגר${b.id ? ` · ${b.id}` : ''}</summary>
    ${fld('מזהה (לתנאי "מה הפעיל")', textIn(b.id ?? '', (v) => fc.patch((x) => { if (v.trim()) x.id = v.trim(); else delete x.id; }), { ph: 'למשל night', attr: 'id', ltr: true }))}</details>`;
};
const forDuration = (fc: FormCtx, b: { for?: Duration | null }): TemplateResult =>
  html`<details class="opts" ?open=${!!b.for}><summary>${icon('chevronDown')}רק אם נשאר כך זמן מסוים${b.for ? ` · ${durText(b.for)}` : ''}</summary>
    ${durationFields(b.for, (d) => fc.patch((x) => { if (d) x.for = d; else delete x.for; }), 'for')}</details>`;

// ------------------------------------------------------------------------------------------------ triggers

const stateEntityFilter = (): PickerFilter => ({ purpose: 'watch', onlyTriggerable: true });

function presenceForm(fc: FormCtx, who: Presence): TemplateResult {
  const b = fc.block as TriggerBlock;
  const set = (w: Presence) => fc.patch((x) => {
    const keep = { uid: x.uid, kind: x.kind, raw: x.raw, id: x.id, sentence: x.sentence };
    for (const k of Object.keys(x)) delete x[k];
    if (w === 'all_left') Object.assign(x, keep, { type: 'numeric_state', entity_ids: [PRESENCE_ZONE], below: 1, above: null });
    else Object.assign(x, keep, { type: 'state', entity_ids: personIds(fc.env), to: 'home' });
    clean(x, 'id');
  });
  const ids = 'entity_ids' in b ? b.entity_ids : [];
  return html`${errLine(fc)}<div class="frow"><div class="fld">${fld('מי', sel(who, [{ value: 'all_left', label: 'כולם יצאו מהבית' }, { value: 'someone_home', label: 'מישהו חזר הביתה' }], (v) => set(v as Presence), 'who'))}</div></div>
    ${who === 'someone_home' ? html`${fld('אנשים', entityChips(fc, ids, { filter: { purpose: 'watch', domains: ['person'] }, apply: (n) => fc.patch((x) => { x.entity_ids = n; }), add: 'בחרו אדם' }), 'full')}` : nothing}
    ${idField(fc)}`;
}

const triggerState: FormFn = (fc) => {
  const b = fc.block as TriggerBlock & { type: 'state' };
  const p = presenceOf(b);
  if (p) return presenceForm(fc, p);
  const choices = stateChoices(b.entity_ids[0]);
  return html`${errLine(fc)}${entityChips(fc, b.entity_ids, { filter: stateEntityFilter(), apply: (ids) => fc.patch((x) => { x.entity_ids = ids; }) })}
    <div class="frow">
      <div class="fld">${fld('עובר ל־', sel(b.to ?? '', [{ value: '', label: 'כל שינוי' }, ...choices], (v) => fc.patch((x) => { if (v) x.to = v; else delete x.to; }), 'to'))}</div>
      <div class="fld">${fld('מ־ (לא חובה)', sel(b.from ?? '', [{ value: '', label: '—' }, ...choices], (v) => fc.patch((x) => { if (v) x.from = v; else delete x.from; }), 'from'))}</div>
    </div>${forDuration(fc, b)}${idField(fc)}`;
};

const numericWatchFilter = (): { filter: PickerFilter; where: (e: CatalogEntity) => boolean } => ({ filter: { purpose: 'watch' }, where: (e) => e.triggers.includes('numeric_state') });

const triggerNumeric: FormFn = (fc) => {
  const b = fc.block as TriggerBlock & { type: 'numeric_state' };
  const p = presenceOf(b);
  if (p) return presenceForm(fc, p);
  const f = numericWatchFilter();
  return html`${errLine(fc)}${entityChips(fc, b.entity_ids, { ...f, apply: (ids) => fc.patch((x) => { x.entity_ids = ids; }) })}
    <div class="frow">
      <div class="fld sm"><label>מעל</label>${numIn(b.above, (n) => fc.patch((x) => { if (n === null) delete x.above; else x.above = n; }), { attr: 'above' })}</div>
      <div class="fld sm"><label>מתחת</label>${numIn(b.below, (n) => fc.patch((x) => { if (n === null) delete x.below; else x.below = n; }), { attr: 'below' })}</div>
    </div>${forDuration(fc, b)}${idField(fc)}`;
};

const triggerTime: FormFn = (fc) => {
  const b = fc.block as TriggerBlock & { type: 'time' };
  return html`${errLine(fc)}<div class="frow"><div class="fld sm"><label>שעה</label>${timeIn(b.at, (v) => fc.patch((x) => { x.at = v; }), 'at')}</div></div>${idField(fc)}`;
};

function simplePattern(b: TriggerBlock & { type: 'time_pattern' }): { unit: 'minutes' | 'hours' | 'seconds'; n: number } | null {
  const parts = (['hours', 'minutes', 'seconds'] as const).filter((k) => b[k] != null);
  if (parts.length !== 1) return null;
  const m = /^\/(\d+)$/.exec(String(b[parts[0]]));
  return m ? { unit: parts[0], n: Number(m[1]) } : null;
}
const triggerPattern: FormFn = (fc) => {
  const b = fc.block as TriggerBlock & { type: 'time_pattern' };
  const sp = simplePattern(b);
  if (!sp) {
    const raw = (k: 'hours' | 'minutes' | 'seconds', label: string) => fld(label, textIn(String(b[k] ?? ''), (v) => fc.patch((x) => { x[k] = v.trim() ? v.trim() : null; }), { attr: k, ltr: true, ph: '*' }), 'sm');
    return html`${errLine(fc)}<div class="frow">${raw('hours', 'שעות')}${raw('minutes', 'דקות')}${raw('seconds', 'שניות')}</div>${idField(fc)}`;
  }
  const set = (unit: string, n: number | null) => fc.patch((x) => { x.hours = null; x.minutes = null; x.seconds = null; x[unit] = `/${Math.max(1, n ?? 1)}`; });
  return html`${errLine(fc)}<div class="frow">
    <div class="fld sm"><label>כל</label>${numIn(sp.n, (n) => set(sp.unit, n), { min: 1, max: 59, attr: 'every' })}</div>
    <div class="fld sm"><label>יחידה</label>${sel(sp.unit, [{ value: 'minutes', label: 'דקות' }, { value: 'hours', label: 'שעות' }, { value: 'seconds', label: 'שניות' }], (u) => set(u, sp.n), 'unit')}</div>
  </div>${idField(fc)}`;
};

const triggerSun: FormFn = (fc) => {
  const b = fc.block as TriggerBlock & { type: 'sun' };
  const dir = b.offset_min === 0 ? 'exact' : b.offset_min < 0 ? 'before' : 'after';
  const mins = Math.abs(b.offset_min);
  const set = (d: string, m: number) => fc.patch((x) => { x.offset_min = d === 'before' ? -m : d === 'after' ? m : 0; });
  return html`${errLine(fc)}<div class="frow">
    <div class="fld">${fld('אירוע', sel(b.event, [{ value: 'sunset', label: 'שקיעה' }, { value: 'sunrise', label: 'זריחה' }], (v) => fc.patch((x) => { x.event = v; }), 'event'))}</div>
    <div class="fld">${fld('מתי', sel(dir, [{ value: 'exact', label: 'בדיוק' }, { value: 'before', label: 'לפני' }, { value: 'after', label: 'אחרי' }], (v) => set(v, mins || 20), 'when'))}</div>
    ${dir === 'exact' ? nothing : html`<div class="fld sm"><label>דקות</label>${numIn(mins, (n) => set(dir, Math.max(1, n ?? 1)), { min: 1, max: 600, attr: 'offset' })}</div>`}
  </div>${idField(fc)}`;
};

const triggerStart: FormFn = (fc) => html`${errLine(fc)}<div class="codenote">${icon('power')}מופעל פעם אחת אחרי שהמערכת עולה.</div>${idField(fc)}`;

// ------------------------------------------------------------------------------------------------ conditions

const conditionState: FormFn = (fc) => {
  const b = fc.block as ConditionBlock & { type: 'state' };
  const choices = stateChoices(b.entity_ids[0]);
  const multi = Array.isArray(b.state);
  const f = { purpose: 'watch' as const, onlyTriggerable: true };
  return html`${errLine(fc)}${entityChips(fc, b.entity_ids, { filter: f, apply: (ids) => fc.patch((x) => { x.entity_ids = ids; }) })}
    ${multi
      ? fld('במצב', html`<div class="rolechips">${choices.map((c) => html`<button type="button" aria-pressed=${(b.state as string[]).includes(c.value)} @click=${() => fc.patch((x) => { const cur = x.state as string[]; x.state = cur.includes(c.value) ? cur.filter((s) => s !== c.value) : [...cur, c.value]; })}>${c.label}</button>`)}</div>`)
      : html`<div class="frow"><div class="fld">${fld('במצב', sel(String(b.state), choices, (v) => fc.patch((x) => { x.state = v; }), 'state'))}</div></div>`}
    <details class="opts" ?open=${!!b.for}><summary>${icon('chevronDown')}רק אם נשאר כך זמן מסוים${b.for ? ` · ${durText(b.for)}` : ''}</summary>${durationFields(b.for, (d) => fc.patch((x) => { if (d) x.for = d; else delete x.for; }), 'for')}</details>`;
};

const conditionNumeric: FormFn = (fc) => {
  const b = fc.block as ConditionBlock & { type: 'numeric_state' };
  const f = numericWatchFilter();
  return html`${errLine(fc)}${entityChips(fc, b.entity_ids, { ...f, apply: (ids) => fc.patch((x) => { x.entity_ids = ids; }) })}
    <div class="frow">
      <div class="fld sm"><label>מעל</label>${numIn(b.above, (n) => fc.patch((x) => { if (n === null) delete x.above; else x.above = n; }), { attr: 'above' })}</div>
      <div class="fld sm"><label>מתחת</label>${numIn(b.below, (n) => fc.patch((x) => { if (n === null) delete x.below; else x.below = n; }), { attr: 'below' })}</div>
    </div>`;
};

const conditionTime: FormFn = (fc) => {
  const b = fc.block as ConditionBlock & { type: 'time' };
  const wd = b.weekday ?? [];
  return html`${errLine(fc)}<div class="frow">
      <div class="fld sm"><label>אחרי</label>${timeIn(b.after, (v) => fc.patch((x) => { if (v) x.after = v; else delete x.after; }), 'after')}</div>
      <div class="fld sm"><label>לפני</label>${timeIn(b.before, (v) => fc.patch((x) => { if (v) x.before = v; else delete x.before; }), 'before')}</div>
    </div>
    ${fld('ימים', html`<div class="rolechips">${WEEKDAYS.map((d: Weekday) => html`<button type="button" data-weekday=${d} aria-pressed=${wd.includes(d)} @click=${() => fc.patch((x) => { const cur = (x.weekday ?? []) as Weekday[]; const next = cur.includes(d) ? cur.filter((y) => y !== d) : [...cur, d]; if (next.length) x.weekday = WEEKDAYS.filter((y) => next.includes(y)); else delete x.weekday; })}>${WEEKDAY_LABEL[d]}</button>`)}</div>`)}`;
};

const SUN_COMBOS: Array<{ value: string; label: string; after?: string; before?: string }> = [
  { value: 'after:sunset', label: 'אחרי השקיעה', after: 'sunset' }, { value: 'before:sunrise', label: 'לפני הזריחה', before: 'sunrise' }, { value: 'after:sunrise', label: 'אחרי הזריחה', after: 'sunrise' },
  { value: 'before:sunset', label: 'לפני השקיעה', before: 'sunset' }, { value: 'night', label: 'בין השקיעה לזריחה (לילה)', after: 'sunset', before: 'sunrise' }, { value: 'day', label: 'בין הזריחה לשקיעה (יום)', after: 'sunrise', before: 'sunset' },
];
const conditionSun: FormFn = (fc) => {
  const b = fc.block as ConditionBlock & { type: 'sun' };
  const cur = SUN_COMBOS.find((c) => (c.after ?? null) === (b.after ?? null) && (c.before ?? null) === (b.before ?? null))?.value ?? 'after:sunset';
  return html`${errLine(fc)}<div class="frow"><div class="fld">${sel(cur, SUN_COMBOS, (v) => { const c = SUN_COMBOS.find((x) => x.value === v)!; fc.patch((x) => { delete x.after; delete x.before; if (c.after) x.after = c.after; if (c.before) x.before = c.before; }); }, 'sun')}</div></div>`;
};

const conditionTrigger: FormFn = (fc) => {
  const b = fc.block as ConditionBlock & { type: 'trigger' };
  return html`${errLine(fc)}${fld('הטריגרים', fc.triggerIds.length
    ? html`<div class="rolechips">${fc.triggerIds.map((id) => html`<button type="button" aria-pressed=${b.ids.includes(id)} @click=${() => fc.patch((x) => { const cur = x.ids as string[]; x.ids = cur.includes(id) ? cur.filter((y) => y !== id) : [...cur, id]; })}>${id}</button>`)}</div>`
    : html`<small>תנו מזהה לטריגר קודם</small>`)}`;
};

const conditionShabbat: FormFn = (fc) => {
  const b = fc.block as ConditionBlock & { type: 'shabbat' };
  return html`${errLine(fc)}<div class="frow"><div class="fld">${sel(b.mode, [{ value: 'only_holy_days', label: 'רק בשבת וחג' }, { value: 'not_holy_days', label: 'לא בשבת וחג' }], (v) => fc.patch((x) => { x.mode = v; }), 'mode')}</div></div>`;
};

const conditionGroup: FormFn = (fc) => html`${errLine(fc)}${fc.nested(fc.block.uid, 'conditions', 'condition')}`;

// ------------------------------------------------------------------------------------------------ actions

type Service = Extract<ActionBlock, { type: 'service' }>;

function argInputs(fc: FormCtx, b: Service, specArgs: ReadonlyArray<{ key: string; label: string; kind: string; min?: number; max?: number; step?: number; unit?: string; options?: Array<{ value: string; label: string }> }>): TemplateResult {
  const setData = (k: string, v: unknown) => fc.patch((x) => { if (v === null || v === undefined || v === '') delete x.data[k]; else x.data[k] = v; });
  return html`${specArgs.length ? html`<div class="frow">${specArgs.map((a) => {
    const v = b.data[a.key];
    if (a.kind === 'number') return html`<div class="fld sm"><label>${a.label}</label>${numIn(typeof v === 'number' ? v : null, (n) => setData(a.key, n), { unit: a.unit, min: a.min, max: a.max, attr: `data.${a.key}`, label: a.label })}</div>`;
    if (a.kind === 'select') return html`<div class="fld">${fld(a.label, sel(String(v ?? ''), [{ value: '', label: '—' }, ...(a.options ?? [])], (s) => setData(a.key, s), `data.${a.key}`, '', a.label))}</div>`;
    if (a.kind === 'boolean') return html`<div class="fld sm"><label>${a.label}</label><div class="rolechips"><button type="button" aria-pressed=${v === true} @click=${() => setData(a.key, v === true ? null : true)}>כן</button></div></div>`;
    return html`<div class="fld">${fld(a.label, textIn(String(v ?? ''), (s) => setData(a.key, s), { attr: `data.${a.key}`, label: a.label }))}</div>`;
  })}</div>` : nothing}`;
}

const sensitiveRow = (fc: FormCtx, b: Service): TemplateResult | typeof nothing => {
  const cls = b.role === 'device' && (b.entity_ids.length ? b.entity_ids : ['']).map((id) => sensitiveClassOf(b.action, id ? fc.env.byId.get(id)?.class ?? null : null)).find(Boolean);
  if (!cls) return nothing;
  return html`<div class="sensrow" data-sensitive-row>${icon('alarm')}<span>פעולה רגישה. מותרת לך כמו בשליטה ידנית; קוד לא נשמר.</span></div>`;
};

function deviceService(fc: FormCtx, b: Service): TemplateResult {
  const first = b.entity_ids[0];
  const dom = domainOf(first) || domainOf(b.action);
  const specs = fc.env.catalog.actions[dom] ?? [];
  const spec = specs.find((s) => s.action === b.action);
  const sensitiveStart = !b.entity_ids.length && sensitiveClassOf(b.action, null) !== null;
  const filter: PickerFilter = { purpose: 'target', controllable: true, ...(b.entity_ids.length ? { domains: [domainOf(first)] } : {}), ...(sensitiveStart ? { sensitive: true } : {}) };
  const apply = (ids: string[]) => fc.patch((x) => {
    x.entity_ids = ids;
    const d = domainOf(ids[0]);
    if (d && domainOf(x.action) !== d) { const acts = fc.env.catalog.actions[d]; if (acts?.length) { x.action = acts[0].action; x.data = {}; } }
  });
  const opts: Choice[] = specs.length ? specs.map((s) => ({ value: s.action, label: s.label || s.action })) : [{ value: b.action, label: b.action }];
  return html`${errLine(fc)}${entityChips(fc, b.entity_ids, { filter, apply })}
    <div class="frow"><div class="fld">${fld('פעולה', sel(b.action, opts, (v) => fc.patch((x) => { x.action = v; x.data = {}; }), 'action'))}</div></div>
    ${argInputs(fc, b, spec?.args ?? [])}${sensitiveRow(fc, b)}`;
}

function scriptFieldsInputs(fc: FormCtx, b: Service): TemplateResult | typeof nothing {
  const s = fc.env.catalog.scripts.find((x) => x.entity_id === b.action);
  const fields = (s?.fields ?? []).filter((f) => f.selector.kind !== 'locked');
  if (!fields.length) return nothing;
  const setData = (k: string, v: unknown) => fc.patch((x) => { if (v === null || v === undefined || v === '') delete x.data[k]; else x.data[k] = v; });
  return html`<div class="frow">${fields.map((f) => {
    const v = b.data[f.key];
    const sk = f.selector;
    if (sk.kind === 'number') return html`<div class="fld sm"><label>${f.name}</label>${numIn(typeof v === 'number' ? v : (f.default as number | null) ?? null, (n) => setData(f.key, n), { min: sk.min, max: sk.max, unit: sk.unit, attr: `data.${f.key}`, label: f.name })}</div>`;
    if (sk.kind === 'select') return html`<div class="fld">${fld(f.name, sel(String(v ?? f.default ?? ''), [{ value: '', label: '—' }, ...sk.options.map((o) => ({ value: o, label: o }))], (o) => setData(f.key, o), `data.${f.key}`, '', f.name))}</div>`;
    if (sk.kind === 'boolean') return html`<div class="fld sm"><label>${f.name}</label><div class="rolechips"><button type="button" aria-pressed=${(v ?? f.default) === true} @click=${() => setData(f.key, (v ?? f.default) === true ? false : true)}>כן</button></div></div>`;
    return html`<div class="fld">${fld(f.name, textIn(String(v ?? f.default ?? ''), (o) => setData(f.key, o), { attr: `data.${f.key}`, label: f.name }))}</div>`;
  })}</div>`;
}

const actionService: FormFn = (fc) => {
  const b = fc.block as Service;
  switch (b.role) {
    case 'scene':
      return html`${errLine(fc)}<div class="frow"><div class="fld">${fld('סצנה', sel(b.entity_ids[0] ?? '', [{ value: '', label: 'בחרו סצנה' }, ...fc.env.catalog.scenes.map((s) => ({ value: s.entity_id, label: s.area ? `${s.name} · ${s.area}` : s.name }))], (v) => fc.patch((x) => { x.entity_ids = v ? [v] : []; }), 'scene'))}</div></div>`;
    case 'script':
      return html`${errLine(fc)}<div class="frow"><div class="fld">${fld('סקריפט', sel(b.entity_ids[0] ?? '', [{ value: '', label: 'בחרו סקריפט' }, ...fc.env.catalog.scripts.map((s) => ({ value: s.entity_id, label: s.name }))], (v) => fc.patch((x) => { x.action = v || 'script.turn_on'; x.entity_ids = v ? [v] : []; x.data = {}; }), 'script'))}</div></div>${scriptFieldsInputs(fc, b)}`;
    case 'notify':
      return html`${errLine(fc)}<div class="frow"><div class="fld">${fld('אל', sel(b.action, fc.env.catalog.notify_targets.length ? fc.env.catalog.notify_targets.map((n) => ({ value: n.action, label: n.name })) : [{ value: b.action, label: fc.env.ctx.notifyName?.(b.action) ?? b.action }], (v) => fc.patch((x) => { x.action = v; }), 'target'))}</div></div>
        ${fld('הודעה', html`<label class="inp"><input type="text" data-fld="message" aria-label="הודעה" dir="auto" placeholder="מה לכתוב" .value=${typeof b.data.message === 'string' ? b.data.message : ''} @input=${(e: Event) => fc.patch((x) => { x.data.message = (e.target as HTMLInputElement).value; })} /></label>`)}`;
    case 'automation':
      return html`${errLine(fc)}<div class="codenote">${icon('bolt')}שולט באוטומציה אחרת. אפשר להזיז או למחוק.</div>`;
    default:
      return deviceService(fc, b);
  }
};

const actionDelay: FormFn = (fc) => {
  const b = fc.block as ActionBlock & { type: 'delay' };
  return html`${errLine(fc)}${durationFields(b.delay, (d) => fc.patch((x) => { x.delay = d ?? {}; }), 'delay')}`;
};

const sectionTitle = (kind: 'if' | 'then' | 'else' | 'opt', n?: number): TemplateResult => {
  const ic = kind === 'then' ? 'play' : kind === 'else' ? 'shuffle' : 'question';
  const text = kind === 'if' ? 'אם' : kind === 'then' ? 'אז' : kind === 'else' ? 'אחרת' : `ענף ${n} · אם`;
  return html`<h4 class="sub-h"><span class="k ${kind === 'then' ? 'then' : 'if'}">${icon(ic, 12)}</span>${text}</h4>`;
};

const actionIf: FormFn = (fc) => html`${errLine(fc)}<div class="bsec">${sectionTitle('if')}${fc.nested(fc.block.uid, 'if', 'condition')}</div>
  <div class="bsec">${sectionTitle('then')}${fc.nested(fc.block.uid, 'then', 'action')}</div>
  <div class="bsec">${sectionTitle('else')}${fc.nested(fc.block.uid, 'else', 'action')}</div>`;

const actionChoose: FormFn = (fc) => {
  const b = fc.block as ActionBlock & { type: 'choose' };
  return html`${errLine(fc)}${b.options.map((_o, i) => html`<div class="bsec" data-choose-option=${i}>
      <div class="opt-h">${sectionTitle('opt', i + 1)}${b.options.length > 1 ? html`<button class="btn quiet sm" type="button" data-option-remove=${i} @click=${() => fc.patch((x) => { x.options.splice(i, 1); })}>${icon('trash')}הסר ענף</button>` : nothing}</div>
      ${fc.nested(fc.block.uid, `choose.${i}.conditions`, 'condition')}
      ${sectionTitle('then')}${fc.nested(fc.block.uid, `choose.${i}.sequence`, 'action')}</div>`)}
    ${b.options.length < CAPS.choose_options_max ? html`<button class="btn quiet sm" type="button" data-option-add @click=${() => fc.patch((x) => { x.options.push({ conditions: [], sequence: [] }); })}>${icon('plus')}ענף נוסף</button>` : nothing}
    ${b.default ? html`<div class="bsec">${sectionTitle('else')}${fc.nested(fc.block.uid, 'default', 'action')}</div>`
      : html`<button class="btn quiet sm" type="button" data-default-add @click=${() => fc.patch((x) => { x.default = []; })}>${icon('plus')}ענף "אחרת"</button>`}`;
};

const actionRepeat: FormFn = (fc) => {
  const b = fc.block as ActionBlock & { type: 'repeat_count' };
  return html`${errLine(fc)}<div class="frow"><div class="fld sm"><label>פעמים</label>${numIn(b.count, (n) => fc.patch((x) => { x.count = Math.round(n ?? 1); }), { min: 1, max: 1000, attr: 'count' })}</div></div>
    <div class="bsec">${fc.nested(fc.block.uid, 'repeat.sequence', 'action')}</div>`;
};

const actionCondition: FormFn = (fc) => {
  const inner = (fc.block as ActionBlock & { type: 'condition' }).condition;
  const f = FORMS[`condition:${inner.type}`];
  return html`${errLine(fc)}${f ? f(fc.child(inner, 'condition')) : nothing}`;
};

const actionStop: FormFn = (fc) => {
  const b = fc.block as ActionBlock & { type: 'stop' };
  return html`${errLine(fc)}${fld('הודעה (לא חובה)', textIn(b.message, (v) => fc.patch((x) => { x.message = v; }), { attr: 'message', ph: 'למה עוצרים' }))}`;
};

// ------------------------------------------------------------------------------------------------ the registry

export const FORMS: Record<string, FormFn> = {
  'trigger:state': triggerState, 'trigger:numeric_state': triggerNumeric, 'trigger:time': triggerTime, 'trigger:time_pattern': triggerPattern, 'trigger:sun': triggerSun, 'trigger:homeassistant': triggerStart,
  'condition:state': conditionState, 'condition:numeric_state': conditionNumeric, 'condition:time': conditionTime, 'condition:sun': conditionSun, 'condition:trigger': conditionTrigger, 'condition:shabbat': conditionShabbat,
  'condition:and': conditionGroup, 'condition:or': conditionGroup, 'condition:not': conditionGroup,
  'action:service': actionService, 'action:delay': actionDelay, 'action:if': actionIf, 'action:choose': actionChoose, 'action:repeat_count': actionRepeat, 'action:condition': actionCondition, 'action:stop': actionStop,
};

/** The form keys of every typed block type of the contract (a spec checks that none is missing). */
export const TYPED_FORM_KEYS = [
  'trigger:state', 'trigger:numeric_state', 'trigger:time', 'trigger:time_pattern', 'trigger:sun', 'trigger:homeassistant',
  'condition:state', 'condition:numeric_state', 'condition:time', 'condition:sun', 'condition:trigger', 'condition:and', 'condition:or', 'condition:not', 'condition:shabbat',
  'action:service', 'action:delay', 'action:choose', 'action:if', 'action:repeat_count', 'action:condition', 'action:stop',
] as const;

/** A typed block's form, or the locked block's read-only body. */
export function formFor(fc: FormCtx): TemplateResult {
  const b = fc.block;
  if (b.kind === 'locked') return lockedForm(fc, b);
  const f = FORMS[`${fc.section}:${(b as Block & { type: string }).type}`];
  return f ? f(fc) : html`<div class="codenote">${icon('info')}אין טופס לחלק הזה.</div>`;
}

function lockedForm(fc: FormCtx, b: LockedBlock): TemplateResult {
  const lines = JSON.stringify(b.raw, null, 2).split('\n');
  const editable = fc.canCode && !b.masked && b.reason === 'template' && typeof b.template_text === 'string';
  return html`<div class="codenote" data-locked-note>${icon('lock')}<span>${lockedWhy(b)}. אפשר להזיז, לשכפל או למחוק${fc.canCode ? '; לעריכה – תצוגת הקוד' : ''}.</span></div>
    ${controlsSchedules(b) ? html`<div class="codenote">${icon('calendar')}שולט בתזמונים של המערכת.</div>` : nothing}
    ${editable ? html`<div class="fld full"><label><span class="tag lock">{{ }}</span> טקסט התבנית</label>
      <label class="inp area"><textarea rows="3" dir="ltr" data-template-text aria-label="טקסט התבנית" .value=${b.template_text ?? ''} @change=${(e: Event) => fc.editTemplate(b.uid, (e.target as HTMLTextAreaElement).value)}></textarea></label></div>` : nothing}
    <div class="lockcode" data-locked-code dir="ltr">${lines.map((l) => html`<span class="ln">${l}</span>`)}</div>
    ${fc.canCode ? html`<div class="frow"><button class="btn sm" type="button" data-goto-code @click=${fc.gotoCode}>${icon('code')}ערוך בקוד</button></div>` : nothing}`;
}


/** The styles of the controls the forms draw (they live in the editor's shadow root). */
export const formStyles = css`
  .bf {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .err {
    font-size: var(--sw-fs-sm);
    color: var(--dv-danger);
    display: flex;
    gap: 6px;
    align-items: center;
    font-weight: 600;
  }
  .entpick {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .ent {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-block-size: 36px;
    padding-block: 3px;
    padding-inline: 12px 6px;
    border-radius: 999px;
    background: var(--dv-surface-solid, var(--dv-surface));
    border: 1px solid var(--dv-border);
    font-size: var(--sw-fs-base);
    font-weight: 500;
  }
  .ent .ic {
    font-size: var(--sw-fs-md);
    color: var(--dv-text-2);
  }
  .ent small {
    color: var(--dv-text-3);
    font-size: var(--sw-fs-xs);
  }
  .ent small.bad {
    color: var(--dv-danger);
  }
  .ent .rm {
    inline-size: 26px;
    block-size: 26px;
    border-radius: 50%;
    border: 0;
    background: var(--dv-surface-3);
    display: grid;
    place-items: center;
    color: var(--dv-text-2);
    padding: 0;
  }
  .ent .rm .ic {
    font-size: var(--sw-fs-xs);
    color: inherit;
  }
  .ent.add {
    border-style: dashed;
    border-color: var(--dv-border-strong);
    color: var(--dv-accent-text);
    font-weight: 600;
    padding-inline: 12px;
    background: transparent;
    cursor: pointer;
  }
  .ent.add .ic {
    color: var(--dv-accent-text);
  }
  .ent.sens {
    border-color: var(--ab-sens-line);
    background: var(--ab-sens-bg);
  }
  .opts {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--dv-radius-sm, 14px);
    background: var(--dv-surface-2);
    border: 1px solid var(--dv-border);
  }
  .opts summary {
    cursor: pointer;
    font-size: var(--sw-fs-base);
    font-weight: 600;
    color: var(--dv-text-2);
    display: flex;
    align-items: center;
    gap: 8px;
    min-block-size: 28px;
    list-style: none;
  }
  .opts summary::-webkit-details-marker {
    display: none;
  }
  .opts summary .ic {
    font-size: var(--sw-fs-lg);
    transition: transform 200ms;
  }
  .opts[open] summary .ic {
    transform: rotate(180deg);
  }
  .codenote {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
    line-height: 1.5;
  }
  .codenote .ic {
    margin-block-start: 3px;
    font-size: var(--sw-fs-md);
  }
  .sensrow {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 9px 12px;
    border-radius: var(--sw-r-md);
    background: var(--ab-sens-bg);
    color: var(--ab-sens-fg);
    font-size: var(--sw-fs-sm);
    font-weight: 600;
  }
  .bsec {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sub-h {
    margin: 4px 0 0;
    font-size: var(--sw-fs-base);
    font-weight: 700;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .opt-h {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .k {
    display: grid;
    place-items: center;
    inline-size: 22px;
    block-size: 22px;
    border-radius: var(--sw-r-xs);
    color: var(--sw-text-inverse);
    flex: none;
  }
  .k.if {
    background: var(--sw-text-3);
  }
  .k.then {
    background: var(--dv-accent);
  }
  .lockcode {
    border-radius: var(--sw-r-md);
    background: var(--dv-surface-3);
    padding: 8px 10px;
    font: 12px/1.7 var(--sw-font-mono, ui-monospace, monospace);
    max-block-size: 220px;
    overflow: auto;
    border-inline-start: 3px solid var(--dv-text-3);
    text-align: left;
  }
  .lockcode .ln {
    display: block;
    white-space: pre;
  }
`;
