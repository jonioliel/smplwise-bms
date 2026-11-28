import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import './sw-dialog';
import { describeError } from '../api/client';
import { DeviceKeyCancelled, deviceKeyBridge } from '../api/factor-screens';
import { approvePushApproval, denyPushApproval, type PushApprovalPending } from '../api/push-approval';
import { tr as trm } from '../i18n/msg/mfa';

/** What the request is for, in the person's words (never an internal id on screen). */
const ACTION_TEXT: Record<string, () => string> = {
  'alarm.disarm': () => trm('נטרול האזעקה'),
  'alarm.bypass': () => trm('עקיפת חיישן באזעקה'),
  'door.open': () => trm('פתיחת דלת'),
  'identity.local.manage': () => trm('שינוי משתמשים'),
  'users.ha_manage': () => trm('שינוי משתמשים'),
  'rbac.assign': () => trm('שינוי הרשאות'),
  'rbac.roles.manage': () => trm('שינוי הרשאות'),
};
function pushActionText(action: string): string {
  return ACTION_TEXT[action]?.() ?? trm('שינוי הגדרות');
}

/**
 * MFA-T095-REST-2530 (CR-011 option D): the phone's side of "approve on the phone". Shown by shell/push-approval-watch.ts inside the
 * Android app that holds the phone key, when another screen of the same account asked for an approval. The person sees what is asked
 * and TYPES the two-digit number the requesting screen shows (the phone is never told it); the app's own prompt (fingerprint / face /
 * screen lock) signs that number with the phone key. A wrong number DENIES the request on the server (an approval given without looking
 * hits the number once in 90); "not me" denies it too. The system's own sw-dialog (skin, RTL, focus trap, phone layout).
 */
@customElement('sw-push-approval-sheet')
export class SwPushApprovalSheet extends LitElement {
  @property({ attribute: false }) request: PushApprovalPending | null = null;
  @property({ attribute: false }) keyId = '';
  @property({ type: Boolean }) open = false;
  @state() private busy = false;
  @state() private error = '';
  @state() private done = '';
  @state() private typed = '';

  /** Called once when the sheet closes (the watcher looks again later). */
  onClosed: (() => void) | null = null;

  static styles = css`
    .msg {
      margin: 0 0 var(--sw-s-1);
      color: var(--sw-text);
      line-height: 1.5;
      overflow-wrap: anywhere;
    }
    .what {
      font-weight: 700;
    }
    .hint {
      margin: 0 0 var(--sw-s-3);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    form {
      display: flex;
      justify-content: center;
    }
    input {
      inline-size: 4.5em;
      min-block-size: var(--sw-ctl-h-lg);
      padding: 0 var(--sw-s-2);
      border: var(--sw-check-border-w) solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-2xl);
      font-weight: 700;
      letter-spacing: 0.2em;
      text-align: center;
      font-variant-numeric: tabular-nums;
      direction: ltr;
    }
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .err {
      margin: var(--sw-s-2) 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
      text-align: center;
    }
    .ok {
      margin: var(--sw-s-2) 0 0;
      color: var(--sw-text);
      text-align: center;
    }
  `;

  close() {
    if (!this.open) return;
    this.open = false;
    const cb = this.onClosed;
    this.onClosed = null;
    cb?.();
    void this.updateComplete.then(() => requestAnimationFrame(() => this.remove()));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    const cb = this.onClosed;
    this.onClosed = null;
    cb?.();
  }

  private get number(): number | null {
    return /^\d{2}$/.test(this.typed.trim()) ? Number(this.typed.trim()) : null;
  }

  private async approve(e?: Event) {
    e?.preventDefault();
    const r = this.request;
    const n = this.number;
    const signer = deviceKeyBridge();
    if (this.busy || !r || n === null || !signer || !this.keyId) return;
    this.busy = true;
    this.error = '';
    try {
      const st = await approvePushApproval(r.request_id, this.keyId, n, signer);
      if (st.status === 'approved') this.done = trm('אושר. אפשר לחזור למסך שביקש.');
      else this.error = trm('הבקשה כבר לא ממתינה.');
    } catch (err) {
      this.error = err instanceof DeviceKeyCancelled ? trm('האישור בטלפון בוטל או נכשל.') : describeError(err);
      const e = err as { body?: { code?: string } } | null;
      if (e?.body?.code === 'push_approval_number_mismatch' || e?.body?.code === 'push_approval_unknown') this.request = null;
    } finally {
      this.busy = false;
    }
  }

  private async deny() {
    const r = this.request;
    if (this.busy || !r) return;
    this.busy = true;
    this.error = '';
    try {
      await denyPushApproval(r.request_id);
      this.done = trm('הבקשה נדחתה.');
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    const r = this.request;
    const live = !!r && !this.done;
    return html`<sw-dialog ?open=${this.open} heading=${trm('בקשת אישור')} data-push-approval-sheet @close=${(e: Event) => { e.stopPropagation(); this.close(); }}>
      ${r && live
        ? html`<p class="msg" data-push-approval-what>${trm('מכשיר אחר שמחובר לחשבון שלך מבקש לאשר:')} <span class="what">${pushActionText(r.action)}</span></p>
            <p class="hint">${trm('הקלד את המספר שמופיע במסך שביקש. אם לא אתה ביקשת - דחה.')}</p>
            <form @submit=${(e: Event) => void this.approve(e)}>
              <input name="number" inputmode="numeric" autocomplete="off" maxlength="2" spellcheck="false" placeholder="00" aria-label=${trm('המספר שעל המסך')}
                data-push-approval-number .value=${this.typed} ?disabled=${this.busy} @input=${(e: Event) => (this.typed = (e.target as HTMLInputElement).value)} />
            </form>`
        : nothing}
      ${this.done ? html`<p class="ok" role="status" data-push-approval-done>${this.done}</p>` : nothing}
      ${this.error ? html`<div class="err" role="alert" data-push-approval-error>${this.error}</div>` : nothing}
      ${live
        ? html`<sw-button slot="footer" variant="danger" data-push-approval-deny ?disabled=${this.busy} @click=${() => void this.deny()}>${trm('לא אני - לדחות')}</sw-button>`
        : nothing}
      <sw-button slot="footer" data-push-approval-close ?disabled=${this.busy} @click=${() => this.close()}>${trm('סגור')}</sw-button>
      ${live
        ? html`<sw-button slot="footer" variant="primary" icon="check" data-push-approval-confirm ?disabled=${this.busy || this.number === null} @click=${() => void this.approve()}>${trm('אישור')}</sw-button>`
        : nothing}
    </sw-dialog>`;
  }
}

/** Show the sheet for one pending request; resolves when it closes. */
export function showPushApproval(request: PushApprovalPending, keyId: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const el = document.createElement('sw-push-approval-sheet');
    el.request = request;
    el.keyId = keyId;
    el.onClosed = resolve;
    document.body.append(el);
    el.open = true;
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-push-approval-sheet': SwPushApprovalSheet;
  }
}
