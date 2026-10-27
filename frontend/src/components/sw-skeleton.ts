import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * POLISH-CLASSIC-DOMUS-297 second pass: the shared loading placeholder (impeccable harden, taste-skill "loading = a skeleton of the
 * real layout", ui-ux-pro-max "stable skeleton with aria-busy"). It draws the SHAPE of what is coming so nothing jumps when the data
 * lands; it is decoration only (aria-hidden) - the region that waits sets aria-busy="true" itself.
 *
 *   <sw-skeleton></sw-skeleton>                       one text line, full width
 *   <sw-skeleton lines="3"></sw-skeleton>             a paragraph; the last line is shorter
 *   <sw-skeleton variant="block" height="120px"></sw-skeleton>   a card / image / chart area
 *   <sw-skeleton variant="circle" size="32px"></sw-skeleton>     an avatar / icon
 *
 * Colours are the --sw-skeleton / --sw-skeleton-shine tokens (every skin); the shimmer stops under reduced motion (the block stays).
 */
@customElement('sw-skeleton')
export class SwSkeleton extends LitElement {
  @property({ reflect: true }) variant: 'text' | 'block' | 'circle' = 'text';
  @property({ type: Number }) lines = 1;
  /** text / block: the width (any CSS length); circle: ignored. */
  @property() width = '100%';
  /** block: the height (any CSS length). */
  @property() height = '';
  /** circle: the diameter. */
  @property() size = '32px';

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-inline-size: 0;
    }
    .b {
      position: relative;
      overflow: hidden;
      background: var(--sw-skeleton);
      border-radius: var(--sw-r-xs);
    }
    .b::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(100%);
      background: linear-gradient(90deg, transparent, var(--sw-skeleton-shine), transparent);
      animation: shine 1.4s ease-in-out infinite;
    }
    :host([variant='text']) .b {
      block-size: 0.8em;
      font-size: var(--sw-fs-md);
    }
    :host([variant='circle']) .b {
      border-radius: 50%;
      flex: none;
    }
    :host([variant='block']) .b {
      border-radius: var(--sw-r-md);
    }
    @keyframes shine {
      to {
        transform: translateX(-100%);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .b::after {
        animation: none;
        opacity: 0;
      }
    }
  `;

  render() {
    if (this.variant === 'circle') return html`<div class="b" aria-hidden="true" style="inline-size:${this.size};block-size:${this.size}"></div>`;
    if (this.variant === 'block') return html`<div class="b" aria-hidden="true" style="inline-size:${this.width};block-size:${this.height || '96px'}"></div>`;
    const n = Math.max(1, Math.min(12, Math.floor(this.lines) || 1));
    return html`${Array.from({ length: n }, (_, i) =>
      html`<div class="b" aria-hidden="true" style="inline-size:${n > 1 && i === n - 1 ? '62%' : this.width}"></div>`,
    )}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-skeleton': SwSkeleton;
  }
}
