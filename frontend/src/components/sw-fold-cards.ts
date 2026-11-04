import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';

/** One card of the list: its id (the body is the light-DOM child with `slot="b-<id>"`), its title and its one-line summary. */
export interface FoldCard {
  id: string;
  title: string;
  summary: string;
  /** not drawn for this viewer (its header and its body stay out of the layout; the body stays in the DOM) */
  hidden?: boolean;
}

/** From this width of the list the open card stands beside the headers; narrower, it unfolds under its own header. */
export const FOLD_WIDE_MIN = 820;
/** What stays free under the open card of a wide list: the page's bottom padding and a little air. */
export const FOLD_BOTTOM_RESERVE = 32;

/**
 * SETTINGS-INTERCOM-CARDS-2401 (owner 04.11, round 19 Q6 = a): collapsible cards, ONE open at a time. Each card's header is a button with
 * the title and a one-line summary of its current values; the open card's content is the light-DOM child `slot="b-<id>"` (the host draws
 * it, so it keeps the host's styles, drafts and data attributes; a closed card's body only carries `hidden`, so its component stays
 * mounted and keeps an unsaved draft).
 *
 * Two arrangements of the same DOM, by the list's own width (a container measure, not the window's):
 *   - wide (>= 820 px): the headers form a column at the start side and the open card stands beside them, from the top - the headers'
 *     column and the open card each fit the screen, which a stack of headers with a card unfolded between them cannot at 1366x768;
 *   - narrow (a phone, a tablet): the headers stack, the open card unfolds under its header; tapping it again folds it.
 * On a wide list the open card is given the height left in the window (`--fold-room`); a card naturally longer than that scrolls inside
 * itself (`data-fold-scroll` on the body) and never the page.
 *
 * Events: `fold-toggle` {id} when a header is pressed (the host decides what is open), `fold-wide` {wide} when the arrangement changes.
 */
@customElement('sw-fold-cards')
export class SwFoldCards extends LitElement {
  @property({ attribute: false }) cards: FoldCard[] = [];
  /** the open card's id; '' = none */
  @property() open = '';
  /** the list's accessible name */
  @property() label = '';
  @state() private wide = true;

  private ro: ResizeObserver | null = null;
  private watched: Element | null = null;
  private frame = 0;
  private readonly onResize = () => this.schedule();

  private schedule(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.measure();
    });
  }

  static styles = css`
    :host {
      display: block;
      container-type: inline-size;
      min-inline-size: 0;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
    }
    .list.wide {
      display: grid;
      grid-template-columns: minmax(232px, 280px) minmax(0, 1fr);
      grid-template-rows: repeat(var(--fold-n, 1), auto) 1fr;
      column-gap: var(--sw-s-4, 16px);
      row-gap: 3px;
      align-items: start;
    }
    .list.wide .head {
      grid-column: 1;
    }
    .list.wide ::slotted(:not([hidden])) {
      grid-column: 2;
      grid-row: 1 / span var(--fold-span, 2);
      max-block-size: var(--fold-room, none);
      min-block-size: 0;
    }
    ::slotted([hidden]) {
      display: none !important;
    }
    ::slotted([data-fold-scroll]) {
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
    }
    ::slotted(:not([hidden])) {
      min-inline-size: 0;
      animation: fold-in 180ms cubic-bezier(0.23, 1, 0.32, 1);
    }
    @keyframes fold-in {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
    }
    /* a header: the title over the summary line, the chevron at the end; a 44 px target at least */
    .head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: 't i' 's i';
      align-items: center;
      column-gap: 10px;
      row-gap: 0;
      inline-size: 100%;
      min-inline-size: 0;
      min-block-size: 44px;
      box-sizing: border-box;
      padding: 4px 12px;
      margin: 0;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-card-bg, var(--sw-surface));
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
      transition:
        transform var(--sw-t-press, 120ms) var(--sw-ease, ease-out),
        background-color var(--sw-t-hover, 150ms) var(--sw-ease-color, ease),
        border-color var(--sw-t-hover, 150ms) var(--sw-ease-color, ease);
    }
    .head[hidden] {
      display: none;
    }
    .head:active {
      transform: scale(var(--sw-press-scale, 0.98));
    }
    .head:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus, var(--sw-accent));
      outline-offset: 2px;
    }
    @media (hover: hover) and (pointer: fine) {
      .head:hover {
        border-color: var(--sw-border-strong);
      }
    }
    .t {
      grid-area: t;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--sw-fs-md);
      line-height: 1.35;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    .s {
      grid-area: s;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--sw-fs-xs);
      line-height: 1.35;
      color: var(--sw-text-3);
    }
    .head sw-icon {
      grid-area: i;
      color: var(--sw-text-3);
      transition: transform var(--sw-t-fast, 150ms) var(--sw-ease, ease-out);
    }
    .head[aria-expanded='true'] {
      border-color: color-mix(in srgb, var(--sw-accent) 45%, var(--sw-border));
      background: var(--sw-accent-soft);
    }
    .head[aria-expanded='true'] .t {
      color: var(--sw-accent-text, var(--sw-accent));
    }
    .head[aria-expanded='true'] .s {
      color: var(--sw-text-2);
    }
    /* narrow: the chevron says fold / unfold; wide: the open card stands beside its header, so the chevron is not drawn */
    .head[aria-expanded='true'] sw-icon {
      transform: rotate(180deg);
    }
    .list.wide .head sw-icon {
      display: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .head,
      .head sw-icon {
        transition-duration: 0ms;
      }
      ::slotted(:not([hidden])) {
        animation-name: fold-fade;
      }
      @keyframes fold-fade {
        from {
          opacity: 0;
        }
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('resize', this.onResize);
    if (typeof ResizeObserver === 'function') {
      // measured in the next frame, never inside the observer's own callback (no "ResizeObserver loop" error when the room changes)
      this.ro = new ResizeObserver(() => this.schedule());
      this.ro.observe(this);
    }
  }

  disconnectedCallback(): void {
    window.removeEventListener('resize', this.onResize);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.ro?.disconnect();
    this.ro = null;
    this.watched = null;
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('open') || changed.has('cards') || changed.has('wide')) this.measure();
  }

  private openBody(): HTMLElement | null {
    return this.open ? this.querySelector<HTMLElement>(`:scope > [slot="b-${CSS.escape(this.open)}"]`) : null;
  }

  /** The arrangement (by the list's width), the room the open card gets on a wide list, and whether it must scroll inside. */
  private measure(): void {
    const width = this.getBoundingClientRect().width;
    const wide = width >= FOLD_WIDE_MIN;
    if (width > 0 && wide !== this.wide) {
      this.wide = wide;
      this.dispatchEvent(new CustomEvent('fold-wide', { detail: { wide }, bubbles: true, composed: true }));
      return; // updated() measures again with the new arrangement
    }
    const body = this.openBody();
    const child = body?.firstElementChild ?? null;
    if (this.ro && child !== this.watched) {
      if (this.watched) this.ro.unobserve(this.watched);
      if (child) this.ro.observe(child);
      this.watched = child;
    }
    if (!this.wide) {
      this.style.removeProperty('--fold-room');
      body?.removeAttribute('data-fold-scroll');
      return;
    }
    // the page's own bottom padding (sw-page: 24 px) and a little air stay below the open card
    const room = Math.max(240, Math.floor(window.innerHeight - this.getBoundingClientRect().top - FOLD_BOTTOM_RESERVE));
    this.style.setProperty('--fold-room', `${room}px`);
    if (!body) return;
    // measured without the inner scroll first, so a card that shrank gives the scroll back
    body.removeAttribute('data-fold-scroll');
    if (body.scrollHeight > body.clientHeight + 1) body.setAttribute('data-fold-scroll', '');
  }

  private press(id: string): void {
    this.dispatchEvent(new CustomEvent('fold-toggle', { detail: { id }, bubbles: true, composed: true }));
  }

  render() {
    const shown = this.cards.filter((c) => !c.hidden).length;
    return html`<div class="list ${this.wide ? 'wide' : ''}" role="group" aria-label=${this.label || nothing} data-fold-wide=${String(this.wide)}
        style=${`--fold-n:${Math.max(1, shown)};--fold-span:${shown + 1}`}>
      ${this.cards.map(
        (c) => html`<button type="button" class="head" ?hidden=${!!c.hidden} aria-expanded=${String(c.id === this.open)} data-fold-toggle=${c.id} title=${c.summary || nothing}
            @click=${() => this.press(c.id)}>
            <span class="t">${c.title}</span>
            <span class="s" data-fold-summary=${c.id}>${c.summary || ' '}</span>
            <sw-icon name="chevronDown" size=${14}></sw-icon>
          </button>
          <slot name=${`b-${c.id}`}></slot>`,
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-fold-cards': SwFoldCards;
  }
}
