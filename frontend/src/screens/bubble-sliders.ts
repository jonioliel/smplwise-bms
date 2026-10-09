import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../components/sw-pill';
import '../components/sw-vslider';
import type { IconName } from '../components/sw-icon';
import { LookController } from '../design/look';

/** One slider of a device sheet (brightness, fan speed, a cover's position or tilt). */
export interface SheetSlider {
  key: string;
  icon: IconName;
  label: string;
  /** The state line of the pill / the value line of the vertical slider ("72%", "כבוי", "60% · טרם נשלח"). */
  state: string;
  value: number;
  on: boolean;
  fillColor?: string;
  keepText?: boolean;
  unavailable?: boolean;
  onToggle?: (on: boolean) => void;
  onInput?: (value: number) => void;
  onChange?: (value: number) => void;
  /** Sub-buttons of the pill (a cover's "לאשר N%?" chip); drawn under the vertical sliders as a row. */
  subs?: TemplateResult | typeof nothing;
}

/**
 * BV1 (2026-10-05): the sliders of a device sheet, drawn by the `slider` look dial - as slider pills (`horizontal`, today's rows)
 * or as tall vertical sliders side by side (`vertical`, `<sw-vslider>`), with the same commands. The element owns the
 * LookController, so the sheet re-draws on a dial change without its host knowing about dials.
 */
@customElement('bubble-sliders')
export class BubbleSliders extends LitElement {
  @property({ attribute: false }) items: SheetSlider[] = [];
  private look = new LookController(this);

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-inline-size: 0;
    }
    :host([data-orientation='vertical']) .vrow {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: flex-end;
      gap: 12px;
      padding: 4px 0;
    }
    .subs {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
    }
    .subs:empty {
      display: none;
    }
    sw-pill,
    sw-vslider {
      --pill-base: var(--sw-layer);
    }
    /* the confirm chip a cover's slider carries (the same chip as devices-area-bubble's; it is rendered here, so it is styled here) */
    ::slotted(.chip),
    .chip {
      block-size: var(--sw-sub-size, var(--sw-sub));
      min-block-size: var(--sw-touch-desktop);
      min-inline-size: var(--sw-touch-desktop);
      box-sizing: border-box;
      justify-content: center;
      padding: 0 12px;
      border: 0;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .chip.armed {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .chip:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 2px;
    }
    @media (max-width: 1100px) {
      .chip {
        min-block-size: 44px;
        min-inline-size: 44px;
      }
    }
  `;

  protected updated() {
    this.setAttribute('data-orientation', this.look.of('slider'));
  }

  render() {
    if (!this.items.length) return nothing;
    if (this.look.of('slider') === 'vertical') {
      const subs = this.items.map((it) => it.subs).filter((s) => s && s !== nothing);
      return html`<div class="vrow" data-bubble-vsliders>
          ${this.items.map(
            (it) => html`<sw-vslider .icon=${it.icon} .label=${it.label} .state=${it.state} .value=${Math.max(0, Math.min(1, it.value))} ?on=${it.on} fill-color=${it.fillColor ?? ''} ?unavailable=${!!it.unavailable} ?readonly=${!it.onInput && !it.onChange && !it.onToggle}
              data-control=${it.key} data-vslider=${it.key}
              @toggle=${(e: CustomEvent<{ on: boolean }>) => it.onToggle?.(e.detail.on)}
              @input=${(e: CustomEvent<{ value: number }>) => it.onInput?.(e.detail.value)}
              @change=${(e: CustomEvent<{ value: number }>) => it.onChange?.(e.detail.value)}></sw-vslider>`,
          )}
        </div>
        ${subs.length ? html`<div class="subs">${subs}</div>` : nothing}`;
    }
    return html`${this.items.map(
      (it) => html`<sw-pill variant="slider" .icon=${it.icon} .label=${it.label} .state=${it.state} .value=${Math.max(0, Math.min(1, it.value))} ?on=${it.on} fill-color=${it.fillColor ?? ''} ?keep-text=${!!it.keepText} ?unavailable=${!!it.unavailable} data-control=${it.key}
        @toggle=${(e: CustomEvent<{ on: boolean }>) => it.onToggle?.(e.detail.on)}
        @input=${(e: CustomEvent<{ value: number }>) => it.onInput?.(e.detail.value)}
        @change=${(e: CustomEvent<{ value: number }>) => it.onChange?.(e.detail.value)}>${it.subs ?? nothing}</sw-pill>`,
    )}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'bubble-sliders': BubbleSliders;
  }
}
