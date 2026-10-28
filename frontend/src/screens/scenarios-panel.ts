import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-drawer';
import '../components/sw-dialog';
import './scenario-recipients';
import { aIcon } from '../components/automation-icons';
import { automationsStyles } from '../styles/automations-glass';
import { bubbleChrome } from '../styles/bubble-chrome';
import { SkinController } from '../design/skin';
import { ApiError } from '../api/client';
import { bidi } from '../i18n/bidi';
import { sct } from '../i18n/scenarios';
import {
  cmpsFor, createScenario, deleteScenario, disableScenario, draftProblems, enableScenario, getScenario, isGroup, isLeaf, isNot, isRedacted, leafPaths,
  listScenarios, newLeaf, scenarioChoices, scenarioRuns, scenarioSignals, simulateScenario, stateTone, testScenario, updateScenario,
  type Action, type Cmp, type ScenarioChoices, type Definition, type DryRun, type Leaf, type Node, type Run, type Scenario, type ScenariosStatus, type SignalDef, type SignalsCatalogue, type Tri,
} from '../api/scenarios';
import type { DrawerResult } from './automation-drawer';
import { dateInputLang } from '../api/day-format';

const CMP_TEXT: Record<Cmp, string> = { is_true: 'כן', is_false: 'לא', gt: '>', ge: '≥', lt: '<', le: '≤', eq: '=', ne: '≠', between: 'בין', outside: 'מחוץ ל', in_set: 'אחד מ' };
const TRI: Record<Tri, { mark: string; cls: string }> = { TRUE: { mark: '✓', cls: 't' }, FALSE: { mark: '✗', cls: 'f' }, UNKNOWN: { mark: '?', cls: 'u' } };

const emptyDraft = (): Definition => ({ when: { op: 'and', items: [] }, actions: [{ type: 'notify', to: { roles: [], users: [] } }], options: {} });

/**
 * XSCENARIO109-295 `<scenarios-panel .status .scenarioId>`: the "תרחישים" block family inside the automations area (owner Q1 = 276 b). The list is a
 * paged grid that always fits the viewport (owner rule 24.10: no scrolling on control screens); a card opens the editor sheet: a condition tree
 * over the Arx signals (read-only mirror of module data), at most three actions from the closed set (notification, service request, flag), the
 * options, a dry run (with optional test values per condition) and the run history. Enabling refuses an untested version (server rule). The panel
 * reports with `result` {text, tone} and `open-scenario` {id} / `close-scenario`.
 */
@customElement('scenarios-panel')
export class ScenariosPanel extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) status: ScenariosStatus | null = null;
  @property() scenarioId = '';
  @state() private list: Scenario[] | null = null;
  @state() private failed = false;
  @state() private cat: SignalsCatalogue | null = null;
  @state() private choices: ScenarioChoices | null = null;
  @state() private page = 0;
  @state() private pageSize = 6;
  @state() private editing: Scenario | null = null;
  @state() private draft: Definition = emptyDraft();
  @state() private name = '';
  @state() private description = '';
  @state() private dry: DryRun | null = null;
  @state() private runs: Run[] = [];
  @state() private sim = false;
  @state() private simValues: Record<string, string> = {};
  @state() private errors: { path: string; message: string }[] = [];
  @state() private busy = false;
  @state() private dialog: '' | 'delete' | 'confirm-enable' = '';
  @state() private view: 'edit' | 'runs' = 'edit';
  private loadedId = '__none__';
  private ro?: ResizeObserver;

  static styles = [bubbleChrome, ...automationsStyles, css`
    :host { display: block; block-size: 100%; }
    .wrap { display: flex; flex-direction: column; gap: 12px; block-size: 100%; min-block-size: 0; }
    .grid { flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); grid-auto-rows: 118px; gap: 12px; overflow: hidden; }
    /* R5-DEVICES-297: a scenario card is the top step (shadow 2, no outline), its name a heading, its state a filled pill; the card
       sinks on pointer-down, hover for a fine pointer only */
    .card { display: flex; flex-direction: column; gap: 6px; padding: 14px 16px; border-radius: var(--sw-r-lg, 20px); cursor: pointer; text-align: start; border: 1px solid var(--dv-border); background: var(--mm-sheen), var(--dv-surface); box-shadow: var(--dv-shadow-2); color: var(--dv-text); font: inherit; min-inline-size: 0; transition: transform var(--sw-t-fast, 120ms) var(--sw-ease, ease-out), box-shadow var(--mm-motion, 200ms) var(--mm-ease, ease-out); }
    .card:focus-visible { outline: 2px solid var(--dv-focus); outline-offset: 2px; }
    .card:active { transform: scale(var(--sw-press-scale, 1)); }
    @media (hover: hover) and (pointer: fine) { .card:hover { box-shadow: var(--dv-shadow-3, var(--dv-shadow-2)); } }
    .card b { font-size: var(--sw-fs-xl); font-weight: 800; color: var(--sw-heading, var(--dv-text)); letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .row { display: flex; align-items: center; gap: 8px; min-inline-size: 0; }
    .meta { color: var(--dv-text-2); font-size: var(--sw-fs-base); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .st { display: inline-flex; align-items: center; min-block-size: 26px; font-size: var(--sw-fs-sm); font-weight: 700; padding: 0 10px; border-radius: 999px; background: var(--dv-surface-3); color: var(--dv-text-2); white-space: nowrap; }
    .st.ok { background: var(--dv-success-soft); color: var(--au-ok-text, var(--dv-success)); }
    .st.warn { background: var(--dv-warning-soft); color: var(--au-warn-text, var(--dv-warning)); }
    .st.bad { background: var(--dv-danger-soft); color: var(--au-bad-text, var(--dv-danger)); }
    .mods { display: flex; gap: 4px; flex-wrap: nowrap; overflow: hidden; }
    .pager { display: flex; justify-content: center; align-items: center; gap: 10px; color: var(--dv-text-2); font-size: var(--sw-fs-sm, 13px); }
    .kill { padding: 8px 12px; border-radius: var(--sw-r-md, 12px); background: var(--dv-danger-soft); color: var(--dv-danger); }
    .center { display: grid; place-items: center; gap: 10px; padding: 32px; color: var(--dv-text-2); }
    sw-drawer { --sw-drawer-modal-w: 760px; }
    .ed { display: grid; gap: 12px; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .tree { display: grid; gap: 6px; }
    /* R5-DEVICES-297: a group is a well, not a side-tab accent border (impeccable detect) */
    .grp { background: var(--dv-surface-2); border-radius: var(--sw-r-md, 12px); padding: 8px 10px; display: grid; gap: 6px; }
    .grp-h { display: flex; gap: 6px; align-items: center; }
    .leaf { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px 8px; border-radius: var(--sw-r-md, 12px); background: var(--dv-surface-2); }
    .leaf select, .leaf input, .act select, .act input, .ed input, .ed select, .ed textarea { font: inherit; color: var(--dv-text); background: var(--dv-surface); border: 1px solid var(--dv-border); border-radius: var(--dv-radius-control, 10px); padding: 4px 8px; min-inline-size: 0; }
    .leaf input[type='number'] { inline-size: 84px; }
    .leaf .sm { inline-size: 64px; }
    .red { color: var(--dv-text-3); font-style: italic; padding: 6px 8px; }
    .tri { inline-size: 22px; block-size: 22px; display: inline-grid; place-items: center; border-radius: 50%; font-size: var(--sw-fs-sm); font-weight: 700; }
    .tri.t { background: var(--dv-success-soft); color: var(--dv-success); }
    .tri.f { background: var(--dv-surface-3); color: var(--dv-text-2); }
    .tri.u { background: var(--dv-warning-soft); color: var(--dv-warning); }
    .act { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px 8px; border-radius: var(--sw-r-md, 12px); background: var(--dv-surface-2); }
    .dry { padding: 10px 12px; border-radius: var(--sw-r-md, 12px); background: var(--dv-surface-2); display: grid; gap: 4px; }
    .dry b.t { color: var(--dv-success); } .dry b.u { color: var(--dv-warning); }
    .err { color: var(--dv-danger); font-size: var(--sw-fs-sm, 13px); }
    .hint { color: var(--dv-text-3); font-size: var(--sw-fs-xs, 12px); }
    .days { display: inline-flex; gap: 2px; }
    .days button { min-inline-size: 26px; padding: 2px 4px; border-radius: var(--sw-r-xs); border: 1px solid var(--dv-border); background: var(--dv-surface); color: var(--dv-text-2); font: inherit; font-size: var(--sw-fs-sm); cursor: pointer; }
    .days button[aria-pressed='true'] { background: var(--dv-accent-soft); color: var(--dv-accent-text, var(--dv-accent)); }
    .foot { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    .runs { display: grid; gap: 6px; }
    .run { padding: 8px 10px; border-radius: var(--sw-r-md, 12px); background: var(--dv-surface-2); display: grid; gap: 2px; font-size: var(--sw-fs-sm, 13px); }
    details > summary { cursor: pointer; color: var(--dv-text-2); }
    @media (max-width: 640px) { .two { grid-template-columns: 1fr; } .grid { grid-auto-rows: 104px; } }
  `];

  connectedCallback(): void {
    super.connectedCallback();
    this.ro = new ResizeObserver(() => this.fit());
    this.ro.observe(this);
    void this.load();
  }

  disconnectedCallback(): void {
    this.ro?.disconnect();
    super.disconnectedCallback();
  }

  /** Cards per page = what fits the panel's box (no page scroll on a control screen). */
  private fit() {
    const w = this.clientWidth || 900;
    const h = (this.clientHeight || 520) - 60;
    const cols = Math.max(1, Math.floor((w + 12) / 292));
    const rows = Math.max(1, Math.floor((h + 12) / 130));
    const size = cols * rows;
    if (size !== this.pageSize) {
      this.pageSize = size;
      this.page = 0;
    }
  }

  private say(text: string, tone: 'ok' | 'error' = 'ok') {
    this.dispatchEvent(new CustomEvent<DrawerResult>('result', { detail: { text, tone }, bubbles: true, composed: true }));
  }

  private async load() {
    try {
      const [l, c] = await Promise.all([listScenarios(), this.cat ? Promise.resolve(this.cat) : scenarioSignals()]);
      this.list = l.scenarios;
      this.cat = c;
      this.failed = false;
    } catch {
      this.failed = true;
    }
    if (this.status?.can.manage && !this.choices) void scenarioChoices().then((c) => (this.choices = c)).catch(() => undefined);
  }

  protected updated(changed: PropertyValues<this>): void {
    if (changed.has('scenarioId') && this.scenarioId !== this.loadedId) void this.openEditor(this.scenarioId);
  }

  private async openEditor(id: string) {
    this.loadedId = id;
    this.dry = null;
    this.errors = [];
    this.sim = false;
    this.simValues = {};
    this.view = 'edit';
    this.runs = [];
    if (!id) {
      this.editing = null;
      return;
    }
    if (id === 'new') {
      this.editing = { id: '', name: '', description: '', enabled: false, version: 0, state: 'off' } as Scenario;
      this.name = '';
      this.description = '';
      this.draft = emptyDraft();
      return;
    }
    try {
      const s = await getScenario(id);
      this.editing = s;
      this.name = s.name;
      this.description = s.description;
      this.draft = s.definition ? structuredClone(s.definition) : emptyDraft();
      this.draft.options = this.draft.options ?? {};
    } catch {
      this.say(sct('loadError'), 'error');
      this.close();
    }
  }

  private close() {
    this.dispatchEvent(new CustomEvent('close-scenario', { bubbles: true, composed: true }));
  }

  private open(id: string) {
    this.dispatchEvent(new CustomEvent('open-scenario', { detail: { id }, bubbles: true, composed: true }));
  }

  // ------------------------------------------------------------------------------------------------ tree editing (immutable updates)

  private sig(id: string): SignalDef | undefined {
    return this.cat?.signals.find((s) => s.id === id);
  }

  private setAt(path: number[], fn: (n: Node) => Node | null) {
    const rec = (n: Node, p: number[]): Node | null => {
      if (!p.length) return fn(n);
      if (isGroup(n)) {
        const items = n.items.map((it, i) => (i === p[0] ? rec(it, p.slice(1)) : it)).filter((x): x is Node => x !== null);
        return { ...n, items };
      }
      if (isNot(n)) {
        const it = rec(n.item, p.slice(1));
        return it === null ? null : { ...n, item: it };
      }
      return n;
    };
    const when = rec(this.draft.when, path) ?? { op: 'and', items: [] };
    this.draft = { ...this.draft, when };
    this.dry = null;
  }

  private addLeaf(path: number[]) {
    const first = this.cat?.signals[0];
    if (!first) return;
    this.setAt(path, (n) => (isGroup(n) ? { ...n, items: [...n.items, newLeaf(first)] } : n));
  }

  private addGroup(path: number[]) {
    this.setAt(path, (n) => (isGroup(n) ? { ...n, items: [...n.items, { op: n.op === 'and' ? 'or' : 'and', items: [] }] } : n));
  }

  private leafRow(leaf: Leaf, path: number[], sp: string, snap?: DryRun['snapshot'][number]): TemplateResult {
    const s = this.sig(leaf.signal);
    const upd = (patch: Partial<Leaf>) => this.setAt(path, (n) => ({ ...(n as Leaf), ...patch }));
    const signals = this.cat?.signals ?? [];
    const groups = [...new Set(signals.map((x) => x.module_label))];
    const num = (v: string) => (v === '' ? undefined : Number(v));
    return html`<div class="leaf" data-leaf=${sp}>
      ${snap ? html`<span class=${`tri ${TRI[snap.result].cls}`} title=${snap.reason ?? ''}>${TRI[snap.result].mark}</span>` : nothing}
      <select aria-label=${sct('signal')} @change=${(e: Event) => { const ns = this.sig((e.target as HTMLSelectElement).value); if (ns) this.setAt(path, () => newLeaf(ns)); }}>
        ${groups.map((g) => html`<optgroup label=${g}>${signals.filter((x) => x.module_label === g).map((x) => html`<option value=${x.id} ?selected=${x.id === leaf.signal}>${x.label}</option>`)}</optgroup>`)}
      </select>
      ${s && s.subject !== 'none' && s.subject !== 'window'
        ? s.subject === 'flag'
          ? html`<input aria-label=${sct('flagName')} .value=${leaf.subject ?? ''} pattern="[a-z][a-z0-9_]{1,39}" @change=${(e: Event) => upd({ subject: (e.target as HTMLInputElement).value.trim() })} />`
          : html`<select aria-label=${sct('subject')} @change=${(e: Event) => upd({ subject: (e.target as HTMLSelectElement).value })}>${s.subjects.map((x) => html`<option value=${x.id} ?selected=${x.id === leaf.subject}>${bidi(x.name)}</option>`)}</select>`
        : nothing}
      ${s?.subject === 'window' && leaf.window ? this.windowEditor(leaf, upd) : nothing}
      ${s ? html`<select aria-label="השוואה" @change=${(e: Event) => { const c = (e.target as HTMLSelectElement).value as Cmp; upd({ cmp: c, value: c === 'between' || c === 'outside' ? [2, 8] : c === 'is_true' || c === 'is_false' ? undefined : typeof leaf.value === 'number' ? leaf.value : 0 }); }}>
        ${cmpsFor(s.kind).map((c) => html`<option value=${c} ?selected=${c === leaf.cmp}>${CMP_TEXT[c]}</option>`)}</select>` : nothing}
      ${s && (s.kind === 'number' || s.kind === 'count') && !Array.isArray(leaf.value) && leaf.cmp !== 'is_true' && leaf.cmp !== 'is_false'
        ? html`<input type="number" aria-label=${sct('value')} .value=${String(leaf.value ?? '')} step=${s.kind === 'count' ? '1' : '0.1'} @change=${(e: Event) => upd({ value: Number((e.target as HTMLInputElement).value) })} />${s.unit ? html`<span class="hint">${s.unit}</span>` : nothing}` : nothing}
      ${Array.isArray(leaf.value) ? html`<input type="number" class="sm" aria-label="מ" .value=${String(leaf.value[0])} @change=${(e: Event) => upd({ value: [Number((e.target as HTMLInputElement).value), Number((leaf.value as number[])[1])] })} />–<input type="number" class="sm" aria-label="עד" .value=${String(leaf.value[1])} @change=${(e: Event) => upd({ value: [Number((leaf.value as number[])[0]), Number((e.target as HTMLInputElement).value)] })} />` : nothing}
      <label class="hint">${sct('holdFor')} <input type="number" class="sm" min="0" .value=${String(leaf.hold_s ?? '')} @change=${(e: Event) => upd({ hold_s: num((e.target as HTMLInputElement).value) })} /></label>
      ${s?.kind === 'bool' ? html`<label class="hint">${sct('debounce')} <input type="number" class="sm" min="0" .value=${String(leaf.debounce_s ?? '')} placeholder=${String(s.default_debounce_s)} @change=${(e: Event) => upd({ debounce_s: num((e.target as HTMLInputElement).value) })} /></label>` : nothing}
      ${s && (s.kind === 'number' || s.kind === 'count') && ['gt', 'ge', 'lt', 'le'].includes(leaf.cmp) ? html`<label class="hint">${sct('margin')} <input type="number" class="sm" min="0" step="0.1" .value=${String(leaf.hysteresis?.clear_margin ?? '')} placeholder=${String(s.default_margin)} @change=${(e: Event) => { const v = num((e.target as HTMLInputElement).value); upd({ hysteresis: v === undefined ? undefined : { clear_margin: v } }); }} /></label>` : nothing}
      ${this.sim ? html`<label class="hint">${sct('simulateHint')} <input class="sm" data-sim=${sp} .value=${this.simValues[sp] ?? ''} placeholder=${s?.kind === 'bool' ? 'כן/לא' : '—'} @change=${(e: Event) => (this.simValues = { ...this.simValues, [sp]: (e.target as HTMLInputElement).value })} /></label>` : nothing}
      <button type="button" class="btn sm" aria-label=${sct('remove')} @click=${() => this.setAt(path, () => null)}>${aIcon('close')}</button>
    </div>`;
  }

  private windowEditor(leaf: Leaf, upd: (p: Partial<Leaf>) => void): TemplateResult {
    const w = leaf.window!;
    const names = sct('dayNames').split(',');
    const toggle = (d: number) => {
      const days = w.days.includes(d) ? w.days.filter((x) => x !== d) : [...w.days, d].sort();
      if (days.length) upd({ window: { ...w, days } });
    };
    return html`<span class="days" role="group" aria-label=${sct('days')}>${[6, 0, 1, 2, 3, 4, 5].map((d) => html`<button type="button" aria-pressed=${String(w.days.includes(d))} @click=${() => toggle(d)}>${names[d]}</button>`)}</span>
      <input type="time" lang=${dateInputLang()} aria-label=${sct('from')} .value=${w.from} @change=${(e: Event) => upd({ window: { ...w, from: (e.target as HTMLInputElement).value } })} />
      <input type="time" lang=${dateInputLang()} aria-label=${sct('to')} .value=${w.to} @change=${(e: Event) => upd({ window: { ...w, to: (e.target as HTMLInputElement).value } })} />`;
  }

  private nodeView(n: Node, path: number[], sp: string): TemplateResult {
    const snap = this.dry?.snapshot.find((x) => x.path === sp);
    if (isRedacted(n)) return html`<div class="red" data-redacted>${sct('redacted')}</div>`;
    if (isLeaf(n)) return this.leafRow(n, path, sp, snap);
    if (isNot(n)) return html`<div class="grp"><div class="grp-h"><b>${sct('not')}</b><button type="button" class="btn sm" @click=${() => this.setAt(path, (x) => (isNot(x) ? x.item : x))}>${sct('remove')}</button></div>${this.nodeView(n.item, [...path, 0], `${sp}.item`)}</div>`;
    const g = n;
    return html`<div class="grp" data-group=${sp}>
      <div class="grp-h">
        <div class="seg sm" role="radiogroup" aria-label="חיבור">
          <button type="button" role="radio" aria-checked=${String(g.op === 'and')} @click=${() => this.setAt(path, (x) => ({ ...(x as typeof g), op: 'and' }))}>${sct('and')}</button>
          <button type="button" role="radio" aria-checked=${String(g.op === 'or')} @click=${() => this.setAt(path, (x) => ({ ...(x as typeof g), op: 'or' }))}>${sct('or')}</button>
        </div>
        <button type="button" class="btn sm" data-add-leaf @click=${() => this.addLeaf(path)}>${aIcon('plus')}${sct('addCondition')}</button>
        ${path.length < 3 ? html`<button type="button" class="btn sm" @click=${() => this.addGroup(path)}>${aIcon('plus')}${sct('addGroup')}</button>` : nothing}
        ${path.length ? html`<button type="button" class="btn sm" @click=${() => this.setAt(path, () => null)}>${sct('remove')}</button>` : nothing}
      </div>
      ${g.items.map((it, i) => this.nodeView(it, [...path, i], `${sp}.items[${i}]`))}
    </div>`;
  }

  private actionRow(a: Action, i: number): TemplateResult {
    const set = (next: Action) => { const actions = [...this.draft.actions]; actions[i] = next; this.draft = { ...this.draft, actions }; this.dry = null; };
    const off = this.status && !this.status.actions[a.type];
    return html`<div class="act" data-action=${a.type}>
      <select aria-label="פעולה" @change=${(e: Event) => { const t = (e.target as HTMLSelectElement).value; set(t === 'notify' ? { type: 'notify', to: { roles: [], users: [] } } : t === 'set_flag' ? { type: 'set_flag', flag: 'flag_1', value: true } : { type: 'create_service_request', department_id: '' }); }}>
        <option value="notify" ?selected=${a.type === 'notify'}>${sct('actNotify')}</option>
        ${this.cat?.tickets_on || a.type === 'create_service_request' ? html`<option value="create_service_request" ?selected=${a.type === 'create_service_request'}>${sct('actTicket')}</option>` : nothing}
        <option value="set_flag" ?selected=${a.type === 'set_flag'}>${sct('actFlag')}</option>
      </select>
      ${a.type === 'notify' ? html`<scenario-recipients data-notify-to .choices=${this.choices} .value=${{ users: a.to?.users ?? [], roles: a.to?.roles ?? [] }}
        @change=${(e: CustomEvent<{ value: { users: string[]; roles: string[] } }>) => set({ ...a, to: e.detail.value })}></scenario-recipients>` : nothing}
      ${a.type === 'create_service_request' ? html`<select aria-label=${sct('department')} data-department @change=${(e: Event) => set({ ...a, department_id: (e.target as HTMLSelectElement).value })}>
          <option value="" ?selected=${!a.department_id}>${sct('departmentPick')}</option>
          ${(this.choices?.departments ?? []).map((d) => html`<option value=${d.id} ?selected=${d.id === a.department_id}>${bidi(d.name)}</option>`)}
          ${a.department_id && !(this.choices?.departments ?? []).some((d) => d.id === a.department_id) ? html`<option value=${a.department_id} selected>${a.department_id}</option>` : nothing}
        </select>
        <input aria-label=${sct('ticketTitle')} placeholder=${sct('ticketTitle')} .value=${a.title ?? ''} @change=${(e: Event) => { const v = (e.target as HTMLInputElement).value.trim(); set({ ...a, title: v || undefined }); }} />
        ${this.cat && !this.cat.tickets_on ? html`<span class="err">${sct('ticketsOff')}</span>` : nothing}` : nothing}
      ${a.type === 'set_flag' ? html`<input aria-label=${sct('flagName')} .value=${a.flag} @change=${(e: Event) => set({ ...a, flag: (e.target as HTMLInputElement).value.trim() })} />
        <select aria-label=${sct('flagValue')} @change=${(e: Event) => set({ ...a, value: (e.target as HTMLSelectElement).value === 'true' })}><option value="true" ?selected=${a.value}>כן</option><option value="false" ?selected=${!a.value}>לא</option></select>` : nothing}
      ${off ? html`<span class="hint" data-action-off>${sct('actionOff')}</span>` : nothing}
      <button type="button" class="btn sm" aria-label=${sct('remove')} @click=${() => { this.draft = { ...this.draft, actions: this.draft.actions.filter((_, j) => j !== i) }; }}>${aIcon('close')}</button>
    </div>`;
  }

  private optionsView(): TemplateResult {
    const o = this.draft.options ?? {};
    const d = this.cat?.option_defaults;
    const set = (k: keyof NonNullable<Definition['options']>, v: string) => {
      const next = { ...o } as Record<string, unknown>;
      if (v === '') delete next[k];
      else next[k] = k === 'on_unknown' ? v : Number(v);
      this.draft = { ...this.draft, options: next };
      this.dry = null;
    };
    const num = (k: 'cooldown_s' | 'clear_after_s' | 'for_s' | 'unknown_grace_s' | 'max_fires_per_day' | 'max_tickets_per_day', label: string) =>
      html`<label class="fld">${label}<input type="number" min="0" .value=${String(o[k] ?? '')} placeholder=${d && k in d ? String((d as Record<string, unknown>)[k]) : ''} @change=${(e: Event) => set(k, (e.target as HTMLInputElement).value)} /></label>`;
    return html`<details><summary>${sct('options')}</summary><div class="two">
      ${num('cooldown_s', sct('cooldown'))}${num('clear_after_s', sct('clearAfter'))}${num('for_s', sct('forS'))}${num('unknown_grace_s', sct('grace'))}
      <label class="fld">${sct('onUnknown')}<select @change=${(e: Event) => set('on_unknown', (e.target as HTMLSelectElement).value)}><option value="hold" ?selected=${o.on_unknown !== 'treat_as_false'}>${sct('onUnknownHold')}</option><option value="treat_as_false" ?selected=${o.on_unknown === 'treat_as_false'}>${sct('onUnknownFalse')}</option></select></label>
      ${num('max_fires_per_day', sct('maxFires'))}${num('max_tickets_per_day', sct('maxTickets'))}
    </div></details>`;
  }

  // ------------------------------------------------------------------------------------------------ server calls

  private overrides(): Record<string, number | boolean | null> | undefined {
    if (!this.sim) return undefined;
    const out: Record<string, number | boolean | null> = {};
    for (const [p, raw] of Object.entries(this.simValues)) {
      const v = raw.trim();
      if (!v) continue;
      out[p] = v === 'כן' || v === 'true' ? true : v === 'לא' || v === 'false' ? false : v === '?' ? null : Number(v);
    }
    return Object.keys(out).length ? out : undefined;
  }

  private fail(e: unknown) {
    if (e instanceof ApiError) {
      const det = (e.body.details ?? {}) as { errors?: { path: string; message: string }[] };
      this.errors = det.errors ?? [];
      this.say(e.code === 'version_conflict' ? sct('conflict') : e.code === 'test_required' ? sct('testFirst') : e.message, 'error');
    } else this.say(String(e), 'error');
  }

  private async runDry() {
    if (!this.editing) return;
    this.busy = true;
    this.errors = [];
    try {
      const unsaved = !this.editing.id || this.dirty();
      this.dry = unsaved ? await simulateScenario(this.draft, this.overrides()) : await testScenario(this.editing.id, this.overrides());
      if (!unsaved && this.editing) this.editing = { ...this.editing, tested_version: true };
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy = false;
    }
  }

  private dirty(): boolean {
    const e = this.editing;
    return !e || !e.definition || e.name !== this.name || e.description !== this.description || JSON.stringify(e.definition) !== JSON.stringify(this.draft);
  }

  private async save() {
    if (!this.editing || !this.cat) return;
    const local = draftProblems(this.draft, this.cat.limits);
    if (local.length) {
      this.errors = local.map((c) => ({ path: '', message: c }));
      return;
    }
    this.busy = true;
    try {
      const s = this.editing.id
        ? await updateScenario(this.editing.id, this.editing.version, this.name.trim(), this.description.trim(), this.draft)
        : await createScenario(this.name.trim(), this.description.trim(), this.draft);
      this.say(sct('saved'));
      this.loadedId = s.id;
      const full = await getScenario(s.id);
      this.editing = full;
      this.draft = structuredClone(full.definition ?? this.draft);
      this.errors = [];
      void this.load();
      if (!this.scenarioId || this.scenarioId === 'new') this.open(s.id);
    } catch (e) {
      this.fail(e);
    } finally {
      this.busy = false;
    }
  }

  private async toggle(s: Scenario, on: boolean, confirm = false) {
    this.busy = true;
    try {
      const r = on ? await enableScenario(s.id, s.version, confirm) : await disableScenario(s.id, s.version);
      this.say(on ? sct('enabled') : sct('disabledNote'));
      if (this.editing?.id === r.id) this.editing = { ...this.editing, ...r };
      this.dialog = '';
      void this.load();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'confirmation_required') this.dialog = 'confirm-enable';
      else this.fail(e);
    } finally {
      this.busy = false;
    }
  }

  private async removeScenario() {
    if (!this.editing?.id) return;
    try {
      await deleteScenario(this.editing.id);
      this.say(sct('deleted'));
      this.dialog = '';
      void this.load();
      this.close();
    } catch (e) {
      this.fail(e);
    }
  }

  private async showRuns() {
    if (!this.editing?.id) return;
    this.view = 'runs';
    try {
      this.runs = (await scenarioRuns(this.editing.id)).runs.slice(0, 12);
    } catch (e) {
      this.fail(e);
    }
  }

  // ------------------------------------------------------------------------------------------------ render

  private card(s: Scenario): TemplateResult {
    const tone = stateTone(s.state);
    const label = { off: sct('stateOff'), ok: sct('stateOk'), active: sct('stateActive'), degraded: sct('stateDegraded'), suppressed: sct('stateSuppressed') }[s.state];
    return html`<button type="button" class="card glass" data-scenario=${s.id} @click=${() => this.open(s.id)}>
      <div class="row"><b>${bidi(s.name)}</b><span class="grow"></span><span class=${`st ${tone}`} data-state=${s.state}>${label}</span></div>
      <div class="meta">${s.state_reason_text || (s.last_fire_at ? sct('lastFire', { t: new Date(s.last_fire_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) }) : sct('never'))}</div>
      <div class="row"><span class="mods">${s.modules.map((m) => html`<span class="chip">${m}</span>`)}</span><span class="grow"></span><span class="meta">${sct('firesToday', { n: s.fires_today })}</span></div>
    </button>`;
  }

  private listView(): TemplateResult {
    if (this.failed) return html`<div class="center" data-scen-state="error">${sct('loadError')}<button type="button" class="btn sm" @click=${() => void this.load()}>${sct('retry')}</button></div>`;
    if (this.list === null) return html`<div class="center" aria-busy="true" data-scen-state="loading"></div>`;
    if (!this.list.length) return html`<div class="center" data-scen-state="empty">${aIcon('bolt')}<b>${sct('empty')}</b>${this.status?.can.manage ? html`<button type="button" class="btn primary" data-scen-new-empty @click=${() => this.open('new')}>${aIcon('plus')}${sct('new')}</button>` : nothing}<span class="hint">${sct('doorWall')}</span></div>`;
    const pages = Math.max(1, Math.ceil(this.list.length / this.pageSize));
    const page = Math.min(this.page, pages - 1);
    const rows = this.list.slice(page * this.pageSize, (page + 1) * this.pageSize);
    return html`<div class="grid" data-scen-grid>${repeat(rows, (s) => s.id, (s) => this.card(s))}</div>
      ${pages > 1 ? html`<div class="pager" data-scen-pager><button type="button" class="btn sm" ?disabled=${page === 0} @click=${() => (this.page = page - 1)}>${sct('prev')}</button>${sct('page', { a: page + 1, b: pages })}<button type="button" class="btn sm" ?disabled=${page >= pages - 1} @click=${() => (this.page = page + 1)}>${sct('next')}</button></div>` : nothing}`;
  }

  private dryView(): TemplateResult | typeof nothing {
    const d = this.dry;
    if (!d) return nothing;
    const head = d.result === 'TRUE' ? html`<b class="t">${sct('wouldFire')}</b>` : d.result === 'UNKNOWN' ? html`<b class="u">${sct('unknownResult')}</b>` : html`<b>${sct('wouldNot')}</b>`;
    return html`<div class="dry" role="status" data-dry=${d.result}>${head}<span>${d.sentence}</span>
      ${d.actions.filter((a) => !a.switch_on).map((a) => html`<span class="hint">${a.type}: ${sct('actionOff')}</span>`)}</div>`;
  }

  private runsView(): TemplateResult {
    if (!this.runs.length) return html`<div class="hint">${sct('noRuns')}</div>`;
    return html`<div class="runs" data-scen-runs>${this.runs.map((r) => html`<div class="run"><div class="row"><b>${r.outcome}</b><span class="grow"></span><span class="meta">${new Date(r.at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'medium' })}</span></div>
      ${r.sentence ? html`<span>${r.sentence}</span>` : nothing}${r.reason_text ? html`<span class="hint">${r.reason_text}</span>` : nothing}
      ${r.actions.length ? html`<span class="hint">${r.actions.map((a) => `${a.type}: ${a.status}${a.reason ? ` (${a.reason})` : ''}`).join(' · ')}</span>` : nothing}</div>`)}</div>`;
  }

  private editor(): TemplateResult | typeof nothing {
    const e = this.editing;
    if (!e) return nothing;
    const manage = !!this.status?.can.manage && !e.redacted_leaves?.length;
    const paths = leafPaths(this.draft.when);
    const onlyDevices = paths.length > 0 && paths.every((p) => this.sig(p.leaf.signal)?.module === 'doors');
    return html`<sw-drawer open modal heading=${e.id ? e.name || sct('title') : sct('new')} data-scen-editor @close=${() => this.close()}>
      <div class="ed">
        ${this.status?.kill_switch ? html`<div class="kill" role="alert">${sct('killOn')}</div>` : nothing}
        ${e.warnings?.map((w) => html`<div class="banner warn" role="status">${w.message}</div>`)}
        ${e.state_reason_text ? html`<div class="banner bad" role="status" data-state-reason=${e.state_reason ?? ''}>${e.state_reason_text}</div>` : nothing}
        <div class="seg sm" role="tablist"><button type="button" role="tab" aria-selected=${String(this.view === 'edit')} @click=${() => (this.view = 'edit')}>${sct('when')}</button>${e.id ? html`<button type="button" role="tab" aria-selected=${String(this.view === 'runs')} data-scen-runs-tab @click=${() => void this.showRuns()}>${sct('runs')}</button>` : nothing}</div>
        ${this.view === 'runs' ? this.runsView() : html`
          <div class="two"><label class="fld">${sct('name')}<input data-scen-name maxlength="120" .value=${this.name} ?disabled=${!manage} @input=${(ev: Event) => (this.name = (ev.target as HTMLInputElement).value)} /></label>
            <label class="fld">${sct('description')}<input maxlength="1000" .value=${this.description} ?disabled=${!manage} @input=${(ev: Event) => (this.description = (ev.target as HTMLInputElement).value)} /></label></div>
          <div class="sect"><b>${sct('when')}</b></div>
          <div class="tree">${this.nodeView(this.draft.when, [], 'when')}</div>
          ${onlyDevices ? html`<div class="hint">${sct('hintHaOnly')}</div>` : nothing}
          <div class="sect"><b>${sct('then')}</b></div>
          ${this.draft.actions.map((a, i) => this.actionRow(a, i))}
          ${this.draft.actions.length < (this.cat?.limits.actions ?? 3) ? html`<button type="button" class="btn sm" data-add-action @click=${() => { this.draft = { ...this.draft, actions: [...this.draft.actions, { type: 'set_flag', flag: 'flag_1', value: true }] }; }}>${aIcon('plus')}${sct('then')}</button>` : nothing}
          <div class="hint">${sct('doorWall')}</div>
          ${this.optionsView()}
          ${this.errors.length ? html`<div class="err" role="alert" data-scen-errors>${this.errors.map((x) => html`<div>${x.path ? `${x.path}: ` : ''}${x.message}</div>`)}</div>` : nothing}
          ${this.dryView()}`}
      </div>
      <div slot="footer" class="foot">
        ${manage && e.id ? html`<button type="button" class="btn" data-scen-delete @click=${() => (this.dialog = 'delete')}>${sct('delete')}</button>` : nothing}
        <span class="grow"></span>
        ${manage ? html`<label class="hint"><input type="checkbox" .checked=${this.sim} @change=${(ev: Event) => (this.sim = (ev.target as HTMLInputElement).checked)} />${sct('simulate')}</label>
          <button type="button" class="btn" data-scen-test ?disabled=${this.busy} @click=${() => void this.runDry()}>${sct('test')}</button>
          <button type="button" class="btn primary" data-scen-save ?disabled=${this.busy || !this.name.trim()} @click=${() => void this.save()}>${sct('save')}</button>
          ${e.id ? html`<button type="button" class="btn" data-scen-toggle ?disabled=${this.busy || (!e.enabled && this.dirty())} title=${!e.enabled && !e.tested_version ? sct('testFirst') : ''} @click=${() => void this.toggle(e, !e.enabled)}>${e.enabled ? sct('disable') : sct('enable')}</button>` : nothing}` : nothing}
      </div>
    </sw-drawer>`;
  }

  private dialogs(): TemplateResult | typeof nothing {
    const e = this.editing;
    if (this.dialog === 'delete' && e) {
      return html`<sw-dialog open heading=${sct('confirmDelete')} @close=${() => (this.dialog = '')}><div class="foot"><button type="button" class="btn" @click=${() => (this.dialog = '')}>${sct('cancel')}</button><button type="button" class="btn primary" data-dialog-ok @click=${() => void this.removeScenario()}>${sct('delete')}</button></div></sw-dialog>`;
    }
    if (this.dialog === 'confirm-enable' && e) {
      const n = e.definition?.options?.max_tickets_per_day ?? 20;
      return html`<sw-dialog open heading=${sct('enable')} @close=${() => (this.dialog = '')}><p>${sct('enableConfirm', { n })}</p><div class="foot"><button type="button" class="btn" @click=${() => (this.dialog = '')}>${sct('cancel')}</button><button type="button" class="btn primary" data-dialog-ok @click=${() => void this.toggle(e, true, true)}>${sct('confirm')}</button></div></sw-dialog>`;
    }
    return nothing;
  }

  render() {
    return html`<div class="wrap" data-scenarios-panel>
      ${this.status?.kill_switch ? html`<div class="kill" role="alert" data-scen-kill>${sct('killOn')}</div>` : nothing}
      ${this.listView()}
    </div>${this.editor()}${this.dialogs()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'scenarios-panel': ScenariosPanel;
  }
}
