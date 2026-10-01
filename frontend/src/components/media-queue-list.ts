import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { confirmCount, errorCode, playerErrorText, players, queueDropTarget, reorderRows, sendQueueEdit, UP_NEXT_REFRESH_MS, type QueueList, type QueueOp, type QueueRow } from '../api/media-players';
import { bidi } from '../i18n/bidi';
import { mmss } from './media-remote-logic';
import { remoteStyles } from './media-remote-css';
import { playerBase, playerStyles } from './media-player-css';
import { ic } from './media-player-icons';

/**
 * CR-016 phase 2b (docs/changes/CR-016-MEDIA-PLAYERS.md section 17.8): the FULL queue of a player inside the player panel - the "הבא בתור" block when the
 * device has `caps.queue_list` (the direct music connection is ready). The current row and what is already buffered are locked (no handle); every other row
 * has a drag handle (pointer drag; ArrowUp / ArrowDown on the focused handle move it by one), "נגן הבא" and delete. "נקה תור" asks once. Without `canEdit`
 * (no media.queue) the list is read-only. A failed read says "לא זמין" - never an empty queue. Every edit is one request (never retried); the next read is
 * the truth (the row moves at once, optimistically, and the list is read again right after).
 *
 *   <media-queue-list .deviceKey=${key} .canEdit=${d.can.queue} .stamp=${title}></media-queue-list>
 */
@customElement('media-queue-list')
export class MediaQueueList extends LitElement {
  @property({ attribute: false }) deviceKey = '';
  @property({ type: Boolean }) canEdit = false;
  /** Changes when the now-playing title changes: the list is read again. */
  @property({ attribute: false }) stamp: string | null = null;

  @state() private list: QueueList | null | 'error' = null;
  @state() private rows: QueueRow[] = [];
  @state() private busy = new Set<string>();
  @state() private drag: { from: number; over: number; dy: number } | null = null;
  @state() private askClear: number | null = null;
  @state() private note = '';

  private timer = 0;
  private noteTimer = 0;
  private token = 0;
  private rects: { index: number; top: number; bottom: number }[] = [];
  private startY = 0;

  static styles = [
    // the colour tokens (--mr-*) are inherited from the panel, which carries the scheme
    remoteStyles,
    playerBase,
    playerStyles,
    css`
      :host {
        display: contents;
      }
      .uq .row.qrow {
        grid-template-columns: 28px minmax(0, 1fr) auto auto;
        touch-action: pan-y;
        transition: background var(--mr-motion);
      }
      .uq .row.qrow.dragging {
        position: relative;
        z-index: 2;
        background: var(--mr-surface);
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
        transition: none;
      }
      .uq .row.qrow.over-before {
        box-shadow: inset 0 2px 0 var(--mr-accent);
      }
      .uq .row.qrow.over-after {
        box-shadow: inset 0 -2px 0 var(--mr-accent);
      }
      .acts {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }
      .qb {
        all: unset;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        inline-size: 34px;
        block-size: 34px;
        border-radius: 10px;
        color: var(--mr-text-2);
        cursor: pointer;
      }
      .qb .ic {
        font-size: 17px;
      }
      .qb:hover {
        background: var(--mr-surface-3);
        color: var(--mr-text);
      }
      .qb:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 1px;
      }
      .qb.grip {
        cursor: grab;
        touch-action: none;
      }
      .qb.pend,
      .qb[disabled] {
        opacity: 0.4;
        pointer-events: none;
      }
      .qb.del:hover {
        color: var(--mr-danger, #d93025);
      }
      .ask {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 8px 10px;
        border-radius: 12px;
        background: var(--mr-surface-3);
        font-size: 13px;
        font-weight: 600;
      }
      .ask .sp {
        flex: 1;
      }
      .ask button {
        all: unset;
        cursor: pointer;
        padding: 6px 12px;
        border-radius: 999px;
        font-weight: 600;
        font-size: 12.5px;
      }
      .ask .yes {
        background: var(--mr-danger, #d93025);
        color: #fff;
      }
      .ask .no {
        color: var(--mr-text-2);
      }
      .ask button:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 2px;
      }
      .qnote {
        font-size: 12.5px;
        color: var(--mr-text-2);
        padding: 2px 8px;
      }
      @media (max-width: 480px) {
        .uq .row.qrow {
          gap: 6px;
          padding-inline: 6px 4px;
        }
        .qb {
          inline-size: 32px;
          block-size: 32px;
        }
        .uq .dur {
          display: none;
        }
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    this.timer = window.setInterval(() => void this.load(), UP_NEXT_REFRESH_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.timer);
    window.clearTimeout(this.noteTimer);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('deviceKey')) {
      this.list = null;
      this.rows = [];
      this.askClear = null;
    }
  }

  protected updated(changed: PropertyValues<this>): void {
    if ((changed.has('deviceKey') || changed.has('stamp')) && this.deviceKey) void this.load();
  }

  /** Reads the list again (also after every edit). */
  async load(): Promise<void> {
    if (!this.deviceKey || this.drag) return;
    const token = ++this.token;
    try {
      const l = await players().queue(this.deviceKey);
      if (token !== this.token) return;
      this.list = l;
      this.rows = l.items;
    } catch (err) {
      if (token !== this.token || errorCode(err) === 'rate_limited') return; // a 429 backs off quietly: the last read stays
      this.list = 'error';
    }
  }

  private say(text: string) {
    this.note = text;
    window.clearTimeout(this.noteTimer);
    this.noteTimer = window.setTimeout(() => (this.note = ''), 3600);
  }

  private async edit(op: QueueOp, row: QueueRow | null, extra: { to?: number; confirmed?: boolean } = {}): Promise<void> {
    const id = row ? `${op}:${row.item}` : op;
    if (this.busy.has(id)) return;
    this.busy = new Set(this.busy).add(id);
    try {
      const r = await sendQueueEdit(this.deviceKey, op, { ...(row ? { item: row.item } : {}), ...extra });
      if (r.status === 'refused') this.say('הפעולה נדחתה');
    } catch (err) {
      const count = confirmCount(err);
      if (op === 'clear' && count !== null) {
        this.askClear = count;
      } else {
        this.say(playerErrorText(err));
      }
    } finally {
      const next = new Set(this.busy);
      next.delete(id);
      this.busy = next;
      void this.load();
    }
  }

  private onNext(row: QueueRow) {
    const l = this.list;
    if (l && l !== 'error' && l.locked_to !== null) this.rows = reorderRows(this.rows, row.index, l.locked_to + 1);
    void this.edit('next', row);
  }

  private onDelete(row: QueueRow) {
    this.rows = this.rows.filter((r) => r.item !== row.item);
    void this.edit('delete', row);
  }

  private moveTo(row: QueueRow, to: number) {
    const l = this.list;
    if (!l || l === 'error' || l.locked_to === null) return;
    const last = this.rows.length ? this.rows[this.rows.length - 1].index : row.index;
    const target = queueDropTarget(row.index, to, l.locked_to, last);
    if (target === null) return;
    this.rows = reorderRows(this.rows, row.index, target);
    void this.edit('move', row, { to: target });
  }

  // ---- drag (pointer) and keyboard

  private onGripDown(e: PointerEvent, row: QueueRow) {
    if (e.button !== 0 || !this.canEdit) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.rects = [...(this.renderRoot as ShadowRoot).querySelectorAll<HTMLElement>('[data-qx-row]')].map((el) => {
      const b = el.getBoundingClientRect();
      return { index: Number(el.dataset.qxRow), top: b.top, bottom: b.bottom };
    });
    this.startY = e.clientY;
    this.drag = { from: row.index, over: row.index, dy: 0 };
  }

  private onGripMove(e: PointerEvent) {
    if (!this.drag) return;
    const hit = this.rects.find((r) => e.clientY >= r.top && e.clientY < r.bottom) ?? (e.clientY < (this.rects[0]?.top ?? 0) ? this.rects[0] : this.rects[this.rects.length - 1]);
    this.drag = { ...this.drag, over: hit ? hit.index : this.drag.over, dy: e.clientY - this.startY };
  }

  private onGripUp(row: QueueRow) {
    const d = this.drag;
    this.drag = null;
    if (d && d.over !== d.from) this.moveTo(row, d.over);
  }

  private onGripKey(e: KeyboardEvent, row: QueueRow) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    this.moveTo(row, row.index + (e.key === 'ArrowUp' ? -1 : 1));
    void this.updateComplete.then(() => (this.renderRoot as ShadowRoot).querySelector<HTMLElement>(`[data-qx-grip="${row.item}"]`)?.focus());
  }

  // ---- render

  protected render(): TemplateResult {
    const l = this.list;
    const count = l && l !== 'error' && l.confirmed ? l.count : null;
    const movable = this.rows.filter((r) => !r.locked).length;
    const head = html`<div class="psh"><h4>הבא בתור</h4>${count ? html`<small class="n" data-qx-count>${count}</small>` : nothing}
      ${this.canEdit && movable > 0 && this.askClear === null ? html`<button type="button" class="lnk" data-qx-clear ?disabled=${this.busy.has('clear')} @click=${() => void this.edit('clear', null)}>נקה תור</button>` : nothing}</div>`;
    if (l === null) return html`${head}<div class="uq" aria-busy="true" data-pn-upnext="loading"><span class="skl skl-row"></span><span class="skl skl-row"></span><span class="skl skl-row"></span></div>`;
    if (l === 'error' || !l.confirmed) return html`${head}<div class="uq" data-pn-upnext="unavailable"><div class="unav">${ic('wifiOff')}לא זמין</div></div>`;
    const d = this.drag;
    return html`${head}
      ${this.askClear !== null
        ? html`<div class="ask" role="alertdialog" aria-label="ניקוי התור" data-qx-ask><span class="sp">לנקות ${this.askClear} שירים מהתור?</span>
            <button type="button" class="yes" data-qx-ask-yes @click=${() => { this.askClear = null; void this.edit('clear', null, { confirmed: true }); }}>נקה</button>
            <button type="button" class="no" data-qx-ask-no @click=${() => (this.askClear = null)}>ביטול</button></div>`
        : nothing}
      <div class="uq" role="list" aria-label="תור הניגון" data-pn-upnext="queue">
        ${this.rows.length
          ? repeat(this.rows, (r) => r.item, (r) => this.row(r, l.index, d))
          : html`<div class="unav" data-qx-empty>${ic('list')}התור ריק</div>`}
      </div>
      ${this.note ? html`<div class="qnote" role="status" data-qx-note>${this.note}</div>` : nothing}`;
  }

  private row(r: QueueRow, current: number | null, d: { from: number; over: number; dy: number } | null): TemplateResult {
    const cur = current !== null && r.index === current;
    const dragging = d?.from === r.index;
    const overBefore = !!d && d.over === r.index && d.over < d.from;
    const overAfter = !!d && d.over === r.index && d.over > d.from;
    const edit = this.canEdit && !r.locked;
    return html`<div class=${classMap({ row: true, qrow: true, cur, dragging, 'over-before': overBefore, 'over-after': overAfter })} role="listitem" data-qx-row=${r.index}
        data-qx-locked=${String(r.locked)} style=${dragging ? `transform:translateY(${d!.dy}px)` : ''}>
      <span class="ix n">${cur ? ic('play') : r.index + 1}</span>
      <div class="t"><b>${bidi(r.name)}</b>${r.artist ? html`<small>${bidi(r.artist)}</small>` : nothing}</div>
      <span class="dur n">${r.duration_s ? mmss(r.duration_s) : ''}</span>
      <span class="acts">${edit
        ? html`<button type="button" class=${classMap({ qb: true, pend: this.busy.has(`next:${r.item}`) })} title="נגן הבא" aria-label="נגן הבא" data-qx-next @click=${() => this.onNext(r)}>${ic('playNext')}</button>
            <button type="button" class=${classMap({ qb: true, del: true, pend: this.busy.has(`delete:${r.item}`) })} title="הסר מהתור" aria-label="הסר מהתור" data-qx-delete @click=${() => this.onDelete(r)}>${ic('trash')}</button>
            <button type="button" class="qb grip" title="גרור לשינוי הסדר" aria-label="הזז בתור (חצים למעלה ולמטה)" data-qx-grip=${r.item}
              @pointerdown=${(e: PointerEvent) => this.onGripDown(e, r)} @pointermove=${(e: PointerEvent) => this.onGripMove(e)}
              @pointerup=${() => this.onGripUp(r)} @pointercancel=${() => (this.drag = null)} @keydown=${(e: KeyboardEvent) => this.onGripKey(e, r)}>${ic('grip')}</button>`
        : nothing}</span>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-queue-list': MediaQueueList;
  }
}
