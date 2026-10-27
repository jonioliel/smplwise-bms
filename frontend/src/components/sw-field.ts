import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';
import { fitSchedule, fitSelectElement } from './fit-text';

/** Labelled form field wrapper; the control (input/select/textarea) is slotted and styled here. */
@customElement('sw-field')
export class SwField extends LitElement {
  @property() label = '';
  @property() hint = '';
  @property({ type: Boolean, reflect: true }) inline = false;
  /** DROPDOWNFIT-295: the slotted `<select>` takes the SAME look as the `capsule` sw-dropdown (height, ring, radius, font, icon + chevron spacing), at the
   * dropdown size dial `dd-size` (sm | md | lg). The label fits (fit-text.ts) instead of being cut. Without it the field is the plain form field. */
  @property({ type: Boolean, reflect: true }) capsule = false;
  @property({ attribute: 'dd-size', reflect: true }) ddSize = 'md';
  /** capsule only: the icon at the start of the control (the dropdown's `icon`). */
  @property() icon: IconName | '' = '';

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
    }
    :host([inline]) {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-3);
    }
    label {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    ::slotted(input),
    ::slotted(select),
    ::slotted(textarea) {
      inline-size: 100%;
      box-sizing: border-box;
      min-block-size: var(--sw-ctl-h-md);
      padding: 5px 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      transition: border-color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color), background var(--sw-t-hover) var(--sw-ease-color);
    }
    /* POLISH-CLASSIC-DOMUS-297 (impeccable harden: every control state): hover where a pointer hovers, a disabled field that reads
       as unavailable, a field the person left wrong in the danger outline */
    @media (hover: hover) and (pointer: fine) {
      ::slotted(input:hover:not(:focus):not(:disabled)),
      ::slotted(select:hover:not(:focus):not(:disabled)),
      ::slotted(textarea:hover:not(:focus):not(:disabled)) {
        border-color: color-mix(in srgb, var(--sw-text-3) 45%, var(--sw-border-strong));
      }
    }
    ::slotted(input:disabled),
    ::slotted(select:disabled),
    ::slotted(textarea:disabled) {
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
      cursor: not-allowed;
      box-shadow: none;
    }
    ::slotted(input:user-invalid),
    ::slotted(textarea:user-invalid) {
      border-color: var(--sw-danger);
    }
    ::slotted(input:focus),
    ::slotted(select:focus),
    ::slotted(textarea:focus) {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    /* touch targets (mobile audit 2026-09-30): fields were 30-33 px high on a phone */
    @media (max-width: 767px) and (pointer: coarse) {
      ::slotted(input:not([type='checkbox']):not([type='radio']):not([type='range'])),
      ::slotted(select),
      ::slotted(textarea) {
        min-block-size: 44px; /* UXFIX-A11Y-295: 44 px touch target (was 40) */
        /* POLISH-CLASSIC-DOMUS-297 (mobile-native): under 16 px the phone zooms the page into the field and never zooms back */
        font-size: max(16px, var(--sw-fs-sm));
      }
    }
    /* ---- DROPDOWNFIT-295: the capsule select. The metrics are the sw-dropdown capsule's (--_c*, copied from sw-dropdown.ts, held equal by
       tests/layout-dropdown-fit.spec.ts). The host-qualified selectors outrank the skins' ::slotted(select) rules. ---- */
    .box {
      position: relative;
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    :host([capsule]) {
      --_ch: 46px;
      --_cfs: 16px;
      --_cico: 20px;
      --_cgap: 10px;
      --_cchev: 16px;
      --_cring: 2px;
    }
    :host([capsule][dd-size='sm']) {
      --_ch: 38px;
      --_cfs: 14px;
      --_cico: 17px;
      --_cgap: 8px;
      --_cchev: 14px;
    }
    :host([capsule][dd-size='lg']) {
      --_ch: 58px;
      --_cfs: 18px;
      --_cico: 24px;
      --_cgap: 12px;
      --_cchev: 18px;
    }
    :host([capsule]) ::slotted(select) {
      -webkit-appearance: none;
      appearance: none;
      box-sizing: border-box;
      min-block-size: max(var(--_ch), 44px);
      padding-block: 0;
      padding-inline-start: calc(var(--_ch) * 0.36);
      padding-inline-end: calc(var(--_ch) * 0.3 + var(--_cchev) + var(--_cgap));
      border: var(--_cring) solid var(--sw-accent);
      border-radius: var(--sw-r-pill);
      background: linear-gradient(180deg, var(--sw-surface-solid) 0%, color-mix(in srgb, var(--sw-accent) 11%, var(--sw-surface-solid)) 100%);
      box-shadow: 0 3px 8px -3px color-mix(in srgb, var(--sw-accent) 42%, transparent), 0 1px 2px color-mix(in srgb, var(--sw-text) 10%, transparent);
      color: var(--sw-text);
      font-size: var(--_cfs);
      font-weight: var(--sw-fw-semibold);
      text-align: start;
      text-overflow: clip;
      cursor: pointer;
    }
    :host([capsule][tight]) ::slotted(select) {
      padding-inline-start: calc(var(--_ch) * 0.2);
      padding-inline-end: calc(var(--_ch) * 0.16 + var(--_cchev) + 6px);
    }
    :host([capsule][tight][has-icon]) ::slotted(select) {
      padding-inline-start: calc(var(--_ch) * 0.2 + var(--_cico) + 6px);
    }
    :host([capsule][tight]) .ci {
      inset-inline-start: calc(var(--_ch) * 0.2);
    }
    :host([capsule][tight]) .cv {
      inset-inline-end: calc(var(--_ch) * 0.16);
    }
    :host([capsule][has-icon]) ::slotted(select) {
      padding-inline-start: calc(var(--_ch) * 0.36 + var(--_cico) + var(--_cgap));
    }
    :host([capsule]) ::slotted(select:focus-visible),
    :host([capsule]) ::slotted(select:focus) {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--sw-accent) 24%, transparent), 0 4px 10px -4px color-mix(in srgb, var(--sw-accent) 45%, transparent);
    }
    .ci,
    .cv {
      position: absolute;
      inset-block-start: 50%;
      translate: 0 -50%;
      display: inline-flex;
      pointer-events: none;
    }
    .ci {
      inset-inline-start: calc(var(--_ch) * 0.36);
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .cv {
      inset-inline-end: calc(var(--_ch) * 0.3);
      color: var(--sw-text-2, var(--sw-text-3));
    }
    @media (max-width: 767px) and (pointer: coarse) {
      :host([capsule]) ::slotted(select) {
        min-block-size: max(var(--_ch), 44px);
      }
    }
    @media (forced-colors: active) {
      :host([capsule]) ::slotted(select) {
        border-color: ButtonText;
      }
    }
    ::slotted([data-ltr]) {
      direction: ltr;
      text-align: left;
      font-family: var(--sw-font-mono);
    }
  `;

  private fitSlot = { raf: 0 };
  private fitObserver?: ResizeObserver;
  private fitMutations?: MutationObserver;
  private fitTarget?: HTMLSelectElement;
  private fitNow = () => {
    if (!this.capsule || !this.fitTarget) return;
    this.removeAttribute('tight');
    if (fitSelectElement(this.fitTarget) === 'floor') {
      this.setAttribute('tight', ''); // the chrome tightens before the label gives up (same rule as the dropdown's data-tight)
      fitSelectElement(this.fitTarget);
    }
  };
  private fitLater = () => fitSchedule(this.fitNow, this.fitSlot);

  /** (Re)attaches the fit to the slotted select: its width, its options' text and its value decide the label. */
  private watchSelect() {
    const sel = this.querySelector('select');
    if (sel === this.fitTarget) return;
    this.unwatchSelect();
    if (!sel) return;
    this.fitTarget = sel;
    sel.addEventListener('change', this.fitLater);
    if (typeof ResizeObserver !== 'undefined') {
      this.fitObserver = new ResizeObserver(this.fitLater);
      this.fitObserver.observe(sel);
    }
    if (typeof MutationObserver !== 'undefined') {
      this.fitMutations = new MutationObserver(this.fitLater);
      this.fitMutations.observe(sel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['selected', 'value'] });
    }
    this.fitLater();
  }

  private unwatchSelect() {
    this.fitTarget?.removeEventListener('change', this.fitLater);
    this.fitObserver?.disconnect();
    this.fitMutations?.disconnect();
    this.fitObserver = this.fitMutations = this.fitTarget = undefined;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.hasUpdated) this.watchSelect();
  }

  disconnectedCallback() {
    this.unwatchSelect();
    cancelAnimationFrame(this.fitSlot.raf);
    this.fitSlot.raf = 0;
    super.disconnectedCallback();
  }

  protected updated() {
    this.toggleAttribute('has-icon', !!this.icon);
    this.watchSelect();
    this.fitLater();
  }

  protected firstUpdated() {
    void document.fonts?.ready.then(this.fitLater);
  }

  render() {
    const size = { sm: 14, md: 16, lg: 18 }[this.ddSize as 'sm' | 'md' | 'lg'] ?? 16;
    const ico = { sm: 17, md: 20, lg: 24 }[this.ddSize as 'sm' | 'md' | 'lg'] ?? 20;
    return html`
      ${this.label ? html`<label>${this.label}</label>` : ''}
      ${this.capsule
        ? html`<div class="box"><slot @slotchange=${() => this.watchSelect()}></slot>${this.icon ? html`<span class="ci" aria-hidden="true"><sw-icon .name=${this.icon} size=${ico}></sw-icon></span>` : ''}<span class="cv" aria-hidden="true"><sw-icon name="chevronDown" size=${size}></sw-icon></span></div>`
        : html`<slot @slotchange=${() => this.watchSelect()}></slot>`}
      ${this.hint ? html`<div class="hint">${this.hint}</div>` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-field': SwField;
  }
}
