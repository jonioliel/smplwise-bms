/** CR-023 electricity screens: the shared base element, state boxes and small templates. */
import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../components/sw-icon';
import type { IconName } from '../components/sw-icon';
import { SkinController } from '../design/skin';
import { BILL_STATE_LABEL, type BillState } from '../api/electricity-billing';
import { elecCss } from './elec-css';

/** Base of every screen element of this half: the shared sheet, the skin mirrored on the host (data-skin). */
export class ElecBase extends LitElement {
  protected skin = new SkinController(this);
  static styles = [elecCss];
  private mq = window.matchMedia('(max-width: 767px)');
  private onMq = () => this.requestUpdate();
  /** a phone-width viewport: lists instead of wide tables */
  protected get phone(): boolean {
    return this.mq.matches;
  }
  connectedCallback() {
    super.connectedCallback();
    this.mq.addEventListener('change', this.onMq);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.mq.removeEventListener('change', this.onMq);
  }
}

export type LoadState = 'loading' | 'ready' | 'error' | 'forbidden' | 'empty';

const BILL_CLASS: Record<BillState, string> = { draft: 'c-mut', issued: 'c-acc', sent: 'c-warn', paid: 'c-ok', void: 'c-err' };
export const billChip = (s: BillState): TemplateResult => html`<span class="chip ${BILL_CLASS[s]}" data-bill-state=${s}>${BILL_STATE_LABEL[s]}</span>`;

/** The empty / error / forbidden panel of a screen. */
export function stateBox(kind: 'empty' | 'error' | 'forbidden', icon: IconName, title: string, action?: { label: string; run: () => void; primary?: boolean }): TemplateResult {
  return html`<div class="card" data-elec-state=${kind}>
    <div class="empty ${kind === 'error' ? 'err' : ''}" role=${kind === 'error' ? 'alert' : 'status'}>
      <div class="ic"><sw-icon .name=${icon} size="28"></sw-icon></div>
      <h3>${title}</h3>
      ${action ? html`<button type="button" class="btn ${action.primary ? 'pri' : ''}" @click=${action.run}>${action.label}</button>` : nothing}
    </div>
  </div>`;
}

/** Loading skeleton rows. */
export function skeleton(rows = 6): TemplateResult {
  return html`<div class="card" data-elec-state="loading" aria-busy="true" aria-label="טוען">
    ${Array.from({ length: rows }, () => html`<div class="row" style="padding:10px 0"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}
  </div>`;
}

export const alertBox = (kind: 'err' | 'warn' | 'ok' | 'info', body: TemplateResult | string, mark = kind === 'ok' ? '✓' : kind === 'info' ? 'i' : '!'): TemplateResult =>
  html`<div class="alert ${kind}" role=${kind === 'err' ? 'alert' : 'status'}><span class="x" aria-hidden="true">${mark}</span><div>${body}</div></div>`;

let flashText = '';
/** A one-shot message for the next screen (the account page shows "the draft was not created: ..." after the wizard saved). */
export const setFlash = (t: string): void => {
  flashText = t;
};
export const takeFlash = (): string => {
  const t = flashText;
  flashText = '';
  return t;
};

/** `<span class="num">x</span>`: an LTR numeral inside RTL text. */
export const n = (s: string | number): TemplateResult => html`<span class="num">${s}</span>`;

/** Reads `FormData`-free form values from inputs by `name` inside a root. */
export function val(root: ParentNode | null | undefined, name: string): string {
  const el = root?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`);
  return el ? el.value : '';
}

/** A modal dialog: a centred card on a desktop, a bottom sheet on a phone. Closes on Escape or a click on the backdrop unless `locked`. */
@customElement('elec-dialog')
export class ElecDialog extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property() heading = '';
  @property({ type: Boolean, reflect: true }) wide = false;
  @property({ type: Boolean }) locked = false;
  private opener: HTMLElement | null = null;

  static styles = css`
    :host {
      display: none;
    }
    :host([open]) {
      display: block;
    }
    .scrim {
      position: fixed;
      inset: 0;
      background: var(--sw-overlay);
      z-index: var(--sw-z-modal, 100);
      display: grid;
      place-items: center;
      padding: max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px));
    }
    .dlg {
      inline-size: min(480px, 100%);
      background: var(--sw-surface-solid);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-block-size: calc(100dvh - 32px);
      overflow: auto;
      color: var(--sw-text);
      font-size: var(--sw-fs-md);
    }
    :host([wide]) .dlg {
      inline-size: min(720px, 100%);
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      color: var(--sw-heading);
    }
    .act {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    :host-context([data-skin='bubble']) .dlg {
      background: rgba(var(--sw-sheet-rgb), 0.92);
      -webkit-backdrop-filter: var(--sw-glass-blur-sheet, none);
      backdrop-filter: var(--sw-glass-blur-sheet, none);
    }
    @media (max-width: 767px) {
      .scrim {
        place-items: end stretch;
        padding: 0;
      }
      .dlg {
        inline-size: 100%;
        border-radius: var(--sw-r-lg) var(--sw-r-lg) 0 0;
        padding-block-end: max(20px, env(safe-area-inset-bottom, 0px));
      }
      .act {
        flex-direction: column;
      }
      ::slotted([slot='actions']) {
        inline-size: 100%;
      }
    }
  `;

  private close() {
    if (this.locked) return;
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open) this.close();
  };
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKey);
  }
  updated(ch: Map<string, unknown>) {
    if (!ch.has('open')) return;
    if (!this.open) {
      if (ch.get('open') === true && this.opener?.isConnected) requestAnimationFrame(() => this.opener?.focus({ preventScroll: true }));
      return;
    }
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    if (a && !this.contains(a)) this.opener = a as HTMLElement;
    requestAnimationFrame(() => {
      const t = this.querySelector<HTMLElement>('[autofocus], input:not([type=hidden]), textarea, select') ?? this.querySelector<HTMLElement>('button:not([disabled])');
      t?.focus({ preventScroll: true });
    });
  }
  render() {
    return html`<div class="scrim" @click=${(e: Event) => e.target === e.currentTarget && this.close()}>
      <div class="dlg" role="dialog" aria-modal="true" aria-label=${this.heading}>
        <h3>${this.heading}</h3>
        <slot></slot>
        <div class="act"><slot name="actions"></slot></div>
      </div>
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'elec-dialog': ElecDialog;
  }
}
