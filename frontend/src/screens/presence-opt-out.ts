import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-toggle';
import { describeError } from '../api/client';
import { getMyPeopleVisibility, setMyPeopleVisibility } from '../api/presence';
import { canAnywhere, isApi, onSession } from '../api/session';
import { pt } from '../i18n/presence';

/**
 * WHOIN034-295: the person's own choice not to appear on "מי במבנה" (PUT presence/people/me). Shown on the personal settings page only
 * while the installation's data sharing is on and the user may report a phone (presence.report); otherwise nothing at all. An opted-out
 * person is counted in the screen's total and never named or placed on a floor. Nobody else can set it for them.
 */
@customElement('presence-opt-out')
export class PresenceOptOut extends LitElement {
  @state() private shown = false;
  @state() private optedOut = false;
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';

  static styles = css`
    :host { display: block; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; }
    .lbl { display: flex; flex-direction: column; gap: 2px; font-weight: var(--sw-fw-medium); }
    .muted { color: var(--sw-text-muted, var(--sw-text-2)); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-regular); }
    .ok { color: var(--sw-live); font-size: var(--sw-fs-sm); }
    .err { color: var(--sw-danger); font-size: var(--sw-fs-sm); }
  `;

  private stop?: () => void;
  private asked = false;

  connectedCallback() {
    super.connectedCallback();
    this.stop = onSession(() => this.check());
  }

  disconnectedCallback() {
    this.stop?.();
    super.disconnectedCallback();
  }

  private check() {
    if (this.asked || !isApi() || !canAnywhere('presence.report')) return;
    this.asked = true;
    void getMyPeopleVisibility()
      .then((r) => {
        this.optedOut = r.opted_out;
        this.shown = r.enabled || r.opted_out;
      })
      .catch(() => {
        this.shown = false;
      });
  }

  private async set(on: boolean) {
    this.busy = true;
    this.error = '';
    try {
      this.optedOut = (await setMyPeopleVisibility(on)).opted_out;
      this.message = pt('optOutSaved');
      window.setTimeout(() => (this.message = ''), 2500);
    } catch (e) {
      this.error = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  render() {
    if (!this.shown) return nothing;
    return html`<sw-card heading=${pt('title')} data-presence-optout-card>
      <div class="row"><span class="lbl">${pt('optOut')}<span class="muted">${pt('optOutHint')}</span></span>
        <sw-toggle ?checked=${this.optedOut} ?disabled=${this.busy} label=${pt('optOut')} labelHidden data-presence-optout
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.set(e.detail.checked)}></sw-toggle></div>
      ${this.message ? html`<span class="ok" role="status">${this.message}</span>` : nothing}
      ${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'presence-opt-out': PresenceOptOut;
  }
}
