import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-dialog';
import { describeError, type StepUpDetails } from '../api/client';
import { verifyStepUp } from '../api/second-factor';
import { t, tf } from '../i18n/he';
import { STEP_UP_VERIFIED } from '../shell/step-up';

/**
 * MFA-STEPUP-TRAIN-2490 slice 2: the code dialog the shell opens when the server's step-up gate refuses a change of settings, users or
 * permissions (403 `step_up_required`, api/client.ts). The user types the current authenticator code; `POST auth/step-up/verify` records a
 * proof on this session (server-side) and the dialog answers true - the client then sends the original request ONCE more. A wrong code
 * keeps the dialog open with the server's message (wrong / locked); cancel, Escape, ✕ or the backdrop answer false (no retry). The
 * system's own sw-dialog, so the skin, RTL, the focus trap and the phone layout are the shell's. Opened by shell/step-up.ts only.
 */
@customElement('sw-step-up-dialog')
export class SwStepUpDialog extends LitElement {
  @property({ attribute: false }) details: StepUpDetails = {};
  @property({ type: Boolean }) open = false;
  @state() private code = '';
  @state() private busy = false;
  @state() private error = '';

  /** Set by stepUpDialog(): called once with the answer. */
  resolver: ((ok: boolean) => void) | null = null;

  static styles = css`
    .msg {
      margin: 0 0 6px;
      color: var(--sw-text);
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .hint {
      margin: 0 0 12px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    form {
      display: flex;
      justify-content: center;
    }
    input {
      inline-size: 9.5em;
      min-block-size: 44px;
      padding: 4px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-lg);
      letter-spacing: 0.25em;
      text-align: center;
      direction: ltr;
    }
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .err {
      margin: 8px 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
      text-align: center;
    }
  `;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.answer(false); // removed without an answer: nothing was confirmed
  }

  private get methods(): string[] {
    return Array.isArray(this.details.methods) ? this.details.methods : [];
  }

  private get valid(): boolean {
    return /^\d{6}$/.test(this.code.replace(/\s+/g, ''));
  }

  answer(ok: boolean) {
    const r = this.resolver;
    if (!r) return;
    this.resolver = null;
    this.open = false;
    r(ok);
    void this.updateComplete.then(() => requestAnimationFrame(() => this.remove()));
  }

  private async submit(e?: Event) {
    e?.preventDefault();
    if (this.busy || !this.valid) return;
    this.busy = true;
    this.error = '';
    try {
      await verifyStepUp(this.code.replace(/\s+/g, ''), this.details.action);
      window.dispatchEvent(new CustomEvent(STEP_UP_VERIFIED));
      this.answer(true);
    } catch (err) {
      this.error = describeError(err);
      this.code = '';
    } finally {
      this.busy = false;
    }
  }

  render() {
    const minutes = typeof this.details.minutes === 'number' ? this.details.minutes : 5;
    const can = this.methods.includes('totp');
    return html`<sw-dialog ?open=${this.open} heading=${t('stepUp.heading')} data-step-up-dialog @close=${(e: Event) => { e.stopPropagation(); this.answer(false); }}>
      ${can
        ? html`<p class="msg" data-step-up-text>${t('stepUp.body')}</p>
            <p class="hint" data-step-up-window>${minutes > 0 ? tf('stepUp.window', { minutes }) : t('stepUp.once')}</p>
            <form @submit=${(e: Event) => void this.submit(e)}>
              <input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000" aria-label=${t('stepUp.codeLabel')} data-step-up-code
                .value=${this.code} ?disabled=${this.busy} @input=${(e: Event) => (this.code = (e.target as HTMLInputElement).value)} />
            </form>`
        : html`<p class="msg" data-step-up-no-method>${t('stepUp.noMethod')}</p>`}
      ${this.error ? html`<div class="err" role="alert" data-step-up-error>${this.error}</div>` : nothing}
      <sw-button slot="footer" data-step-up-cancel ?disabled=${this.busy} @click=${() => this.answer(false)}>${t('stepUp.cancel')}</sw-button>
      ${can
        ? html`<sw-button slot="footer" variant="primary" data-step-up-confirm ?disabled=${this.busy || !this.valid} @click=${() => void this.submit()}>${t('stepUp.confirm')}</sw-button>`
        : nothing}
    </sw-dialog>`;
  }
}

/** Open the step-up dialog; resolves true once a proof was recorded, false on cancel. */
export function stepUpDialog(details: StepUpDetails): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const el = document.createElement('sw-step-up-dialog');
    el.details = details;
    el.resolver = resolve;
    document.body.append(el);
    el.open = true;
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-step-up-dialog': SwStepUpDialog;
  }
}
