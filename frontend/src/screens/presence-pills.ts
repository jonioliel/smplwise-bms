import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { CompactRoom } from '../api/building-presence-logic';
import { BP } from '../i18n/building-presence';

/**
 * PRESENCE-COMPACT-2310 `<presence-pills>`: the compact card's row of room pills (round-9 mockup, direction A). As many WHOLE pills as fit in
 * `rows` lines - never a cut pill, never a third line (the home never scrolls) - and an honest "+N" for the active rooms that did not fit.
 * The pills are hidden from the end until the row fits, again whenever the card changes width. Grey (empty) and dashed (unknown) pills come
 * after the active ones and simply drop when there is no room for them (they are on the map and in the area window).
 */
@customElement('presence-pills')
export class PresencePills extends LitElement {
  @property({ attribute: false }) rooms: CompactRoom[] = [];
  /** All active rooms (the list may be cut short for speed: the "+N" still counts them all). */
  @property({ type: Number }) activeTotal = 0;
  @property({ type: Number, reflect: true }) rows = 1;

  private ro: ResizeObserver | null = null;
  private lastW = -1;

  static styles = css`
    :host { display: block; min-inline-size: 0; }
    .box { display: flex; flex-wrap: nowrap; gap: 6px; min-inline-size: 0; overflow: hidden; }
    :host([rows='2']) .box { flex-wrap: wrap; max-block-size: calc(24px * 2 + 6px); }
    .r {
      display: inline-flex; align-items: center; gap: 5px; flex: none; min-inline-size: 0; max-inline-size: min(150px, 100%); box-sizing: border-box; block-size: 24px;
      padding-inline: 9px; border-radius: var(--sw-r-pill, 999px); background: var(--sw-success-soft); color: var(--sw-success-text);
      font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium, 500); line-height: 1; white-space: nowrap;
    }
    .r[hidden] { display: none; }
    .r::before { content: ''; inline-size: 6px; block-size: 6px; border-radius: 50%; flex: none; background: var(--sw-success); }
    .r bdi { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; }
    .r[data-tone='neutral'] { background: var(--sw-surface-3); color: var(--sw-text-2); }
    .r[data-tone='neutral']::before { background: var(--sw-unknown); }
    .r[data-tone='unknown'] { background: transparent; color: var(--sw-text-3); box-shadow: inset 0 0 0 1px var(--sw-border-strong, var(--sw-border)); }
    .r[data-tone='unknown']::before { background: transparent; box-shadow: inset 0 0 0 1.5px var(--sw-unknown); }
    .r.more { background: var(--sw-surface-3); color: var(--sw-text-2); font-weight: var(--sw-fw-semibold); }
    .r.more::before { display: none; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (w !== this.lastW) {
        this.lastW = w;
        this.fit();
      }
    });
    this.ro.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.ro?.disconnect();
    this.ro = null;
  }

  protected updated(_c: PropertyValues) {
    this.fit();
  }

  /** Hide pills from the end until the box fits; the "+N" counts the active rooms not shown. */
  private fit() {
    const box = this.renderRoot.querySelector<HTMLElement>('.box');
    const more = this.renderRoot.querySelector<HTMLElement>('.more');
    if (!box || !more) return;
    const pills = [...box.querySelectorAll<HTMLElement>('.r:not(.more)')];
    pills.forEach((p) => (p.hidden = false));
    const shownActive = () => pills.filter((p) => !p.hidden && p.dataset.tone === 'ok').length;
    const update = () => {
      const n = Math.max(0, this.activeTotal - shownActive());
      more.hidden = n <= 0;
      more.textContent = BP.plus(n);
    };
    update();
    if (!box.clientWidth) return; // not laid out yet (a hidden card): the observer fits it once it has a size
    const over = () => box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1;
    for (let i = pills.length - 1; i >= 0 && over(); i--) {
      pills[i].hidden = true;
      update();
    }
  }

  render() {
    if (!this.rooms.length && !this.activeTotal) return nothing;
    return html`<div class="box" data-building-rooms>${this.rooms.map(
      (r) => html`<span class="r" data-tone=${r.tone} title=${r.title}><bdi>${r.name}</bdi></span>`,
    )}<span class="r more" data-building-more-rooms hidden></span></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'presence-pills': PresencePills;
  }
}
