import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import { emergencyApi, SLOTS, type Contact, type EmergencyConfig, type Slot } from '../api/emergency';
import { em, emLang, TH_LABEL, type EmKey } from '../i18n/emergency';
import { fmtInstant } from './model';
import { parseThreshold } from './emergency-model';
import { maintCss } from './styles';

const ITEM_IDS = ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E09', 'E10', 'E11', 'E12', 'E14', 'E17', 'E18', 'E19'];

/** Threshold keys that belong together on one row group (the order of the screen). */
export const THRESHOLD_ORDER = Object.keys(TH_LABEL);

const panelCss = css`
  :host { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 14px; }
  .fill { display: flex; flex-direction: column; flex: 1; min-block-size: 0; }
  .scroller { flex: 1; min-block-size: 0; overflow: auto; padding: 12px 14px; display: grid; gap: 18px; align-content: start; }
  h3 { margin: 0 0 8px; font-size: var(--sw-fs-lg); color: var(--sw-heading); }
  .hint { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px 16px; }
  .fld { display: grid; gap: 4px; }
  .fld label { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 8px 0; border-block-end: 1px solid var(--sw-border); }
  .row .sp { flex: 1; }
  .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
  .ok { color: var(--sw-success-text); font-size: var(--sw-fs-sm); }
  .btn.sm { padding: 4px 10px; min-block-size: 30px; }
`;

/** CR-EMERG104 (owner q203 b): the dedicated emergency contact list - a manager adds, edits, verifies and deletes; a deletion erases the personal details. */
@customElement('emergency-contacts-panel')
export class EmergencyContactsPanel extends LitElement {
  @property({ type: Boolean }) manage = false;
  @state() private items: Contact[] = [];
  @state() private count = 0;
  @state() private error = '';
  @state() private msg = '';
  @state() private form: { id: string | null; display_name: string; role_title: string; phone: string; email: string; priority: string; revision?: number } | null = null;
  @state() private loaded = false;

  static styles = [maintCss, panelCss];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      const r = await emergencyApi.contacts();
      this.items = r.items;
      this.count = r.count;
      this.error = '';
    } catch (e) {
      this.error = describeError(e);
    }
    this.loaded = true;
  }

  private edit(c: Contact | null) {
    this.msg = '';
    this.form = c ? { id: c.id, display_name: c.display_name, role_title: c.role_title, phone: c.phone ?? '', email: c.email ?? '', priority: String(c.priority), revision: c.revision }
      : { id: null, display_name: '', role_title: '', phone: '', email: '', priority: '100' };
  }

  private async save() {
    const f = this.form;
    if (!f) return;
    if (!f.display_name.trim() || (!f.phone.trim() && !f.email.trim())) {
      this.error = em('cRoute');
      return;
    }
    const body = { display_name: f.display_name.trim(), role_title: f.role_title.trim(), phone: f.phone.trim(), email: f.email.trim(), priority: Number(f.priority) || 100 };
    try {
      if (f.id) await emergencyApi.updateContact(f.id, { ...body, revision: f.revision });
      else await emergencyApi.createContact(body);
      this.form = null;
      this.error = '';
      this.msg = em('sSaved');
      await this.load();
    } catch (e) {
      this.error = e instanceof ApiError && e.status === 409 ? em('sConflict') : describeError(e);
    }
  }

  private async act(fn: () => Promise<unknown>) {
    try {
      await fn();
      this.error = '';
      await this.load();
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private field(k: 'display_name' | 'role_title' | 'phone' | 'email' | 'priority', label: EmKey, dir?: string) {
    const f = this.form!;
    return html`<div class="fld"><label for=${`ec-${k}`}>${em(label)}</label><input id=${`ec-${k}`} class="inp" dir=${dir ?? 'auto'} .value=${f[k]} data-emerg-contact-field=${k}
      @input=${(e: Event) => { this.form = { ...f, [k]: (e.target as HTMLInputElement).value }; }}></div>`;
  }

  render() {
    if (!this.loaded) return html`<div class="skl" aria-busy="true" aria-label=${em('loading')}></div>`;
    if (!this.manage) return html`<div class="panel card" data-emerg-contacts-count><p>${em('cCountOnly', { n: this.count })}</p></div>`;
    return html`<div class="panel flush fill" data-emerg-contacts><div class="scroller">
      <div class="row"><h3>${em('viewContacts')}</h3><span class="sp"></span><button type="button" class="btn pri sm" data-emerg-contact-add @click=${() => this.edit(null)}><sw-icon name="plus" size="14"></sw-icon>${em('cAdd')}</button></div>
      <p class="hint">${em('cPrivacy')}</p>
      ${this.form ? html`<div class="panel card" data-emerg-contact-form><div class="grid">${this.field('display_name', 'cName')}${this.field('role_title', 'cRole')}${this.field('phone', 'cPhone', 'ltr')}${this.field('email', 'cEmail', 'ltr')}${this.field('priority', 'cPriority', 'ltr')}</div>
        <div class="row"><button type="button" class="btn pri sm" data-emerg-contact-save @click=${() => void this.save()}>${em('cSave')}</button><button type="button" class="btn sm" @click=${() => { this.form = null; }}>${em('cCancel')}</button></div></div>` : nothing}
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}${this.msg ? html`<div class="ok" role="status">${this.msg}</div>` : nothing}
      ${this.items.length ? this.items.map((c) => html`<div class="row" data-emerg-contact=${c.id}>
          <div><b>${c.display_name}</b>${c.role_title ? html` <span class="mut">${c.role_title}</span>` : nothing}${c.active ? nothing : html` <span class="chip" data-look="unk">${em('cInactive')}</span>`}
            <div class="mut num">${c.phone ?? ''} ${c.email ?? ''}</div></div><span class="sp"></span>
          <span class="chip" data-look=${c.verified_ok ? 'ok' : 'warn'}>${c.last_verified_at ? `${em('cVerified')} ${fmtInstant(c.last_verified_at, false)}` : em('cNever')}</span>
          <button type="button" class="btn sm" data-emerg-contact-verify @click=${() => void this.act(() => emergencyApi.verifyContact(c.id))}>${em('cVerify')}</button>
          <button type="button" class="btn sm" @click=${() => this.edit(c)}><sw-icon name="edit" size="14"></sw-icon></button>
          <button type="button" class="btn sm dng" data-emerg-contact-delete @click=${() => { if (confirm(em('cDeleteConfirm'))) void this.act(() => emergencyApi.deleteContact(c.id)); }}><sw-icon name="trash" size="14"></sw-icon>${em('cDelete')}</button>
        </div>`) : html`<div class="nomatch">${em('cEmpty')}</div>`}
    </div></div>`;
  }
}

/** CR-EMERG104 (owner q204/q205/q206): the configuration - ledger tasks bound to the checks, every threshold (and its default), the emergency cameras and the
 * "not applicable" marks. Revision-guarded; every change is audited by the server. */
@customElement('emergency-settings-panel')
export class EmergencySettingsPanel extends LitElement {
  @state() private cfg: EmergencyConfig | null = null;
  @state() private error = '';
  @state() private msg = '';
  @state() private draft: Record<string, string> = {};
  @state() private naNote: Record<string, string> = {};
  @state() private busy = false;

  static styles = [maintCss, panelCss, css`select.inp { max-inline-size: 360px; }`];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.apply(await emergencyApi.config());
      this.error = '';
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private apply(c: EmergencyConfig) {
    this.cfg = c;
    this.draft = Object.fromEntries(Object.entries(c.thresholds.effective).map(([k, v]) => [k, String(v)]));
  }

  private async put(body: Parameters<typeof emergencyApi.putConfig>[0]) {
    if (!this.cfg || this.busy) return;
    this.busy = true;
    try {
      this.apply(await emergencyApi.putConfig({ revision: this.cfg.revision, ...body }));
      this.error = '';
      this.msg = em('sSaved');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        this.msg = '';
        this.error = em('sConflict');
        await this.load();
      } else this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private slotName(s: Slot): string {
    return em(`slot_${s}` as EmKey);
  }

  private slots(c: EmergencyConfig) {
    return html`<section><h3>${em('sSlots')}</h3>${SLOTS.map((s) => {
      const bound = c.slots[s] ?? [];
      const sug = c.suggestions[s] ?? [];
      return html`<div class="row" data-emerg-slot=${s}><b>${this.slotName(s)}</b>
        ${bound.length ? bound.map((t) => html`<span class="chip" data-look="ok">${t.title}${t.due_date ? ` · ${t.due_date}` : ''}
          <button type="button" class="btn sm" data-emerg-unbind=${t.id} @click=${() => void this.put({ bindings: { [t.id]: null } })}>${em('sUnbind')}</button></span>`) : html`<span class="mut">${em('sNoneBound')}</span>`}
        <span class="sp"></span>
        ${sug.length ? html`<select class="inp" data-emerg-bind=${s} aria-label=${em('sPick')} @change=${(e: Event) => {
          const id = (e.target as HTMLSelectElement).value;
          if (id) void this.put({ bindings: { [id]: s } });
        }}><option value="">${em('sPick')}</option>${sug.map((t) => html`<option value=${t.id}>${t.title}${t.due_date ? ` · ${t.due_date}` : ''}</option>`)}</select>` : html`<span class="mut">${em('sNoSuggest')}</span>`}
      </div>`;
    })}</section>`;
  }

  private thresholds(c: EmergencyConfig) {
    const lang = emLang();
    const changed = Object.keys(c.thresholds.effective).filter((k) => {
      const t = parseThreshold(this.draft[k] ?? '', c.thresholds.ranges[k][0], c.thresholds.ranges[k][1]);
      return t !== null && t !== c.thresholds.effective[k];
    });
    const invalid = Object.keys(c.thresholds.effective).some((k) => parseThreshold(this.draft[k] ?? '', c.thresholds.ranges[k][0], c.thresholds.ranges[k][1]) === null);
    return html`<section><h3>${em('sThresholds')}</h3><div class="grid">${THRESHOLD_ORDER.filter((k) => k in c.thresholds.effective).map((k) => {
      const [lo, hi] = c.thresholds.ranges[k];
      const bad = parseThreshold(this.draft[k] ?? '', lo, hi) === null;
      const isDefault = c.thresholds.effective[k] === c.thresholds.defaults[k];
      return html`<div class="fld"><label for=${`th-${k}`}>${TH_LABEL[k]?.[lang] ?? k} ${TH_LABEL[k]?.unit ?? ''}</label>
        <input id=${`th-${k}`} class="inp num" inputmode="decimal" .value=${this.draft[k] ?? ''} aria-invalid=${String(bad)} data-emerg-th=${k}
          @input=${(e: Event) => { this.draft = { ...this.draft, [k]: (e.target as HTMLInputElement).value }; }}>
        <span class="hint">${em('sDefault', { v: c.thresholds.defaults[k] })} (${lo}–${hi})
          ${isDefault ? nothing : html`<button type="button" class="btn sm" data-emerg-th-reset=${k} @click=${() => void this.put({ thresholds: { [k]: null } })}>${em('sReset')}</button>`}</span></div>`;
    })}</div>
      <div class="row"><button type="button" class="btn pri sm" ?disabled=${this.busy || invalid || !changed.length} data-emerg-th-save
        @click=${() => void this.put({ thresholds: Object.fromEntries(changed.map((k) => [k, Number(this.draft[k])])) })}>${em('cSave')}</button></div></section>`;
  }

  private cameras(c: EmergencyConfig) {
    const sel = new Set(c.cameras.selected);
    return html`<section><h3>${em('sCameras')}</h3><p class="hint">${em('sCamerasHint')}</p><div class="grid">${c.cameras.choices.map((cam) => html`<label class="row" data-emerg-cam=${cam.id}>
      <input type="checkbox" .checked=${sel.has(cam.id)} @change=${(e: Event) => {
        const next = new Set(sel);
        if ((e.target as HTMLInputElement).checked) next.add(cam.id);
        else next.delete(cam.id);
        void this.put({ cameras: [...next] });
      }}> ${cam.name} <span class="mut">${cam.recorder}</span></label>`)}</div></section>`;
  }

  private notApplicable(c: EmergencyConfig) {
    return html`<section><h3>${em('sNa')}</h3>${ITEM_IDS.map((id) => {
      const mark = c.not_applicable[id];
      return html`<div class="row" data-emerg-na=${id}><b>${id}</b>
        ${mark ? html`<span class="mut">${em('naBy', { by: mark.by, at: fmtInstant(mark.at, false) })}${mark.note ? ` · ${mark.note}` : ''}</span><span class="sp"></span>
            <button type="button" class="btn sm" data-emerg-na-clear=${id} @click=${() => void this.put({ not_applicable: { [id]: null } })}>${em('sNaClear')}</button>`
          : html`<input class="inp" placeholder=${em('sNaNote')} maxlength="200" .value=${this.naNote[id] ?? ''} @input=${(e: Event) => { this.naNote = { ...this.naNote, [id]: (e.target as HTMLInputElement).value }; }}>
            <button type="button" class="btn sm" data-emerg-na-set=${id} @click=${() => void this.put({ not_applicable: { [id]: { note: (this.naNote[id] ?? '').trim() } } })}>${em('sNaSet')}</button>`}
      </div>`;
    })}</section>`;
  }

  render() {
    const c = this.cfg;
    if (!c) return this.error ? html`<sw-state-panel state="error" heading=${em('errTitle')} hint=${this.error} data-state="error"></sw-state-panel>` : html`<div class="skl" aria-busy="true"></div>`;
    return html`<div class="panel flush fill" data-emerg-settings><div class="scroller">
      ${this.slots(c)}${this.thresholds(c)}${this.cameras(c)}${this.notApplicable(c)}
      <p class="hint">${em('sHistory', { n: c.history_keep_days })}</p>
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}${this.msg ? html`<div class="ok" role="status">${this.msg}</div>` : nothing}
    </div></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'emergency-contacts-panel': EmergencyContactsPanel;
    'emergency-settings-panel': EmergencySettingsPanel;
  }
}
