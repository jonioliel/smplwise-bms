import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-dialog';
import './sw-dropdown';
import { describeError } from '../api/client';
import type { WireCamera } from '../api/frigate';
import {
  createExport, deleteExport, exportRangeError, getExports, isFirstWriteRefusal, renameExport, typedMatches,
  type FirstWrites, type FrigateExport,
} from '../api/frigate-control';
import { fx } from '../i18n/frigate-text';
import { adminStyles, dateText, epochToLocal, firstBlocked, localToEpoch, supervisedBox } from './frigate-admin-shared';

interface CreateDraft {
  camera: string;
  start: string;
  end: string;
  name: string;
  supervised: boolean;
  error: string;
}

/**
 * FRGD: Frigate's exports for ONE recorder (Settings only; F2b class `exports`, permission analytics.exports + video.export on the camera).
 * A table (name, camera, date, state, origin) that folds to rows on a narrow card; "ייצוא חדש" (one camera, a range of at most two
 * hours, not in the future); rename inline and delete with a typed confirmation - both only for exports Arx created (the server refuses
 * the rest). The first write of each kind carries `supervised: true` from a system administrator. Fires `frigate-changed` after a write.
 */
@customElement('frigate-exports-panel')
export class FrigateExportsPanel extends LitElement {
  @property({ attribute: 'recorder-id' }) recorderId = '';
  @property({ attribute: false }) first: FirstWrites | null = null;
  @property({ attribute: false }) cams: WireCamera[] = [];
  /** the caller holds analytics.exports somewhere */
  @property({ type: Boolean }) allowed = false;
  @property() tz = '';
  @state() private rows: FrigateExport[] | null = null;
  @state() private enabled = false;
  @state() private failed = '';
  @state() private busy = false;
  @state() private msg: { tone: 'ok' | 'err'; text: string } | null = null;
  @state() private draft: CreateDraft | null = null;
  @state() private renaming: { id: string; name: string; supervised: boolean } | null = null;
  @state() private deleting: { row: FrigateExport; typed: string; supervised: boolean; error: string } | null = null;

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
      const r = await getExports(this.recorderId);
      this.rows = r.exports;
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

  private openCreate() {
    const now = Math.floor(Date.now() / 1000);
    const cam = this.cams.find((c) => c.enabled && c.frigate_enabled !== false) ?? this.cams[0];
    this.draft = { camera: cam?.id ?? '', start: epochToLocal(now - 600), end: epochToLocal(now), name: '', supervised: false, error: '' };
  }

  private async submitCreate() {
    const d = this.draft;
    if (!d || this.busy) return;
    const t = fx().control.settings.exports;
    const start = localToEpoch(d.start);
    const end = localToEpoch(d.end);
    const bad = exportRangeError(start, end);
    if (!d.camera) return void (this.draft = { ...d, error: t.chooseCamera });
    if (bad) return void (this.draft = { ...d, error: bad === 'missing' ? t.rangeMissing : bad === 'order' ? t.rangeOrder : bad === 'long' ? t.rangeLong : t.rangeFuture });
    if (!d.name.trim()) return void (this.draft = { ...d, error: `${t.name}?` });
    this.busy = true;
    try {
      const r = await createExport(this.recorderId, { camera_id: d.camera, start: start!, end: end!, name: d.name.trim(), ...(d.supervised ? { supervised: true } : {}) });
      this.draft = null;
      this.flash('ok', r.verified ? t.created : fx().control.unverified);
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
      const res = await renameExport(this.recorderId, r.id, r.name.trim(), r.supervised);
      this.renaming = null;
      this.flash('ok', res.verified ? fx().control.settings.exports.renamed : fx().control.unverified);
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
      const res = await deleteExport(this.recorderId, d.row.id, d.supervised);
      this.deleting = null;
      this.flash('ok', res.verified ? fx().control.settings.exports.deleted : fx().control.unverified);
      this.changed();
    } catch (err) {
      this.deleting = { ...d, error: this.refusal(err) };
    } finally {
      this.busy = false;
    }
  }

  private camName(id: string, key: string | null): string {
    return this.cams.find((c) => c.id === id)?.name ?? key ?? id;
  }

  private createDialog() {
    const d = this.draft;
    if (!d) return nothing;
    const t = fx().control.settings.exports;
    const c = fx().control;
    const items = this.cams.filter((x) => x.enabled).map((x) => ({ id: x.id, label: x.name }));
    const needSup = !!this.first && this.first.can_supervise && !this.first.done.export_create;
    return html`<sw-dialog open heading=${t.create} data-fx-create @close=${() => (this.draft = null)}>
      <div class="form">
        <label>${t.camera}<sw-dropdown block data-fx-camera .label=${t.camera} .placeholder=${t.chooseCamera} .value=${d.camera} .items=${items} @change=${(e: CustomEvent<{ id: string }>) => (this.draft = { ...d, camera: e.detail.id })}></sw-dropdown></label>
        <div class="two">
          <label>${t.from}<input type="datetime-local" data-fx-start .value=${d.start} @input=${(e: Event) => (this.draft = { ...d, start: (e.target as HTMLInputElement).value })} /></label>
          <label>${t.to}<input type="datetime-local" data-fx-end .value=${d.end} @input=${(e: Event) => (this.draft = { ...d, end: (e.target as HTMLInputElement).value })} /></label>
        </div>
        <label>${t.name}<input type="text" maxlength="80" data-fx-name .value=${d.name} @input=${(e: Event) => (this.draft = { ...d, name: (e.target as HTMLInputElement).value })} /></label>
        ${supervisedBox(this.first, 'export_create', d.supervised, (v) => (this.draft = { ...d, supervised: v }), 'export_create')}
        ${d.error ? html`<div class="err" role="alert" data-fx-error>${d.error}</div>` : nothing}
      </div>
      <sw-button slot="footer" @click=${() => (this.draft = null)}>${c.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" icon="download" data-fx-create-ok ?disabled=${this.busy || (needSup && !d.supervised)} @click=${() => void this.submitCreate()}>${t.create}</sw-button>
    </sw-dialog>`;
  }

  private deleteDialog() {
    const d = this.deleting;
    if (!d) return nothing;
    const t = fx().control.settings.exports;
    const c = fx().control;
    const needSup = !!this.first && this.first.can_supervise && !this.first.done.export_delete;
    return html`<sw-dialog open heading=${t.deleteTitle} subheading=${d.row.name} data-fx-delete @close=${() => (this.deleting = null)}>
      <div class="form">
        <p class="dialog-text">${t.deleteText}</p>
        <input type="text" data-fx-delete-typed aria-label=${t.name} .value=${d.typed} @input=${(e: Event) => (this.deleting = { ...d, typed: (e.target as HTMLInputElement).value })} />
        ${supervisedBox(this.first, 'export_delete', d.supervised, (v) => (this.deleting = { ...d, supervised: v }), 'export_delete')}
        ${d.error ? html`<div class="err" role="alert" data-fx-error>${d.error}</div>` : nothing}
      </div>
      <sw-button slot="footer" @click=${() => (this.deleting = null)}>${c.cancel}</sw-button>
      <sw-button slot="footer" variant="danger" icon="trash" data-fx-delete-ok ?disabled=${this.busy || !typedMatches(d.typed, d.row.name) || (needSup && !d.supervised)} @click=${() => void this.confirmDelete()}>${t.delete}</sw-button>
    </sw-dialog>`;
  }

  private row(x: FrigateExport) {
    const t = fx().control.settings.exports;
    const c = fx().control;
    const ren = this.renaming?.id === x.id ? this.renaming : null;
    const canWrite = this.enabled && x.arx_created;
    return html`<div class="r" role="row" data-fx-row=${x.id} data-arx=${String(x.arx_created)}>
      <div class="c main" role="cell">
        ${ren
          ? html`<span class="inline"><input type="text" maxlength="80" data-fx-rename-input aria-label=${t.name} .value=${ren.name} ?disabled=${this.busy}
                @input=${(e: Event) => (this.renaming = { ...ren, name: (e.target as HTMLInputElement).value })}
                @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this.saveRename(); if (e.key === 'Escape') this.renaming = null; }} />
              <sw-button size="sm" variant="primary" iconOnly icon="check" label=${c.confirm} data-fx-rename-save ?disabled=${this.busy || !ren.name.trim()} @click=${() => void this.saveRename()}></sw-button>
              <sw-button size="sm" variant="ghost" iconOnly icon="close" label=${c.cancel} @click=${() => (this.renaming = null)}></sw-button></span>`
          : html`<b title=${x.name}>${x.name || x.id}</b>`}
        ${ren ? supervisedBox(this.first, 'export_rename', ren.supervised, (v) => (this.renaming = { ...ren, supervised: v }), 'export_rename') : nothing}
      </div>
      <div class="c sub muted" role="cell">${this.camName(x.camera_id, x.camera)} · ${dateText(x.date, this.tz || undefined)}</div>
      <div class="c ltr muted" role="cell">${dateText(x.date, this.tz || undefined)}</div>
      <div class="c" role="cell"><span class=${`chip ${x.in_progress ? 'warn' : 'ok'}`} data-fx-state=${x.in_progress ? 'progress' : 'ready'}>${x.in_progress ? t.inProgress : t.ready}</span></div>
      <div class="c muted" role="cell">${x.arx_created ? t.arx : t.foreign}</div>
      <div class="c acts" role="cell">
        ${canWrite && !ren ? html`<sw-button size="sm" variant="ghost" iconOnly icon="edit" label=${t.rename} data-fx-rename ?disabled=${this.busy || firstBlocked(this.first, 'export_rename')} @click=${() => (this.renaming = { id: x.id, name: x.name, supervised: false })}></sw-button>` : nothing}
        ${canWrite ? html`<sw-button size="sm" variant="ghost" iconOnly icon="trash" label=${t.delete} data-fx-delete-btn ?disabled=${this.busy || firstBlocked(this.first, 'export_delete')} @click=${() => (this.deleting = { row: x, typed: '', supervised: false, error: '' })}></sw-button>` : nothing}
      </div>
    </div>`;
  }

  render() {
    if (!this.allowed) return nothing;
    const t = fx().control.settings.exports;
    const s = fx().control.settings;
    const rows = this.rows;
    const canCreate = this.enabled && !firstBlocked(this.first, 'export_create') && this.cams.length > 0;
    return html`<div class="panel" data-frigate-exports>
      <div class="head">
        <h4>${s.tabs.exports}</h4>
        <span class="inline">
          ${this.enabled ? nothing : html`<span class="chip warn" data-fx-off>${s.classOff}</span>`}
          ${this.first && !this.first.done.export_create ? html`<span class="chip" data-fx-first-pending>${s.firstPending}</span>` : nothing}
          <sw-button size="sm" variant="primary" icon="plus" data-fx-new ?disabled=${!canCreate} @click=${() => this.openCreate()}>${t.create}</sw-button>
        </span>
      </div>
      ${this.failed ? html`<div class="msg err" role="alert" data-fx-failed>${this.failed}</div>` : nothing}
      ${rows === null
        ? nothing
        : rows.length
          ? html`<div class="tbl" role="table" style="--cols: minmax(140px, 1.6fr) minmax(90px, 1fr) 110px 88px 70px 88px">
              <div class="h" role="row"><span>${t.name}</span><span>${t.camera}</span><span>${t.date}</span><span>${t.state}</span><span>${t.origin}</span><span></span></div>
              ${rows.map((x) => this.row(x))}
            </div>`
          : html`<div class="tbl"><div class="empty" data-fx-empty>${t.empty}</div></div>`}
      ${this.msg ? html`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone === 'err' ? 'alert' : 'status'} data-fx-msg>${this.msg.text}</div>` : nothing}
      ${this.createDialog()}
      ${this.deleteDialog()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-exports-panel': FrigateExportsPanel;
  }
}
