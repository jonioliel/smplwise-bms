import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-dropdown';
import { describeError } from '../api/client';
import type { WireCamera } from '../api/frigate';
import { EVENT_MAX_S, createManualEvent, endManualEvent, isFirstWriteRefusal, openManualEvents, type ChangeRow, type FirstWrites } from '../api/frigate-control';
import { fx } from '../i18n/frigate-text';
import { adminStyles, dateText, firstBlocked, supervisedBox } from './frigate-admin-shared';

/**
 * FRGD: manual events on ONE Frigate recorder (Settings only; F2b, class `events`, permission analytics.events). One form - camera, label,
 * a duration of 1..600 s or "open until ended" - and the open events Arx created (from the change log, the server lists none), each
 * with "סיים". The first create / end carries `supervised: true` from a system administrator. Fires `frigate-changed` after a write.
 */
@customElement('frigate-manual-events')
export class FrigateManualEvents extends LitElement {
  @property({ attribute: 'recorder-id' }) recorderId = '';
  @property({ attribute: false }) first: FirstWrites | null = null;
  @property({ attribute: false }) cams: WireCamera[] = [];
  @property({ attribute: false }) changes: ChangeRow[] = [];
  /** the `events` write class is on for the recorder */
  @property({ type: Boolean }) enabled = false;
  @property({ type: Boolean }) allowed = false;
  @property() tz = '';
  @state() private camera = '';
  @state() private label = '';
  @state() private subLabel = '';
  @state() private duration = '30';
  @state() private openEnded = false;
  @state() private supervised = false;
  @state() private endSupervised = false;
  @state() private busy = false;
  @state() private error = '';
  @state() private msg: { tone: 'ok' | 'err'; text: string } | null = null;

  static styles = adminStyles;

  private flash(tone: 'ok' | 'err', text: string) {
    this.msg = { tone, text };
    window.setTimeout(() => {
      if (this.msg?.text === text) this.msg = null;
    }, 4000);
  }

  private changed() {
    this.dispatchEvent(new CustomEvent('frigate-changed', { bubbles: true, composed: true }));
  }

  private refusal(err: unknown): string {
    return isFirstWriteRefusal(err) ? fx().control.settings.supervised.need : describeError(err);
  }

  private async create() {
    const t = fx().control.settings.events;
    const cam = this.camera || this.cams.find((c) => c.enabled)?.id || '';
    const dur = this.openEnded ? null : Number(this.duration);
    if (!cam) return void (this.error = fx().control.settings.exports.chooseCamera);
    if (!this.label.trim()) return void (this.error = t.labelError);
    if (dur !== null && (!Number.isInteger(dur) || dur < 1 || dur > EVENT_MAX_S)) return void (this.error = t.durationError);
    this.busy = true;
    this.error = '';
    try {
      const r = await createManualEvent(this.recorderId, cam, { label: this.label.trim(), duration_s: dur, sub_label: this.subLabel.trim() || null, ...(this.supervised ? { supervised: true } : {}) });
      this.label = '';
      this.subLabel = '';
      this.flash('ok', r.verified ? t.created : fx().control.unverified);
      this.changed();
    } catch (err) {
      this.error = this.refusal(err);
    } finally {
      this.busy = false;
    }
  }

  private async end(id: string) {
    this.busy = true;
    try {
      const r = await endManualEvent(this.recorderId, id, this.endSupervised);
      this.flash('ok', r.verified ? fx().control.settings.events.ended : fx().control.unverified);
      this.changed();
    } catch (err) {
      this.flash('err', this.refusal(err));
    } finally {
      this.busy = false;
    }
  }

  private camName(id: string | null): string {
    return this.cams.find((c) => c.id === id)?.name ?? id ?? '';
  }

  render() {
    if (!this.allowed) return nothing;
    const t = fx().control.settings.events;
    const s = fx().control.settings;
    const items = this.cams.filter((c) => c.enabled).map((c) => ({ id: c.id, label: c.name }));
    const camera = this.camera || items[0]?.id || '';
    const needSup = !!this.first && this.first.can_supervise && !this.first.done.event_create;
    const canCreate = this.enabled && !firstBlocked(this.first, 'event_create') && items.length > 0;
    const open = openManualEvents(this.changes);
    return html`<div class="panel" data-frigate-events>
      <div class="head">
        <h4>${t.create}</h4>
        <span class="inline">
          ${this.enabled ? nothing : html`<span class="chip warn" data-fe-off>${s.classOff}</span>`}
          ${this.first && !this.first.done.event_create ? html`<span class="chip" data-fe-first-pending>${s.firstPending}</span>` : nothing}
        </span>
      </div>
      <div class="form" data-fe-form>
        <div class="two">
          <label>${t.camera}<sw-dropdown block data-fe-camera .label=${t.camera} .placeholder=${t.camera} .value=${camera} .items=${items} @change=${(e: CustomEvent<{ id: string }>) => (this.camera = e.detail.id)}></sw-dropdown></label>
          <label>${t.label}<input type="text" maxlength="40" data-fe-label .value=${this.label} ?disabled=${!canCreate} @input=${(e: Event) => (this.label = (e.target as HTMLInputElement).value)} /></label>
        </div>
        <div class="two">
          <label>${t.subLabel}<input type="text" maxlength="60" data-fe-sub-label .value=${this.subLabel} ?disabled=${!canCreate} @input=${(e: Event) => (this.subLabel = (e.target as HTMLInputElement).value)} /></label>
          <label>${t.duration}<input type="number" min="1" max=${EVENT_MAX_S} step="1" data-fe-duration .value=${this.duration} ?disabled=${!canCreate || this.openEnded} @input=${(e: Event) => (this.duration = (e.target as HTMLInputElement).value)} /></label>
        </div>
        <label class="row"><input type="checkbox" data-fe-open .checked=${this.openEnded} ?disabled=${!canCreate} @change=${(e: Event) => (this.openEnded = (e.target as HTMLInputElement).checked)} /><span>${t.openEnded}</span></label>
        ${supervisedBox(this.first, 'event_create', this.supervised, (v) => (this.supervised = v), 'event_create')}
        ${this.error ? html`<div class="err" role="alert" data-fe-error>${this.error}</div>` : nothing}
        <div class="inline"><sw-button size="sm" variant="primary" icon="plus" data-fe-create ?disabled=${this.busy || !canCreate || (needSup && !this.supervised)} @click=${() => void this.create()}>${t.create}</sw-button></div>
      </div>
      <h5>${t.openList}</h5>
      ${open.length
        ? html`<div class="tbl" role="table" style="--cols: minmax(120px, 1.4fr) minmax(100px, 1fr) 110px 110px 80px">
            <div class="h" role="row"><span>${t.label}</span><span>${t.camera}</span><span>${fx().review.time}</span><span>${fx().control.settings.by}</span><span></span></div>
            ${open.map((o) => html`<div class="r" role="row" data-fe-open-row=${o.id}>
              <div class="c main" role="cell"><b>${o.label}</b>${o.sub_label ? html` <span class="muted">· ${o.sub_label}</span>` : nothing}${o.status === 'unverified' ? html` <span class="chip warn">${s.unverified}</span>` : nothing}</div>
              <div class="c sub muted" role="cell">${this.camName(o.camera_id)} · ${dateText(o.at, this.tz || undefined)}</div>
              <div class="c ltr muted" role="cell">${dateText(o.at, this.tz || undefined)}</div>
              <div class="c muted" role="cell">${o.actor ?? ''}</div>
              <div class="c acts" role="cell"><sw-button size="sm" icon="stopSquare" data-fe-end ?disabled=${this.busy || !this.enabled || firstBlocked(this.first, 'event_end')} @click=${() => void this.end(o.id)}>${t.end}</sw-button></div>
            </div>`)}
          </div>
          ${supervisedBox(this.first, 'event_end', this.endSupervised, (v) => (this.endSupervised = v), 'event_end')}`
        : html`<div class="tbl"><div class="empty" data-fe-empty>${t.empty}</div></div>`}
      ${this.msg ? html`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone === 'err' ? 'alert' : 'status'} data-fe-msg>${this.msg.text}</div>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-manual-events': FrigateManualEvents;
  }
}
