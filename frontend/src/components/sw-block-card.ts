import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { icon } from '../screens/automation-builder-icons';
import { editorShared } from '../screens/automation-editor-css';

export interface BlockChip { tone: 'sens' | 'lock' | 'bad' | 'warn' | 'acc' | 'code' | 'why'; text: string; icon?: string; title?: string }

/**
 * CR-017 S4: one block of the builder (a trigger, a condition or a step): a card with the block's own Hebrew sentence, its chips and, when
 * open, the form slotted into it. Presentational: the editor owns the state and renders the form into the default slot.
 *
 *   .icon .heading .chips .open .locked .invalid .nested .readonly .canUp .canDown
 *   card-toggle           the header was pressed
 *   card-remove           the ✕ was pressed
 *   card-move {delta}     Alt + ArrowUp / ArrowDown on the header, or the up / down buttons of the open card
 *   card-duplicate        the duplicate button of the open card
 *   card-dragstart        the grip started a drag (the editor's list handles the drop)
 *
 * A locked block (CR §4.2.3) is drawn hatched and dashed: it can be moved, duplicated and deleted, never edited here.
 */
@customElement('sw-block-card')
export class SwBlockCard extends LitElement {
  @property() icon = 'bolt';
  @property() heading = '';
  @property({ attribute: false }) chips: BlockChip[] = [];
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean, reflect: true }) locked = false;
  @property({ type: Boolean, reflect: true }) invalid = false;
  @property({ type: Boolean, reflect: true }) nested = false;
  @property({ type: Boolean, reflect: true }) readonly = false;
  @property({ type: Boolean }) canUp = false;
  @property({ type: Boolean }) canDown = false;
  @property({ type: Boolean }) canDuplicate = true;
  @property() uid = '';

  static styles = [
    editorShared,
    css`
      :host {
        display: block;
      }
      .blk {
        position: relative;
        display: flex;
        flex-direction: column;
        border-radius: var(--dv-radius-sm, 14px);
        background: var(--dv-surface-2);
        border: 1px solid var(--dv-border);
        transition: border-color var(--ab-motion, 200ms), box-shadow var(--ab-motion, 200ms);
      }
      :host([open]) .blk {
        border-color: color-mix(in srgb, var(--dv-accent) 50%, transparent);
        box-shadow: 0 0 0 4px var(--dv-accent-soft);
        background: var(--dv-surface-solid, var(--dv-surface));
      }
      :host([locked]) .blk {
        background: repeating-linear-gradient(135deg, transparent 0 10px, rgba(120, 120, 128, 0.07) 10px 20px), var(--dv-surface-2);
        border-style: dashed;
        border-color: var(--dv-border-strong);
      }
      :host([invalid]) .blk {
        border-color: color-mix(in srgb, var(--dv-danger) 45%, transparent);
      }
      :host([nested]) .blk {
        margin-inline-start: 22px;
      }
      .bh {
        display: flex;
        align-items: center;
        gap: 6px;
        padding-inline: 8px 6px;
        min-block-size: 54px;
      }
      .grip {
        display: grid;
        place-items: center;
        inline-size: 26px;
        block-size: 40px;
        color: var(--dv-text-3);
        font-size: 16px;
        cursor: grab;
        flex: none;
        border: 0;
        background: transparent;
        padding: 0;
      }
      :host([readonly]) .grip,
      :host([readonly]) .xb {
        display: none;
      }
      .bm {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        border: 0;
        background: transparent;
        padding: 6px 0;
        text-align: start;
        border-radius: 12px;
        min-block-size: 44px;
      }
      .rg {
        display: grid;
        place-items: center;
        inline-size: 34px;
        block-size: 34px;
        border-radius: 50%;
        background: var(--dv-icon-ring-bg);
        color: var(--dv-icon-ring-fg);
        font-size: 16px;
        flex: none;
      }
      :host([locked]) .rg {
        background: var(--dv-surface-3);
        color: var(--dv-text-2);
      }
      .bt {
        flex: 1;
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
        line-height: 1.35;
      }
      .bt b {
        font-size: 14px;
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      .sub {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        align-items: center;
      }
      .xb {
        inline-size: 40px;
        block-size: 40px;
        border-radius: 50%;
        border: 0;
        background: transparent;
        display: grid;
        place-items: center;
        color: var(--dv-text-3);
        flex: none;
        font-size: 16px;
      }
      .xb:hover {
        background: var(--dv-surface-3);
        color: var(--dv-danger);
      }
      .body {
        display: none;
        border-top: 1px solid var(--dv-border);
        padding: 12px 14px 14px;
        flex-direction: column;
        gap: 12px;
      }
      :host([open]) .body {
        display: flex;
        animation: pop 180ms var(--ab-ease, ease);
      }
      .tools {
        display: flex;
        gap: 6px;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
      .tools button {
        inline-size: 36px;
        block-size: 36px;
        border-radius: 50%;
        border: 1px solid var(--dv-border);
        background: transparent;
        display: grid;
        place-items: center;
        color: var(--dv-text-2);
        font-size: 15px;
      }
      .tools button:hover:not(:disabled) {
        background: var(--dv-surface-3);
        color: var(--dv-text);
      }
      .tools button:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
      @keyframes pop {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
      }
      @media (max-width: 767px) {
        .bh {
          min-block-size: 58px;
        }
        .tools button {
          inline-size: 44px;
          block-size: 44px;
        }
        :host([nested]) .blk {
          margin-inline-start: 12px;
        }
      }
    `,
  ];

  private fire(name: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private onKey(e: KeyboardEvent) {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || this.readonly) return;
    e.preventDefault();
    const delta = e.key === 'ArrowUp' ? -1 : 1;
    if ((delta < 0 && this.canUp) || (delta > 0 && this.canDown)) this.fire('card-move', { delta, from: 'key' });
  }

  private onDragStart(e: DragEvent) {
    if (this.readonly) return;
    const host = this.shadowRoot?.querySelector('.blk');
    e.dataTransfer?.setData('text/plain', this.uid);
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; if (host) e.dataTransfer.setDragImage(host, 20, 24); }
    this.fire('card-dragstart', { uid: this.uid });
  }

  render() {
    return html`<div class="blk">
      <div class="bh">
        <button class="grip" type="button" draggable="true" tabindex="-1" aria-label="גרירה" title="גרירה (Alt + חצים להזזה)" @dragstart=${this.onDragStart}>${icon('grip')}</button>
        <button class="bm" type="button" aria-expanded=${this.open} data-block-main @click=${() => this.fire('card-toggle')} @keydown=${this.onKey}>
          <span class="rg">${icon(this.icon)}</span>
          <span class="bt"><b dir="auto">${this.heading}</b>${this.chips.length ? html`<span class="sub">${this.chips.map((c) => this.chip(c))}</span>` : nothing}</span>
        </button>
        <button class="xb" type="button" aria-label="מחיקת החלק" data-block-remove @click=${() => this.fire('card-remove')}>${icon('close')}</button>
      </div>
      ${this.open ? html`<div class="body">
        ${this.readonly ? nothing : html`<div class="tools">
          <button type="button" aria-label="הזז למעלה" data-block-up ?disabled=${!this.canUp} @click=${() => this.fire('card-move', { delta: -1, from: 'button' })}>${icon('arrowUp')}</button>
          <button type="button" aria-label="הזז למטה" data-block-down ?disabled=${!this.canDown} @click=${() => this.fire('card-move', { delta: 1, from: 'button' })}>${icon('arrowDown')}</button>
          ${this.canDuplicate ? html`<button type="button" aria-label="שכפול" data-block-dup @click=${() => this.fire('card-duplicate')}>${icon('copy')}</button>` : nothing}
        </div>`}
        <slot></slot>
      </div>` : nothing}
    </div>`;
  }

  private chip(c: BlockChip) {
    if (c.tone === 'code') return html`<code title=${c.title ?? ''}>${c.text}</code>`;
    return html`<span class="tag ${c.tone === 'why' ? 'lock' : c.tone}" title=${c.title ?? ''}>${c.icon ? icon(c.icon) : nothing}${c.text}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-block-card': SwBlockCard;
  }
}
