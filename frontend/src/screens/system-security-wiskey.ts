import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-icon';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { SWITCH_KEYS, SWITCH_STEM, canTurnOn, getSwitches, putSwitch, refusalKind, stateOf, type RefusalKind, type SwitchKey, type SwitchState, type SwitchesView } from '../api/wiskey-switches';
import { can, isApi } from '../api/session';
import { statusStyles } from '../access-control/status-css';
import { wst, type WsKey } from '../i18n/wiskey-switches';
import { bubbleChrome } from '../styles/bubble-chrome';

interface Pending {
  key: SwitchKey;
  next: SwitchState;
}

/**
 * SWITCHUI-295: "Settings > Security > Access-control reads" - the administrator's screen of the four `wiskey.acr5_*` switches
 * (GET / PUT /wiskey/switches, system administrators with system.configure only; the server decides and a 403 shows the closed
 * "only a system administrator" panel). Each switch is listed in plain language with its state; the internal key sits only in a small
 * details line. Turning one on or off asks for a confirmation and sends exactly that one key. While the build carries no go-live permit
 * a switch that is off cannot be turned on: the row says so, and a 409 from a stale screen is worded the same way. No explanatory
 * paragraphs beyond the one-line lead.
 */
@customElement('system-security-wiskey')
export class SystemSecurityWiskey extends LitElement {
  @state() private loading = true;
  @state() private failed = '';
  @state() private forbidden = false;
  @state() private view: SwitchesView | null = null;
  @state() private pending: Pending | null = null;
  @state() private busy = false;
  @state() private dlgError = '';
  @state() private error = '';
  @state() private done: SwitchState | null = null;

  static styles = [
    statusStyles,
    css`
      :host { display: block; }
      .lead { margin: 0; padding: 14px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .sw-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 14px; align-items: center; padding: 14px; border-block-start: 1px solid var(--sw-border); }
      .sw-row .t { margin: 0; font-size: var(--sw-fs-lg); color: var(--sw-heading); font-weight: var(--sw-fw-bold); display: flex; gap: 10px; align-items: center; flex-wrap: wrap; } /* R5-SECURITY: the switch's name 15/700 */
      .sw-row .x { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .sw-row .k { margin: 4px 0 0; color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
      .sw-row .k code { font-family: var(--sw-font-mono, monospace); direction: ltr; unicode-bidi: isolate; }
      .sw-row .why { grid-column: 1 / -1; margin: 0; display: inline-flex; gap: 6px; align-items: center; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .pill { display: inline-flex; align-items: center; min-block-size: 24px; padding: 0 10px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); background: var(--sw-surface-3, var(--sw-border)); color: var(--sw-text-2); } /* R5-SECURITY: the state is a filled 12.5/700 field */
      .pill[data-state='on'] { background: var(--sw-success-bg, var(--sw-toggle-on)); color: var(--sw-success-text, var(--sw-text)); }
      .foot { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; margin-block-start: 14px; }
      .err-line { margin: 10px 0 0; color: var(--sw-danger-text, var(--sw-danger)); font-size: var(--sw-fs-sm); }
      .grp { padding: 14px; border-block-start: 1px solid var(--sw-border); }
      .ok { color: var(--sw-success-text, var(--sw-text-2)); font-size: var(--sw-fs-sm); display: inline-flex; gap: 6px; align-items: center; }
      @media (max-width: 767px) { .sw-row { grid-template-columns: minmax(0, 1fr); } }
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
    this.forbidden = false;
    try {
      this.view = await getSwitches();
    } catch (err) {
      if (refusalKind(err) === 'forbidden') this.forbidden = true;
      else this.failed = describeError(err);
    } finally {
      this.loading = false;
    }
  }

  private get canEdit(): boolean {
    return !isApi() || can('system.configure');
  }

  private ask(key: SwitchKey, next: SwitchState): void {
    if (this.busy || !this.canEdit) return;
    this.error = '';
    this.done = null;
    this.dlgError = '';
    this.pending = { key, next };
  }

  private refusalText(kind: RefusalKind, err: unknown): string {
    if (kind === 'permit') return wst('permitRefused');
    if (kind === 'forbidden') return wst('forbidden');
    if (kind === 'invalid') return wst('invalid');
    return `${wst('failed')} · ${describeError(err)}`;
  }

  private async confirm(): Promise<void> {
    const p = this.pending;
    if (!p || this.busy) return;
    this.busy = true;
    this.dlgError = '';
    try {
      this.view = await putSwitch(p.key, p.next);
      this.done = p.next;
      this.pending = null;
    } catch (err) {
      const kind = refusalKind(err);
      if (kind === 'permit' && this.view) {
        // a stale screen: the server says there is no permit, so show it as the row would have
        this.view = { ...this.view, go_live_permitted: false };
        this.pending = null;
        this.error = this.refusalText(kind, err);
      } else this.dlgError = this.refusalText(kind, err);
    } finally {
      this.busy = false;
    }
  }

  private name(key: SwitchKey): string {
    return wst(`${SWITCH_STEM[key]}Title` as WsKey);
  }

  private row(v: SwitchesView, key: SwitchKey) {
    const on = stateOf(v, key) === 'on';
    const blocked = !on && !canTurnOn(v);
    const stem = SWITCH_STEM[key];
    return html`<div class="sw-row" data-wiskey-switch=${stem} data-state=${on ? 'on' : 'off'}>
      <div>
        <h4 class="t">${this.name(key)}<span class="pill" data-state=${on ? 'on' : 'off'} data-wiskey-state>${wst(on ? 'on' : 'off')}</span></h4>
        <p class="x">${wst(`${stem}Text` as WsKey)}</p>
        <p class="k" data-wiskey-details>${wst('detailsKey')}: <code>${key}</code></p>
      </div>
      <sw-button variant=${on ? 'secondary' : 'primary'} data-wiskey-toggle ?disabled=${!this.canEdit || this.busy || blocked} @click=${() => this.ask(key, on ? 'off' : 'on')}>${wst(on ? 'turnOff' : 'turnOn')}</sw-button>
      ${blocked ? html`<p class="why" data-wiskey-permit><sw-icon name="info" size="14"></sw-icon>${wst('permitMissing')}</p>` : nothing}
    </div>`;
  }

  private dialog() {
    const p = this.pending;
    if (!p) return nothing;
    const on = p.next === 'on';
    const name = this.name(p.key);
    return html`<sw-dialog open heading=${wst(on ? 'confirmOnQ' : 'confirmOffQ', { name })} data-wiskey-dialog=${p.next} @close=${() => { if (!this.busy) this.pending = null; }}>
      <p style="margin:0">${wst(on ? 'confirmOnText' : 'confirmOffText')}</p>
      ${this.dlgError ? html`<p class="err-line" role="alert" data-wiskey-dialog-error>${this.dlgError}</p>` : nothing}
      <div class="foot"><sw-button variant="ghost" data-wiskey-cancel ?disabled=${this.busy} @click=${() => (this.pending = null)}>${wst('cancel')}</sw-button>
        <sw-button variant=${on ? 'primary' : 'danger'} data-wiskey-confirm ?disabled=${this.busy} @click=${() => void this.confirm()}>${wst(on ? 'turnOn' : 'turnOff')}</sw-button></div>
    </sw-dialog>`;
  }

  private body() {
    if (this.loading) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    if (this.forbidden) return html`<sw-state-panel state="forbidden" data-wiskey-forbidden></sw-state-panel>`;
    if (this.failed || !this.view) return html`<sw-state-panel state="error" heading=${wst('loadFailed')} hint=${this.failed} actionLabel=${wst('retry')} @action=${() => void this.load()}></sw-state-panel>`;
    const v = this.view;
    return html`<sw-card flush data-wiskey-switches>
      <p class="lead">${wst('lead')}</p>
      ${SWITCH_KEYS.map((k) => this.row(v, k))}
      ${this.error ? html`<div class="note err" role="alert" data-wiskey-error><sw-icon name="warning" size=${16}></sw-icon><span>${this.error}</span></div>` : nothing}
      ${this.done && !this.error ? html`<div class="grp"><span class="ok" role="status" data-wiskey-saved><sw-icon name="check" size=${16}></sw-icon>${wst(this.done === 'on' ? 'doneOn' : 'doneOff')}</span></div>` : nothing}
    </sw-card>
    ${this.dialog()}`;
  }

  render() {
    return html`<sw-page crumbs="הגדרות | אבטחה" heading=${wst('title')}>${this.body()}</sw-page>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-security-wiskey': SystemSecurityWiskey;
  }
}
