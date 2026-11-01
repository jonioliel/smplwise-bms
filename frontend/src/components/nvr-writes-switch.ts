import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-dialog';
import './sw-toggle';
import { describeError } from '../api/client';
import { PRIMARY_RECORDER, recorderWrites, setRecorderWrites, type RecorderWrites } from '../api/recorders';
import {
  WRITES_CONFIRM_ACTION,
  WRITES_CONFIRM_HEADING,
  WRITES_CONFIRM_POINTS,
  WRITES_LABEL,
  writesStatusLine,
} from '../screens/nvr-h264-preset';

const fmt = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });
};

/**
 * NVR-H264-BULK-2341: "אפשר שינויי הגדרות ב־NVR" - the per-recorder switch in the NVR connection settings (nvr-connection-form). Off: Arx
 * never writes encoding settings to this recorder (the single stream editor, the multi-camera change, the bulk encoding change and their
 * undos are all refused, before a request is built). Turning it ON opens a Hebrew confirmation (what Arx will write, that it is recorded,
 * that it can be turned off any time); turning it OFF applies at once without a question (a safety action). Changing it needs
 * `system.configure` and `nvr.configure` (`can_change`); without the second the switch is shown read-only. Hidden for a vendor without
 * encoding writes (Frigate, "no NVR").
 */
@customElement('nvr-writes-switch')
export class NvrWritesSwitch extends LitElement {
  @property({ attribute: 'recorder-id' }) recorderId = PRIMARY_RECORDER;
  @state() private view: RecorderWrites | null = null;
  @state() private busy = false;
  @state() private confirmOpen = false;
  @state() private error = '';

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('recorderId') && changed.get('recorderId') !== undefined) void this.load();
  }

  private async load() {
    try {
      this.view = await recorderWrites(this.recorderId);
      this.error = '';
    } catch {
      // an older server without the route, or no answer: the connection card stays as it was (the switch is not shown); the server
      // refuses every write while the switch is off anyway
      this.view = null;
      this.error = '';
    }
  }

  private async apply(enabled: boolean) {
    this.busy = true;
    this.error = '';
    try {
      this.view = await setRecorderWrites(this.recorderId, enabled, enabled);
      this.confirmOpen = false;
      this.dispatchEvent(new CustomEvent('writes-changed', { detail: { recorderId: this.recorderId, enabled: this.view.enabled }, bubbles: true, composed: true }));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private onToggle(e: CustomEvent<{ checked: boolean }>) {
    const want = e.detail.checked;
    const v = this.view;
    if (!v) return;
    (e.target as HTMLElement & { checked: boolean }).checked = v.enabled; // the switch shows the server's state until it answers
    if (want === v.enabled) return;
    if (want) this.confirmOpen = true;
    else void this.apply(false);
  }

  render() {
    const v = this.view;
    if (!v || !v.supported) return nothing;
    return html`<div class="row" data-nvr-writes data-enabled=${v.enabled ? 'true' : 'false'}>
        <div class="txt">
          <span class="label">${WRITES_LABEL}</span>
          <span class="status" data-nvr-writes-status>${writesStatusLine(v, fmt)}</span>
          ${v.can_change ? nothing : html`<span class="status" data-nvr-writes-readonly>נדרשת הרשאת שינוי הגדרות NVR</span>`}
        </div>
        <sw-toggle label=${WRITES_LABEL} .labelHidden=${true} data-nvr-writes-toggle .checked=${v.enabled} ?disabled=${!v.can_change || this.busy} @change=${(e: CustomEvent<{ checked: boolean }>) => this.onToggle(e)}></sw-toggle>
      </div>
      ${this.error ? html`<p class="err" role="alert" data-nvr-writes-error>${this.error}</p>` : nothing}
      ${this.confirmOpen
        ? html`<sw-dialog open heading=${WRITES_CONFIRM_HEADING} data-nvr-writes-dialog ?locked=${this.busy} @close=${() => (this.confirmOpen = false)}>
            <ul class="points">${WRITES_CONFIRM_POINTS.map((p) => html`<li>${p}</li>`)}</ul>
            <div slot="footer">
              <sw-button variant="primary" data-nvr-writes-confirm ?disabled=${this.busy} @click=${() => void this.apply(true)}>${this.busy ? 'מפעיל…' : WRITES_CONFIRM_ACTION}</sw-button>
              <sw-button variant="ghost" data-nvr-writes-cancel ?disabled=${this.busy} @click=${() => (this.confirmOpen = false)}>ביטול</sw-button>
            </div>
          </sw-dialog>`
        : nothing}`;
  }

  static styles = css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-block-size: 44px;
      padding-block: 8px;
      border-block-start: 1px solid var(--sw-border);
    }
    .txt {
      display: grid;
      gap: 2px;
      min-inline-size: 0;
    }
    .label {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    .status {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      overflow-wrap: anywhere;
    }
    .err {
      margin: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-danger-text, var(--sw-danger));
    }
    .points {
      margin: 0;
      padding-inline-start: 18px;
      display: grid;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'nvr-writes-switch': NvrWritesSwitch;
  }
}
