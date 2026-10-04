import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-badge';
import './sw-button';
import './sw-card';
import './sw-dialog';
import './sw-field';
import './sw-state-panel';
import './nvr-connection-form';
import { ApiError, describeError } from '../api/client';
import { listRecorders, updateRecorder, STATE_TEXT, type Recorder, type RecorderList } from '../api/recorders';
import { can, isApi } from '../api/session';
import { announceRestartPending } from './nvr-restart-banner';
import type { StateKind } from './sw-badge';

const BADGE: Record<string, StateKind> = { online: 'live', error: 'error', unknown: 'unknown', pending_restart: 'stale', disabled: 'neutral', not_configured: 'neutral', unreadable: 'error', refused: 'error', removed: 'neutral' };

/**
 * CR-024: Settings › connections - the installation's recorders. With one recorder the card is the familiar connection form
 * (plus "הוסף NVR" once that recorder is connected), so a single-NVR installation looks as before; with two or more, one row per recorder:
 * name, type and model, state, cameras; "חיבור" opens that recorder's connection form (edit, test, remove - the cameras stay
 * disabled and hidden, history kept), "שם" renames, "השבת"/"הפעל" toggles it. "הוסף NVR" opens the connection form in its add
 * mode (type → fields → test → save). Every change waits for a restart (the shell's banner). An installation without an NVR
 * shows the connection form itself, as before. system.configure only.
 */
@customElement('nvr-recorders-card')
export class NvrRecordersCard extends LitElement {
  @state() private loadState: 'loading' | 'ready' | 'error' = 'loading';
  @state() private loadError = '';
  @state() private data: RecorderList | null = null;
  @state() private open = '';
  @state() private renaming = '';
  @state() private nameDraft = '';
  @state() private toggling: Recorder | null = null;
  @state() private adding = false;
  @state() private busy = false;
  @state() private msg: { tone: 'ok' | 'err'; text: string } | null = null;
  /** A backend without the recorders route (404): the plain connection form, as before multi-NVR. */
  @state() private fallback = false;

  private readonly mq = window.matchMedia('(max-width: 767px)');
  private readonly onMq = () => this.requestUpdate();
  private get btn(): 'sm' | 'lg' {
    return this.mq.matches ? 'lg' : 'sm';
  }

  connectedCallback() {
    super.connectedCallback();
    this.mq.addEventListener('change', this.onMq);
    if (isApi() && can('system.configure')) void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mq.removeEventListener('change', this.onMq);
  }

  private async load() {
    try {
      const data = await listRecorders();
      this.fallback = !Array.isArray(data?.recorders);
      this.data = this.fallback ? null : data;
      this.loadState = 'ready';
      this.loadError = '';
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        this.fallback = true;
        this.loadState = 'ready';
        return;
      }
      this.loadError = describeError(err);
      this.loadState = 'error';
    }
  }

  private async rename(r: Recorder) {
    const name = this.nameDraft.trim();
    if (!name || this.busy) return;
    this.busy = true;
    try {
      await updateRecorder(r.id, { name });
      this.renaming = '';
      this.msg = { tone: 'ok', text: 'השם נשמר' };
      await this.load();
    } catch (err) {
      this.msg = { tone: 'err', text: describeError(err) };
    } finally {
      this.busy = false;
    }
  }

  private async toggle(r: Recorder) {
    if (this.busy) return;
    this.busy = true;
    try {
      const out = await updateRecorder(r.id, { enabled: !r.enabled });
      this.toggling = null;
      this.msg = { tone: 'ok', text: r.enabled ? 'ה־NVR הושבת' : 'ה־NVR הופעל' };
      if (out.restart_required) announceRestartPending(true);
      await this.load();
    } catch (err) {
      this.toggling = null;
      this.msg = { tone: 'err', text: describeError(err) };
    } finally {
      this.busy = false;
    }
  }

  private changed(text: string) {
    this.msg = { tone: 'ok', text };
    this.adding = false;
    void this.load();
  }

  private row(r: Recorder) {
    const st = r.status.state;
    const meta = [r.vendor_label, r.model].filter(Boolean).join(' · ');
    const isOpen = this.open === r.id;
    return html`<li class="rec" data-recorder=${r.id} data-recorder-state=${st}>
      <div class="head">
        <div class="who">
          ${this.renaming === r.id
            ? html`<input class="name-in" data-recorder-name-input maxlength="60" .value=${this.nameDraft} @input=${(e: Event) => (this.nameDraft = (e.target as HTMLInputElement).value)}
                @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this.rename(r); if (e.key === 'Escape') this.renaming = ''; }} />`
            : html`<span class="name" data-recorder-name>${r.name}</span>`}
          <span class="meta">${meta}</span>
        </div>
        <div class="facts">
          <sw-badge kind=${BADGE[st] ?? 'neutral'} label=${STATE_TEXT[st] ?? st} data-recorder-status></sw-badge>
          <span class="cams" data-recorder-cameras>${r.cameras} מצלמות</span>
        </div>
      </div>
      <div class="actions">
        ${this.renaming === r.id
          ? html`<sw-button size=${this.btn} variant="primary" icon="check" ?disabled=${this.busy || !this.nameDraft.trim()} data-recorder-name-save @click=${() => this.rename(r)}>שמור</sw-button>
              <sw-button size=${this.btn} variant="ghost" @click=${() => (this.renaming = '')}>ביטול</sw-button>`
          : html`<sw-button size=${this.btn} icon="link" data-recorder-connection aria-expanded=${String(isOpen)} @click=${() => (this.open = isOpen ? '' : r.id)}>חיבור</sw-button>
              <sw-button size=${this.btn} variant="ghost" icon="edit" data-recorder-rename @click=${() => { this.renaming = r.id; this.nameDraft = r.name; this.msg = null; }}>שם</sw-button>
              <sw-button size=${this.btn} variant="ghost" icon="power" data-recorder-toggle @click=${() => (this.toggling = r)}>${r.enabled ? 'השבת' : 'הפעל'}</sw-button>`}
      </div>
      ${isOpen
        ? html`<div class="conn" data-recorder-connection-form>
            <nvr-connection-form context="settings" recorder-id=${r.id}
              @nvr-connection-saved=${() => this.changed('נשמר')} @nvr-connection-removed=${() => { this.open = ''; this.changed('ה־NVR הוסר'); }}></nvr-connection-form>
          </div>`
        : nothing}
    </li>`;
  }

  private addDialog() {
    return html`<sw-dialog open wide heading="הוספת NVR" data-recorder-add-dialog @close=${() => (this.adding = false)}>
      <nvr-connection-form context="add" @nvr-recorder-added=${() => this.changed('ה־NVR נוסף')}></nvr-connection-form>
    </sw-dialog>`;
  }

  render() {
    if (!isApi() || !can('system.configure')) return nothing;
    if (this.loadState === 'loading') return html`<sw-card heading="מקליטים (NVR)"><sw-state-panel state="loading" compact heading="קורא…"></sw-state-panel></sw-card>`;
    if (this.fallback) {
      return html`<sw-card heading="חיבור ל־NVR" data-nvr-connection><nvr-connection-form context="settings"></nvr-connection-form></sw-card>`;
    }
    if (this.loadState === 'error' || !this.data) {
      return html`<sw-card heading="מקליטים (NVR)"><sw-state-panel state="error" compact heading="רשימת המקליטים לא נטענה" hint=${this.loadError} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel></sw-card>`;
    }
    const recs = this.data.recorders.filter((r) => !r.removed);
    if (recs.length <= 1) {
      // no NVR yet, or one: the connection form itself (choose a type, or "ללא NVR"), as before multi-NVR; "הוסף NVR" once one is connected
      const only = recs[0];
      const connected = !!only && only.connection?.vendor && only.connection.vendor !== 'none' && only.connection.state !== 'not_chosen';
      return html`<sw-card heading="חיבור ל־NVR" data-nvr-connection>
        <nvr-connection-form context="settings" recorder-id=${only?.id ?? 'nvr-1'} @nvr-connection-saved=${() => void this.load()} @nvr-connection-removed=${() => void this.load()}></nvr-connection-form>
        ${connected ? html`<div class="actions add-one"><sw-button size=${this.btn} icon="plus" data-recorder-add @click=${() => { this.adding = true; this.msg = null; }}>הוסף NVR</sw-button></div>` : nothing}
        ${this.msg ? html`<div class=${`line ${this.msg.tone}`} role=${this.msg.tone === 'err' ? 'alert' : 'status'} data-recorder-msg>${this.msg.text}</div>` : nothing}
        ${this.adding ? this.addDialog() : nothing}
      </sw-card>`;
    }
    const t = this.toggling;
    return html`<sw-card heading="מקליטים (NVR)" data-nvr-recorders data-nvr-connection>
      <ul class="list" data-recorder-list>${recs.map((r) => this.row(r))}</ul>
      <div class="actions">
        <sw-button size=${this.btn} variant="primary" icon="plus" data-recorder-add @click=${() => { this.adding = true; this.msg = null; }}>הוסף NVR</sw-button>
      </div>
      ${this.msg ? html`<div class=${`line ${this.msg.tone}`} role=${this.msg.tone === 'err' ? 'alert' : 'status'} data-recorder-msg>${this.msg.text}</div>` : nothing}
      ${this.adding ? this.addDialog() : nothing}
      ${t
        ? html`<sw-dialog open heading=${t.enabled ? 'השבתת NVR' : 'הפעלת NVR'} subheading=${t.name} data-recorder-toggle-dialog @close=${() => (this.toggling = null)}>
            <div class="dlg">${t.enabled ? 'המצלמות שלו יישארו ברשימות ולא יוצגו בשידור חי.' : 'ה־NVR יחזור לפעול.'}</div>
            <div slot="footer">
              <sw-button variant=${t.enabled ? 'danger' : 'primary'} ?disabled=${this.busy} data-recorder-toggle-confirm @click=${() => this.toggle(t)}>${t.enabled ? 'השבת' : 'הפעל'}</sw-button>
              <sw-button variant="ghost" @click=${() => (this.toggling = null)}>ביטול</sw-button>
            </div>
          </sw-dialog>`
        : nothing}
    </sw-card>`;
  }

  static styles = css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    .rec {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 0;
      border-block-end: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    .rec:last-child {
      border-block-end: 0;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      min-inline-size: 0;
    }
    .who {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    .name {
      font-weight: var(--sw-fw-semibold);
      overflow-wrap: anywhere;
    }
    .meta,
    .cams,
    .dlg,
    .line {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .facts {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .add-one {
      margin-block-start: 12px;
      padding-block-start: 12px;
      border-block-start: 1px solid var(--sw-border);
    }
    .conn {
      padding: 10px 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md, 10px);
      background: var(--sw-surface-2, transparent);
      min-inline-size: 0;
    }
    .name-in {
      font: inherit;
      min-block-size: var(--sw-touch-desktop, 44px);
      max-inline-size: 100%;
      inline-size: 260px;
      box-sizing: border-box;
      padding: 4px 8px;
      border: 1px solid var(--sw-border-strong, var(--sw-border));
      border-radius: 8px;
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    .line.ok {
      color: var(--sw-success, #15803d);
    }
    .line.err {
      color: var(--sw-danger-text, var(--sw-danger));
    }
    @media (max-width: 767px) {
      .name-in {
        min-block-size: 44px;
        inline-size: 100%;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'nvr-recorders-card': NvrRecordersCard;
  }
}
