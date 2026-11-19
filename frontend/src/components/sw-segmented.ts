import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { segmentedFocusStep } from './segmented-logic';

/** One key of a segmented control. */
export interface SegmentOption<V extends string = string> {
  value: V;
  label: string;
  /** A small number after the label (e.g. "only failures 3"); 0 / '' shows nothing. */
  count?: number | string;
  disabled?: boolean;
  /** A tooltip (the key's `title`). */
  title?: string;
  /** Attributes copied onto the key's `<button>` (the data-* hooks a screen and its specs already used, e.g. `{ 'data-lock-level': 'full' }`). */
  attrs?: Readonly<Record<string, string>>;
}

export interface SegmentedChange<V extends string = string> {
  value: V;
}

/**
 * CR-CMP2-SELECTS-2450 (owner N11, 19.11; 06:CMP-2): THE segmented control - a short row of mutually exclusive keys on a sunken track,
 * the chosen key a lifted thumb. The look is the settings key style the owner chose (POLISH4-WP1, Q3a: styles/settings.ts
 * `settingsSegStyles`), so a screen that swaps its hand-built `.seg` for this element keeps that language; the `--sw-seg-*` knobs a
 * glass host sets (TKUI6, the service-management pages) still reach every part through the shadow boundary.
 *
 *     <sw-segmented label="רמת פירוט" .options=${[{ value: 'generic', label: 'כללי' }, ...]} value=${s.lockscreen}
 *       @change=${(e: CustomEvent<SegmentedChange>) => this.patch({ lockscreen: e.detail.value })}></sw-segmented>
 *
 * Behaviour, kept from the hand-built keys it replaces:
 *  - CONTROLLED: a press never moves the thumb by itself. It fires `change` ({ value }) and the host re-renders with the new `value`
 *    (a key showed the model's value before too - a refused save leaves the thumb where it was). A press on the chosen key fires as
 *    well: some screens reopen something from it (the "selected users" key opens the picker again).
 *  - each key is a `<button aria-pressed>` in a `role="group"` named by `label`; the screens' specs that read `button[aria-pressed]`
 *    keep working (Playwright's CSS pierces the shadow root). The arrow keys and Home / End move the focus along the keys.
 *  - `size="sm"`: the 28 px key of the compact rows (notification settings); default 34 px. `block`: the track fills its row and the
 *    keys share it equally. On a coarse pointer every key keeps a 44 px tall touch target (an absolute ::before, no layout change).
 *  - motion (emil-design-eng): a settings key is pressed tens of times a day, so the thumb does not slide; colour fades on the
 *    hover curve and a key gives on pointer-down (`--sw-press-scale`, 1 = none in the skins that turn press feedback off).
 */
@customElement('sw-segmented')
export class SwSegmented<V extends string = string> extends LitElement {
  @property({ attribute: false }) options: readonly SegmentOption<V>[] = [];
  @property() value = '';
  /** The group's accessible name. */
  @property() label = '';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ reflect: true }) size: 'md' | 'sm' = 'md';
  @property({ type: Boolean, reflect: true }) block = false;

  static styles = css`
    :host {
      display: inline-flex;
      flex: none;
      max-inline-size: 100%;
      vertical-align: middle;
    }
    :host([hidden]) {
      display: none;
    }
    :host([block]) {
      display: flex;
      flex: 1 1 auto;
    }
    .seg {
      display: inline-flex;
      flex-wrap: wrap;
      max-inline-size: 100%;
      box-sizing: border-box;
      border: 1px solid var(--sw-seg-border, transparent);
      border-radius: var(--sw-seg-radius, var(--sw-r-md));
      background: var(--sw-seg-track, var(--sw-surface-3));
      padding: var(--sw-seg-pad, 3px);
      gap: var(--sw-seg-gap, 2px);
    }
    :host([block]) .seg {
      display: flex;
      inline-size: 100%;
    }
    button {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-sizing: border-box;
      min-block-size: var(--sw-seg-h, 34px);
      padding: 0 var(--sw-seg-key-pad, 14px);
      border: 0;
      border-radius: var(--sw-seg-btn-radius, var(--sw-r-sm));
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      line-height: 1.2;
      white-space: nowrap;
      cursor: pointer;
      transition:
        transform var(--sw-t-press, 120ms) var(--sw-ease),
        background var(--sw-t-hover, 120ms) var(--sw-ease-color, ease),
        color var(--sw-t-hover, 120ms) var(--sw-ease-color, ease),
        box-shadow var(--sw-t-hover, 120ms) var(--sw-ease-color, ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      user-select: none;
      -webkit-user-select: none;
    }
    :host([size='sm']) button {
      min-block-size: var(--sw-seg-h, 28px);
      padding: 0 var(--sw-seg-key-pad, 10px);
      font-size: var(--sw-fs-sm);
    }
    :host([block]) button {
      flex: 1 1 0;
      min-inline-size: 0;
    }
    button + button {
      border-inline-start: var(--sw-seg-divider, 0 solid transparent);
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover:not([aria-pressed='true']):not(:disabled) {
        background: var(--sw-hover-wash);
        color: var(--sw-text);
      }
    }
    button:active:not(:disabled) {
      transform: scale(var(--sw-press-scale, 1));
    }
    .seg button[aria-pressed='true'] {
      /* GATE2370-B: in dark the chosen key is the light pill (--sw-seg-key / --sw-seg-key-ink) - 3:1 from the track (WCAG 1.4.11) */
      background: var(--sw-seg-on-bg, var(--sw-seg-key, var(--sw-surface)));
      color: var(--sw-seg-on-fg, var(--sw-seg-key-ink, var(--sw-accent-text)));
      box-shadow: var(--sw-seg-on-shadow, var(--sw-seg-thumb-shadow, var(--sw-shadow-1)));
    }
    button:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
      outline-offset: -2px;
    }
    button:disabled {
      opacity: var(--sw-disabled-opacity, 0.5);
      cursor: not-allowed;
    }
    .n {
      font-size: var(--sw-fs-2xs, 11px);
      font-weight: var(--sw-fw-bold);
      font-variant-numeric: tabular-nums;
      min-inline-size: 18px;
      padding: 1px 5px;
      box-sizing: border-box;
      border-radius: var(--sw-r-pill);
      background: var(--sw-seg-count-bg, color-mix(in srgb, currentColor 14%, transparent));
      text-align: center;
    }
    /* UIPOLISH-2320 rule (sw-toggle): on a phone the key keeps a 44 px tall touch target, grown in the block axis only */
    @media (max-width: 767px) and (pointer: coarse) {
      button::before {
        content: '';
        position: absolute;
        inset-inline: 0;
        inset-block: min(0px, calc((var(--sw-seg-h, 34px) - 44px) / 2));
      }
      :host([size='sm']) button::before {
        inset-block: min(0px, calc((var(--sw-seg-h, 28px) - 44px) / 2));
      }
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition-duration: 0ms;
      }
    }
  `;

  /** The keys (rendered), in order. */
  private get keys(): HTMLButtonElement[] {
    return [...(this.renderRoot?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
  }

  private press(o: SegmentOption<V>) {
    if (this.disabled || o.disabled) return;
    this.dispatchEvent(new CustomEvent<SegmentedChange<V>>('change', { detail: { value: o.value }, bubbles: true, composed: true }));
  }

  private onKey(e: KeyboardEvent) {
    const keys = this.keys;
    const from = keys.indexOf(e.target as HTMLButtonElement);
    if (from < 0) return;
    const rtl = getComputedStyle(this).direction === 'rtl';
    const to = segmentedFocusStep(e.key, from, keys.map((k) => !k.disabled), rtl);
    if (to < 0) return;
    e.preventDefault();
    keys[to].focus();
  }

  protected updated(changed: PropertyValues) {
    if (!changed.has('options')) return;
    // the screens' data-* hooks: set on the keys as given (and removed when an option drops one)
    const keys = this.keys;
    this.options.forEach((o, i) => {
      const k = keys[i];
      if (!k) return;
      const want = o.attrs ?? {};
      for (const a of [...k.attributes]) if (a.name.startsWith('data-') && !(a.name in want)) k.removeAttribute(a.name);
      for (const [name, v] of Object.entries(want)) if (k.getAttribute(name) !== v) k.setAttribute(name, v);
    });
  }

  render() {
    return html`<div class="seg" part="track" role="group" aria-label=${this.label || nothing} @keydown=${this.onKey}>
      ${this.options.map(
        (o) => html`<button type="button" part="key" aria-pressed=${o.value === this.value ? 'true' : 'false'} ?disabled=${this.disabled || !!o.disabled} title=${o.title || nothing}
          @click=${() => this.press(o)}>${o.label}${o.count ? html`<small class="n">${o.count}</small>` : nothing}</button>`,
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-segmented': SwSegmented;
  }
}
