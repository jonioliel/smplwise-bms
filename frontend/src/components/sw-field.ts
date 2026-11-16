import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
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
  /** AUDIT30-B-SHARED (audit round 30, finding 16): `type="search"` makes the field THE search box of the product - it draws its own
   * input (leading search icon, a clear key while there is text, 34 px, --sw-r-sm; 44 px and 16 px text under a coarse pointer).
   * Read `value`; listen to `input` (every keystroke, composed from the inner input - `e.target` is this field) and `search-clear`
   * (the clear key or Escape emptied it; an `input` event fires too). The accessible name is `label`, else `placeholder`.
   * Unset: the field is the plain slotted form field exactly as before. */
  @property({ reflect: true }) type: '' | 'search' = '';
  @property() value = '';
  @property() placeholder = '';
  /** search: the clear key's name (the i18n catalogue belongs to another branch, so the default is set here). */
  @property({ attribute: 'clear-label' }) clearLabel = 'נקה חיפוש';
  @query('input.search') private searchInput?: HTMLInputElement;

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
    /* ---- AUDIT30-B-SHARED (finding 16): the search box (type="search"). Measured before: pill, r10, r16 and r0 search inputs across
       the modules. One shape now: the field's own outline and well, the icon at the start, the clear key at the end. ---- */
    .sbox {
      position: relative;
      display: flex;
      align-items: center;
      min-inline-size: 0;
    }
    input.search {
      -webkit-appearance: none;
      appearance: none;
      inline-size: 100%;
      box-sizing: border-box;
      block-size: 34px;
      margin: 0;
      padding-block: 0;
      padding-inline: 32px 30px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      box-shadow: inset 0 1px 2px color-mix(in srgb, var(--sw-text) 6%, transparent);
      transition: border-color var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color);
    }
    input.search::placeholder {
      color: var(--sw-text-3);
      opacity: 1;
    }
    input.search::-webkit-search-cancel-button,
    input.search::-webkit-search-decoration {
      -webkit-appearance: none;
      appearance: none;
      display: none;
    }
    @media (hover: hover) and (pointer: fine) {
      input.search:hover:not(:focus):not(:disabled) {
        border-color: color-mix(in srgb, var(--sw-text-3) 45%, var(--sw-border-strong));
      }
    }
    input.search:focus {
      outline: none;
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    input.search:disabled {
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
      cursor: not-allowed;
    }
    .sico {
      position: absolute;
      inset-inline-start: 10px;
      inset-block-start: 50%;
      translate: 0 -50%;
      display: inline-flex;
      color: var(--sw-text-3);
      pointer-events: none;
    }
    .sclr {
      position: absolute;
      inset-inline-end: 4px;
      inset-block-start: 50%;
      translate: 0 -50%;
      display: grid;
      place-items: center;
      inline-size: 26px;
      block-size: 26px;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: var(--sw-r-xs, var(--sw-r-sm));
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), scale var(--sw-t-press) var(--sw-ease);
    }
    /* a 44 px hit area around the 26 px key (touch target) without growing the field */
    .sclr::after {
      content: '';
      position: absolute;
      inset: -9px;
    }
    @media (hover: hover) and (pointer: fine) {
      .sclr:hover {
        background: var(--sw-hover-wash);
        color: var(--sw-text);
      }
    }
    .sclr:active {
      scale: var(--sw-press-scale);
    }
    .sclr:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 0;
    }
    @media (pointer: coarse) {
      input.search {
        block-size: 44px;
        font-size: max(16px, var(--sw-fs-sm)); /* under 16 px the phone zooms the page into the field */
        padding-inline: 38px 44px;
      }
      .sico {
        inset-inline-start: 12px;
      }
      .sclr {
        inline-size: 36px;
        block-size: 36px;
      }
      .sclr::after {
        inset: -4px;
      }
    }
    @media (forced-colors: active) {
      input.search {
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

  private onSlotChange = () => {
    this.watchSelect();
    this.nameControls();
  };
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
    this.nameControls();
  }

  /** A11Y-POLISHED-2342: the <label> is drawn inside this element's shadow root and the control is slotted from the page, so the
   * two were never associated (a label cannot point across a shadow boundary) and every field read as an unnamed edit box or
   * combo box. The field now names its own slotted controls with its label, unless the screen named them itself; a name it set is
   * marked so it follows a label change and is removed with the label. */
  private nameControls() {
    for (const el of Array.from(this.children)) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) continue;
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio' || el.type === 'hidden')) continue;
      const ours = el.hasAttribute('data-sw-field-named');
      if (!ours && (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') || (el.id && el.labels?.length))) continue;
      if (this.label) {
        el.setAttribute('aria-label', this.label);
        el.setAttribute('data-sw-field-named', '');
      } else if (ours) {
        el.removeAttribute('aria-label');
        el.removeAttribute('data-sw-field-named');
      }
    }
  }

  protected firstUpdated() {
    void document.fonts?.ready.then(this.fitLater);
  }

  private onSearchInput = (e: Event) => {
    this.value = (e.target as HTMLInputElement).value; // runs before the event reaches this host's own listeners
  };

  private clearSearch = () => {
    const el = this.searchInput;
    if (!el) return;
    el.value = '';
    this.value = '';
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    this.dispatchEvent(new CustomEvent('search-clear', { bubbles: true, composed: true }));
    el.focus();
  };

  private onSearchKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.value) {
      e.preventDefault();
      e.stopPropagation(); // an open drawer / dialog keeps its place: Escape first empties the box
      this.clearSearch();
    }
  };

  /** The search box: its own input, so every module gets the same one (finding 16). */
  private renderSearch() {
    const name = this.label || this.placeholder;
    return html`
      ${this.label ? html`<label for="q">${this.label}</label>` : ''}
      <div class="sbox">
        <input id="q" class="search" type="search" part="input" enterkeyhint="search" autocomplete="off" spellcheck="false"
          .value=${this.value} placeholder=${this.placeholder} aria-label=${name || nothing}
          @input=${this.onSearchInput} @keydown=${this.onSearchKey} />
        <span class="sico" aria-hidden="true"><sw-icon name="search" size=${15}></sw-icon></span>
        ${this.value
          ? html`<button type="button" class="sclr" data-search-clear aria-label=${this.clearLabel} title=${this.clearLabel} @click=${this.clearSearch}><sw-icon name="close" size=${14}></sw-icon></button>`
          : ''}
      </div>
      ${this.hint ? html`<div class="hint">${this.hint}</div>` : ''}
    `;
  }

  render() {
    if (this.type === 'search') return this.renderSearch();
    const size = { sm: 14, md: 16, lg: 18 }[this.ddSize as 'sm' | 'md' | 'lg'] ?? 16;
    const ico = { sm: 17, md: 20, lg: 24 }[this.ddSize as 'sm' | 'md' | 'lg'] ?? 20;
    return html`
      ${this.label ? html`<label>${this.label}</label>` : ''}
      ${this.capsule
        ? html`<div class="box"><slot @slotchange=${this.onSlotChange}></slot>${this.icon ? html`<span class="ci" aria-hidden="true"><sw-icon .name=${this.icon} size=${ico}></sw-icon></span>` : ''}<span class="cv" aria-hidden="true"><sw-icon name="chevronDown" size=${size}></sw-icon></span></div>`
        : html`<slot @slotchange=${this.onSlotChange}></slot>`}
      ${this.hint ? html`<div class="hint">${this.hint}</div>` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-field': SwField;
  }
}
