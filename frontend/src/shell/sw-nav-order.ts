import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-dialog';
import '../components/sw-button';
import '../components/sw-icon';
import type { AreaEntry } from './nav';
import { describeError } from '../api/client';

/**
 * CR-013 "סדר הלשוניות": the user's visible navigation tabs as a vertical list - drag a row by its handle (mouse and
 * touch, pointer events), or move it with the ▲/▼ buttons or the arrow keys on the handle. "שמור" stores the order for
 * the user on the server (every device), "אפס לברירת המחדל" forgets it. Tabs the user does not see keep their place in
 * the stored order. The user avatar is not a tab: always last, not listed.
 * The shell passes the visible tabs in the current order and the full order; this element reports `save` with the new
 * full order through `onSave` / `onReset` (a rejection shows its error and keeps the dialog open).
 */
@customElement('sw-nav-order')
export class SwNavOrder extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  /** The visible tabs in the user's current order. */
  @property({ attribute: false }) tabs: AreaEntry[] = [];
  /** The user's full order (hidden tabs included). */
  @property({ attribute: false }) order: string[] = [];
  /** The shell's save / reset: resolve on success, reject with the error. */
  @property({ attribute: false }) onSave: ((order: string[]) => Promise<void>) | null = null;
  @property({ attribute: false }) onReset: (() => Promise<void>) | null = null;

  @state() private draft: string[] = [];
  @state() private dragging: string | null = null;
  @state() private announce = '';
  @state() private saving = false;
  @state() private failure = '';

  static styles = css`
    :host {
      display: contents;
    }
    p.hint {
      margin: 0;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    li {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 52px;
      padding: 4px 6px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      transition: box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    li.dragging {
      border-color: var(--sw-accent);
      box-shadow: var(--sw-shadow-2);
      transform: scale(1.02);
      position: relative;
      z-index: 1;
    }
    li.fixed {
      background: var(--sw-surface-2);
      border-style: dashed;
      color: var(--sw-text-3);
    }
    .handle {
      all: unset;
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      border-radius: 8px;
      color: var(--sw-text-3);
      cursor: grab;
      touch-action: none;
      flex: none;
    }
    .handle:active {
      cursor: grabbing;
    }
    .handle:focus-visible,
    .mv:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: -2px;
    }
    .ic {
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: 9px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      flex: none;
    }
    li.fixed .ic {
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
    }
    .name {
      flex: 1;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-md);
    }
    .pos {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
      min-inline-size: 16px;
      text-align: center;
    }
    .mv {
      all: unset;
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      border-radius: 8px;
      color: var(--sw-text-2);
      cursor: pointer;
      flex: none;
    }
    .mv:hover:not([aria-disabled='true']) {
      background: var(--sw-surface-3);
      color: var(--sw-text);
    }
    .mv[aria-disabled='true'] {
      opacity: 0.3;
      cursor: default;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    .foot {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      inline-size: 100%;
    }
    .foot .grow {
      flex: 1;
    }
  `;

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has('open') && this.open) {
      this.draft = this.tabs.map((t) => t.id);
      this.dragging = null;
      this.announce = '';
      this.failure = '';
    }
  }

  private label(id: string): string {
    return this.tabs.find((t) => t.id === id)?.label ?? id;
  }

  private move(id: string, to: number, focus: 'handle' | 'up' | 'down' | null = null) {
    const from = this.draft.indexOf(id);
    const target = Math.max(0, Math.min(this.draft.length - 1, to));
    if (from < 0 || from === target) return;
    const next = [...this.draft];
    next.splice(from, 1);
    next.splice(target, 0, id);
    this.draft = next;
    this.announce = `${this.label(id)} הועבר למקום ${target + 1} מתוך ${next.length}`;
    if (focus) {
      void this.updateComplete.then(() => {
        const row = this.renderRoot.querySelector<HTMLElement>(`li[data-tab="${id}"]`);
        const want = row?.querySelector<HTMLElement>(focus === 'handle' ? '.handle' : `.mv[data-move="${focus}"]`);
        // a button at the list's edge is disabled after the move: keep the keyboard on the handle then
        (want && want.getAttribute('aria-disabled') !== 'true' ? want : row?.querySelector<HTMLElement>('.handle'))?.focus();
      });
    }
  }

  private onHandleKey(e: KeyboardEvent, id: string) {
    const i = this.draft.indexOf(id);
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.move(id, i - 1, 'handle');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.move(id, i + 1, 'handle');
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.move(id, 0, 'handle');
    } else if (e.key === 'End') {
      e.preventDefault();
      this.move(id, this.draft.length - 1, 'handle');
    }
  }

  // ---- drag (pointer events: mouse, touch and pen alike) ----

  // window listeners, not pointer capture: the dragged row's DOM node moves while it is dragged (keyed repeat), and a
  // moved node can lose an element's pointer capture
  private onPointerDown(e: PointerEvent, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    this.dragging = id;
    window.addEventListener('pointermove', this.onWindowMove);
    window.addEventListener('pointerup', this.onWindowUp);
    window.addEventListener('pointercancel', this.onWindowUp);
  }

  private onWindowMove = (e: PointerEvent) => this.onPointerMove(e);

  private onWindowUp = () => {
    this.dragging = null;
    this.stopDrag();
  };

  private stopDrag() {
    window.removeEventListener('pointermove', this.onWindowMove);
    window.removeEventListener('pointerup', this.onWindowUp);
    window.removeEventListener('pointercancel', this.onWindowUp);
  }

  disconnectedCallback() {
    this.stopDrag();
    super.disconnectedCallback();
  }

  private onPointerMove(e: PointerEvent) {
    const id = this.dragging;
    if (!id) return;
    const rows = Array.from(this.renderRoot.querySelectorAll<HTMLElement>('li[data-tab]'));
    // the slot whose middle the pointer passed: rows above the pointer's y count, the dragged row itself does not
    let to = 0;
    for (const row of rows) {
      if (row.dataset.tab === id) continue;
      const r = row.getBoundingClientRect();
      if (e.clientY > r.top + r.height / 2) to += 1;
    }
    if (to !== this.draft.indexOf(id)) this.move(id, to);
  }


  /** The full order with the visible tabs rearranged in their own slots (hidden tabs keep theirs). */
  private fullOrder(): string[] {
    const visible = new Set(this.draft);
    const queue = [...this.draft];
    return this.order.map((id) => (visible.has(id) ? queue.shift()! : id)).concat(queue);
  }

  private async save() {
    if (!this.onSave) return;
    this.saving = true;
    this.failure = '';
    try {
      await this.onSave(this.fullOrder());
      this.close();
    } catch (err) {
      this.failure = `השמירה נכשלה: ${describeError(err)}`;
    } finally {
      this.saving = false;
    }
  }

  private async reset() {
    if (!this.onReset) return;
    this.saving = true;
    this.failure = '';
    try {
      await this.onReset();
      this.close();
    } catch (err) {
      this.failure = `האיפוס נכשל: ${describeError(err)}`;
    } finally {
      this.saving = false;
    }
  }

  private close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  render() {
    const n = this.draft.length;
    return html`<sw-dialog ?open=${this.open} heading="סדר הלשוניות" subheading="גררו שורה בידית, או הזיזו בחצים. הסדר נשמר לחשבון שלכם ומופיע בכל המכשירים." data-nav-order-dialog @close=${(e: Event) => {
      e.stopPropagation();
      if (this.open) this.close();
    }}>
      <ol aria-label="הלשוניות לפי הסדר">
        ${repeat(
          this.draft,
          (id) => id,
          (id, i) => {
            const tab = this.tabs.find((t) => t.id === id);
            return html`<li data-tab=${id} class=${this.dragging === id ? 'dragging' : ''}>
              <button type="button" class="handle" data-drag=${id} aria-label=${`גרירה: ${tab?.label ?? id}. חצים למעלה ולמטה מזיזים`} aria-roledescription="ידית גרירה"
                @pointerdown=${(e: PointerEvent) => this.onPointerDown(e, id)}
                @keydown=${(e: KeyboardEvent) => this.onHandleKey(e, id)}><sw-icon name="grip" size=${20}></sw-icon></button>
              <span class="ic"><sw-icon .name=${tab?.icon ?? 'list'} size=${18}></sw-icon></span>
              <span class="name">${tab?.label ?? id}</span>
              <span class="pos" aria-hidden="true">${i + 1}</span>
              <button type="button" class="mv" data-move="up" aria-label=${`הזז למעלה: ${tab?.label ?? id}`} aria-disabled=${i === 0 ? 'true' : 'false'} @click=${() => i > 0 && this.move(id, i - 1, 'up')}><sw-icon name="arrowUp" size=${18}></sw-icon></button>
              <button type="button" class="mv" data-move="down" aria-label=${`הזז למטה: ${tab?.label ?? id}`} aria-disabled=${i === n - 1 ? 'true' : 'false'} @click=${() => i < n - 1 && this.move(id, i + 1, 'down')}><sw-icon name="arrowDown" size=${18}></sw-icon></button>
            </li>`;
          },
        )}
        <li class="fixed" aria-label="המשתמש - תמיד אחרון"><span class="handle" aria-hidden="true"><sw-icon name="lock" size=${16}></sw-icon></span><span class="ic"><sw-icon name="user" size=${18}></sw-icon></span><span class="name">המשתמש</span><span class="pos">תמיד אחרון</span></li>
      </ol>
      <span class="sr" role="status" aria-live="polite" data-nav-order-announce>${this.announce}</span>
      ${this.failure ? html`<div class="err" role="alert" data-nav-order-error>${this.failure}</div>` : nothing}
      <div class="foot" slot="footer">
        <sw-button variant="ghost" size="sm" data-nav-order-reset ?disabled=${this.saving} @click=${() => void this.reset()}>אפס לברירת המחדל</sw-button>
        <span class="grow"></span>
        <sw-button variant="secondary" size="sm" ?disabled=${this.saving} @click=${() => this.close()}>ביטול</sw-button>
        <sw-button variant="primary" size="sm" data-nav-order-save ?disabled=${this.saving} @click=${() => void this.save()}>שמור</sw-button>
      </div>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-nav-order': SwNavOrder;
  }
}
