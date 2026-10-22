import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-button';
import { ApiError, describeError } from '../api/client';
import { ownPasskeys, registerPasskey, registrationOptions, removePasskey, setPasskeyFirst, setPasskeyOnly, type PasskeySummary } from '../api/passkeys';
import { PasskeyCancelled, createPasskey, passkeysSupported } from '../arx/webauthn';
import { lit } from '../i18n/local-identity';
import { po } from '../i18n/passkey-only';
import { dayText } from '../api/day-format';

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return dayText(d);
}

/**
 * החשבון שלי › אימות דו־שלבי › מפתחות גישה (USR2 phase 4): the passkeys of an Arx-only identity - add (a fresh sign-in is needed:
 * the server answers `reauth_required` otherwise), remove, and the user's own "passkey only" mode while the owner allows it. Renders
 * nothing for anyone the server refuses (an infrastructure user, the feature off).
 */
@customElement('sw-passkeys')
export class SwPasskeys extends LitElement {
  @state() private data: PasskeySummary | null = null;
  @state() private refused = false;
  @state() private busy = false;
  @state() private label = '';
  @state() private armed = '';
  @state() private error = '';
  @state() private message = '';

  static styles = css`
    :host {
      display: block;
      margin-block-start: 12px;
      padding-block-start: 12px;
      border-block-start: 1px solid var(--sw-border);
    }
    h3 {
      margin: 0 0 6px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-block-size: 40px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    small,
    .lbl {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    form {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-block-start: 8px;
    }
    input[type='text'] {
      flex: 1 1 10em;
      min-inline-size: 0;
      min-block-size: 36px;
      padding: 4px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    label.first {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      margin-block-start: 10px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .err {
      margin: 4px 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .ok {
      margin: 4px 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.data = await ownPasskeys();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 403 || err.status === 404 || err.status === 409)) this.refused = true;
      else this.error = describeError(err);
    }
  }

  private explain(err: unknown): string {
    if (err instanceof PasskeyCancelled) return lit('passkeyCancelled');
    if (err instanceof ApiError && err.body.code === 'reauth_required') return lit('passkeyReauth');
    return describeError(err);
  }

  private async run(fn: () => Promise<void>) {
    this.busy = true;
    this.error = '';
    this.message = '';
    try {
      await fn();
    } catch (err) {
      this.error = this.explain(err);
    } finally {
      this.busy = false;
    }
  }

  private add(e: Event) {
    e.preventDefault();
    void this.run(async () => {
      const opts = await registrationOptions();
      const credential = await createPasskey(opts.publicKey);
      await registerPasskey(credential, this.label.trim() || undefined);
      this.label = '';
      this.message = lit('passkeyAdded');
      this.data = await ownPasskeys();
    });
  }

  private removeOne(id: string) {
    void this.run(async () => {
      this.data = await removePasskey(id);
      this.armed = '';
      this.message = lit('passkeyRemoved');
    });
  }

  private first(e: Event) {
    const box = e.target as HTMLInputElement;
    const on = box.checked;
    void this.run(async () => {
      try {
        this.data = await setPasskeyFirst(on);
      } catch (err) {
        box.checked = !on;
        throw err;
      }
    });
  }

  private only(e: Event) {
    const box = e.target as HTMLInputElement;
    const on = box.checked;
    if (on && !window.confirm(po('onlyConfirmOn'))) {
      box.checked = false;
      return;
    }
    void this.run(async () => {
      try {
        this.data = await setPasskeyOnly(on);
      } catch (err) {
        box.checked = !on;
        throw err;
      }
    });
  }

  render() {
    if (this.refused) return nothing;
    const d = this.data;
    if (!d) return this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing;
    const here = typeof window !== 'undefined' ? window.location.origin : '';
    const wrongHost = !!d.origin && here !== d.origin;
    return html`
      <h3 data-pk-title>${lit('passkeys')}</h3>
      <div class="lbl">${lit('passkeyFactorNote')}</div>
      ${!d.available
        ? html`<div class="lbl" data-pk-unavailable>${lit('passkeyUnavailable')}</div>`
        : wrongHost
        ? html`<div class="lbl" data-pk-wrong-host>${lit('passkeyWrongHost', { origin: d.origin ?? '' })}</div>`
        : !passkeysSupported()
        ? html`<div class="lbl" data-pk-unsupported>${lit('passkeyUnsupported')}</div>`
        : nothing}
      ${d.credentials.length
        ? html`<ul data-pk-list>
            ${d.credentials.map((c) => html`<li data-pk-item=${c.id}>
              <span>${c.label || lit('passkeys')}
                <small>${when(c.created_at)}${c.synced ? html` · ${lit('passkeySynced')}` : nothing}${c.last_used_at ? html` · ${lit('passkeyLastUsed')} ${when(c.last_used_at)}` : nothing}${c.usable ? nothing : html` · ${lit('passkeyNotUsable')}`}</small></span>
              ${this.armed === c.id
                ? html`<span><sw-button size="sm" variant="danger" ?disabled=${this.busy} data-pk-remove-confirm @click=${() => this.removeOne(c.id)}>${lit('passkeyRemove')}</sw-button>
                    <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${() => (this.armed = '')}>${lit('cancel')}</sw-button></span>`
                : html`<sw-button size="sm" variant="secondary" ?disabled=${this.busy} data-pk-remove @click=${() => (this.armed = c.id)}>${lit('passkeyRemove')}</sw-button>`}
            </li>`)}
          </ul>
          ${this.armed ? html`<div class="lbl">${lit('passkeyRemoveConfirm', { name: d.credentials.find((c) => c.id === this.armed)?.label ?? '' })}</div>` : nothing}`
        : html`<div class="lbl" data-pk-empty>${lit('passkeyNone')}</div>`}
      ${d.available && !wrongHost && passkeysSupported()
        ? html`<form @submit=${(e: Event) => this.add(e)} data-pk-add-form>
            <input type="text" maxlength="40" aria-label=${lit('passkeyLabel')} placeholder=${lit('passkeyLabel')} .value=${this.label}
              @input=${(e: Event) => (this.label = (e.target as HTMLInputElement).value)} ?disabled=${this.busy} />
            <sw-button size="sm" variant="primary" ?disabled=${this.busy} data-pk-add @click=${(e: Event) => this.add(e)}>${this.busy ? lit('passkeyWaiting') : lit('passkeyAdd')}</sw-button>
          </form>`
        : nothing}
      ${d.first_allowed && d.credentials.some((c) => c.usable)
        ? html`<label class="first"><input type="checkbox" data-pk-first .checked=${d.first_on} ?disabled=${this.busy} @change=${(e: Event) => this.first(e)} />
            <span>${lit('passkeyFirst')}<br /><small>${lit('passkeyFirstHelp')}</small></span></label>`
        : nothing}
      ${d.first_allowed && d.credentials.some((c) => c.usable)
        ? html`<label class="first"><input type="checkbox" data-pk-only .checked=${!!d.only_on} ?disabled=${this.busy} @change=${(e: Event) => this.only(e)} />
            <span>${po('onlyLabel')}</span></label>`
        : nothing}
      ${this.error ? html`<div class="err" role="alert" data-pk-error>${this.error}</div>` : nothing}
      ${this.message ? html`<div class="ok" role="status" data-pk-message>${this.message}</div>` : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-passkeys': SwPasskeys;
  }
}
