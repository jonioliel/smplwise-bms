import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';
import { deepFocusables } from './sw-drawer';
import { LookController, type Popup } from '../design/look';

/** The element that really holds focus (through shadow roots). */
function deepActive(): HTMLElement | null {
  let a: Element | null = document.activeElement;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
  return a as HTMLElement | null;
}

const PHONE = '(max-width: 767px)';
const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * The pop-up of the Bubble foundation (owner 2026-10-02): ONE translucent sheet component for every pop-up.
 *
 * `kind` (the look dial `popup` when unset - design/look.ts lookOf('popup')):
 *   - `sheet`   a bottom sheet on a phone (grabber row of 44 px, swipe down to close past 35 % of its height or a fast flick,
 *               rubber band upwards), a centred dialog on wider screens;
 *   - `centred` a centred dialog everywhere (full width with a 16 px inset on a phone);
 *   - `inline`  an in-flow panel where the element sits: it never covers the floors / areas tree or anything else; no backdrop.
 * Translucent: `rgba(--sw-sheet-rgb, --sw-sheet-alpha)` with `--sw-glass-blur-sheet` over the dimmed and blurred page
 * (`--sw-overlay`, `--sw-backdrop-blur`); solid `--sw-surface-solid` when the browser cannot blur or the OS asks for less
 * transparency (the classic skin's resting alpha is 1, so there it is simply a dialog). Opening is a spring (`--sw-t-sheet`,
 * `--sw-ease-thumb`), the content "focuses in"; `prefers-reduced-motion` removes every transition.
 * Accessibility: `role="dialog"` + `aria-modal` (not inline), focus moves to the first focusable (else the close button), Tab and
 * Shift+Tab wrap inside (through shadow roots and slots), Escape and a press on the backdrop close, focus returns to the opener.
 * Events: `close` when it closes (any way). Slots: default (body), `head` (a pill or title row under the grabber), `footer`.
 */
@customElement('sw-sheet')
export class SwSheet extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property() heading = '';
  /** `sheet` | `centred` | `inline`; unset = the look dial. */
  @property() kind: Popup | '' = '';
  /** The wider centred box (760 px: an area pop-up). */
  @property({ type: Boolean, reflect: true }) wide = false;
  /** The narrow centred box (440 px: a confirmation). */
  @property({ type: Boolean, reflect: true }) narrow = false;
  /** While set, nothing closes the sheet (a physical action is on its way). */
  @property({ type: Boolean }) locked = false;
  @state() private phone = false;
  @state() private hasFooter = false;
  @state() private hasHead = false;
  /** The drag offset while swiping down (px). */
  private drag = 0;
  private look = new LookController(this);
  private mq: MediaQueryList | null = null;
  private onMq = () => (this.phone = this.mq?.matches ?? false);
  private opener: HTMLElement | null = null;
  private swipe: { y0: number; t0: number; id: number } | null = null;

  static styles = css`
    :host {
      display: contents;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--sw-z-modal);
      background: var(--sw-overlay);
      -webkit-backdrop-filter: var(--sw-backdrop-blur);
      backdrop-filter: var(--sw-backdrop-blur);
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--sw-t-med) var(--sw-ease);
    }
    :host([open]) .backdrop {
      opacity: 1;
      pointer-events: auto;
    }
    .sheet {
      position: fixed;
      z-index: calc(var(--sw-z-modal) + 1);
      inset-inline: 0;
      margin-inline: auto;
      top: 50%;
      box-sizing: border-box;
      inline-size: min(var(--sw-sheet-w), calc(100% - 32px));
      max-block-size: min(86vh, 860px);
      display: flex;
      flex-direction: column;
      border-radius: var(--sw-r-xl);
      background: rgba(var(--sw-sheet-rgb), var(--sw-sheet-alpha));
      -webkit-backdrop-filter: var(--sw-glass-blur-sheet);
      backdrop-filter: var(--sw-glass-blur-sheet);
      box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border-strong), var(--sw-shadow-3);
      color: var(--sw-text);
      isolation: isolate;
      overflow: hidden;
      transform: translateY(-50%) scale(0.86);
      opacity: 0;
      visibility: hidden;
      transition: transform 200ms var(--sw-ease-out), opacity 180ms var(--sw-ease-out), visibility 0s linear 220ms;
    }
    :host([wide]) .sheet {
      inline-size: min(var(--sw-sheet-w-wide), calc(100% - 32px));
    }
    :host([narrow]) .sheet {
      inline-size: min(440px, calc(100% - 32px));
    }
    :host([open]) .sheet {
      transform: translateY(-50%) scale(1);
      opacity: 1;
      visibility: visible;
      transition: transform var(--sw-t-sheet) var(--sw-ease-thumb), opacity 250ms var(--sw-ease-dialog), visibility 0s;
    }
    /* the grabber: a 44 px in-flow row of the sheet (never over the content), shown in the bottom-sheet layout only */
    .grab {
      display: none;
      flex: none;
      inline-size: 100%;
      block-size: 44px;
      border: 0;
      background: transparent;
      cursor: grab;
      touch-action: none;
      padding: 0;
    }
    .grab::before {
      content: '';
      display: block;
      inline-size: 44px;
      block-size: 5px;
      border-radius: 3px;
      margin: 12px auto 0;
      background: var(--sw-text-3);
      opacity: 0.6;
    }
    header {
      flex: none;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 18px 18px 8px;
    }
    header[hidden] {
      display: none;
    }
    header .titles {
      flex: 1;
      min-inline-size: 0;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    ::slotted([slot='head']) {
      flex: 1;
      min-inline-size: 0;
    }
    /* the close button: a round target of the touch size (44 px on a phone and by default on a desktop; the look dial may say 32) */
    .x {
      flex: none;
      inline-size: var(--sw-touch-desktop, 44px);
      block-size: var(--sw-touch-desktop, 44px);
      min-inline-size: 32px;
      border: 0;
      border-radius: 50%;
      background: var(--sw-layer);
      color: var(--sw-text);
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
    }
    .x:hover {
      background: var(--sw-layer-2);
    }
    .x:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 2px;
    }
    @media (max-width: 1100px) {
      .x {
        inline-size: 44px;
        block-size: 44px;
      }
    }
    .body {
      flex: 1 1 auto;
      min-block-size: 0;
      overflow: auto;
      padding: 8px 18px 22px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scrollbar-width: thin;
      -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%);
      mask-image: linear-gradient(to bottom, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%);
    }
    .body > ::slotted(*) {
      flex-shrink: 0;
    }
    footer {
      flex: none;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
      padding: 0 18px 18px;
    }
    footer[hidden] {
      display: none;
    }
    /* the content focuses in as the sheet lands (the Bubble intro video) */
    :host([open]) .body > ::slotted(*) {
      animation: focus-in var(--sw-t-sheet) var(--sw-ease-dialog) both;
    }
    @keyframes focus-in {
      from {
        opacity: 0;
        filter: blur(6px);
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        filter: none;
        transform: none;
      }
    }
    /* ---- bottom sheet (phone, kind sheet) ---- */
    :host([data-layout='bottom']) .sheet {
      top: auto;
      bottom: 0;
      inline-size: 100%;
      max-block-size: 88vh;
      max-block-size: 88dvh;
      border-end-start-radius: 0;
      border-end-end-radius: 0;
      padding-block-end: env(safe-area-inset-bottom, 0px);
      transform: translateY(100%);
      opacity: 1;
      transition: transform 240ms var(--sw-ease-out), visibility 0s linear 260ms;
    }
    :host([data-layout='bottom'][open]) .sheet {
      transform: translateY(var(--drag, 0px));
      transition: transform var(--sw-t-sheet) var(--sw-ease-thumb), visibility 0s;
    }
    :host([data-layout='bottom'][data-dragging]) .sheet {
      transition: none;
    }
    :host([data-layout='bottom']) .grab {
      display: block;
    }
    :host([data-layout='bottom']) header {
      padding-block-start: 0;
    }
    /* ---- centred on a phone: full width with a 16 px inset ---- */
    :host([data-layout='centred-phone']) .sheet {
      inline-size: calc(100% - 32px);
    }
    /* ---- inline: an in-flow panel, no backdrop, never over anything ---- */
    :host([data-layout='inline']) {
      display: block;
    }
    :host([data-layout='inline']:not([open])) {
      display: none;
    }
    :host([data-layout='inline']) .backdrop {
      display: none;
    }
    :host([data-layout='inline']) .sheet {
      position: static;
      inline-size: 100%;
      max-block-size: none;
      margin: 0;
      transform: none;
      opacity: 1;
      visibility: visible;
      transition: none;
      box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border-strong);
    }
    :host([data-layout='inline']) .body {
      overflow: visible;
      -webkit-mask-image: none;
      mask-image: none;
    }
    /* no blur, or the OS asks for less transparency: solid (the skin contract) */
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      .sheet {
        background: var(--sw-surface-solid);
      }
    }
    @media (prefers-reduced-transparency: reduce) {
      .sheet {
        background: var(--sw-surface-solid);
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
      }
      .backdrop {
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .sheet,
      :host([open]) .sheet,
      .backdrop {
        transition: none !important;
      }
      :host([open]) .body > ::slotted(*) {
        animation: none;
      }
    }
  `;

  /** The layout in force: bottom sheet, centred (desktop / phone) or inline. */
  get layout(): 'bottom' | 'centred' | 'centred-phone' | 'inline' {
    const kind = this.kind || this.look.of('popup');
    if (kind === 'inline') return 'inline';
    if (kind === 'sheet' && this.phone) return 'bottom';
    return this.phone ? 'centred-phone' : 'centred';
  }

  connectedCallback() {
    super.connectedCallback();
    try {
      this.mq = window.matchMedia(PHONE);
      this.mq.addEventListener('change', this.onMq);
      this.phone = this.mq.matches;
    } catch {
      this.mq = null;
    }
    window.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    this.mq?.removeEventListener('change', this.onMq);
    window.removeEventListener('keydown', this.onKey);
    if (this.open) this.restoreFocus();
    super.disconnectedCallback();
  }

  private onKey = (e: KeyboardEvent) => {
    if (!this.open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key === 'Tab' && this.layout !== 'inline') this.trapTab(e);
  };

  /** Tab / Shift+Tab wrap inside the sheet (through shadow roots and slots). */
  private trapTab(e: KeyboardEvent) {
    const sheet = this.renderRoot.querySelector('.sheet');
    if (!sheet) return;
    const all = deepFocusables(sheet).filter((el) => !el.classList.contains('grab'));
    if (!all.length) {
      e.preventDefault();
      return;
    }
    const active = deepActive();
    const inside = active ? sheet.contains(active) || this.contains(active) : false;
    const first = all[0];
    const last = all[all.length - 1];
    if (!inside) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus({ preventScroll: true });
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  close() {
    if (this.locked || !this.open) return;
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private restoreFocus() {
    const back = this.opener;
    this.opener = null;
    if (back?.isConnected) requestAnimationFrame(() => back.focus({ preventScroll: true }));
  }

  protected updated(changed: Map<string, unknown>) {
    this.setAttribute('data-layout', this.layout);
    if (changed.has('open')) {
      if (this.open) {
        const a = deepActive();
        if (a && !this.contains(a) && !this.renderRoot.contains(a)) this.opener = a;
        this.drag = 0;
        requestAnimationFrame(() => {
          const sheet = this.renderRoot.querySelector('.sheet');
          if (!sheet) return;
          const all = deepFocusables(sheet).filter((el) => !el.classList.contains('grab'));
          const target = all.find((el) => !el.hasAttribute('data-sheet-close')) ?? all[0];
          target?.focus({ preventScroll: true });
        });
      } else if (changed.get('open') === true) {
        this.restoreFocus();
      }
    }
  }

  // ---- swipe down to close (the grabber or the head row; bottom-sheet layout only) ----
  private onDown = (e: PointerEvent) => {
    if (this.layout !== 'bottom' || this.locked) return;
    const t = e.target as HTMLElement;
    if (t.closest('button:not(.grab), a, input, [role="slider"], sw-pill, sw-button')) return;
    this.swipe = { y0: e.clientY, t0: performance.now(), id: e.pointerId };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* no capture */
    }
    this.setAttribute('data-dragging', '');
  };
  private onMove = (e: PointerEvent) => {
    if (!this.swipe || e.pointerId !== this.swipe.id) return;
    let dy = e.clientY - this.swipe.y0;
    if (dy < 0) dy = dy / 4; // rubber band upwards
    this.drag = dy;
    this.style.setProperty('--drag', `${dy}px`);
  };
  private onUp = (e: PointerEvent) => {
    if (!this.swipe || e.pointerId !== this.swipe.id) return;
    const sheet = this.renderRoot.querySelector<HTMLElement>('.sheet');
    const h = sheet?.offsetHeight ?? 400;
    const v = this.drag / Math.max(1, performance.now() - this.swipe.t0);
    const shouldClose = this.drag > h * 0.35 || (v > 0.5 && this.drag > 40);
    this.swipe = null;
    this.removeAttribute('data-dragging');
    this.style.setProperty('--drag', '0px');
    this.drag = 0;
    if (shouldClose) this.close();
  };

  render() {
    const inline = this.layout === 'inline';
    const showHeader = !!this.heading || this.hasHead;
    return html`<div class="backdrop" data-sheet-backdrop @click=${(e: Event) => e.target === e.currentTarget && this.close()}></div>
      <section class="sheet" role=${inline ? 'region' : 'dialog'} aria-modal=${inline ? nothing : 'true'} aria-label=${this.heading || nothing} data-sheet
        @pointerdown=${this.onDown} @pointermove=${this.onMove} @pointerup=${this.onUp} @pointercancel=${this.onUp}>
        <button type="button" class="grab" tabindex="-1" aria-label="גרירה לסגירה" data-sheet-grab></button>
        <header ?hidden=${!showHeader}>
          ${this.hasHead ? nothing : html`<div class="titles"><h3>${this.heading}</h3></div>`}
          <slot name="head" @slotchange=${(e: Event) => (this.hasHead = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0)}></slot>
          <button type="button" class="x" aria-label="סגור" data-sheet-close @click=${() => this.close()}><sw-icon name="close" size=${18}></sw-icon></button>
        </header>
        <div class="body"><slot></slot></div>
        <footer ?hidden=${!this.hasFooter}><slot name="footer" @slotchange=${(e: Event) => (this.hasFooter = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0)}></slot></footer>
      </section>`;
  }
}

export { reducedMotion as sheetReducedMotion };

declare global {
  interface HTMLElementTagNameMap {
    'sw-sheet': SwSheet;
  }
}
