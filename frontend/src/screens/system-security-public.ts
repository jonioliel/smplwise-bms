import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { describeError, get, patch, put } from '../api/client';
import { getPendingPolicy, putPendingPolicy, type PendingPolicy } from '../api/access-grants';
import { can, isApi } from '../api/session';
import { statusStyles } from '../access-control/status-css';
import { parseCap, parseRetention } from '../access-external/pending-model';
import { spt } from '../i18n/security-public';
import { bubbleChrome } from '../styles/bubble-chrome';

export const UNIFORM_404_KEY = 'access.unknown_person_uniform_404';

interface SettingsReply {
  settings: Record<string, unknown>;
  can_edit: boolean;
}

interface TicketsDoc {
  revision: number;
  vendor_portal?: { start_worker?: boolean };
}

/**
 * SECFIX2-295 (owner decisions 2026-10-21): "Settings > Security > Public interface" - the administrator's settings of the public-surface
 * hardening, one place:
 *  - technicians a vendor typed on the public page: the auto-delete period (default 90 days, 0 = off) and the most undecided per vendor
 *    (default 10, 0 = no cap) - GET / PUT access-grants/settings, system administrators only (a 403 hides the group);
 *  - the vendor portal's separate sign-in queue (`tickets.settings.vendor_portal.start_worker`, OFF) - only while the tickets module is on;
 *  - the uniform answer for a malformed person record (`access.unknown_person_uniform_404`, OFF until the security review).
 * Every value is decided and checked by the server; a refused save restores the shown value and says so. No explanatory paragraphs.
 */
@customElement('system-security-public')
export class SystemSecurityPublic extends LitElement {
  @state() private loading = true;
  @state() private failed = '';
  @state() private policy: PendingPolicy | null = null;
  @state() private retention = '';
  @state() private cap = '';
  @state() private worker: boolean | null = null;
  @state() private uniform: boolean | null = null;
  @state() private canEdit = false;
  @state() private busy = '';
  @state() private error = '';
  @state() private saved = false;
  private ticketsRev = 0;

  static styles = [
    statusStyles,
    css`
      :host { display: block; }
      .grp { display: grid; gap: 12px; padding: 14px; border-block-start: 1px solid var(--sw-border); }
      .grp h4 { margin: 0; font-size: var(--sw-fs-md); color: var(--sw-heading); font-weight: var(--sw-fw-semibold); }
      .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
      .f { display: grid; gap: 4px; }
      .f label { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .f input { inline-size: 100%; box-sizing: border-box; min-block-size: var(--sw-touch-desktop); padding: 0 12px; border-radius: var(--sw-r-sm); border: 1px solid var(--sw-border-strong); background: var(--sw-surface-solid); color: var(--sw-text); font: inherit; font-variant-numeric: tabular-nums; }
      .f input[aria-invalid='true'] { border-color: var(--sw-danger); }
      .f small { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
      .f .bad { color: var(--sw-danger-text, var(--sw-danger)); }
      .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .ok { color: var(--sw-success-text, var(--sw-text-2)); font-size: var(--sw-fs-sm); display: inline-flex; gap: 6px; align-items: center; }
      .sw { display: flex; align-items: center; gap: 14px; inline-size: 100%; min-block-size: var(--sw-touch-desktop); padding: 6px 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: start; cursor: pointer; }
      .sw:disabled { cursor: default; opacity: var(--sw-disabled-opacity); }
      .sw:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 2px; }
      .sw .t { flex: 1; min-inline-size: 0; font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
      .track { flex: none; position: relative; inline-size: 42px; block-size: 24px; border-radius: var(--sw-r-pill); background: var(--sw-border-strong); transition: background var(--sw-t-fast) var(--sw-ease); }
      .track::after { content: ''; position: absolute; inset-block-start: 3px; inset-inline-start: 3px; inline-size: 18px; block-size: 18px; border-radius: 50%; background: var(--sw-toggle-thumb); box-shadow: var(--sw-shadow-1); transition: transform var(--sw-t-fast) var(--sw-ease); }
      .sw[aria-checked='true'] .track { background: var(--sw-toggle-on); }
      .sw[aria-checked='true'] .track::after { transform: translateX(-18px); }
      :host-context([dir='ltr']) .sw[aria-checked='true'] .track::after { transform: translateX(18px); }
      @media (prefers-reduced-motion: reduce) { .track, .track::after { transition: none; } }
    `,
    bubbleChrome,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.failed = '';
    try {
      const s = await get<SettingsReply>('settings');
      this.canEdit = !!s.can_edit && (!isApi() || can('system.configure'));
      this.uniform = String(s.settings[UNIFORM_404_KEY] ?? 'false') === 'true';
      const ticketsOn = String(s.settings['tickets.enabled'] ?? 'false') === 'true';
      const [pol, doc] = await Promise.all([
        getPendingPolicy().catch(() => null), // system administrators only: a refusal hides the group
        ticketsOn ? get<TicketsDoc>('tickets/settings').catch(() => null) : Promise.resolve(null),
      ]);
      this.policy = pol ? { pending_retention_days: pol.pending_retention_days, pending_max_per_vendor: pol.pending_max_per_vendor } : null;
      this.retention = pol ? String(pol.pending_retention_days) : '';
      this.cap = pol ? String(pol.pending_max_per_vendor) : '';
      this.worker = doc ? !!doc.vendor_portal?.start_worker : null;
      this.ticketsRev = doc?.revision ?? 0;
    } catch (err) {
      this.failed = describeError(err);
    } finally {
      this.loading = false;
    }
  }

  private async run(key: string, fn: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = key;
    this.error = '';
    this.saved = false;
    try {
      await fn();
      this.saved = true;
    } catch (err) {
      this.error = `${spt('saveFailed')} · ${describeError(err)}`;
    } finally {
      this.busy = '';
    }
  }

  private savePolicy(): void {
    const days = parseRetention(this.retention);
    const cap = parseCap(this.cap);
    if (days === null || cap === null) return;
    void this.run('policy', async () => {
      const r = await putPendingPolicy({ pending_retention_days: days, pending_max_per_vendor: cap });
      this.policy = { pending_retention_days: r.pending_retention_days, pending_max_per_vendor: r.pending_max_per_vendor };
      this.retention = String(r.pending_retention_days);
      this.cap = String(r.pending_max_per_vendor);
    });
  }

  private flipWorker(): void {
    if (this.worker === null) return;
    const next = !this.worker;
    void this.run('worker', async () => {
      const r = await put<TicketsDoc>('tickets/settings', { revision: this.ticketsRev, vendor_portal: { start_worker: next } });
      this.worker = !!r.vendor_portal?.start_worker;
      this.ticketsRev = r.revision;
    });
  }

  private flipUniform(): void {
    if (this.uniform === null) return;
    const next = !this.uniform;
    void this.run('uniform', async () => {
      const r = await patch<SettingsReply>('settings', { [UNIFORM_404_KEY]: String(next) });
      this.uniform = String(r.settings[UNIFORM_404_KEY] ?? 'false') === 'true';
    });
  }

  private toggle(key: string, label: string, on: boolean, flip: () => void) {
    return html`<button type="button" class="sw" role="switch" aria-checked=${String(on)} data-public-switch=${key} ?disabled=${!this.canEdit || !!this.busy} @click=${flip}>
      <span class="t">${label}</span><span class="track" aria-hidden="true"></span>
    </button>`;
  }

  private body() {
    if (this.loading) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    if (this.failed) return html`<sw-state-panel state="error" heading=${spt('loadFailed')} hint=${this.failed} actionLabel=${spt('retry')} @action=${() => void this.load()}></sw-state-panel>`;
    const days = parseRetention(this.retention);
    const cap = parseCap(this.cap);
    const changed = !!this.policy && (days !== this.policy.pending_retention_days || cap !== this.policy.pending_max_per_vendor);
    return html`<sw-card flush data-public-settings>
      ${this.policy
        ? html`<section class="grp" data-public-group="pending">
            <h4>${spt('secPending')}</h4>
            <div class="fields">
              <div class="f"><label for="ret">${spt('retention')}</label>
                <input id="ret" inputmode="numeric" data-public-retention .value=${this.retention} aria-invalid=${String(days === null)} ?disabled=${!this.canEdit} @input=${(e: Event) => (this.retention = (e.target as HTMLInputElement).value)} />
                <small class=${days === null ? 'bad' : ''}>${days === null ? spt('invalidRetention') : spt('zeroOff')}</small></div>
              <div class="f"><label for="cap">${spt('cap')}</label>
                <input id="cap" inputmode="numeric" data-public-cap .value=${this.cap} aria-invalid=${String(cap === null)} ?disabled=${!this.canEdit} @input=${(e: Event) => (this.cap = (e.target as HTMLInputElement).value)} />
                <small class=${cap === null ? 'bad' : ''}>${cap === null ? spt('invalidCap') : spt('zeroOff')}</small></div>
            </div>
            <div class="row"><sw-button variant="primary" data-public-save ?disabled=${!this.canEdit || !changed || days === null || cap === null || !!this.busy} @click=${() => this.savePolicy()}>${spt('save')}</sw-button></div>
          </section>`
        : nothing}
      ${this.worker !== null
        ? html`<section class="grp" data-public-group="portal"><h4>${spt('secPortal')}</h4>${this.toggle('start_worker', spt('startWorker'), this.worker, () => this.flipWorker())}</section>`
        : nothing}
      ${this.uniform !== null
        ? html`<section class="grp" data-public-group="access"><h4>${spt('secAccess')}</h4>${this.toggle('uniform_404', spt('uniform404'), this.uniform, () => this.flipUniform())}</section>`
        : nothing}
      ${this.error ? html`<div class="note err" role="alert" data-public-error><sw-icon name="warning" size=${16}></sw-icon><span>${this.error}</span></div>` : nothing}
      ${this.saved && !this.error ? html`<div class="grp"><span class="ok" role="status" data-public-saved><sw-icon name="check" size=${16}></sw-icon>${spt('saved')}</span></div>` : nothing}
    </sw-card>`;
  }

  render() {
    return html`<sw-page crumbs="הגדרות | אבטחה" heading=${spt('title')}>${this.body()}</sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-security-public': SystemSecurityPublic;
  }
}
