import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-toggle';
import type { SwToggle } from './sw-toggle';
import './sw-button';
import { ApiError, describeError } from '../api/client';
import { ownPasskeys, registerPasskey, registrationOptions, removePasskey, renamePasskey, setPasskeyFirst, setPasskeyOnly, type PasskeySummary } from '../api/passkeys';
import { passkeyStepUp, stepUpNeed, verifyCodeStepUp } from '../api/step-up-passkey';
import { PasskeyCancelled, createPasskey, passkeysSupported } from '../arx/webauthn';
import { lit } from '../i18n/local-identity';
import { po } from '../i18n/passkey-only';
import { dayText } from '../api/day-format';
import { confirmDialog } from './confirm-dialog';

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return dayText(d);
}

/**
 * החשבון שלי › אימות דו־שלבי › מפתחות גישה (USR2 phase 4): the passkeys of an Arx-only identity - add (a fresh sign-in is needed:
 * the server answers `reauth_required` otherwise), remove, and the user's own "passkey only" mode while the owner allows it. Renders
 * nothing for anyone the server refuses (an infrastructure user, the feature off).
 *
 * MFA-PASSKEYS-2490: every user who signs in to Arx while `security.passkeys_all_users` is on (`user_kind` = `user`: no sign-in modes),
 * and renaming. A factor change the server answers with 403 `step_up_required` (adding a passkey to an account that has a factor,
 * removing one) opens a small confirmation in place - a passkey (api/step-up-passkey.ts) and / or the authenticator code, as the
 * server lists them - and the change is sent again ONCE after the proof; a second refusal is shown, never retried.
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
  /** MFA-PASSKEYS-2490: the passkey being renamed and the typed name. */
  @state() private renaming = '';
  @state() private renameValue = '';
  /** MFA-PASSKEYS-2490: a factor change waiting for a step-up proof - the action, the methods the server offers, the change to send again. */
  @state() private need: { action: string; methods: string[]; retry: () => Promise<void> } | null = null;
  @state() private code = '';

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
    .actions {
      display: inline-flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .confirm {
      margin-block-start: 8px;
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2, var(--sw-surface));
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .confirm form {
      margin: 0;
    }
    input.code {
      flex: 0 1 9em;
      letter-spacing: 0.2em;
      text-align: center;
      direction: ltr;
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

  /** `retry`: a 403 `step_up_required` opens the confirmation and keeps `fn` to send again once; false = the retry itself (a second
   * refusal is only shown). */
  private async run(fn: () => Promise<void>, retry = true) {
    this.busy = true;
    this.error = '';
    this.message = '';
    try {
      await fn();
    } catch (err) {
      const need = retry ? stepUpNeed(err) : null;
      if (need) {
        this.need = { action: need.action ?? '', methods: Array.isArray(need.methods) ? need.methods : [], retry: fn };
        this.code = '';
      } else this.error = this.explain(err);
    } finally {
      this.busy = false;
    }
  }

  /** MFA-PASSKEYS-2490: the proof, then the waiting change once. */
  private confirmWith(prove: (action: string) => Promise<unknown>) {
    const need = this.need;
    if (!need) return;
    void this.run(async () => {
      await prove(need.action);
      this.need = null;
      this.code = '';
      await need.retry();
    }, false);
  }

  private confirmCode(e: Event) {
    e.preventDefault();
    const code = this.code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(code)) return;
    this.confirmWith((action) => verifyCodeStepUp(code, action || undefined));
  }

  private rename(id: string) {
    const label = this.renameValue.trim();
    void this.run(async () => {
      await renamePasskey(id, label);
      this.renaming = '';
      this.message = lit('passkeyRenamed');
      this.data = await ownPasskeys();
    });
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
      await removePasskey(id);
      this.armed = '';
      this.message = lit('passkeyRemoved');
      this.data = await ownPasskeys();
    });
  }

  /** MFA-PASSKEYS-2490: the in-place confirmation of a factor change (a passkey and / or the authenticator code). */
  private renderNeed(canPasskey: boolean) {
    const need = this.need;
    if (!need) return nothing;
    const byPasskey = canPasskey && need.methods.includes('passkey');
    const byCode = need.methods.includes('totp');
    return html`<div class="confirm" role="group" aria-label=${lit('passkeyConfirmTitle')} data-pk-step-up>
      <span>${lit('passkeyConfirmTitle')}</span>
      ${byPasskey
        ? html`<span><sw-button size="sm" variant="primary" ?disabled=${this.busy} data-pk-step-up-passkey @click=${() => this.confirmWith((a) => passkeyStepUp(a || undefined))}>${this.busy ? lit('passkeyWaiting') : lit('passkeyConfirmWithPasskey')}</sw-button></span>`
        : nothing}
      ${byCode
        ? html`<form @submit=${(e: Event) => this.confirmCode(e)}>
            <input class="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000" aria-label=${lit('passkeyConfirmCode')}
              .value=${this.code} ?disabled=${this.busy} data-pk-step-up-code @input=${(e: Event) => (this.code = (e.target as HTMLInputElement).value)} />
            <sw-button size="sm" variant=${byPasskey ? 'secondary' : 'primary'} ?disabled=${this.busy || !/^\d{6}$/.test(this.code.replace(/\s+/g, ''))} data-pk-step-up-code-go
              @click=${(e: Event) => this.confirmCode(e)}>${lit('passkeyConfirmCodeGo')}</sw-button>
          </form>`
        : nothing}
      ${!byPasskey && !byCode ? html`<span class="lbl" data-pk-step-up-none>${lit('passkeyConfirmNone')}</span>` : nothing}
      <span><sw-button size="sm" variant="ghost" ?disabled=${this.busy} data-pk-step-up-cancel @click=${() => { this.need = null; this.code = ''; this.armed = ''; }}>${lit('cancel')}</sw-button></span>
    </div>`;
  }

  private first(e: Event) {
    const box = e.target as SwToggle;
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

  private async only(e: Event) {
    const box = e.target as SwToggle;
    const on = box.checked;
    if (on && !(await confirmDialog({ body: po('onlyConfirmOn'), danger: true }))) {
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
    const anyUser = d.user_kind === 'user'; // MFA-PASSKEYS-2490: not an Arx-only identity - no sign-in modes, no sessions end on removal
    const usable = d.credentials.filter((c) => c.usable);
    const armed = d.credentials.find((c) => c.id === this.armed);
    const lastFactor = !!armed && armed.usable && usable.length === 1 && !d.totp;
    return html`
      <h3 data-pk-title>${lit('passkeys')}</h3>
      <div class="lbl" data-pk-note>${anyUser ? lit('passkeyFactorNoteUser') : lit('passkeyFactorNote')}</div>
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
              ${this.renaming === c.id
                ? html`<form class="actions" @submit=${(e: Event) => { e.preventDefault(); this.rename(c.id); }} data-pk-rename-form>
                    <input type="text" maxlength="40" aria-label=${lit('passkeyLabel')} .value=${this.renameValue} ?disabled=${this.busy} data-pk-rename-input
                      @input=${(e: Event) => (this.renameValue = (e.target as HTMLInputElement).value)} />
                    <sw-button size="sm" variant="primary" ?disabled=${this.busy} data-pk-rename-save @click=${() => this.rename(c.id)}>${lit('passkeyRenameSave')}</sw-button>
                    <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${() => (this.renaming = '')}>${lit('cancel')}</sw-button></form>`
                : this.armed === c.id
                ? html`<span class="actions"><sw-button size="sm" variant="danger" ?disabled=${this.busy} data-pk-remove-confirm @click=${() => this.removeOne(c.id)}>${lit('passkeyRemove')}</sw-button>
                    <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${() => (this.armed = '')}>${lit('cancel')}</sw-button></span>`
                : html`<span class="actions"><sw-button size="sm" variant="ghost" ?disabled=${this.busy} data-pk-rename
                      @click=${() => { this.renaming = c.id; this.renameValue = c.label ?? ''; this.armed = ''; }}>${lit('passkeyRename')}</sw-button>
                    <sw-button size="sm" variant="secondary" ?disabled=${this.busy} data-pk-remove @click=${() => { this.armed = c.id; this.renaming = ''; }}>${lit('passkeyRemove')}</sw-button></span>`}
            </li>`)}
          </ul>
          ${armed
            ? html`<div class="lbl" data-pk-remove-text>${anyUser ? lit('passkeyRemoveConfirmUser', { name: armed.label ?? '' }) : lit('passkeyRemoveConfirm', { name: armed.label ?? '' })}${lastFactor ? html`<br /><span data-pk-last-factor>${lit('passkeyLastFactor')}</span>` : nothing}</div>`
            : nothing}`
        : html`<div class="lbl" data-pk-empty>${lit('passkeyNone')}</div>`}
      ${d.available && !wrongHost && passkeysSupported()
        ? html`<form @submit=${(e: Event) => this.add(e)} data-pk-add-form>
            <input type="text" maxlength="40" aria-label=${lit('passkeyLabel')} placeholder=${lit('passkeyLabel')} .value=${this.label}
              @input=${(e: Event) => (this.label = (e.target as HTMLInputElement).value)} ?disabled=${this.busy} />
            <sw-button size="sm" variant="primary" ?disabled=${this.busy} data-pk-add @click=${(e: Event) => this.add(e)}>${this.busy ? lit('passkeyWaiting') : lit('passkeyAdd')}</sw-button>
          </form>`
        : nothing}
      ${d.first_allowed && d.credentials.some((c) => c.usable)
        ? html`<label class="first"><sw-toggle size="sm" labelHidden in-label label=${lit('passkeyFirst')} data-pk-first .checked=${d.first_on} ?disabled=${this.busy} @change=${(e: Event) => this.first(e)}></sw-toggle>
            <span>${lit('passkeyFirst')}<br /><small>${lit('passkeyFirstHelp')}</small></span></label>`
        : nothing}
      ${d.first_allowed && d.credentials.some((c) => c.usable)
        ? html`<label class="first"><sw-toggle size="sm" labelHidden in-label label=${po('onlyLabel')} data-pk-only .checked=${!!d.only_on} ?disabled=${this.busy} @change=${(e: Event) => this.only(e)}></sw-toggle>
            <span>${po('onlyLabel')}</span></label>`
        : nothing}
      ${this.renderNeed(d.available && !wrongHost && passkeysSupported())}
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
