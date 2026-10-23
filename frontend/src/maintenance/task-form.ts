import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import { CATEGORIES, DOC_TYPES, INTERVAL_UNITS, maintApi, type Options, type TaskDetail, type TaskKind } from '../api/maintenance';
import { mt, type MtKey } from '../i18n/maintenance';
import { bodyOf, categoryText, docTypeText, draftOf, newDraft, newItem, placeOptions, validate, vendorMark, type Draft } from './model';
import { maintCss } from './styles';

const TITLE: Record<TaskKind, MtKey> = { certificate: 'formNewCert', vendor_document: 'formNewDoc', preventive: 'formNewPlan', round: 'formNewRound' };

/**
 * The task form (create and edit) - maintenance.manage only (the server checks the place, the supplier, the department gate and every
 * field again). The places offered are the ones the manager may manage; "no place" is offered when he holds the permission anywhere
 * (a placeless task, owner answer 24.10 q15). The reminder lead left empty takes the installation's default from Settings (q13).
 * Requests on schedule are offered only while the tickets module is on.
 */
@customElement('maint-task-form')
export class MaintTaskForm extends LitElement {
  @property() kind: TaskKind = 'certificate';
  @property() taskId: string | null = null;
  @property({ type: Boolean }) ticketsOn = false;
  /** a supplier to preselect (the supplier card's "new document") */
  @property() presetVendor = '';
  @state() private opts: Options | null = null;
  @state() private prev: TaskDetail | null = null;
  @state() private d: Draft = newDraft('certificate');
  @state() private errors: Record<string, MtKey> = {};
  @state() private error = '';
  @state() private busy = false;
  @state() private loaded = false;

  static styles = maintCss;

  protected willUpdate(changed: Map<string, unknown>) {
    if ((changed.has('kind') || changed.has('taskId')) && !this.loaded) void this.load();
    if (changed.has('presetVendor') && this.presetVendor) this.d = { ...this.d, vendor_id: this.presetVendor };
  }

  private async load() {
    this.loaded = true;
    try {
      const [o, t] = await Promise.all([maintApi.options(), this.taskId ? maintApi.task(this.taskId) : Promise.resolve(null)]);
      this.opts = o;
      this.prev = t;
      this.d = t ? draftOf(t) : { ...newDraft(this.kind), vendor_id: this.presetVendor || '' };
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private set<K extends keyof Draft>(k: K, v: Draft[K]) {
    this.d = { ...this.d, [k]: v };
    if (this.errors[k as string]) {
      const { [k as string]: _gone, ...rest } = this.errors;
      this.errors = rest;
    }
  }

  private async save() {
    const errs = validate(this.d);
    this.errors = errs;
    if (Object.keys(errs).length) return;
    this.busy = true;
    this.error = '';
    try {
      const saved = this.prev ? await maintApi.update(this.prev.id, bodyOf(this.d, this.prev)) : await maintApi.create(bodyOf(this.d));
      this.dispatchEvent(new CustomEvent('saved', { detail: { id: saved.id, text: mt('saved') } }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const f = (e.body.details?.fields as string[] | undefined)?.[0];
        if (f) this.errors = { ...this.errors, [f === 'interval' ? 'every' : f]: 'fRequired' };
      }
      if (e instanceof ApiError && e.code === 'revision_conflict') {
        this.error = mt('conflict');
        this.loaded = false;
        await this.load();
      } else this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private err(k: string): TemplateResult | typeof nothing {
    return this.errors[k] ? html`<span class="err" id=${`e-${k}`}>${mt(this.errors[k])}</span>` : nothing;
  }

  private text(k: 'title' | 'notes', label: MtKey, multiline = false): TemplateResult {
    return html`<div class="fld"><label for=${`f-${k}`}>${mt(label)}</label>
      ${multiline
        ? html`<textarea id=${`f-${k}`} class="inp" maxlength="2000" .value=${this.d[k]} @input=${(e: Event) => this.set(k, (e.target as HTMLTextAreaElement).value)}></textarea>`
        : html`<input id=${`f-${k}`} class="inp" maxlength="120" .value=${this.d[k]} aria-invalid=${String(!!this.errors[k])} data-maint-field=${k}
            @input=${(e: Event) => this.set(k, (e.target as HTMLInputElement).value)}>`}${this.err(k)}</div>`;
  }

  private date(k: 'due_date' | 'anchor_date', label: MtKey): TemplateResult {
    return html`<div class="fld"><label for=${`f-${k}`}>${mt(label)}</label><input id=${`f-${k}`} class="inp num" type="date" .value=${this.d[k]} aria-invalid=${String(!!this.errors[k])}
      data-maint-field=${k} @input=${(e: Event) => this.set(k, (e.target as HTMLInputElement).value)}>${this.err(k)}</div>`;
  }

  private vendorField(o: Options): TemplateResult {
    const v = o.vendors.find((x) => x.id === this.d.vendor_id);
    const mark = vendorMark(v);
    const required = this.d.kind === 'vendor_document';
    return html`<div class="fld"><label for="f-vendor">${mt('fVendor')}</label>
      <select id="f-vendor" class="inp" aria-invalid=${String(!!this.errors.vendor_id)} data-maint-field="vendor_id" @change=${(e: Event) => this.set('vendor_id', (e.target as HTMLSelectElement).value)}>
        ${required ? nothing : html`<option value="" ?selected=${!this.d.vendor_id}>${mt('fVendorNone')}</option>`}
        ${required && !this.d.vendor_id ? html`<option value="" selected disabled>${mt('fVendor')}</option>` : nothing}
        ${o.vendors.map((x) => {
          const m = vendorMark(x);
          return html`<option value=${x.id} ?selected=${x.id === this.d.vendor_id}>${x.name}${m && m.look !== 'ok' ? ` · ${m.text}` : ''}</option>`;
        })}
      </select>
      ${mark && mark.look !== 'ok' && this.d.kind !== 'vendor_document' ? html`<span class="chip" data-look=${mark.look} data-maint-vendor-mark>${mark.text}</span>` : nothing}${this.err('vendor_id')}</div>`;
  }

  /** What it is about (MAINT215B): an elevator or a generator of the infrastructure screens - their cards then show the nearest certificate. */
  private assetField(o: Options): TemplateResult | typeof nothing {
    const el = o.elevators ?? [];
    const ge = o.generators ?? [];
    if (!el.length && !ge.length) return nothing;
    return html`<div class="fld"><label for="f-asset">${mt('fAsset')}</label>
      <select id="f-asset" class="inp" data-maint-field="asset" @change=${(e: Event) => this.set('asset', (e.target as HTMLSelectElement).value)}>
        <option value="" ?selected=${!this.d.asset}>${mt('fAssetNone')}</option>
        ${el.length ? html`<optgroup label=${mt('elevator')}>${el.map((x) => html`<option value=${`elevator:${x.id}`} ?selected=${this.d.asset === `elevator:${x.id}`}>${x.name}</option>`)}</optgroup>` : nothing}
        ${ge.length ? html`<optgroup label=${mt('generator')}>${ge.map((x) => html`<option value=${`generator:${x.id}`} ?selected=${this.d.asset === `generator:${x.id}`}>${x.name}</option>`)}</optgroup>` : nothing}
      </select></div>`;
  }

  private intervalField(): TemplateResult {
    const optional = this.d.kind === 'certificate' || this.d.kind === 'vendor_document';
    return html`<div class="row"><div class="fld"><label for="f-every">${mt('fInterval')}</label>
        <input id="f-every" class="inp num" inputmode="numeric" .value=${this.d.every} placeholder=${optional ? mt('fIntervalNone') : ''} aria-invalid=${String(!!this.errors.every)} data-maint-field="every"
          @input=${(e: Event) => this.set('every', (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '').slice(0, 3))}>${this.err('every')}</div>
      <div class="fld"><label for="f-unit" class="lbl">&nbsp;</label><select id="f-unit" class="inp" aria-label=${mt('fInterval')} @change=${(e: Event) => this.set('unit', (e.target as HTMLSelectElement).value as Draft['unit'])}>
        ${INTERVAL_UNITS.map((u) => html`<option value=${u} ?selected=${this.d.unit === u}>${mt(`fUnit_${u}` as MtKey)}</option>`)}</select></div></div>`;
  }

  private checklist(): TemplateResult {
    const items = this.d.checklist;
    const upd = (i: number, patch: Partial<Draft['checklist'][number]>) => this.set('checklist', items.map((x, n) => (n === i ? { ...x, ...patch } : x)));
    const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));
    return html`<div class="fld"><span class="lbl">${mt('fChecklist')}</span><div class="items" data-maint-checklist>
      ${items.map((it, i) => html`<div class="item" data-maint-item=${i}>
        <div class="fld"><label for=${`it-${it._id}`}>${mt('fItemLabel')} ${i + 1}</label><input id=${`it-${it._id}`} class="inp" maxlength="120" .value=${it.label} @input=${(e: Event) => upd(i, { label: (e.target as HTMLInputElement).value })}></div>
        <div class="fld"><label for=${`ik-${it._id}`}>${mt('fItemKind')}</label><select id=${`ik-${it._id}`} class="inp" @change=${(e: Event) => upd(i, { kind: (e.target as HTMLSelectElement).value as 'check' })}>
          ${(['check', 'number', 'text'] as const).map((k) => html`<option value=${k} ?selected=${(it.kind ?? 'check') === k}>${mt(k === 'check' ? 'fItemCheck' : k === 'number' ? 'fItemNumber' : 'fItemText')}</option>`)}</select></div>
        <button type="button" class="btn sm ghost" aria-label=${`${mt('fItemRemove')} ${i + 1}`} @click=${() => this.set('checklist', items.filter((_x, n) => n !== i))}><sw-icon name="trash" size="14"></sw-icon></button>
        <div class="range">
          ${it.kind === 'number' ? html`<label class="mut" for=${`mn-${it._id}`}>${mt('fItemMin')}</label><input id=${`mn-${it._id}`} class="inp num" inputmode="decimal" .value=${it.min ?? ''} @input=${(e: Event) => upd(i, { min: num((e.target as HTMLInputElement).value) })}>
            <label class="mut" for=${`mx-${it._id}`}>${mt('fItemMax')}</label><input id=${`mx-${it._id}`} class="inp num" inputmode="decimal" .value=${it.max ?? ''} @input=${(e: Event) => upd(i, { max: num((e.target as HTMLInputElement).value) })}>` : nothing}
          <label class="check"><input type="checkbox" .checked=${it.required !== false} @change=${(e: Event) => upd(i, { required: (e.target as HTMLInputElement).checked })}>${mt('fItemRequired')}</label>
          ${this.err(`item${i}`)}
        </div></div>`)}
      <button type="button" class="btn sm" data-maint-add-item @click=${() => this.set('checklist', [...items, newItem()])}><sw-icon name="plus" size="14"></sw-icon>${mt('fAddItem')}</button>
      ${this.err('checklist')}</div></div>`;
  }

  private fields(o: Options): TemplateResult {
    const k = this.d.kind;
    const plan = k === 'preventive' || k === 'round';
    const places = placeOptions(o);
    const leadDefault = o.defaults.lead_days[k];
    const ledgerKinds: TaskKind[] = ['certificate', 'vendor_document'];
    return html`<div class="form" data-maint-form=${k}>
      ${!this.taskId && ledgerKinds.includes(k) ? html`<div class="seg" role="group" aria-label=${mt('fKind')} data-maint-form-kind>
        ${ledgerKinds.map((x) => html`<button type="button" aria-pressed=${String(k === x)} data-kind=${x} @click=${() => { this.d = { ...newDraft(x), title: this.d.title, vendor_id: this.d.vendor_id }; this.errors = {}; }}>${mt(x === 'certificate' ? 'kindCerts' : 'kindVendorDocs')}</button>`)}</div>` : nothing}
      ${this.text('title', 'fTitle')}
      <div class="row">
        ${k === 'vendor_document'
          ? html`<div class="fld"><label for="f-doc">${mt('fDocType')}</label><select id="f-doc" class="inp" data-maint-field="doc_type" @change=${(e: Event) => this.set('doc_type', (e.target as HTMLSelectElement).value as Draft['doc_type'])}>
              ${DOC_TYPES.map((d) => html`<option value=${d} ?selected=${this.d.doc_type === d}>${docTypeText(d)}</option>`)}</select></div>`
          : html`<div class="fld"><label for="f-cat">${mt('fCategory')}</label><select id="f-cat" class="inp" @change=${(e: Event) => this.set('category', (e.target as HTMLSelectElement).value)}>
              ${CATEGORIES.map((c) => html`<option value=${c} ?selected=${this.d.category === c}>${categoryText(c)}</option>`)}</select></div>`}
        ${k === 'vendor_document' ? nothing : html`<div class="fld"><label for="f-place">${mt('fPlace')}</label><select id="f-place" class="inp" data-maint-field="place" @change=${(e: Event) => this.set('place', (e.target as HTMLSelectElement).value)}>
          ${o.placeless || !places.length ? html`<option value="" ?selected=${!this.d.place}>${mt('fPlaceNone')}</option>` : nothing}
          ${places.map((p) => html`<option value=${p.value} ?selected=${this.d.place === p.value}>${p.label}</option>`)}</select></div>`}
      </div>
      ${k === 'vendor_document' ? nothing : this.assetField(o)}
      ${this.vendorField(o)}
      <div class="row">${plan ? this.date('anchor_date', 'fFirstDate') : this.date('due_date', 'fValidUntil')}
        <div class="fld"><label for="f-lead">${mt('fLead')}</label><input id="f-lead" class="inp num" inputmode="numeric" .value=${this.d.lead} placeholder=${String(leadDefault)}
          aria-describedby="f-lead-h" aria-invalid=${String(!!this.errors.lead)} data-maint-field="lead" @input=${(e: Event) => this.set('lead', (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '').slice(0, 3))}>
          <span class="mut" id="f-lead-h">${mt('fLeadHint', { n: leadDefault })}</span>${this.err('lead')}</div></div>
      ${this.intervalField()}
      <div class="fld"><label for="f-owner">${mt('fOwner')}</label><select id="f-owner" class="inp" @change=${(e: Event) => this.set('owner_user_id', (e.target as HTMLSelectElement).value)}>
        <option value="" ?selected=${!this.d.owner_user_id}>${mt('fOwnerNone')}</option>${o.people.map((p) => html`<option value=${p.id} ?selected=${p.id === this.d.owner_user_id}>${p.name}</option>`)}</select></div>
      ${plan ? this.checklist() : nothing}
      ${this.ticketsOn && o.tickets_on && k !== 'vendor_document' ? html`<div class="fld" data-maint-auto-ticket>
        <label class="check"><input type="checkbox" .checked=${this.d.auto_ticket} @change=${(e: Event) => this.set('auto_ticket', (e.target as HTMLInputElement).checked)}>${mt('fAutoTicket')}</label>
        ${this.d.auto_ticket ? html`<select class="inp" aria-label=${mt('fDepartment')} aria-invalid=${String(!!this.errors.department_id)} data-maint-field="department_id" @change=${(e: Event) => this.set('department_id', (e.target as HTMLSelectElement).value)}>
          <option value="" ?selected=${!this.d.department_id} disabled>${mt('fDepartmentPick')}</option>${o.departments.map((x) => html`<option value=${x.id} ?selected=${x.id === this.d.department_id}>${x.name}</option>`)}</select>${this.err('department_id')}` : nothing}</div>` : nothing}
      ${this.text('notes', 'fNotes', true)}
      ${this.error ? html`<div class="alert err" role="alert" data-maint-form-error>${this.error}</div>` : nothing}
    </div>`;
  }

  render() {
    const o = this.opts;
    return html`<sw-dialog open wide heading=${this.taskId ? `${mt('formEdit')}: ${this.prev?.title ?? ''}` : mt(TITLE[this.kind])} data-maint-task-form @close=${() => this.dispatchEvent(new CustomEvent('close'))}>
      ${o ? this.fields(o) : this.error ? html`<div class="alert err" role="alert">${this.error}</div>` : html`<div class="skl" aria-busy="true" aria-label=${mt('loading')}></div>`}
      <div class="foot" slot="footer"><span class="sp"></span><button type="button" class="btn" @click=${() => this.dispatchEvent(new CustomEvent('close'))}>${mt('cancel')}</button>
        <button type="button" class="btn pri" ?disabled=${this.busy || !o} data-maint-save @click=${() => void this.save()}>${mt(this.taskId ? 'fSave' : 'fCreate')}</button></div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'maint-task-form': MaintTaskForm;
  }
}
