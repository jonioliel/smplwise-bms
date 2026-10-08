import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-dialog';
import { describeError } from '../api/client';
import { createCase, deleteCase, getCases, isFirstWriteRefusal, renameCase, typedMatches, type FirstWrites, type FrigateCase } from '../api/frigate-control';
import { fx } from '../i18n/frigate-text';
import { adminStyles, dateText, firstBlocked, supervisedBox } from './frigate-admin-shared';

/**
 * FRGD: Frigate's cases for ONE recorder (Settings only; F2b class `cases`, permission analytics.cases). A table (name, description,
 * created, origin) that folds on a narrow card; "תיק חדש"; rename inline and delete with a typed confirmation - only for cases Arx created.
 * The first write of each kind carries `supervised: true` from a system administrator. Fires `frigate-changed` after a write.
 */
@customElement('frigate-cases-panel')
export class FrigateCasesPanel extends LitElement {
  @property({ attribute: 'recorder-id' }) recorderId = '';
  @property({ attribute: false }) first: FirstWrites | null = null;
  @property({ type: Boolean }) allowed = false;
  @property() tz = '';
  @state() private rows: FrigateCase[] | null = null;
  @state() private enabled = false;
  @state() private failed = '';
  @state() private busy = false;
  @state() private msg: { tone: 'ok' | 'err'; text: string } | null = null;
  @state() private draft: { name: string; description: string; supervised: boolean; error: string } | null = null;
  @state() private renaming: { id: string; name: string; supervised: boolean } | null = null;
  @state() private deleting: { row: FrigateCase; typed: string; supervised: boolean; error: string } | null = null;

  static styles = adminStyles;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('recorderId') && changed.get('recorderId') !== undefined) void this.load();
  }

  async load() {
    if (!this.recorderId || !this.allowed) return;
    try {
      const r = await getCases(this.recorderId);
      this.rows = r.cases;
      this.enabled = r.enabled;
      this.failed = '';
    } catch (err) {
      this.failed = describeError(err);
      this.rows = [];
    }
  }

  private flash(tone: 'ok' | 'err', text: string) {
    this.msg = { tone, text };
    window.setTimeout(() => {
      if (this.msg?.text === text) this.msg = null;
    }, 4000);
  }

  private changed() {
    this.dispatchEvent(new CustomEvent('frigate-changed', { bubbles: true, composed: true }));
    void this.load();
  }

  private refusal(err: unknown): string {
    return isFirstWriteRefusal(err) ? fx().control.settings.supervised.need : describeError(err);
  }

  private async submitCreate() {
    const d = this.draft;
    if (!d || this.busy || !d.name.trim()) return;
    this.busy = true;
    try {
      const r = await createCase(this.recorderId, { name: d.name.trim(), description: d.description.trim() || null, ...(d.supervised ? { supervised: true } : {}) });
      this.draft = null;
      this.flash('ok', r.verified ? fx().control.settings.cases.created : fx().control.unverified);
      this.changed();
    } catch (err) {
      this.draft = { ...d, error: this.refusal(err) };
    } finally {
      this.busy = false;
    }
  }

  private async saveRename() {
    const r = this.renaming;
    if (!r || this.busy || !r.name.trim()) return;
    this.busy = true;
    try {
      const res = await renameCase(this.recorderId, r.id, r.name.trim(), r.supervised);
      this.renaming = null;
      this.flash('ok', res.verified ? fx().control.settings.cases.renamed : fx().control.unverified);
      this.changed();
    } catch (err) {
      this.flash('err', this.refusal(err));
    } finally {
      this.busy = false;
    }
  }

  private async confirmDelete() {
    const d = this.deleting;
    if (!d || this.busy || !typedMatches(d.typed, d.row.name)) return;
    this.busy = true;
    try {
      const res = await deleteCase(this.recorderId, d.row.id, d.supervised);
      this.deleting = null;
      this.flash('ok', res.verified ? fx().control.settings.cases.deleted : fx().control.unverified);
      this.changed();
    } catch (err) {
      this.deleting = { ...d, error: this.refusal(err) };
    } finally {
      this.busy = false;
    }
  }

  private createDialog() {
    const d = this.draft;
    if (!d) return nothing;
    const t = fx().control.settings.cases;
    const c = fx().control;
    const needSup = !!this.first && this.first.can_supervise && !this.first.done.case_create;
    return html`<sw-dialog open heading=${t.create} data-fc-create @close=${() => (this.draft = null)}>
      <div class="form">
        <label>${t.name}<input type="text" maxlength="80" data-fc-name .value=${d.name} @input=${(e: Event) => (this.draft = { ...d, name: (e.target as HTMLInputElement).value })} /></label>
        <label>${t.description}<input type="text" maxlength="200" data-fc-description .value=${d.description} @input=${(e: Event) => (this.draft = { ...d, description: (e.target as HTMLInputElement).value })} /></label>
        ${supervisedBox(this.first, 'case_create', d.supervised, (v) => (this.draft = { ...d, supervised: v }), 'case_create')}
        ${d.error ? html`<div class="err" role="alert" data-fc-error>${d.error}</div>` : nothing}
      </div>
      <sw-button slot="footer" @click=${() => (this.draft = null)}>${c.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" icon="case" data-fc-create-ok ?disabled=${this.busy || !d.name.trim() || (needSup && !d.supervised)} @click=${() => void this.submitCreate()}>${t.create}</sw-button>
    </sw-dialog>`;
  }

  private deleteDialog() {
    const d = this.deleting;
    if (!d) return nothing;
    const t = fx().control.settings.cases;
    const x = fx().control.settings.exports;
    const c = fx().control;
    const needSup = !!this.first && this.first.can_supervise && !this.first.done.case_delete;
    return html`<sw-dialog open heading=${t.deleteTitle} subheading=${d.row.name} data-fc-delete @close=${() => (this.deleting = null)}>
      <div class="form">
        <p class="dialog-text">${x.deleteText}</p>
        <input type="text" data-fc-delete-typed aria-label=${t.name} .value=${d.typed} @input=${(e: Event) => (this.deleting = { ...d, typed: (e.target as HTMLInputElement).value })} />
        ${supervisedBox(this.first, 'case_delete', d.supervised, (v) => (this.deleting = { ...d, supervised: v }), 'case_delete')}
        ${d.error ? html`<div class="err" role="alert" data-fc-error>${d.error}</div>` : nothing}
      </div>
      <sw-button slot="footer" @click=${() => (this.deleting = null)}>${c.cancel}</sw-button>
      <sw-button slot="footer" variant="danger" icon="trash" data-fc-delete-ok ?disabled=${this.busy || !typedMatches(d.typed, d.row.name) || (needSup && !d.supervised)} @click=${() => void this.confirmDelete()}>${x.delete}</sw-button>
    </sw-dialog>`;
  }

  private row(x: FrigateCase) {
    const t = fx().control.settings.cases;
    const e = fx().control.settings.exports;
    const c = fx().control;
    const ren = this.renaming?.id === x.id ? this.renaming : null;
    const canWrite = this.enabled && x.arx_created;
    return html`<div class="r" role="row" data-fc-row=${x.id} data-arx=${String(x.arx_created)}>
      <div class="c main" role="cell">
        ${ren
          ? html`<span class="inline"><input type="text" maxlength="80" data-fc-rename-input aria-label=${t.name} .value=${ren.name} ?disabled=${this.busy}
                @input=${(ev: Event) => (this.renaming = { ...ren, name: (ev.target as HTMLInputElement).value })}
                @keydown=${(ev: KeyboardEvent) => { if (ev.key === 'Enter') void this.saveRename(); if (ev.key === 'Escape') this.renaming = null; }} />
              <sw-button size="sm" variant="primary" iconOnly icon="check" label=${c.confirm} data-fc-rename-save ?disabled=${this.busy || !ren.name.trim()} @click=${() => void this.saveRename()}></sw-button>
              <sw-button size="sm" variant="ghost" iconOnly icon="close" label=${c.cancel} @click=${() => (this.renaming = null)}></sw-button></span>`
          : html`<b title=${x.name}>${x.name || x.id}</b>`}
        ${ren ? supervisedBox(this.first, 'case_rename', ren.supervised, (v) => (this.renaming = { ...ren, supervised: v }), 'case_rename') : nothing}
      </div>
      <div class="c sub muted" role="cell" title=${x.description}>${x.description || dateText(x.created_at, this.tz || undefined)}</div>
      <div class="c ltr muted" role="cell">${dateText(x.created_at, this.tz || undefined)}</div>
      <div class="c muted" role="cell">${x.arx_created ? e.arx : e.foreign}</div>
      <div class="c acts" role="cell">
        ${canWrite && !ren ? html`<sw-button size="sm" variant="ghost" iconOnly icon="edit" label=${e.rename} data-fc-rename ?disabled=${this.busy || firstBlocked(this.first, 'case_rename')} @click=${() => (this.renaming = { id: x.id, name: x.name, supervised: false })}></sw-button>` : nothing}
        ${canWrite ? html`<sw-button size="sm" variant="ghost" iconOnly icon="trash" label=${e.delete} data-fc-delete-btn ?disabled=${this.busy || firstBlocked(this.first, 'case_delete')} @click=${() => (this.deleting = { row: x, typed: '', supervised: false, error: '' })}></sw-button>` : nothing}
      </div>
    </div>`;
  }

  render() {
    if (!this.allowed) return nothing;
    const t = fx().control.settings.cases;
    const s = fx().control.settings;
    const rows = this.rows;
    const canCreate = this.enabled && !firstBlocked(this.first, 'case_create');
    return html`<div class="panel" data-frigate-cases>
      <div class="head">
        <h4>${s.tabs.cases}</h4>
        <span class="inline">
          ${this.enabled ? nothing : html`<span class="chip warn" data-fc-off>${s.classOff}</span>`}
          ${this.first && !this.first.done.case_create ? html`<span class="chip" data-fc-first-pending>${s.firstPending}</span>` : nothing}
          <sw-button size="sm" variant="primary" icon="plus" data-fc-new ?disabled=${!canCreate} @click=${() => (this.draft = { name: '', description: '', supervised: false, error: '' })}>${t.create}</sw-button>
        </span>
      </div>
      ${this.failed ? html`<div class="msg err" role="alert" data-fc-failed>${this.failed}</div>` : nothing}
      ${rows === null
        ? nothing
        : rows.length
          ? html`<div class="tbl" role="table" style="--cols: minmax(140px, 1.4fr) minmax(120px, 1.6fr) 110px 70px 88px">
              <div class="h" role="row"><span>${t.name}</span><span>${t.description}</span><span>${t.createdAt}</span><span>${t.origin}</span><span></span></div>
              ${rows.map((x) => this.row(x))}
            </div>`
          : html`<div class="tbl"><div class="empty" data-fc-empty>${t.empty}</div></div>`}
      ${this.msg ? html`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone === 'err' ? 'alert' : 'status'} data-fc-msg>${this.msg.text}</div>` : nothing}
      ${this.createDialog()}
      ${this.deleteDialog()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-cases-panel': FrigateCasesPanel;
  }
}
