import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { errorCode, partialDone, playerErrorText, players, queueDropTarget, queueResultLine, reorderRows, sendQueueEdit, toggleSelected, upcomingCount, QUEUE_SELECT_MAX, UP_NEXT_REFRESH_MS, type QueueList, type QueueOp, type QueueRow } from '../api/media-players';
import { bidi } from '../i18n/bidi';
import { mmss } from './media-remote-logic';
import { remoteStyles } from './media-remote-css';
import { playerBase, playerStyles } from './media-player-css';
import { ic } from './media-player-icons';

/**
 * CR-016 phase 2b (docs/changes/CR-016-MEDIA-PLAYERS.md section 17.8): the FULL queue of a player inside the player panel - the "הבא בתור" block when the
 * device has `caps.queue_list` (the direct music connection is ready). The current row and what is already buffered are locked (no handle); every other row
 * has a drag handle (pointer drag; ArrowUp / ArrowDown on the focused handle move it by one), "העבר לראש התור" and delete. Tapping a row plays it now; "בחר" turns
 * the rows into a multi-select (up to 25) removed with one request; "נקה תור" asks WHICH clear: what follows (the current song continues) or everything (stops).
 * Without `canEdit`
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
  /** The question on screen: which clear, or the removal of the ticked rows. */
  @state() private ask: 'clear' | 'remove' | null = null;
  @state() private select = false;
  @state() private selected: string[] = [];
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
        grid-template-columns: minmax(0, 1fr) auto;
        touch-action: pan-y;
        transition: background var(--mr-motion);
      }
      .tap {
        all: unset;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        min-inline-size: 0;
        min-block-size: 32px;
        border-radius: var(--sw-r-md);
      }
      button.tap {
        cursor: pointer;
      }
      button.tap:hover {
        background: var(--mr-surface-3);
      }
      button.tap:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 1px;
      }
      .tap.pend {
        opacity: 0.5;
        pointer-events: none;
      }
      .tap.off {
        opacity: 0.55;
      }
      .tap.sel .ix {
        background: var(--mr-accent);
        color: #fff;
      }
      .hacts {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        margin-inline-start: auto;
      }
      .psh .hacts .lnk {
        margin-inline-start: 0;
      }
      .psh .lnk.danger {
        color: var(--mr-danger, var(--sw-danger-text));
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
        border-radius: var(--sw-r-md);
        color: var(--mr-text-2);
        cursor: pointer;
      }
      .qb .ic {
        font-size: var(--sw-fs-xl);
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
        color: var(--mr-danger, var(--sw-danger-text));
      }
      .ask {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 8px 10px;
        border-radius: var(--sw-r-md);
        background: var(--mr-surface-3);
        font-size: var(--sw-fs-base);
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
        font-size: var(--sw-fs-sm);
      }
      .ask .yes {
        background: var(--mr-danger, var(--sw-danger));
        color: #fff;
      }
      .ask.choice {
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
      }
      .ask.choice .opt {
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding: 8px 12px;
        border-radius: var(--sw-r-md);
        background: var(--mr-surface);
        border: 1px solid var(--mr-border);
        font-size: var(--sw-fs-base);
        text-align: start;
      }
      .ask.choice .opt small {
        font-size: var(--sw-fs-sm);
        font-weight: 500;
        color: var(--mr-text-2);
      }
      .ask.choice .opt.danger {
        color: var(--mr-danger, var(--sw-danger-text));
      }
      .ask.choice .no {
        align-self: flex-end;
      }
      .ask .no {
        color: var(--mr-text-2);
      }
      .ask button:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 2px;
      }
      .qnote {
        font-size: var(--sw-fs-sm);
        color: var(--mr-text-2);
        padding: 2px 8px;
      }
      /* every target is 44 px (the layout guard's rule: touch layouts, and the desktop dial's default) */
      .qb {
        inline-size: 44px;
        block-size: 44px;
      }
      .tap {
        min-block-size: 44px;
      }
      .psh .hacts .lnk {
        min-block-size: 44px;
        min-inline-size: 44px;
        justify-content: center;
        padding-inline: 10px;
      }
      .ask button {
        min-block-size: 44px;
        min-inline-size: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding-inline: 14px;
      }
      @media (max-width: 480px) {
        .uq .row.qrow {
          gap: 4px;
          padding-inline: 6px 2px;
        }
        .acts {
          gap: 0;
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
      this.ask = null;
      this.select = false;
      this.selected = [];
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
      const here = new Set(l.items.filter((r) => !r.locked).map((r) => r.item));
      if (this.selected.some((i) => !here.has(i))) this.selected = this.selected.filter((i) => here.has(i));
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

  private async edit(op: QueueOp, row: QueueRow | null, extra: { items?: string[]; to?: number; confirmed?: boolean } = {}): Promise<void> {
    const id = row ? `${op}:${row.item}` : op;
    if (this.busy.has(id)) return;
    this.busy = new Set(this.busy).add(id);
    try {
      const r = await sendQueueEdit(this.deviceKey, op, { ...(row ? { item: row.item } : {}), ...extra });
      if (r.status === 'refused') this.say(queueResultLine(r, extra.items?.length ?? 1) || 'הפעולה נדחתה');
    } catch (err) {
      const done = partialDone(err);
      this.say(done !== null && extra.items ? `הוסרו ${done} מתוך ${extra.items.length}` : playerErrorText(err));
    } finally {
      const next = new Set(this.busy);
      next.delete(id);
      this.busy = next;
      void this.load();
    }
  }

  private onPlay(row: QueueRow) {
    if (this.select) {
      if (!row.locked) this.selected = toggleSelected(this.selected, row.item);
      return;
    }
    void this.edit('play', row);
  }

  private endSelect() {
    this.select = false;
    this.selected = [];
    if (this.ask === 'remove') this.ask = null;
  }

  private removeSelected() {
    const items = [...this.selected];
    const gone = new Set(items);
    this.ask = null;
    this.rows = this.rows.filter((r) => !gone.has(r.item));
    this.endSelect();
    void this.edit('delete_many', null, { items });
  }

  private clear(op: 'clear' | 'clear_upcoming') {
    this.ask = null;
    void this.edit(op, null, { confirmed: true });
  }

  private onNext(row: QueueRow) {
    const l = this.list;
    if (l && l !== 'error' && l.locked_to !== null) this.rows = reorderRows(this.rows, row.index, l.locked_to + 1);
    void this.edit('top', row);
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
    const n = this.selected.length;
    const acts = !this.canEdit || movable === 0 ? nothing : this.select
      ? html`<span class="hacts"><small class="n" data-qx-sel-count>${n} נבחרו</small>
          <button type="button" class="lnk danger" data-qx-remove-sel ?disabled=${n === 0 || this.busy.has('delete_many')} @click=${() => (this.ask = 'remove')}>הסר</button>
          <button type="button" class="lnk" data-qx-select-cancel @click=${() => this.endSelect()}>ביטול</button></span>`
      : html`<span class="hacts"><button type="button" class="lnk" data-qx-select @click=${() => { this.select = true; this.ask = null; }}>בחר</button>
          <button type="button" class="lnk" data-qx-clear ?disabled=${this.busy.has('clear') || this.busy.has('clear_upcoming')} @click=${() => (this.ask = 'clear')}>נקה תור</button></span>`;
    const head = html`<div class="psh"><h4>הבא בתור</h4>${count ? html`<small class="n" data-qx-count>${count}</small>` : nothing}${acts}</div>`;
    if (l === null) return html`${head}<div class="uq" aria-busy="true" data-pn-upnext="loading"><span class="skl skl-row"></span><span class="skl skl-row"></span><span class="skl skl-row"></span></div>`;
    if (l === 'error' || !l.confirmed) return html`${head}<div class="uq" data-pn-upnext="unavailable"><div class="unav">${ic('wifiOff')}לא זמין</div></div>`;
    const d = this.drag;
    const up = upcomingCount(l);
    return html`${head}
      ${this.ask === 'clear'
        ? html`<div class="ask choice" role="alertdialog" aria-label="ניקוי התור" data-qx-ask="clear"><b>לנקות את התור?</b>
            ${up > 0 ? html`<button type="button" class="opt" data-qx-clear-upcoming @click=${() => this.clear('clear_upcoming')}>נקה את הבאים<small>${up} שירים; השיר הנוכחי ממשיך</small></button>` : nothing}
            <button type="button" class="opt danger" data-qx-clear-all @click=${() => this.clear('clear')}>נקה הכול<small>הניגון ייעצר</small></button>
            <button type="button" class="no" data-qx-ask-no @click=${() => (this.ask = null)}>ביטול</button></div>`
        : nothing}
      ${this.ask === 'remove'
        ? html`<div class="ask" role="alertdialog" aria-label="הסרת שירים" data-qx-ask="remove"><span class="sp">להסיר ${n} שירים מהתור?</span>
            <button type="button" class="yes" data-qx-remove-yes @click=${() => this.removeSelected()}>הסר</button>
            <button type="button" class="no" data-qx-ask-no @click=${() => (this.ask = null)}>ביטול</button></div>`
        : nothing}
      <div class="uq" role="list" aria-label="תור הניגון" data-pn-upnext="queue">
        ${this.rows.length
          ? repeat(this.rows, (r) => r.item, (r) => this.row(r, l.index, d))
          : html`<div class="unav" data-qx-empty>${ic('list')}התור ריק</div>`}
      </div>
      ${this.select && n >= QUEUE_SELECT_MAX ? html`<div class="qnote" role="status" data-qx-cap>אפשר לבחור עד ${QUEUE_SELECT_MAX} שירים</div>` : nothing}
      ${this.note ? html`<div class="qnote" role="status" data-qx-note>${this.note}</div>` : nothing}`;
  }

  private row(r: QueueRow, current: number | null, d: { from: number; over: number; dy: number } | null): TemplateResult {
    const cur = current !== null && r.index === current;
    const dragging = d?.from === r.index;
    const overBefore = !!d && d.over === r.index && d.over < d.from;
    const overAfter = !!d && d.over === r.index && d.over > d.from;
    const edit = this.canEdit && !r.locked && !this.select;
    const picked = this.selected.includes(r.item);
    const inner = html`<span class="ix n">${this.select && !r.locked ? (picked ? ic('check') : '') : cur ? ic('play') : r.index + 1}</span>
      <span class="t"><b>${bidi(r.name)}</b>${r.artist ? html`<small>${bidi(r.artist)}</small>` : nothing}</span>
      <span class="dur n">${r.duration_s ? mmss(r.duration_s) : ''}</span>`;
    const tappable = this.canEdit && (this.select ? !r.locked : !cur);
    const tap = tappable
      ? this.select
        ? html`<button type="button" role="checkbox" aria-checked=${String(picked)} class=${classMap({ tap: true, sel: picked })} data-qx-pick @click=${() => this.onPlay(r)}>${inner}</button>`
        : html`<button type="button" class=${classMap({ tap: true, pend: this.busy.has(`play:${r.item}`) })} aria-label=${`נגן עכשיו: ${r.name}`} data-qx-play @click=${() => this.onPlay(r)}>${inner}</button>`
      : html`<div class=${classMap({ tap: true, off: this.select && r.locked })}>${inner}</div>`;
    return html`<div class=${classMap({ row: true, qrow: true, cur, dragging, 'over-before': overBefore, 'over-after': overAfter })} role="listitem" data-qx-row=${r.index}
        data-qx-locked=${String(r.locked)} style=${dragging ? `transform:translateY(${d!.dy}px)` : ''}>
      ${tap}
      <span class="acts">${edit
        ? html`<button type="button" class=${classMap({ qb: true, pend: this.busy.has(`top:${r.item}`) })} title="העבר לראש התור" aria-label="העבר לראש התור" data-qx-next @click=${() => this.onNext(r)}>${ic('playNext')}</button>
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
