import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('sw-toggle')
export class SwToggle extends LitElement {
  @property({ type: Boolean, reflect: true }) checked = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() label = '';
  /** Keep `label` as the switch's accessible name but do not render it (the row already shows the text). */
  @property({ type: Boolean }) labelHidden = false;
  /**
   * HAND-SWITCH-2480: the switch that replaced a native check box inside a `<label>`. The enclosing `<label>` keeps working as its
   * label (a press on the label's text flips the switch, as it flipped the check box); opt-in, so the older switches that sit inside a
   * label keep their behaviour.
   */
  @property({ type: Boolean, attribute: 'in-label' }) inLabel = false;
  /** HAND-SWITCH-2480 (owner N13 "smaller toggles are fine"): the attribute `size="sm"` is the compact 32 x 18 track for the rows where a
   * check box stood (styled by the attribute, so set it in the markup). */
  @property() size: 'md' | 'sm' = 'md';
  /**
   * HONEST-STATES-2540 (deep review FC-01): a controlled switch. A press does NOT move it: it only asks, through `change` with
   * `detail.checked` = the value the person asked for, and the switch keeps drawing `checked` until the screen sets it (after the save
   * was confirmed). A refused or cancelled change (a confirmation dialog closed, a write the server or the device refused) therefore
   * never leaves the switch on a state that was not saved. Opt-in (the attribute `controlled`, like `<sw-tabs controlled>`), so the
   * switches that edit a draft keep moving at once. Read the asked value with `toggled(e)` (it reads `detail.checked`).
   */
  @property({ type: Boolean }) controlled = false;

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-2);
    }
    button {
      inline-size: 42px;
      block-size: 24px;
      border-radius: var(--sw-r-pill);
      border: 0;
      background: var(--sw-toggle-off);
      position: relative;
      cursor: pointer;
      /* POLISH-CLASSIC-DOMUS-297: the track fades on the state curve, the thumb rides the switch spring (tokens.ts: the plain curve at
         120 ms in a skin that sets no spring) */
      transition: background var(--sw-t-med) var(--sw-ease), box-shadow var(--sw-t-med) var(--sw-ease);
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    button::after {
      content: '';
      position: absolute;
      inset-block-start: 3px;
      inset-inline-start: 3px;
      inline-size: 18px;
      block-size: 18px;
      border-radius: 50%;
      background: var(--sw-toggle-thumb);
      /* the knob's own shadow (the thumb token), not the card's: it reads as a physical knob on the track */
      box-shadow: var(--sw-shadow-thumb);
      transition: transform var(--sw-spring-toggle-ms) var(--sw-spring-toggle);
    }
    :host([checked]) button {
      /* 2.4.4: the switch-on colour token (classic: the same blue as the accent; Settings › "צבע מתג פעיל" may change it) */
      background: var(--sw-toggle-on);
    }
    :host([checked]) button::after {
      transform: translateX(-18px);
    }
    :host-context([dir='ltr'][checked]) button::after {
      transform: translateX(18px);
    }
    :host([disabled]) button {
      opacity: var(--sw-disabled-opacity);
      cursor: not-allowed;
    }
    span {
      font-size: var(--sw-fs-sm);
    }
    :host(:not([disabled])) span {
      cursor: pointer;
    }
    /* HAND-SWITCH-2480: the compact track (32 x 18, thumb 14) for the rows where a check box stood - the row keeps its height */
    :host([size='sm']) button {
      inline-size: 32px;
      block-size: 18px;
    }
    :host([size='sm']) button::after {
      inset-block-start: 2px;
      inset-inline-start: 2px;
      inline-size: 14px;
      block-size: 14px;
    }
    :host([size='sm'][checked]) button::after {
      transform: translateX(-14px);
    }
    :host-context([dir='ltr'][size='sm'][checked]) button::after {
      transform: translateX(14px);
    }
    /* UIPOLISH-2320 (owner 1B, 31.10): on a phone the 24 px track gets a 44 px tall touch target - a transparent ::before (free: the thumb is
       ::after) that grows ONLY in the block axis. No inline extension: a ::before wider than the 42 px track is horizontal overflow and
       tripped the 320 px clipped-content guard (layout-devices-break-297), which is why POLISH-PHONE-2310 dropped the old 50 x 44 slop.
       Absolute, so the drawn switch and the row layout do not move. */
    @media (max-width: 767px) and (pointer: coarse) {
      button::before {
        content: '';
        position: absolute;
        inset-inline: 0;
        inset-block: -10px;
      }
      :host([size='sm']) button::before {
        inset-block: -13px;
      }
    }
  `;

  // CR-CMP2-TOAST-2440: a press on the visible label flips the switch too (as a <label> does), so a hand-built switch whose text sat
  // inside its button keeps that behaviour when it becomes a sw-toggle with a visible label.
  constructor() {
    super();
    // A press on the host's own box around the switch (a screen may pad it to a 44 px touch target) flips it too; a
    // press on the switch itself is handled by the button. Nothing changes where the host has no padding.
    this.addEventListener('click', (e) => {
      if (e.composedPath()[0] === this) this.flip();
    });
  }

  private labelEl: HTMLLabelElement | null = null;

  /** HAND-SWITCH-2480: a press on the enclosing label (not on the switch, not on another control inside the label) flips the switch. */
  private readonly onLabelClick = (e: MouseEvent) => {
    if (!this.inLabel || e.defaultPrevented) return;
    const path = e.composedPath();
    if (path.includes(this)) return;
    const first = path[0];
    const ctl = first instanceof Element ? first.closest('a, button, input, select, textarea, sw-toggle, sw-button') : null;
    if (ctl && this.labelEl?.contains(ctl)) return; // a link or another control inside the label keeps its own press
    this.flip();
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

  private flip() {
    if (this.disabled) return;
    const want = !this.checked;
    if (!this.controlled) this.checked = want;
    this.dispatchEvent(new CustomEvent('change', { detail: { checked: want }, bubbles: true, composed: true }));
  }

  render() {
    return html`<button type="button" role="switch" aria-checked=${this.checked} aria-label=${this.label} ?disabled=${this.disabled} @click=${this.flip}></button>${this.label && !this.labelHidden ? html`<span @click=${this.flip}>${this.label}</span>` : ''}`;
  }
}

/**
 * CR-CMP2-TOAST-2440 (06:CMP-2 step 2, owner O13 a): the `@change` handler of a sw-toggle that stands in for a hand-built
 * `<button role="switch" aria-checked=...>`. Such a button showed the MODEL's value only: a press asked the model, and the switch moved
 * when the answer re-rendered it. This handler keeps that: it puts the switch back at `shown` (the value it was rendered with), stops the
 * new `change` event from reaching handlers that never heard it before, and runs `act`. Bind `.checked=${live(shown)}` with it.
 */
export function switchPress(shown: boolean, act: () => void): (e: Event) => void {
  return (e: Event) => {
    e.stopPropagation();
    (e.currentTarget as SwToggle).checked = shown;
    act();
  };
}

/** HAND-SWITCH-2480: the new value in a sw-toggle's `change` handler - kept decorator-free in toggle-value.ts (RELEASE-2480-TRAIN). */
export { toggled } from './toggle-value';

declare global {
  interface HTMLElementTagNameMap {
    'sw-toggle': SwToggle;
  }
}
