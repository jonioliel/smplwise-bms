import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-card';
import './sw-button';
import './sw-badge';
import './sw-toggle';
import type { StateKind } from './sw-badge';
import { onRemote } from '../api/session';
import { describeError } from '../api/client';
import { ACTIVE_STATES, getBridgeKey, resumeRotation, setBridgeKeySettings, startRotation, type BridgeKeyStatus, type RotationMode } from '../api/bridge-key';
import { bkt, bktCode, bktLang } from '../i18n/bridge-key';

function when(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const locale = { he: 'he-IL', en: 'en-GB', ar: 'ar', ru: 'ru-RU' }[bktLang()];
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(locale, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * CR-WISKEY-HMAC-ROTATION-295: "מפתח הגשר" / Bridge key - Settings › Connections, right after the stored-passwords card. System administrator
 * only (the card hides itself on 403 / 404 and on the remote channel; the server enforces it). Shows the key id, generation, since,
 * the last rotation and the reminder - never the key itself. The switch stays disabled while the owner's activation permit is not in
 * the build; the rotate buttons are disabled with the server's short reason (`blocked_by`). Polls while a rotation is running.
 */
@customElement('sw-bridge-key-card')
export class SwBridgeKeyCard extends LitElement {
  @state() private s: BridgeKeyStatus | null = null;
  @state() private notShown = false;
  @state() private busy = false;
  @state() private error = '';
  @state() private asking: RotationMode | null = null;
  @state() private saved = false;
  private timer: number | undefined;

  static styles = css`
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px 14px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      flex-wrap: wrap;
    }
    .row:last-of-type {
      border-block-end: 0;
    }
    .lbl {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    .val {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .acts {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    select {
      min-block-size: 36px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      padding-inline: 8px;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      padding-block: 6px;
    }
    .note {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      padding-block: 6px;
    }
    .ok {
      color: var(--sw-success-text, var(--sw-text-2));
      font-size: var(--sw-fs-sm);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    if (onRemote()) {
      this.notShown = true;
      return;
    }
    void this.load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.timer);
  }

  private schedule(): void {
    window.clearTimeout(this.timer);
    const running = !!this.s?.rotation && ACTIVE_STATES.includes(this.s.rotation.state);
    if (running) this.timer = window.setTimeout(() => void this.load(), 5000);
  }

  private async load(): Promise<void> {
    try {
      this.s = await getBridgeKey();
      this.error = '';
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 403 || status === 404) this.notShown = true;
      else this.error = describeError(err);
    }
    this.schedule();
  }

  private async run(fn: () => Promise<unknown>): Promise<void> {
    this.busy = true;
    this.error = '';
    this.saved = false;
    try {
      await fn();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
    await this.load();
  }

  private overall(s: BridgeKeyStatus): [StateKind, string] {
    if (s.rotation && ACTIVE_STATES.includes(s.rotation.state)) return ['partial', bkt('stateRotating')];
    if (s.last && (s.last.state === 'needs_repair' || s.last.state === 'verify_failed')) return ['error', bkt('stateAttention')];
    if (s.key && s.key.readable === false) return ['error', bkt('stateAttention')];
    if (!s.enabled) return ['neutral', bkt('stateOff')];
    return ['live', bkt('stateReady')];
  }

  private renderAsk() {
    if (!this.asking) return nothing;
    const mode = this.asking;
    return html`<div class="row" data-bridge-key-confirm=${mode}>
      <span class="val">${bkt(mode === 'hard_cut' ? 'confirmHardCut' : 'confirmRotate')}</span>
      <span class="acts">
        <sw-button size="sm" variant="primary" ?disabled=${this.busy} data-bridge-key-confirm-yes
          @click=${() => { this.asking = null; void this.run(() => startRotation(mode)); }}>${bkt('confirm')}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${() => (this.asking = null)}>${bkt('cancel')}</sw-button>
      </span>
    </div>`;
  }

  render() {
    if (this.notShown) return nothing;
    const s = this.s;
    if (!s) return this.error ? html`<p class="err" role="alert">${this.error}</p>` : nothing;
    const [kind, label] = this.overall(s);
    const rot = s.rotation;
    const last = s.last;
    const repair = last && last.state === 'needs_repair' ? last : null;
    const blocked = s.blocked_by ? bktCode('bl_', s.blocked_by) : '';
    return html`<sw-card heading=${bkt('title')} data-bridge-key>
      <div class="row">
        <span class="lbl">${bkt('switchLabel')}</span>
        <span class="acts">
          <sw-badge kind=${kind} label=${label} data-bridge-key-state></sw-badge>
          <sw-toggle .checked=${s.enabled} ?disabled=${this.busy || (!s.enabled && !s.go_live_permitted)} label=${bkt('switchLabel')} labelHidden
            data-bridge-key-switch @change=${(e: CustomEvent<{ checked: boolean }>) => void this.run(() => setBridgeKeySettings({ enabled: e.detail.checked }))}></sw-toggle>
        </span>
      </div>
      <div class="row">
        <span class="lbl">${bkt('keyId')}</span>
        <span class="val ltr" data-bridge-key-kid>${s.key ? `${s.key.kid} · ${bkt('generation')} ${s.key.generation}` : bkt('none')}</span>
      </div>
      ${s.key ? html`<div class="row"><span class="lbl">${bkt('since')}</span><span class="val">${when(s.key.activated_at ?? s.key.created_at)}</span></div>` : nothing}
      <div class="row">
        <span class="lbl">${bkt('lastRotation')}</span>
        <span class="val" data-bridge-key-last>${(rot ?? last)
          ? `${when((rot ?? last)!.ended_at ?? (rot ?? last)!.started_at)} · ${bkt((rot ?? last)!.mode === 'hard_cut' ? 'modeHardCut' : 'modeRoutine')} · ${bktCode('st_', (rot ?? last)!.state)}`
          : bkt('none')}</span>
      </div>
      <div class="note" role="status" data-bridge-key-auto>${s.automatic === 'waiting_for_bridge' ? bkt('autoWaiting') : s.automatic === 'scheduled' ? bkt('autoScheduled') : s.automatic === 'idle' ? bkt('autoIdle') : ''}</div>
      <div class="note" data-bridge-key-hygiene>${bkt('hygieneNote')}</div>
      ${rot?.retire_at ? html`<div class="note" role="status">${bkt('retireAt', { t: when(rot.retire_at) })}</div>` : nothing}
      <div class="row">
        <span class="lbl">${bkt('reminder')}</span>
        <span class="acts">
          ${s.reminder_due ? html`<sw-badge kind="stale" label=${bkt('reminderDue')} data-bridge-key-reminder-due></sw-badge>` : nothing}
          <select aria-label=${bkt('reminder')} ?disabled=${this.busy} data-bridge-key-reminder
            @change=${(e: Event) => { const n = Number((e.target as HTMLSelectElement).value); void this.run(async () => { await setBridgeKeySettings({ reminder_days: n }); this.saved = true; }); }}>
            ${s.reminder_values.map((n) => html`<option value=${n} ?selected=${n === s.reminder_days}>${n ? bkt('reminderDays', { n }) : bkt('reminderOff')}</option>`)}
          </select>
        </span>
      </div>
      ${this.renderAsk()}
      <div class="row">
        <span class="val" data-bridge-key-blocked>${blocked}</span>
        <span class="acts">
          ${repair
            ? html`<sw-button size="sm" ?disabled=${this.busy} data-bridge-key-resume @click=${() => void this.run(() => resumeRotation(repair.id))}>${bkt('resume')}</sw-button>`
            : nothing}
          <sw-button size="sm" variant="primary" ?disabled=${this.busy || !s.can_start || !!this.asking} data-bridge-key-rotate
            @click=${() => (this.asking = 'routine')}>${bkt('rotate')}</sw-button>
          <sw-button size="sm" ?disabled=${this.busy || !s.can_start || !!this.asking} data-bridge-key-hard-cut
            @click=${() => (this.asking = 'hard_cut')}>${bkt('hardCut')}</sw-button>
        </span>
      </div>
      ${this.error ? html`<p class="err" role="alert">${this.error}</p>` : nothing}
      ${this.saved ? html`<p class="ok" role="status">${bkt('saved')}</p>` : nothing}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-bridge-key-card': SwBridgeKeyCard;
  }
}
