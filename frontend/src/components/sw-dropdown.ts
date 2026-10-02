import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';

export interface DropdownItem {
  id: string;
  label: string;
  /** Shown as "(6)" in the option and, for the selected one, in the chip. */
  count?: number;
  /** A dot on the option, and on the chip while this option is not the selected one: `true` = alert (red), `'warn'` = attention (amber). */
  alert?: boolean | 'warn';
  /** Options with the same `group` are listed together under that heading (the floors of an area list). */
  group?: string;
  /** Where choosing it lands, for a list that navigates (a link target; the host handles it on `change`). */
  href?: string;
}

/**
 * A compact dropdown for choosing ONE of a list (0.1.153, the tabs presentation modes): a 32 px chip with a 44 px hit area and a
 * translucent popover with a real listbox - `aria-haspopup="listbox"` / `aria-expanded` / `aria-controls` on the chip,
 * `role="listbox"` + `aria-activedescendant` on the popover, `role="option"` / `aria-selected` on the options (44 px each), groups as
 * `role="group"`. Keys: Arrow Up/Down move (wrapping), Home / End jump, typeahead jumps to the next option starting with the typed
 * text, Enter / Space choose, Esc closes and returns focus to the chip, Tab closes; an outside press closes. The chip opens with
 * Arrow Down / Up, Enter, Space. The popover lives in the top layer (the popover API; a fixed box when it is missing), so a row that
 * scrolls or clips never cuts it, and it is anchored to the chip's inline edge, kept inside the viewport (RTL aware). Motion uses
 * the `--sw-t-*` tokens, which are 0 ms under prefers-reduced-motion. Fires `change` ({ id }) when the choice changes.
 */
@customElement('sw-dropdown')
export class SwDropdown extends LitElement {
  @property({ attribute: false }) items: DropdownItem[] = [];
  @property() value = '';
  /** The accessible name of the chip and the list. */
  @property() label = '';
  @property() icon?: IconName;
  @property() placeholder = '';
  @state() private open = false;
  @state() private cursor = -1;
  @state() private pos = { top: 0, left: 0, minWidth: 0, maxHeight: 320 };
  private seq = Math.random().toString(36).slice(2, 8);
  private typed = '';
  private typedTimer = 0;

  static styles = css`
    :host {
      display: inline-flex;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    .chip {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 32px;
      min-inline-size: 0;
      max-inline-size: 100%;
      padding-inline: 12px 8px;
      border: 1px solid var(--sw-dd-border, var(--sw-border-strong));
      border-radius: var(--sw-dd-radius, 10px);
      background: var(--sw-dd-bg, var(--sw-surface));
      color: var(--sw-dd-text, var(--sw-text));
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
      box-shadow: var(--sw-dd-shadow, var(--sw-shadow-1));
      transition: background var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    /* the 44 px target: the chip stays 32 px and the hit area grows into the row's padding (the shell's floating-button trick) */
    .chip::after {
      content: '';
      position: absolute;
      inset-inline: -4px;
      inset-block: -7px;
    }
    .chip:hover {
      background: var(--sw-dd-hover, var(--sw-surface-2));
    }
    .chip:focus-visible,
    .opt:focus-visible {
      outline: 2px solid var(--sw-focus, var(--sw-accent));
      outline-offset: 1px;
    }
    .chip[aria-expanded='true'] {
      border-color: var(--sw-dd-accent, var(--sw-accent));
    }
    .txt {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .n {
      font-weight: var(--sw-fw-medium);
      color: var(--sw-dd-text-3, var(--sw-text-3));
      font-size: var(--sw-fs-xs);
    }
    .chev {
      flex: none;
      display: inline-flex;
      color: var(--sw-dd-text-3, var(--sw-text-3));
      transition: transform var(--sw-t-fast) var(--sw-ease);
    }
    .chip[aria-expanded='true'] .chev {
      transform: rotate(180deg);
    }
    .dot {
      flex: none;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-danger);
    }
    .dot.warn {
      background: var(--sw-warning);
    }
    .chip .dot {
      position: absolute;
      inset-block-start: -2px;
      inset-inline-end: -2px;
      box-shadow: 0 0 0 2px var(--sw-dd-bg, var(--sw-surface));
    }
    .pop {
      position: fixed;
      inset: auto;
      margin: 0;
      padding: 4px;
      box-sizing: border-box;
      overflow: auto;
      border: 1px solid var(--sw-dd-border-soft, var(--sw-border));
      border-radius: 14px;
      color: var(--sw-dd-text, var(--sw-text));
      background: var(--sw-dd-pop-bg, var(--mm-sheet-surface, color-mix(in srgb, var(--sw-surface) 86%, transparent)));
      -webkit-backdrop-filter: blur(40px) saturate(1.8);
      backdrop-filter: blur(40px) saturate(1.8);
      box-shadow: var(--sw-shadow-3);
      outline: none;
      opacity: 1;
      transition: opacity var(--sw-t-fast) var(--sw-ease);
    }
    .pop[hidden] {
      display: none;
    }
    .opt {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 44px;
      padding-inline: 12px;
      border-radius: 10px;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      user-select: none;
    }
    .opt .lbl {
      flex: 1;
      min-inline-size: 0;
    }
    .opt[data-active] {
      background: var(--sw-dd-active, var(--sw-surface-3));
    }
    .opt[aria-selected='true'] {
      color: var(--sw-dd-accent, var(--sw-accent-text, var(--sw-accent)));
      font-weight: var(--sw-fw-semibold);
    }
    .grp {
      padding: 8px 12px 2px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-dd-text-3, var(--sw-text-3));
      font-weight: var(--sw-fw-semibold);
    }
    @media (forced-colors: active) {
      .opt[aria-selected='true'] {
        outline: 2px solid Highlight;
      }
    }
  `;

  private onOutside = (e: Event) => {
    if (this.open && !e.composedPath().includes(this)) this.close(false);
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('pointerdown', this.onOutside, true);
  }

  disconnectedCallback() {
    document.removeEventListener('pointerdown', this.onOutside, true);
    window.clearTimeout(this.typedTimer);
    super.disconnectedCallback();
  }

  /** True when an option other than the selected one carries an alert (the chip's dot). */
  private get hiddenAlert(): false | 'alert' | 'warn' {
    let warn = false;
    for (const it of this.items) {
      if (it.id === this.value || !it.alert) continue;
      if (it.alert === true) return 'alert';
      warn = true;
    }
    return warn ? 'warn' : false;
  }

  private get selected(): DropdownItem | undefined {
    return this.items.find((i) => i.id === this.value);
  }

  private popEl(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.pop');
  }

  private chipEl(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.chip');
  }

  private place() {
    const chip = this.chipEl();
    if (!chip) return;
    const r = chip.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const pad = 8;
    const rtl = getComputedStyle(this).direction === 'rtl';
    const minWidth = Math.min(Math.max(r.width, 200), vw - pad * 2);
    // anchored to the chip's inline-start edge (the right edge in RTL), then kept inside the viewport
    let left = rtl ? r.right - minWidth : r.left;
    left = Math.max(pad, Math.min(left, vw - pad - minWidth));
    const below = vh - r.bottom - pad - 4;
    const above = r.top - pad - 4;
    const flip = below < 220 && above > below;
    const maxHeight = Math.max(160, Math.min(flip ? above : below, 360));
    this.pos = { top: flip ? Math.max(pad, r.top - 4 - Math.min(maxHeight, this.items.length * 44 + 16 + 40)) : r.bottom + 4, left, minWidth, maxHeight };
  }

  private async openList(cursor?: number) {
    if (this.open || !this.items.length) return;
    this.place();
    this.open = true;
    const sel = this.items.findIndex((i) => i.id === this.value);
    this.cursor = cursor ?? (sel >= 0 ? sel : 0);
    await this.updateComplete;
    const pop = this.popEl();
    if (pop) {
      try {
        (pop as HTMLElement & { showPopover?: () => void }).showPopover?.();
      } catch {
        /* already showing, or no popover API: the element is then a plain fixed box */
      }
      pop.focus({ preventScroll: true });
      this.scrollToCursor();
    }
  }

  private close(refocus: boolean) {
    if (!this.open) return;
    const pop = this.popEl();
    try {
      (pop as (HTMLElement & { hidePopover?: () => void }) | null)?.hidePopover?.();
    } catch {
      /* not showing */
    }
    this.open = false;
    window.clearTimeout(this.typedTimer);
    this.typed = '';
    if (refocus) void this.updateComplete.then(() => this.chipEl()?.focus({ preventScroll: true }));
  }

  private choose(i: number) {
    const it = this.items[i];
    if (!it) return;
    const changed = it.id !== this.value;
    this.value = it.id;
    this.close(true);
    if (changed) this.dispatchEvent(new CustomEvent('change', { detail: { id: it.id }, bubbles: true, composed: true }));
  }

  private move(to: number) {
    const n = this.items.length;
    if (!n) return;
    this.cursor = ((to % n) + n) % n;
    this.scrollToCursor();
  }

  private scrollToCursor() {
    void this.updateComplete.then(() => this.renderRoot.querySelector<HTMLElement>('.opt[data-active]')?.scrollIntoView({ block: 'nearest' }));
  }

  private onChipKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void this.openList();
    } else if (e.key === 'Escape' && this.open) {
      this.close(true);
    }
  }

  private onListKey(e: KeyboardEvent) {
    const k = e.key;
    if (k === 'ArrowDown') {
      e.preventDefault();
      this.move(this.cursor + 1);
    } else if (k === 'ArrowUp') {
      e.preventDefault();
      this.move(this.cursor - 1);
    } else if (k === 'Home') {
      e.preventDefault();
      this.move(0);
    } else if (k === 'End') {
      e.preventDefault();
      this.move(this.items.length - 1);
    } else if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      this.choose(this.cursor);
    } else if (k === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close(true);
    } else if (k === 'Tab') {
      this.close(false);
    } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // typeahead: the typed text so far (reset after 600 ms); the same letter again cycles through the options starting with it
      e.preventDefault();
      window.clearTimeout(this.typedTimer);
      this.typed += k.toLocaleLowerCase();
      this.typedTimer = window.setTimeout(() => (this.typed = ''), 600);
      const n = this.items.length;
      const cycle = this.typed.length > 1 && [...this.typed].every((c) => c === this.typed[0]);
      const needle = cycle ? this.typed[0] : this.typed;
      const from = cycle || this.typed.length === 1 ? this.cursor + 1 : this.cursor;
      for (let o = 0; o < n; o++) {
        const idx = (from + o) % n;
        if (this.items[idx].label.toLocaleLowerCase().startsWith(needle)) {
          this.move(idx);
          break;
        }
      }
    }
  }

  private optionId(i: number) {
    return `o-${this.seq}-${i}`;
  }

  private renderItems() {
    const out: unknown[] = [];
    let lastGroup: string | undefined;
    this.items.forEach((it, i) => {
      if (it.group && it.group !== lastGroup) out.push(html`<div class="grp" role="presentation" aria-hidden="true">${it.group}</div>`);
      lastGroup = it.group;
      out.push(html`<div class="opt" role="option" id=${this.optionId(i)} data-id=${it.id} aria-selected=${String(it.id === this.value)} ?data-active=${i === this.cursor}
        @click=${() => this.choose(i)} @pointermove=${() => (this.cursor = i)}>
        <span class="lbl">${it.label}</span>${it.count !== undefined ? html`<span class="n">(${it.count})</span>` : nothing}${it.alert ? html`<span class="dot ${it.alert === 'warn' ? 'warn' : ''}" data-alert="${it.alert === 'warn' ? 'warn' : 'alert'}"></span>` : nothing}
      </div>`);
    });
    return out;
  }

  protected updated(changed: Map<string, unknown>) {
    if (this.open && (changed.has('pos') || changed.has('open'))) {
      const pop = this.popEl();
      if (pop) pop.style.cssText = `top:${this.pos.top}px;left:${this.pos.left}px;min-inline-size:${this.pos.minWidth}px;max-block-size:${this.pos.maxHeight}px;`;
    }
  }

  render() {
    const sel = this.selected;
    const alert = this.hiddenAlert;
    const name = sel ? `${sel.label}${sel.count !== undefined ? ` (${sel.count})` : ''}` : this.placeholder;
    const aria = `${[this.label, name].filter(Boolean).join(': ')}${alert ? ', יש התראות באפשרויות אחרות' : ''}`;
    const listId = `l-${this.seq}`;
    return html`<button type="button" class="chip" data-dropdown-chip aria-haspopup="listbox" aria-expanded=${String(this.open)} aria-controls=${listId} aria-label=${aria}
        @click=${() => (this.open ? this.close(true) : void this.openList())} @keydown=${(e: KeyboardEvent) => this.onChipKey(e)}>
        ${this.icon ? html`<sw-icon .name=${this.icon} size=${15}></sw-icon>` : nothing}
        <span class="txt">${sel?.label ?? this.placeholder}</span>${sel?.count !== undefined ? html`<span class="n">(${sel.count})</span>` : nothing}
        <span class="chev" aria-hidden="true"><sw-icon name="chevronDown" size=${12}></sw-icon></span>
        ${alert ? html`<span class="dot ${alert === 'warn' ? 'warn' : ''}" data-chip-alert=${alert}></span>` : nothing}
      </button>
      <div class="pop" id=${listId} popover="manual" role="listbox" tabindex="-1" aria-label=${this.label || nothing} aria-activedescendant=${this.cursor >= 0 ? this.optionId(this.cursor) : nothing}
        ?hidden=${!this.open} @keydown=${(e: KeyboardEvent) => this.onListKey(e)}>${this.open ? this.renderItems() : nothing}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-dropdown': SwDropdown;
  }
}
