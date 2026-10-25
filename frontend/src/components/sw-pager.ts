import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import { pl } from '../i18n/polish';

/**
 * POLISH-295 `<sw-pager .page .pages>`: the pages of a long list on a control screen (owner rule 2026-10-24: control screens never
 * scroll; owner 2026-10-25: long lists use pages, as many rows per page as the installation's setting says). "‹ 2 / 5 ›": the
 * previous and next buttons and where we are. The chevrons follow the reading direction (sw-icon flips them in RTL). Draws nothing
 * for a single page. Fires `page-change` {page} (bubbles, composed); the screen owns the page number.
 */
@customElement('sw-pager')
export class SwPager extends LitElement {
  @property({ type: Number }) page = 1;
  @property({ type: Number }) pages = 1;

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-1);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    :host([hidden]) {
      display: none;
    }
    .at {
      min-inline-size: 3.5em;
      text-align: center;
      unicode-bidi: isolate;
      direction: ltr;
    }
    button {
      display: grid;
      place-items: center;
      inline-size: var(--sw-ctl-h-md);
      block-size: var(--sw-ctl-h-md);
      padding: 0;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      cursor: pointer;
      transition: background-color var(--sw-t-fast) ease, color var(--sw-t-fast) ease, transform var(--sw-t-fast) var(--sw-ease);
    }
    button:active:not(:disabled) {
      transform: scale(0.96);
    }
    button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    @media (hover: hover) and (pointer: fine) {
      button:hover:not(:disabled) {
        background: var(--sw-surface-3);
        color: var(--sw-text);
      }
    }
    @media (pointer: coarse) {
      button {
        inline-size: var(--sw-ctl-h-lg);
        block-size: var(--sw-ctl-h-lg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `;

  private go(page: number) {
    const p = Math.min(Math.max(1, page), this.pages);
    if (p === this.page) return;
    this.dispatchEvent(new CustomEvent('page-change', { detail: { page: p }, bubbles: true, composed: true }));
  }

  render() {
    if (this.pages <= 1) return nothing;
    const page = Math.min(Math.max(1, this.page), this.pages);
    return html`<nav role="navigation" aria-label=${pl('pages')} data-pager>
        <span style="display:inline-flex;align-items:center;gap:var(--sw-s-1)">
          <button type="button" data-pager-prev aria-label=${pl('prev')} title=${pl('prev')} ?disabled=${page <= 1} @click=${() => this.go(page - 1)}><sw-icon name="chevronBack" size=${16}></sw-icon></button>
          <span class="at" aria-live="polite" aria-label=${pl('pageOf', { n: page, m: this.pages })} data-pager-at>${page} / ${this.pages}</span>
          <button type="button" data-pager-next aria-label=${pl('next')} title=${pl('next')} ?disabled=${page >= this.pages} @click=${() => this.go(page + 1)}><sw-icon name="chevron" size=${16}></sw-icon></button>
        </span>
      </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-pager': SwPager;
  }
}
