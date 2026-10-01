import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { aIcon, domainIcon } from './automation-icons';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { bidi } from '../i18n/bidi';
import { groupPicker, pickerEntities, INSTALLATION_WIDE, SCENE_CAPTURE_DOMAINS, type CatalogEntity, type SceneMember } from '../api/automations';

import { ATTR_DEFS, STATE_OPTIONS, domainOf, visibleAttrs, withValue, ON_OFF } from '../screens/automations-logic';
export { ATTR_DEFS, STATE_OPTIONS, visibleAttrs, withValue };

/**
 * CR-017 `<scene-capture .name .members .entities .phase .error>`: the table of a scene (owner decision 7א: "צלם מצב נוכחי" and a manual correction
 * of every value). The author picks the devices (chips, "עוד" opens the picker of the devices a scene may hold), presses "צלם מצב נוכחי" (event
 * `capture` {entity_ids, merge}; the screen asks the server, which reads the mirror, and answers through `.members` / `.phase`), then corrects any
 * value in the table (a state per device and the domain's numbers) or removes a device, and saves (`save` {name, members}) or cancels (`cancel`).
 * Alarm panels are not offered (their state needs a code and codes are never stored). Nothing is written here.
 */
@customElement('scene-capture')
export class SceneCapture extends LitElement {
  @property() name = '';
  /** The scene's members (a saved scene, or the answer of the last capture). */
  @property({ attribute: false }) members: SceneMember[] = [];
  /** The devices a scene may hold (the catalogue, already scoped by the server). */
  @property({ attribute: false }) entities: CatalogEntity[] = [];
  /** idle: nothing captured yet; busy: asking; done: a fresh capture is shown; error: it failed. */
  @property() phase: 'idle' | 'busy' | 'done' | 'error' = 'idle';
  @property() error = '';
  @property({ type: Boolean }) isNew = true;
  @property({ type: Boolean }) saving = false;
  @property({ type: Boolean }) readOnly = false;
  /** An existing scene: the bar offers "מחיקה" (event `delete`). */
  @property({ type: Boolean }) deletable = false;
  @state() private draftName = '';
  @state() private rows: SceneMember[] = [];
  @state() private picked: string[] = [];
  @state() private picker = false;
  @state() private q = '';

  static styles = [...automationsStyles, css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
      min-inline-size: 0;
    }
    .nm {
      font: inherit;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
      border: 0;
      border-block-end: 1px dashed var(--dv-border);
      background: transparent;
      color: var(--dv-text);
      padding: 4px 0 8px;
      min-block-size: 44px;
      inline-size: 100%;
      box-sizing: border-box;
    }
    .nm:focus-visible {
      outline: 2px solid var(--dv-focus);
      outline-offset: 2px;
      border-radius: 6px;
    }
    .devs h4 {
      margin: 0 0 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--dv-text-2);
    }
    .chipsrow {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .dchip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 40px;
      padding-inline: 12px 6px;
      border-radius: var(--dv-radius-control);
      background: var(--dv-surface);
      border: 1px solid var(--dv-border);
      font-size: 13.5px;
      font-weight: 600;
    }
    .dchip small {
      color: var(--dv-text-2);
      font-weight: 500;
    }
    .dchip .ic {
      font-size: 16px;
      color: var(--dv-text-2);
    }
    .dchip button {
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--dv-text-2);
    }
    .dchip button:hover {
      background: var(--dv-surface-3);
    }
    .addchip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 40px;
      padding-inline: 14px;
      border-radius: var(--dv-radius-control);
      border: 1px dashed var(--dv-accent);
      background: transparent;
      color: var(--dv-accent-text);
      font-weight: 600;
      font-size: 13.5px;
    }
    .pickwrap {
      position: relative;
    }
    .pop {
      background: var(--dv-surface-solid, #fff);
      inset-block-start: calc(100% + 6px);
      inset-inline-start: 0;
      min-inline-size: min(320px, 90vw);
      max-block-size: 320px;
    }
    .pop .gh {
      padding: 8px 10px 2px;
      font-size: 12px;
      font-weight: 600;
      color: var(--dv-text-2);
    }
    .pop .srch {
      margin: 4px 4px 6px;
    }
    .state-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: var(--dv-radius-md);
      background: var(--dv-success-soft);
      color: var(--au-ok-text);
      font-weight: 700;
      font-size: 14.5px;
    }
    .state-banner.bad {
      background: var(--dv-danger-soft);
      color: var(--dv-danger);
    }
    .state-banner .btn {
      margin-inline-start: 6px;
    }
    .capbtn {
      inline-size: 100%;
      justify-content: center;
      min-block-size: 52px;
      font-size: 15.5px;
    }
    table {
      inline-size: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border-radius: var(--dv-radius-md);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface);
      overflow: hidden;
    }
    th {
      text-align: start;
      font-size: 12px;
      font-weight: 600;
      color: var(--dv-text-2);
      padding: 10px 12px;
      background: var(--dv-surface-3);
    }
    td {
      padding: 10px 12px;
      border-block-start: 1px solid var(--dv-border);
      vertical-align: middle;
      font-size: 14px;
    }
    td.dev {
      display: flex;
      align-items: center;
      gap: 10px;
      border-block-start: 0;
    }
    tr + tr td.dev {
      border-block-start: 0;
    }
    .ico {
      display: grid;
      place-items: center;
      inline-size: 34px;
      block-size: 34px;
      border-radius: 50%;
      background: var(--dv-surface-3);
      color: var(--dv-text-2);
      flex: none;
    }
    .ico .ic {
      font-size: 17px;
    }
    th:first-child,
    td.dev {
      inline-size: 40%;
    }
    td.dev b {
      display: block;
      font-weight: 600;
    }
    td.dev small {
      color: var(--dv-text-2);
      font-size: 12px;
    }
    td .inp {
      min-block-size: 40px;
      inline-size: 100%;
      max-inline-size: 118px;
    }
    .vals {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .num {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 40px;
      padding-inline: 10px;
      border-radius: var(--dv-radius-control);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface-2);
      max-inline-size: 130px;
    }
    .num input {
      border: 0;
      background: transparent;
      font: inherit;
      color: var(--dv-text);
      inline-size: 100%;
      min-inline-size: 0;
      text-align: end;
      font-variant-numeric: tabular-nums;
      min-block-size: 36px;
    }
    .num input:focus-visible {
      outline: none;
    }
    .num:focus-within {
      outline: 2px solid var(--dv-focus);
    }
    .num small {
      color: var(--dv-text-2);
      font-size: 12px;
    }
    .none {
      color: var(--dv-text-3);
    }
    .x {
      display: grid;
      place-items: center;
      inline-size: 40px;
      block-size: 40px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--dv-text-2);
    }
    .x:hover {
      background: var(--dv-surface-3);
      color: var(--dv-danger);
    }
    .bar {
      position: sticky;
      inset-block-end: 0;
      display: flex;
      gap: 8px;
      padding: 10px 0 2px;
      background: linear-gradient(to top, var(--mm-sheet-surface, var(--dv-surface-solid)) 70%, transparent);
      margin-block-start: 8px;
    }
    @media (max-width: 767px) {
      table,
      thead,
      tbody,
      tr,
      td {
        display: block;
      }
      thead {
        display: none;
      }
      tr {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px 10px;
        padding: 10px 12px;
        border-block-start: 1px solid var(--dv-border);
      }
      tr:first-child {
        border-block-start: 0;
      }
      td {
        border: 0;
        padding: 0;
      }
      td.dev {
        grid-column: 1;
      }
      td.rm {
        grid-column: 2;
        grid-row: 1;
      }
      td.st,
      td.vl {
        grid-column: 1 / -1;
      }
      td .inp {
        max-inline-size: none;
      }
    }
  `];

  protected willUpdate(c: PropertyValues<this>) {
    if (c.has('members')) {
      this.rows = this.members.map((m) => ({ entity_id: m.entity_id, state: m.state, attributes: { ...m.attributes } }));
      this.picked = this.rows.map((r) => r.entity_id);
    }
    if (c.has('name')) this.draftName = this.name;
  }

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    window.addEventListener('pointerdown', this.onOutside, true);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('pointerdown', this.onOutside, true);
  }
  private onOutside = (e: PointerEvent) => {
    if (this.picker && !e.composedPath().some((n) => n instanceof HTMLElement && n.classList?.contains('pickwrap'))) this.picker = false;
  };

  private ent(id: string): CatalogEntity | undefined {
    return this.entities.find((e) => e.entity_id === id);
  }
  private nameOf(id: string): string {
    return this.ent(id)?.name ?? id;
  }

  private fire<T>(name: string, detail?: T) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private addDevice(id: string) {
    if (this.picked.includes(id)) return;
    this.picked = [...this.picked, id];
    this.picker = false;
    if (this.rows.length) this.fire('capture', { entity_ids: [id], merge: true });
  }
  private removeDevice(id: string) {
    this.picked = this.picked.filter((x) => x !== id);
    this.rows = this.rows.filter((r) => r.entity_id !== id);
  }
  private setRow(id: string, patch: Parameters<typeof withValue>[1]) {
    this.rows = this.rows.map((r) => (r.entity_id === id ? withValue(r, patch) : r));
  }
  /** Appends the members the screen captured for devices added after the first capture (`capture` with merge: true); the edits so far stay. */
  merge(added: SceneMember[]): void {
    const have = new Set(this.rows.map((r) => r.entity_id));
    this.rows = [...this.rows, ...added.filter((m) => !have.has(m.entity_id)).map((m) => ({ entity_id: m.entity_id, state: m.state, attributes: { ...m.attributes } }))];
  }
  private capturable(): CatalogEntity[] {
    const base = pickerEntities(this.entities, INSTALLATION_WIDE, { domains: SCENE_CAPTURE_DOMAINS as readonly string[], controllable: true });
    const q = this.q.trim();
    return q ? base.filter((e) => `${e.name} ${e.area?.name ?? ''}`.includes(q)) : base;
  }

  private picklist(): TemplateResult {
    const groups = groupPicker(this.capturable().filter((e) => !this.picked.includes(e.entity_id)));
    return html`<div class="pop" role="listbox" aria-label="בחירת מכשירים" data-scene-picker>
      <input class="inp srch" type="search" placeholder="חיפוש מכשיר" aria-label="חיפוש מכשיר" .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} />
      ${groups.length ? groups.map((g) => g.areas.map((a) => html`<div class="gh">${bidi([g.floor?.name, a.area?.name].filter(Boolean).join(' · ') || 'כל הבית')}</div>${a.entities.map((e) => html`<button type="button" role="option" data-pick=${e.entity_id} @click=${() => this.addDevice(e.entity_id)}>${aIcon(domainIcon(e.entity_id))}${bidi(e.name)}</button>`)}`)) : html`<div class="gh">אין עוד מכשירים</div>`}
    </div>`;
  }

  private stateCell(m: SceneMember): TemplateResult {
    const opts = STATE_OPTIONS[domainOf(m.entity_id)] ?? ON_OFF;
    const all = opts.some((o) => o.value === m.state) ? opts : [...opts, { value: m.state, label: m.state }];
    return html`<select class="inp" aria-label=${`מצב · ${this.nameOf(m.entity_id)}`} data-row-state=${m.entity_id} ?disabled=${this.readOnly} @change=${(e: Event) => this.setRow(m.entity_id, { state: (e.target as HTMLSelectElement).value })}>${all.map((o) => html`<option value=${o.value} ?selected=${o.value === m.state}>${o.label}</option>`)}</select>`;
  }

  private valuesCell(m: SceneMember): TemplateResult {
    const defs = visibleAttrs(m);
    if (!defs.length) return html`<span class="none">—</span>`;
    return html`<div class="vals">${defs.map((d) => {
      const raw = m.attributes[d.key];
      const ui = typeof raw === 'number' ? (d.toUi ? d.toUi(raw) : raw) : '';
      return html`<label class="num"><small>${d.unit}</small><input type="number" inputmode="decimal" min=${d.min} max=${d.max} step=${d.step} .value=${String(ui)} aria-label=${`${d.key} · ${this.nameOf(m.entity_id)}`} data-row-attr=${`${m.entity_id}:${d.key}`} ?disabled=${this.readOnly} @change=${(e: Event) => { const v = (e.target as HTMLInputElement).value; this.setRow(m.entity_id, { attr: { key: d.key, ui: v === '' ? null : Math.min(d.max, Math.max(d.min, Number(v))) } }); }} /></label>`;
    })}</div>`;
  }

  private table(): TemplateResult {
    return html`<table data-scene-table>
      <thead><tr><th>מכשיר</th><th>מצב</th><th>ערכים שנלכדו</th><th></th></tr></thead>
      <tbody>${this.rows.map((m) => {
        const e = this.ent(m.entity_id);
        return html`<tr data-scene-row=${m.entity_id}>
          <td class="dev"><span class="ico">${aIcon(domainIcon(m.entity_id))}</span><span><b>${bidi(this.nameOf(m.entity_id))}</b><small>${bidi(e?.area?.name ?? e?.floor?.name ?? '')}</small></span></td>
          <td class="st">${this.stateCell(m)}</td>
          <td class="vl">${this.valuesCell(m)}</td>
          <td class="rm">${this.readOnly ? nothing : html`<button type="button" class="x" aria-label=${`הסרה · ${this.nameOf(m.entity_id)}`} data-row-remove=${m.entity_id} @click=${() => this.removeDevice(m.entity_id)}>${aIcon('close')}</button>`}</td>
        </tr>`;
      })}</tbody>
    </table>`;
  }

  render() {
    const captured = this.rows.length > 0;
    const canSave = !!this.draftName.trim() && captured && !this.saving && !this.readOnly;
    return html`
      <input class="nm" type="text" maxlength="120" .value=${this.draftName} placeholder="שם הסצנה" aria-label="שם הסצנה" data-scene-name ?disabled=${this.readOnly} @input=${(e: Event) => (this.draftName = (e.target as HTMLInputElement).value)} />
      <div class="devs">
        <h4>${aIcon('layers')}מכשירים <span>${this.picked.length}</span></h4>
        <div class="chipsrow" data-scene-devices>
          ${this.picked.map((id) => html`<span class="dchip" data-device-chip=${id}>${aIcon(domainIcon(id))}<span>${bidi(this.nameOf(id))}${this.ent(id)?.area ? html` <small>${bidi(this.ent(id)!.area!.name)}</small>` : nothing}</span>${this.readOnly ? nothing : html`<button type="button" aria-label=${`הסרה · ${this.nameOf(id)}`} @click=${() => this.removeDevice(id)}>${aIcon('close')}</button>`}</span>`)}
          ${this.readOnly ? nothing : html`<span class="pickwrap"><button type="button" class="addchip" data-scene-add aria-haspopup="listbox" aria-expanded=${String(this.picker)} @click=${() => (this.picker = !this.picker)}>${aIcon('plus')}עוד</button>${this.picker ? this.picklist() : nothing}</span>`}
        </div>
      </div>
      ${this.phase === 'done' ? html`<div class="state-banner" role="status" data-scene-captured>${aIcon('check')}נלכד<button type="button" class="btn sm" data-scene-recapture @click=${() => this.fire('capture', { entity_ids: this.picked, merge: false })}>צלם שוב</button></div>`
        : this.phase === 'error' ? html`<div class="state-banner bad" role="alert" data-scene-error>${aIcon('warning')}${this.error || 'הצילום נכשל'}<button type="button" class="btn sm" @click=${() => this.fire('capture', { entity_ids: this.picked, merge: false })}>נסו שוב</button></div>`
        : this.readOnly ? nothing
        : html`<button type="button" class="btn primary capbtn" data-scene-capture ?disabled=${!this.picked.length || this.phase === 'busy'} @click=${() => this.fire('capture', { entity_ids: this.picked, merge: false })}>${aIcon('camera')}${this.phase === 'busy' ? 'מצלם…' : captured ? 'צלם שוב' : 'צלם מצב נוכחי'}</button>`}
      ${captured ? this.table() : nothing}
      ${this.readOnly ? nothing : html`<div class="bar"><button type="button" class="btn primary" data-scene-save ?disabled=${!canSave} @click=${() => this.fire('save', { name: this.draftName.trim(), members: this.rows })}>${aIcon('check')}שמירה</button><button type="button" class="btn" data-scene-cancel @click=${() => this.fire('cancel')}>ביטול</button>${this.deletable ? html`<span class="grow"></span><button type="button" class="btn quiet dz" data-scene-delete @click=${() => this.fire('delete')}>${aIcon('trash')}מחיקה</button>` : nothing}</div>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'scene-capture': SceneCapture;
  }
}
