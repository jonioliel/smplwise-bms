import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { chipOn, segmentedFocusStep } from './segmented-logic';

/** One chip of a chip choice. */
interface ChipChoiceOption<V extends string = string> {
  value: V;
  label: string;
  disabled?: boolean;
  /** A tooltip (the chip's `title`). */
  title?: string;
  /** Attributes copied onto the chip's `<button>` (the data-* hooks a screen and its specs already used). */
  attrs?: Readonly<Record<string, string>>;
  /** CR-CMP2-TABS-2460: an icon at the start of the chip (the screen's own template: an `sw-icon`, the app's inline `svg.ic`). */
  icon?: TemplateResult;
  /** CR-CMP2-TABS-2460: a count after the label (a small figure on a soft wash of the chip's ink, part `count`). */
  count?: number;
}

export interface ChipChoiceChange<V extends string = string> {
  value: V;
  /** CR-CMP2-TABS-2460, `multi` only: the state the press asks for (true = turn this chip on). */
  pressed?: boolean;
}


/**
 * CR-CMP2-SEGMENTED-C-2450 (owner N11 follow-up, recommendation of CR-CMP2-SEGMENTED-B-2450 Q4): ONE choice drawn as a row of separate
 * chips - bordered pills with gaps, the chosen chip filled with the accent - for the choices that were never a segmented track (the door
 * windows' rule source / kind / generator / hours, the external access settings, the WisKey diagnostics filters). They reused the `.seg`
 * class name with their own chip rules; this element is that look once. A longer list wraps onto more lines (no sideways scroll).
 *
 *     <sw-chip-choice label="מקור" .options=${[{ value: 'arx', label: 'Arx' }, ...]} value=${d.source}
 *       @change=${(e: CustomEvent<ChipChoiceChange>) => this.patch({ source: e.detail.value })}></sw-chip-choice>
 *
 * Behaviour - the same contract as sw-segmented, so a screen moves between the two without new handlers:
 *  - CONTROLLED: a press fires `change` ({ value }) and never marks the chip itself; the host re-renders `value`. A press on the chosen
 *    chip fires as well (a screen that ignores it keeps its own "only when it differs" guard).
 *  - each chip is a `<button aria-pressed>` in a `role="group"` named by `label`; the arrows (reading direction) and Home / End move the
 *    focus. Every `data-*` hook of an option lands on its chip (`attrs`).
 *  - a coarse pointer gets 44 px tall chips (the chips grow, the row wraps - they are separate targets, not one track).
 *  - knobs: --sw-chipc-gap, --sw-chipc-h, --sw-chipc-pad, --sw-chipc-radius, --sw-chipc-fs, --sw-chipc-fg, --sw-chipc-bg,
 *    --sw-chipc-border, --sw-chipc-on-bg, --sw-chipc-on-fg, --sw-chipc-on-border, --sw-chipc-on-fw.
 *  - motion (emil-design-eng): colour on the hover curve, a 0.97 give on press (`--sw-press-scale` where a skin sets it), none when reduced.
 *  - CR-CMP2-TABS-2460: an option may carry an `icon` and a `count`. `multi`: several chips may be on at once (`values`); a press
 *    fires `change` ({ value, pressed }) with the state it asks for and, controlled as ever, the host re-renders `values` (the
 *    personal home panel's summary tiles: "follow the installation" is one more chip the host keeps exclusive itself).
 */
@customElement('sw-chip-choice')
export class SwChipChoice<V extends string = string> extends LitElement {
  @property({ attribute: false }) options: readonly ChipChoiceOption<V>[] = [];
  @property() value = '';
  /** The group's accessible name. */
  @property() label = '';
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** CR-CMP2-TABS-2460: several chips may be on at once - the chips that are on are `values` (not `value`). */
  @property({ type: Boolean, reflect: true }) multi = false;
  @property({ attribute: false }) values: readonly string[] = [];

  static styles = css`
    :host {
      display: flex;
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    :host([hidden]) {
      display: none;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-chipc-gap, 6px);
      min-inline-size: 0;
    }
    button {
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-block-size: var(--sw-chipc-h, 32px);
      padding: 0 var(--sw-chipc-pad, 12px);
      border: 1px solid var(--sw-chipc-border, var(--sw-border));
      border-radius: var(--sw-chipc-radius, var(--sw-r-pill));
      background: var(--sw-chipc-bg, var(--sw-surface));
      color: var(--sw-chipc-fg, var(--sw-text));
      font: inherit;
      font-size: var(--sw-chipc-fs, inherit);
      line-height: 1.2;
      max-inline-size: 100%;
      overflow-wrap: anywhere;
      cursor: pointer;
      transition:
        background-color var(--sw-t-hover, 120ms) var(--sw-ease-color, ease),
        border-color var(--sw-t-hover, 120ms) var(--sw-ease-color, ease),
        color var(--sw-t-hover, 120ms) var(--sw-ease-color, ease),
        transform var(--sw-t-press, 120ms) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover:not([aria-pressed='true']):not(:disabled) {
        border-color: var(--sw-border-strong);
        background: var(--sw-surface-2);
      }
    }
    button:active:not(:disabled) {
      transform: scale(var(--sw-press-scale, 0.97));
    }
    button[aria-pressed='true'] {
      background: var(--sw-chipc-on-bg, var(--sw-accent));
      border-color: var(--sw-chipc-on-border, var(--sw-accent));
      color: var(--sw-chipc-on-fg, var(--sw-text-inverse));
      font-weight: var(--sw-chipc-on-fw, inherit);
    }
    button:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
      outline-offset: 2px;
    }
    button:disabled {
      opacity: var(--sw-disabled-opacity, 0.5);
      cursor: not-allowed;
    }
    /* CR-CMP2-TABS-2460: an icon before the label, a count after it */
    button {
      gap: 6px;
    }
    .ic {
      display: inline-flex;
      flex: none;
      line-height: 0;
    }
    .ic > svg {
      inline-size: 1em;
      block-size: 1em;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .n {
      display: inline-grid;
      place-items: center;
      box-sizing: border-box;
      min-inline-size: 18px;
      block-size: 18px;
      padding-inline: 5px;
      border-radius: 999px;
      background: color-mix(in srgb, currentColor 14%, transparent);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    @media (pointer: coarse) {
      button {
        min-block-size: max(44px, var(--sw-chipc-h, 32px));
      }
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition-duration: 0ms;
      }
    }
  `;

  private get chips(): HTMLButtonElement[] {
    return [...(this.renderRoot?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
  }

  private press(o: ChipChoiceOption<V>) {
    if (this.disabled || o.disabled) return;
    const detail: ChipChoiceChange<V> = this.multi ? { value: o.value, pressed: !this.on(o) } : { value: o.value };
    this.dispatchEvent(new CustomEvent<ChipChoiceChange<V>>('change', { detail, bubbles: true, composed: true }));
  }

  private on(o: ChipChoiceOption<V>): boolean {
    return chipOn(o.value, this.value, this.multi, this.values);
  }

  private onKey(e: KeyboardEvent) {
    const chips = this.chips;
    const from = chips.indexOf(e.target as HTMLButtonElement);
    if (from < 0) return;
    const to = segmentedFocusStep(e.key, from, chips.map((c) => !c.disabled), getComputedStyle(this).direction === 'rtl');
    if (to < 0) return;
    e.preventDefault();
    chips[to].focus();
  }

  protected updated(changed: PropertyValues) {
    if (!changed.has('options')) return;
    const chips = this.chips;
    this.options.forEach((o, i) => {
      const c = chips[i];
      if (!c) return;
      const want = o.attrs ?? {};
      for (const a of [...c.attributes]) if (a.name.startsWith('data-') && !(a.name in want)) c.removeAttribute(a.name);
      for (const [name, v] of Object.entries(want)) if (c.getAttribute(name) !== v) c.setAttribute(name, v);
    });
  }

  render() {
    return html`<div class="row" part="row" role="group" aria-label=${this.label || nothing} @keydown=${this.onKey}>
      ${this.options.map((o) => {
        const on = this.on(o);
        return html`<button type="button" part=${on ? 'chip chip-on' : 'chip'} aria-pressed=${on ? 'true' : 'false'}
          ?disabled=${this.disabled || !!o.disabled} title=${o.title || nothing} @click=${() => this.press(o)}>${o.icon ? html`<span class="ic" part="icon" aria-hidden="true">${o.icon}</span>` : nothing}${o.label}${o.count !== undefined ? html`<small class="n" part="count">${o.count}</small>` : nothing}</button>`;
      })}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-chip-choice': SwChipChoice;
  }
}
