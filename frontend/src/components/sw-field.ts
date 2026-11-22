import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';
import { fitSchedule, fitSelectElement } from './fit-text';
import { tr } from '../i18n/msg/components';

/** Labelled form field wrapper; the control (input/select/textarea) is slotted and styled here.
 * Slots: the default one (the control), `message` (a field's own message under the control - an error with role="alert" - kept out of
 * the unit frame). Parts: `label`, `hint`, `unit-box`, `unit` (a module skin keeps its own label size through `sw-field::part(label)`).
 * Custom property: `--sw-field-unit-inset` (the unit's distance from the frame edge; 11 px). */
@customElement('sw-field')
export class SwField extends LitElement {
  @property() label = '';
  @property() hint = '';
  @property({ type: Boolean, reflect: true }) inline = false;
  /** NATIVE-SELECT-B-2480: the field draws no box of its own (`display: contents`): the slotted control keeps its place in the screen's
   * row or grid and its own width, the screen keeps its own label and form layout (a module skin - calendars `.inp`, tickets `.in` -
   * sits in the outer tree and outranks every ::slotted() rule here, so the module look stays). The control takes the shared field's
   * states and look only where the screen's skin leaves them unset. Use it for a select that moves into the shared field while its
   * form keeps the module's own label (owner N10 + the standing look rule: module looks stay). No `label` / `hint` / `unit` with it. */
  @property({ type: Boolean, reflect: true }) flow = false;
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
  @property({ attribute: 'clear-label' }) clearLabel = tr('נקה חיפוש');
  /** CR-FIELD-UNIT-2470: the unit of the value (₪, kWh, m³, %, "ימים"), drawn INSIDE the slotted input's frame - the figure and its unit
   * read as one value, a press on the unit still lands in the input. The input keeps every state of its own (hover, focus, disabled,
   * the screen's error class); the unit side is padded by the unit's measured width. A numeric input (`inputmode` decimal / numeric,
   * `type="number"`) keeps left-to-right digits in tabular figures in either reading direction. The unit is also the input's
   * accessible description (`aria-description`), so a screen reader hears "12.5, shekel sign". Unset: the field is unchanged. */
  @property() unit = '';
  /** CR-FIELD-UNIT-2470: where the unit sits, in the READING direction of the page: `end` (the default - after the figure, as "12.5 ₪"
   * is read: the left edge in Hebrew, the right edge in English) or `start` (before it, as a currency prefix "₪ 12.5"). */
  @property({ attribute: 'unit-at', reflect: true }) unitAt: 'start' | 'end' = 'end';
  @query('input.search') private searchInput?: HTMLInputElement;
  @query('.ubox') private unitBox?: HTMLElement;
  @query('.unit') private unitMark?: HTMLElement;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
    }
    :host([flow]) {
      display: contents;
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
    :host(:not([flow])) ::slotted(input),
    :host(:not([flow])) ::slotted(select),
    :host(:not([flow])) ::slotted(textarea) {
      inline-size: 100%;
    }
    ::slotted(input),
    ::slotted(select),
    ::slotted(textarea) {
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
    /* CR-FIELD-UNIT-2470: a value the screen marked wrong (aria-invalid) reads as wrong wherever the field sits - also inside a shared
       table's shadow root, where the screen's own .err class does not reach */
    ::slotted(input[aria-invalid='true']),
    ::slotted(select[aria-invalid='true']),
    ::slotted(textarea[aria-invalid='true']) {
      border-color: var(--sw-danger);
      box-shadow: 0 0 0 3px var(--sw-danger-soft);
    }
    /* ---- CR-FIELD-UNIT-2470: the unit inside the input's frame. The unit is laid over the input's padding on the unit side; the padding
       is the unit's measured width (--_uw, set from a ResizeObserver; 1.4em until the first measure) + the frame inset + a gap. ---- */
    .ubox {
      position: relative;
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
      --_uin: var(--sw-field-unit-inset, 11px);
      --_upad: calc(var(--_uw, 1.4em) + var(--_uin) + 6px);
    }
    .unit {
      position: absolute;
      inset-block: 0;
      inset-inline-end: var(--_uin);
      display: flex;
      align-items: center;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      line-height: 1;
      white-space: nowrap;
      unicode-bidi: isolate;
      pointer-events: none;
      user-select: none;
    }
    :host([unit-at='start']) .unit {
      inset-inline-end: auto;
      inset-inline-start: var(--_uin);
    }
    /* The padding side is PHYSICAL: a figure is a left-to-right input inside a right-to-left page, so the input's own logical sides are
       not the page's. !important on this one property only: a module skin's plain "input { padding: 0 12px }" sits in the outer tree,
       which outranks ::slotted() for normal declarations, and the figure would run under the unit. */
    :host([has-unit]:dir(ltr):not([unit-at='start'])) ::slotted(input),
    :host([has-unit]:dir(rtl)[unit-at='start']) ::slotted(input) {
      padding-right: var(--_upad) !important;
      --_ualign: right;
    }
    :host([has-unit]:dir(rtl):not([unit-at='start'])) ::slotted(input),
    :host([has-unit]:dir(ltr)[unit-at='start']) ::slotted(input) {
      padding-left: var(--_upad) !important;
      --_ualign: left;
    }
    /* a figure keeps left-to-right digits (the minus sign and the decimal point stay where they are typed) in tabular figures, and sits
       against its unit (--_ualign: the unit's physical side, set above) */
    :host([has-unit]) ::slotted(input[inputmode='decimal']),
    :host([has-unit]) ::slotted(input[inputmode='numeric']),
    :host([has-unit]) ::slotted(input[type='number']) {
      direction: ltr;
      text-align: var(--_ualign, left);
      font-variant-numeric: tabular-nums;
    }
    @media (forced-colors: active) {
      .unit {
        color: CanvasText;
      }
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
    this.unitObserver?.disconnect();
    this.unitObserved = undefined;
    cancelAnimationFrame(this.fitSlot.raf);
    this.fitSlot.raf = 0;
    super.disconnectedCallback();
  }

  protected willUpdate() {
    this.toggleAttribute('has-unit', this.hasUnit);
  }

  protected updated() {
    this.toggleAttribute('has-icon', !!this.icon);
    this.watchSelect();
    this.fitLater();
    this.nameControls();
    this.watchUnit();
  }

  /** CR-FIELD-UNIT-2470: a unit is drawn for the plain field only (the capsule select and the search box have their own chrome) */
  private get hasUnit(): boolean {
    return !!this.unit && !this.capsule && this.type !== 'search';
  }

  private unitObserver?: ResizeObserver;
  private unitObserved?: HTMLElement;
  /** the input's padding on the unit side follows the unit's drawn width (a font swap or a language change re-measures it) */
  private measureUnit = () => {
    const w = this.unitMark?.getBoundingClientRect().width ?? 0;
    if (w > 0) this.unitBox?.style.setProperty('--_uw', `${Math.ceil(w)}px`);
  };
  private watchUnit() {
    const mark = this.hasUnit ? this.unitMark : undefined;
    if (mark === this.unitObserved) return;
    this.unitObserver?.disconnect();
    this.unitObserved = mark;
    if (!mark) return;
    if (typeof ResizeObserver !== 'undefined') {
      this.unitObserver ??= new ResizeObserver(this.measureUnit);
      this.unitObserver.observe(mark);
    }
    this.measureUnit();
  }

  /** A11Y-POLISHED-2342: the <label> is drawn inside this element's shadow root and the control is slotted from the page, so the
   * two were never associated (a label cannot point across a shadow boundary) and every field read as an unnamed edit box or
   * combo box. The field now names its own slotted controls with its label, unless the screen named them itself; a name it set is
   * marked so it follows a label change and is removed with the label. */
  private nameControls() {
    for (const el of Array.from(this.children)) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) continue;
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio' || el.type === 'hidden')) continue;
      this.describeUnit(el);
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

  /** CR-FIELD-UNIT-2470: the unit is drawn in this shadow root, out of the control's reach, so it is the control's description (a
   * description the screen set itself is kept; ours is marked, follows a unit change and leaves with the unit). */
  private describeUnit(el: HTMLElement) {
    const ours = el.hasAttribute('data-sw-field-unit');
    if (!ours && el.hasAttribute('aria-description')) return;
    if (this.hasUnit && el instanceof HTMLInputElement) {
      el.setAttribute('aria-description', this.unit);
      el.setAttribute('data-sw-field-unit', '');
    } else if (ours) {
      el.removeAttribute('aria-description');
      el.removeAttribute('data-sw-field-unit');
    }
  }

  /** CR-FIELD-UNIT-2470: the label is drawn in this shadow root and cannot point at the slotted control (no `for` across the boundary),
   * so a press on it focuses the control itself, as a page label would */
  private focusControl = () => {
    const c = Array.from(this.children).find((el) => el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
      | undefined;
    if (c && !c.disabled) c.focus();
  };

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
      ${this.label ? html`<label part="label" @click=${this.focusControl}>${this.label}</label>` : ''}
      ${this.capsule
        ? html`<div class="box"><slot @slotchange=${this.onSlotChange}></slot>${this.icon ? html`<span class="ci" aria-hidden="true"><sw-icon .name=${this.icon} size=${ico}></sw-icon></span>` : ''}<span class="cv" aria-hidden="true"><sw-icon name="chevronDown" size=${size}></sw-icon></span></div>`
        : this.hasUnit
          ? html`<div class="ubox" part="unit-box"><slot @slotchange=${this.onSlotChange}></slot><span class="unit" part="unit" aria-hidden="true" data-unit>${this.unit}</span></div>`
          : html`<slot @slotchange=${this.onSlotChange}></slot>`}
      <slot name="message"></slot>
      ${this.hint ? html`<div class="hint" part="hint">${this.hint}</div>` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-field': SwField;
  }
}
