import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-dialog';
import './sw-button';
import './sw-icon';
import REQUEST_RAW from '../content/architect-request.he.txt?raw';
import { REQUEST_FILE_NAME, REQUEST_TITLE, copyText, mailtoHref, normalizeRequest, requestBlob, requestSubject } from './architect-request';

/** The request text, as the dialog shows, copies, shares and downloads it. */
export const ARCHITECT_REQUEST_TEXT = normalizeRequest(REQUEST_RAW);

/** "בקשה לאדריכל": the Hebrew request for the plans the system needs, opened on demand (setup wizard, plan editor, floors list, plan import)
 * so a person with no plan yet can read it, copy it and send it to the architect. One instance serves the whole app: `openArchitectRequest()`. */
@customElement('architect-request-dialog')
export class ArchitectRequestDialog extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  /** Overridable for tests; the app always shows the shipped text. */
  @property() text = ARCHITECT_REQUEST_TEXT;
  @state() private notice = '';
  private noticeTimer = 0;

  static styles = css`
    .txt {
      margin: 0;
      padding: 12px 14px;
      max-block-size: min(56dvh, 520px);
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font: inherit;
      font-size: var(--sw-fs-md);
      line-height: 1.7;
      color: var(--sw-text);
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md, 10px);
      user-select: text;
      -webkit-user-select: text;
    }
    .txt:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
    }
    .notice {
      flex: 1 1 100%;
      min-block-size: 1.2em;
      font-size: var(--sw-fs-sm);
      color: var(--sw-success, #15803d);
      font-weight: var(--sw-fw-semibold);
    }
    .notice:empty {
      display: none;
    }
    a.btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-block-size: 36px;
      padding-inline: 16px;
      border-radius: 8px;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      color: var(--sw-text);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      line-height: 1;
      text-decoration: none;
      white-space: nowrap;
    }
    a.btn:hover {
      background: var(--sw-surface-2);
    }
    a.btn:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    /* a finger needs 44px (the same rule as sw-button's lg size) */
    @media (max-width: 767px) and (pointer: coarse) {
      a.btn {
        min-block-size: 44px;
      }
    }
    @media (max-width: 520px) {
      .actions > * {
        flex: 1 1 calc(50% - 8px);
      }
      .actions > .notice {
        flex-basis: 100%;
      }
    }
  `;

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.noticeTimer);
  }

  private say(text: string) {
    this.notice = text;
    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => (this.notice = ''), 3200);
  }

  private async copy(): Promise<boolean> {
    const ok = await copyText(this.text);
    this.say(ok ? 'הועתק' : 'ההעתקה לא הצליחה: סמנו את הטקסט והעתיקו ידנית');
    return ok;
  }

  private async share() {
    try {
      await navigator.share({ title: requestSubject(this.text), text: this.text });
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') void this.copy();
    }
  }

  private download() {
    const url = URL.createObjectURL(requestBlob(this.text));
    const a = document.createElement('a');
    a.href = url;
    a.download = REQUEST_FILE_NAME;
    a.hidden = true;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  /** A body too long for a mail link carries a one-line pointer; the text itself is put on the clipboard to paste below it. */
  private async mail() {
    if (mailtoHref(this.text).full) return;
    const ok = await copyText(this.text);
    this.say(ok ? 'הועתק: הדביקו את הבקשה בגוף המייל' : 'סמנו והעתיקו את הטקסט, ואז הדביקו בגוף המייל');
  }

  private close() {
    this.open = false;
    this.notice = '';
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  render() {
    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    return html`<sw-dialog wide ?open=${this.open} heading=${REQUEST_TITLE} @close=${(e: Event) => { e.stopPropagation(); this.close(); }}>
      <pre class="txt" dir="rtl" lang="he" tabindex="0" data-architect-text aria-label=${REQUEST_TITLE}>${this.text}</pre>
      <div slot="footer" class="actions">
        <sw-button size="lg" variant="primary" icon="copy" data-architect-copy @click=${() => void this.copy()}>העתק</sw-button>
        ${canShare ? html`<sw-button size="lg" icon="share" data-architect-share @click=${() => void this.share()}>שתף</sw-button>` : nothing}
        <sw-button size="lg" icon="download" data-architect-download @click=${() => this.download()}>הורד כקובץ</sw-button>
        <a class="btn" href=${mailtoHref(this.text).href} data-architect-mail @click=${() => void this.mail()}><sw-icon name="mail" size=${18}></sw-icon>שלח במייל</a>
        <div class="notice" role="status" aria-live="polite" data-architect-notice>${this.notice}</div>
      </div>
    </sw-dialog>`;
  }
}

/** Opens the one shared dialog (created on first use, appended to the page body). */
export function openArchitectRequest(): void {
  let el = document.querySelector<ArchitectRequestDialog>('architect-request-dialog');
  if (!el) {
    el = document.createElement('architect-request-dialog');
    document.body.append(el);
  }
  el.open = true;
}

declare global {
  interface HTMLElementTagNameMap {
    'architect-request-dialog': ArchitectRequestDialog;
  }
}
