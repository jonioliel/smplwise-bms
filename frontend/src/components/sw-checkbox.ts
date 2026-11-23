import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ariaChecked, pressed } from './sw-checkbox-logic';

/**
 * SHARED-CHECKBOX-2480: THE check box of the product, for a SELECTION - pick a subset of a list (rows of a table, recipients, channels,
 * doors / days / columns / scopes) or tick an acknowledgement ("I confirm ..."). One on/off SETTING is a `sw-toggle`, not this.
 *
 * API (the sw-toggle shape):
 *  - `checked`, `indeterminate` (the "some of them" mark of a select-all box; `aria-checked="mixed"`), `disabled` - reflected;
 *  - `label`: the visible text and the accessible name; or put rich text in the default slot (it names the box through the row's label);
 *    `labelHidden` keeps `label` as the name without drawing it (the row already shows the text);
 *  - `in-label`: the box sits inside a screen's own `<label>` (where a native box sat); a press on that label's text ticks it;
 *  - `value`: carried in the `change` detail, so one handler can serve a list.
 * Events: `change` (bubbles, composed) with `{ checked, value }` after a press - Space or a pointer; Enter does not tick (as on a native
 * box). A press on a mixed box checks it. Read the new value with `checkedOf(e)` (sw-checkbox-logic.ts).
 * Parts: `row` (the label row), `box` (the drawn box), `label` (the text). Not form-associated (neither is sw-toggle): the screens read
 * `checked` / the `change` event, none of them submits a native form.
 * Knobs (set on the host or any ancestor; the sizes are tokens in design/tokens.ts, the rest fall back to a token here):
 *   --sw-check-size (18px), --sw-check-border-w (2px), --sw-check-touch (44px) | --sw-check-radius (--sw-r-2xs),
 *   --sw-check-on (--sw-accent), --sw-check-off (--sw-toggle-off, >= 3:1 on every surface), --sw-check-bg (--sw-surface-solid),
 *   --sw-check-mark (--sw-text-inverse), --sw-check-gap (--sw-s-2), --sw-check-fs (--sw-fs-sm).
 */
@customElement('sw-checkbox')
export class SwCheckbox extends LitElement {
  @property({ type: Boolean, reflect: true }) checked = false;
  @property({ type: Boolean, reflect: true }) indeterminate = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() label = '';
  /** Keep `label` as the box's accessible name but do not render it (the row already shows the text). */
  @property({ type: Boolean }) labelHidden = false;
  /** The box sits inside a screen's own `<label>`: a press on that label (not on a link or another control in it) ticks the box. */
  @property({ type: Boolean, attribute: 'in-label' }) inLabel = false;
  @property() value = '';
  @state() private slotted = false;

  /** `host.focus()` (a screen moving focus to the first row of a list) and a press on the row's text focus the box itself. */
  static shadowRootOptions = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static styles = css`
    :host {
      --_on: var(--sw-check-on, var(--sw-accent));
      --_off: var(--sw-check-off, var(--sw-toggle-off));
      display: inline-flex;
      align-items: center;
      vertical-align: middle;
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    /* the box sits on the FIRST line of a label that wraps: both start at the top, the shorter one is pushed down by half the
       difference between the box and one line (1lh; where 1lh is not known the two simply start at the top) */
    .row {
      display: inline-flex;
      align-items: flex-start;
      gap: var(--sw-check-gap, var(--sw-s-2));
      min-inline-size: 0;
      font-size: var(--sw-check-fs, var(--sw-fs-sm));
      color: inherit;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    button {
      position: relative;
      flex: none;
      box-sizing: border-box;
      inline-size: var(--sw-check-size);
      block-size: var(--sw-check-size);
      margin: 0;
      margin-block: max(0em, calc((1lh - var(--sw-check-size)) / 2));
      padding: 0;
      display: inline-grid;
      place-items: center;
      border: var(--sw-check-border-w) solid var(--_off);
      border-radius: var(--sw-check-radius, var(--sw-r-2xs));
      background: var(--sw-check-bg, var(--sw-surface-solid));
      color: var(--sw-check-mark, var(--sw-text-inverse));
      font: inherit;
      cursor: inherit;
      transition: background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      touch-action: manipulation;
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    :host(:not([disabled])) button:active {
      transform: scale(var(--sw-press-scale));
    }
    /* the filled box keeps a ring a quarter of the way to the text colour: the accent alone reads under 3:1 on some dark beds (classic,
       infra, soft dark), the ring lifts the box's edge to >= 3:1 everywhere (tests/unit-sw-checkbox-2480.spec.ts) */
    :host([checked]) button,
    :host([indeterminate]) button {
      background: var(--_on);
      border-color: color-mix(in srgb, var(--_on) 75%, var(--sw-text));
    }
    svg {
      inline-size: 100%;
      block-size: 100%;
      overflow: visible;
      pointer-events: none;
    }
    /* the mark draws itself in (pathLength 1: a dash of 1, hidden at offset 1); reduced motion zeroes the duration (css.ts) */
    .tick,
    .dash {
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      transition: stroke-dashoffset var(--sw-t-fast) var(--sw-ease);
    }
    :host([checked]:not([indeterminate])) .tick,
    :host([indeterminate]) .dash {
      stroke-dashoffset: 0;
    }
    @media (hover: hover) and (pointer: fine) {
      :host(:not([disabled]):not([checked]):not([indeterminate])) .row:hover button {
        border-color: color-mix(in srgb, var(--_on) 60%, var(--_off));
      }
      :host(:not([disabled])[checked]) .row:hover button,
      :host(:not([disabled])[indeterminate]) .row:hover button {
        background: color-mix(in srgb, var(--_on) 86%, var(--sw-text));
      }
    }
    :host([disabled]) .row {
      opacity: var(--sw-disabled-opacity);
      cursor: not-allowed;
    }
    .text {
      min-inline-size: 0;
      margin-block: max(0em, calc((var(--sw-check-size) - 1lh) / 2));
      overflow-wrap: anywhere;
    }
    .text[hidden] {
      display: none;
    }
    /* A coarse pointer gets a 44 px tall hit area: a transparent ::before that grows ONLY in the block axis (as sw-toggle's), absolute,
       so the drawn box and the row do not move and nothing overflows sideways; the visible label (a <label>) is the inline extent. */
    @media (pointer: coarse) {
      button::before {
        content: '';
        position: absolute;
        inset-inline: calc(var(--sw-check-border-w) * -1);
        inset-block: calc((var(--sw-check-size) - var(--sw-check-touch)) / 2 - var(--sw-check-border-w));
      }
    }
    @media (forced-colors: active) {
      button {
        border-color: CanvasText;
      }
      :host([checked]) button,
      :host([indeterminate]) button {
        background: Highlight;
        border-color: Highlight;
        color: HighlightText;
      }
    }
  `;

  constructor() {
    super();
    // a press on the host's own box around the row (a screen may pad it to a touch target) ticks it too; nothing changes without padding
    this.addEventListener('click', (e) => {
      if (e.composedPath()[0] === this) this.press();
    });
  }

  private labelEl: HTMLLabelElement | null = null;

  /** in-label: a press on the enclosing label (not on this box, not on another control inside the label) ticks the box. */
  private readonly onLabelClick = (e: MouseEvent) => {
    if (!this.inLabel || e.defaultPrevented) return;
    const path = e.composedPath();
    if (path.includes(this)) return;
    const first = path[0];
    const ctl = first instanceof Element ? first.closest('a, button, input, select, textarea, sw-toggle, sw-checkbox, sw-button') : null;
    if (ctl && this.labelEl?.contains(ctl)) return; // a link or another control inside the label keeps its own press
    this.press();
  };

  connectedCallback() {
    super.connectedCallback();
    this.labelEl = this.closest('label');
    this.labelEl?.addEventListener('click', this.onLabelClick);
  }

  disconnectedCallback() {
    this.labelEl?.removeEventListener('click', this.onLabelClick);
    this.labelEl = null;
    super.disconnectedCallback();
  }

  private press() {
    if (this.disabled) return;
    const next = pressed({ checked: this.checked, indeterminate: this.indeterminate });
    this.checked = next.checked;
    this.indeterminate = next.indeterminate;
    this.dispatchEvent(new CustomEvent('change', { detail: { checked: this.checked, value: this.value }, bubbles: true, composed: true }));
  }

  /** A press on the box, or on the row's text (the shadow <label> forwards it to the box), ticks it once; the click bubbles on as usual. */
  private onClick = () => this.press();

  /** Space ticks (the button's own activation); Enter does not, as on a native box. */
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') e.preventDefault();
  };

  private onSlot = (e: Event) => {
    this.slotted = (e.target as HTMLSlotElement).assignedNodes({ flatten: true }).some((n) => n.nodeType === Node.ELEMENT_NODE || !!n.textContent?.trim());
  };

  render() {
    const showText = this.slotted || (!!this.label && !this.labelHidden);
    return html`<label class="row" part="row"
      ><button
        type="button"
        part="box"
        role="checkbox"
        aria-checked=${ariaChecked(this)}
        aria-label=${this.label && (this.labelHidden || !this.slotted) ? this.label : nothing}
        ?disabled=${this.disabled}
        @click=${this.onClick}
        @keydown=${this.onKey}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
          <path class="tick" pathLength="1" d="M3.6 8.4 6.6 11.3 12.4 4.9" />
          <path class="dash" pathLength="1" d="M4.2 8h7.6" />
        </svg></button
      ><span class="text" part="label" ?hidden=${!showText}><slot @slotchange=${this.onSlot}>${this.labelHidden ? '' : this.label}</slot></span></label
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-checkbox': SwCheckbox;
  }
}
