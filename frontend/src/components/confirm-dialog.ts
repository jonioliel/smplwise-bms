import { LitElement, html, css, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-button';
import './sw-dialog';
import { cdt } from '../i18n/confirm-dialog';

/**
 * CR-CONFIRM-DIALOG-2438 (owner Q-SYS-6 / O7 a; code review 06:CMP-1, 07:F18): the browser's native confirm() box ignored the skin,
 * RTL and the focus rules, and an embedded web view may suppress it. Every confirmation now goes through this helper, which opens the
 * system's own sw-dialog (unchanged - the visual unification of dialogs is a separate task) and answers with a promise:
 *
 *   if (!(await confirmDialog({ body: 'למחוק?', danger: true }))) return;
 *
 * Keyboard, as the native box: the confirm button has the focus, Enter confirms (Enter on the focused cancel button cancels), Escape
 * cancels. While the dialog is open no other key reaches the page (a native box is modal for the keyboard too), except Tab, which the
 * dialog's own focus trap keeps inside the box. The ✕ and a click on the backdrop cancel. Focus returns to the control that opened it.
 *
 * The guard tests/unit-no-native-dialogs.spec.ts fails on any new window.confirm / alert / prompt in frontend/src.
 */
export interface ConfirmDialogOptions {
  /** The question. A string keeps its line breaks. */
  body: string | TemplateResult;
  /** The dialog's title; defaults to "נדרש אישור" in the interface language. */
  heading?: string;
  /** The confirm button; defaults to "אישור". */
  confirmLabel?: string;
  /** The cancel button; defaults to "ביטול". */
  cancelLabel?: string;
  /** A destructive action: the confirm button is the danger button. */
  danger?: boolean;
}

/** The open confirmation dialogs, oldest first: only the top one answers the keyboard. */
const OPEN: SwConfirmDialog[] = [];

function deepActive(): Element | null {
  let a: Element | null = document.activeElement;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
  return a;
}

function isModal(d: HTMLDialogElement): boolean {
  try {
    return d.matches(':modal');
  } catch {
    return true; // a browser without :modal - an open dialog in the ancestry is the safer host
  }
}

/** Where the dialog is attached: the page body, unless the control that asked sits inside a modal <dialog> (a modal sw-drawer
 * uses showModal(), which makes everything outside it inert) - then inside that dialog, as sw-drawer's own notes ask. */
function hostFor(): Element {
  for (let n: Node | null = deepActive(); n; n = n.parentNode ?? (n as ShadowRoot).host ?? null) {
    if (n instanceof HTMLDialogElement && n.open && isModal(n)) return n;
  }
  return document.body;
}

@customElement('sw-confirm-dialog')
export class SwConfirmDialog extends LitElement {
  @property({ attribute: false }) options: ConfirmDialogOptions = { body: '' };
  @property({ type: Boolean }) open = false;

  /** Set by confirmDialog(): called once with the answer. */
  resolver: ((ok: boolean) => void) | null = null;

  static styles = css`
    .msg {
      margin: 0;
      white-space: pre-line;
      overflow-wrap: anywhere;
      color: var(--sw-text);
      line-height: 1.5;
    }
  `;

  private onKey = (e: KeyboardEvent) => {
    if (!this.open || OPEN[OPEN.length - 1] !== this) return;
    if (e.key === 'Tab') return; // sw-dialog's focus trap
    e.stopPropagation(); // the page behind does not see the key, as under a native box
    if (e.key === 'Escape') {
      e.preventDefault();
      this.answer(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cancel = this.renderRoot.querySelector('[data-confirm-cancel]');
      const a = deepActive();
      const onCancel = !!a && !!cancel && (a === cancel || cancel.shadowRoot?.contains(a) === true);
      this.answer(!onCancel);
    }
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey, true);
    OPEN.push(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKey, true);
    const at = OPEN.indexOf(this);
    if (at >= 0) OPEN.splice(at, 1);
    this.answer(false); // removed from the page without an answer: nothing was confirmed
  }

  protected updated(changed: Map<string, unknown>) {
    if (!changed.has('open') || !this.open) return;
    // sw-dialog moves the focus on the next frame (to the first control); the native box focused its OK button - so does this one
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const ok = this.renderRoot.querySelector<HTMLElement>('[data-confirm-ok]');
        (ok?.shadowRoot?.querySelector<HTMLElement>('button') ?? ok)?.focus({ preventScroll: true });
      }),
    );
  }

  answer(ok: boolean) {
    const r = this.resolver;
    if (!r) return;
    this.resolver = null;
    this.open = false;
    r(ok);
    void this.updateComplete.then(() => requestAnimationFrame(() => this.remove()));
  }

  render() {
    const o = this.options;
    return html`<sw-dialog ?open=${this.open} heading=${o.heading || cdt('heading')} data-confirm-dialog @close=${(e: Event) => { e.stopPropagation(); this.answer(false); }}>
      ${typeof o.body === 'string' ? html`<p class="msg" data-confirm-text>${o.body}</p>` : html`<div data-confirm-text>${o.body}</div>`}
      <sw-button slot="footer" data-confirm-cancel @click=${() => this.answer(false)}>${o.cancelLabel || cdt('cancel')}</sw-button>
      <sw-button slot="footer" variant=${o.danger ? 'danger' : 'primary'} data-confirm-ok @click=${() => this.answer(true)}>${o.confirmLabel || cdt('ok')}</sw-button>
    </sw-dialog>`;
  }
}

/** Ask a yes / no question in the system's own dialog; resolves true on confirm, false on cancel, Escape, ✕ or backdrop. */
export function confirmDialog(options: ConfirmDialogOptions | string): Promise<boolean> {
  const opts = typeof options === 'string' ? { body: options } : options;
  if (typeof document === 'undefined') return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const el = document.createElement('sw-confirm-dialog');
    el.options = opts;
    el.resolver = resolve;
    hostFor().append(el);
    el.open = true;
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-confirm-dialog': SwConfirmDialog;
  }
}
