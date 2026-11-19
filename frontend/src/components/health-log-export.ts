import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-button';
import './sw-card';
import './sw-field';
import { ApiError, describeError } from '../api/client';
import { exportLogs, LOG_EXPORT_LEVELS, LOG_EXPORT_MINUTES, type LogExportLevel, type LogExportMinutes } from '../api/health';
import { confirmDialog } from './confirm-dialog';
import { ToastController } from './toast-controller';
import { liftRef, liftedReset } from './top-layer';
import { lxt } from '../i18n/log-export';
import { SkinController } from '../design/skin';

/**
 * CR-FE-LOGEXPORT-TARIFF-EN-2440 (T033 acceptance 2; CR-BE-SMALL-2440 question 1 a / 2 a): הגדרות › בריאות ועבודות - the redacted
 * log export. Two choices (the window, 60 minutes by default, up to 24 hours; the level, information and above by default) and one
 * button. The button first asks for the administrator's explicit consent in a confirmation dialog that says what the file holds and
 * what it never holds; only a "yes" posts `consent: true` and saves the JSON the server answers. A "no" creates nothing (a short
 * toast says so). A refusal (403, `consent_required`) or a failure stays on the card under the button with a retry, until the next
 * try. Shown by <system-diagnostics> only to a user who may edit the system settings (the server also checks system.configure).
 */
@customElement('health-log-export')
export class HealthLogExport extends LitElement {
  readonly skin = new SkinController(this);
  @state() private minutes: LogExportMinutes = 60;
  @state() private level: LogExportLevel = 'INFO';
  @state() private busy = false;
  @state() private error = '';
  private toast = new ToastController(this, { ms: 3200 });

  static styles = [liftedReset, css`
    :host {
      display: block;
    }
    .opts {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
      gap: 8px 12px;
    }
    .opts select {
      inline-size: 100%;
      box-sizing: border-box;
    }
    .hidden {
      margin-block: 10px 0;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px 12px;
      margin-block-start: 12px;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    /* centred by auto margins (not a transform), so the same rule holds in the RTL and the LTR interface */
    .toast {
      position: fixed;
      inset-block-end: 24px;
      inset-inline: 16px;
      margin-inline: auto;
      inline-size: fit-content;
      box-sizing: border-box;
      background: var(--sw-toast-bg);
      color: var(--sw-toast-text);
      padding: 10px 16px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-md);
      z-index: var(--sw-z-toast);
      box-shadow: var(--sw-shadow-3);
      max-inline-size: calc(100vw - 32px);
      overflow-wrap: anywhere;
    }
    @media (max-width: 767px) {
      .toast {
        inset-block-end: calc(var(--sw-bottomnav-h) + 16px + env(safe-area-inset-bottom));
      }
    }
    :host([data-skin='bubble']) .opts select {
      min-block-size: 44px;
    }
  `];

  private async run() {
    if (this.busy) return;
    const ok = await confirmDialog({
      heading: lxt('confirmTitle'),
      body: lxt('confirmBody', { window: lxt(`w${this.minutes}`), level: lxt(`p${this.level}`) }),
      confirmLabel: lxt('confirm'),
      cancelLabel: lxt('cancel'),
    });
    if (!ok) {
      this.toast.show(lxt('cancelled'));
      return;
    }
    this.busy = true;
    this.error = '';
    try {
      const name = await exportLogs(this.minutes, this.level);
      this.toast.show(lxt('done', { name }));
    } catch (err) {
      this.error = err instanceof ApiError && err.status === 403 ? lxt('forbidden')
        : err instanceof ApiError && err.body.code === 'consent_required' ? lxt('consent')
        : lxt('failed', { error: describeError(err) });
    } finally {
      this.busy = false;
    }
  }

  render() {
    return html`<sw-card heading=${lxt('title')} subheading=${lxt('subtitle')} data-log-export>
      <div class="opts">
        <sw-field label=${lxt('window')}><select data-log-window ?disabled=${this.busy} @change=${(e: Event) => { this.minutes = Number((e.target as HTMLSelectElement).value) as LogExportMinutes; this.error = ''; }}>
          ${LOG_EXPORT_MINUTES.map((m) => html`<option value=${m} .selected=${m === this.minutes}>${lxt(`o${m}`)}</option>`)}</select></sw-field>
        <sw-field label=${lxt('level')}><select data-log-level ?disabled=${this.busy} @change=${(e: Event) => { this.level = (e.target as HTMLSelectElement).value as LogExportLevel; this.error = ''; }}>
          ${LOG_EXPORT_LEVELS.map((l) => html`<option value=${l} .selected=${l === this.level}>${lxt(`o${l}`)}</option>`)}</select></sw-field>
      </div>
      <div class="hidden">${lxt('hidden')}</div>
      <div class="actions">
        <sw-button size="sm" icon="download" data-log-export-go ?disabled=${this.busy} @click=${() => void this.run()}>${this.busy ? lxt('exporting') : lxt('export')}</sw-button>
        ${this.error ? html`<span class="err" role="alert" data-log-export-error>${this.error}</span><sw-button size="sm" variant="ghost" data-log-export-retry @click=${() => void this.run()}>${lxt('retry')}</sw-button>` : nothing}
      </div>
      ${this.toast.text ? html`<div class="toast" role="status" data-log-export-toast ${liftRef()}>${this.toast.text}</div>` : nothing}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'health-log-export': HealthLogExport;
  }
}
