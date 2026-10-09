import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import type { GroupBy, MediaDevice, MediaLayout, Size } from '../api/media-screens';
import { bidi } from '../i18n/bidi';
import { applyMediaGlass, mediaGlassStyles } from '../styles/media-glass';
import { mIcon, nameText } from '../components/media-icons';
import { GROUP_LABEL, SIZE_LABEL, cardOf, editGroups, moveFloor, moveInGroup, moveOnto, setCard, setGroupBy, togglePin, type FloorRef } from './multimedia-layout';

const SIZES: Size[] = ['s', 'm', 'l'];
const GROUPS: GroupBy[] = ['floor', 'area', 'none'];

/**
 * CR-015 addition A: the edit panel of the screens page, the counterpart of the home screen's `home-edit-panel` (owner: "like
 * the home screen editor"). It edits a DRAFT the screen owns: every change is one `layout-draft` event carrying the whole new
 * layout, and the edit bar's "שמור" saves it. Per screen: show / hide, size (קטן · רגיל · גדול), "מועדף" (the pinned top row),
 * earlier / later (buttons - focus stays on the moved row - or a drag) and, for the installation layout, its phone visibility
 * and size (folded under a phone button: rarely touched); plus the grouping (קומה · חדר · רציף) and the floors' order. In the
 * personal scope ("רק אני", a holder of screen.personalize) the panel offers what a personal override can hold: grouping, order,
 * show / hide and size. The page docks it beside the cards on a wide screen and above them on a narrow one. Nothing here
 * reaches the network; screens are named as the operator named them.
 */
@customElement('multimedia-edit-panel')
export class MultimediaEditPanel extends LitElement {
  @property({ attribute: false }) draft!: MediaLayout;
  @property({ attribute: false }) devices: MediaDevice[] = [];
  @property() scope: 'all' | 'me' = 'all';
  @property({ attribute: false }) floors: FloorRef[] = [];
  /** CR-016: the players tab's editor - no card sizes and no phone settings (a player card has one size); `heading` names the list. */
  @property({ type: Boolean }) simple = false;
  @property() heading = 'מסכים';
  @state() private drag = '';
  @state() private dragFloor = '';
  @state() private phoneOpen = new Set<string>();

  static styles = [mediaGlassStyles, css`
    :host {
      display: block;
      color: var(--dv-text);
      font-family: var(--dv-font);
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 16px 18px;
      border: 1px dashed color-mix(in srgb, var(--dv-accent) 55%, transparent);
    }
    h3,
    h4 {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: 700;
      color: var(--dv-text-2);
      letter-spacing: 0.02em;
    }
    h4 {
      margin-block-start: 6px;
    }
    .lbl {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-base);
      color: var(--dv-text-2);
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .row {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 9px 10px;
      border: 1px solid var(--dv-border);
      border-radius: var(--dv-radius-sm);
      background: var(--dv-surface-2);
    }
    .row.off {
      opacity: 0.7;
    }
    .row.dragging {
      opacity: 0.45;
    }
    .l1,
    .l2 {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .grip {
      color: var(--dv-text-3);
      cursor: grab;
      display: inline-flex;
      font-size: var(--sw-fs-md);
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 32px;
      font-size: var(--sw-fs-base);
      min-inline-size: 0;
    }
    .check input {
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--dv-accent);
      flex: none;
    }
    .check b {
      font-weight: 600;
    }
    .check small {
      color: var(--dv-text-2);
      font-size: var(--sw-fs-sm);
    }
    .sp {
      flex: 1;
    }
    .phone {
      display: flex;
      align-items: center;
      gap: 6px 12px;
      flex-wrap: wrap;
      padding-block-start: 8px;
      border-block-start: 1px dashed var(--dv-border);
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
    }
    .phone .pl {
      font-weight: 700;
    }
    select {
      min-block-size: 32px;
      padding-inline: 8px;
      border: 1px solid var(--dv-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--dv-surface-solid);
      color: var(--dv-text);
      font: inherit;
      font-size: var(--sw-fs-base);
    }
    .ib {
      position: relative;
      display: inline-grid;
      place-items: center;
      inline-size: 34px;
      block-size: 34px;
      padding: 0;
      border: 1px solid var(--dv-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--dv-surface);
      color: var(--dv-text);
    }
    .ib[aria-pressed='true'],
    .ib[aria-expanded='true'] {
      background: var(--dv-accent-soft);
      color: var(--dv-accent-text);
      border-color: transparent;
    }
    .ib[disabled] {
      opacity: 0.35;
    }
    .ib .ic {
      font-size: var(--sw-fs-lg);
    }
    .ib .dot {
      position: absolute;
      inset-block-start: 4px;
      inset-inline-end: 4px;
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--dv-accent);
    }
    ol {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .floor {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border: 1px solid var(--dv-border);
      border-radius: var(--dv-radius-sm);
      background: var(--dv-surface-2);
    }
    .floor.dragging {
      opacity: 0.45;
    }
    .floor .nm {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--sw-fs-base);
    }
    @media (pointer: coarse), (max-width: 767px) {
      .ib {
        inline-size: 44px;
        block-size: 44px;
      }
      select {
        min-block-size: 44px;
      }
      .check {
        min-block-size: 44px;
      }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    void applyMediaGlass(this);
  }

  private change(next: MediaLayout) {
    this.dispatchEvent(new CustomEvent('layout-draft', { detail: next, bubbles: true, composed: true }));
  }

  /** The moved row keeps the keyboard focus (the panel is re-rendered from the new draft first). */
  private keepFocus(key: string, dir: 'up' | 'down') {
    void this.updateComplete.then(() => requestAnimationFrame(() => {
      const root = this.renderRoot as ParentNode;
      const row = `[data-mm-row="${CSS.escape(key)}"]`;
      (root.querySelector<HTMLElement>(`${row} [data-mm-${dir}]:not([disabled])`) ?? root.querySelector<HTMLElement>(`${row} [data-mm-up]:not([disabled]), ${row} [data-mm-down]:not([disabled])`))?.focus();
    }));
  }

  private move(key: string, dir: -1 | 1) {
    this.change(moveInGroup(this.draft, this.devices, key, dir));
    this.keepFocus(key, dir < 0 ? 'up' : 'down');
  }

  private onDrop(e: DragEvent, onto: string) {
    e.preventDefault();
    const key = this.drag;
    this.drag = '';
    if (key) this.change(moveOnto(this.draft, this.devices, key, onto));
  }

  private togglePhone(key: string) {
    const next = new Set(this.phoneOpen);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.phoneOpen = next;
  }

  private row(d: MediaDevice, index: number, count: number): TemplateResult {
    const l = this.draft;
    const c = cardOf(l, d.key);
    const personal = this.scope === 'me';
    const phoneOn = c.phone_on ?? c.on;
    const pinned = l.pinned.includes(d.key);
    const custom = c.phone_on !== null || c.phone_size !== null;
    const open = this.phoneOpen.has(d.key);
    return html`<div class=${classMap({ row: true, off: !c.on, dragging: this.drag === d.key })} data-mm-row=${d.key} draggable="true"
      @dragstart=${(e: DragEvent) => { this.drag = d.key; e.dataTransfer?.setData('text/plain', d.key); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; }}
      @dragend=${() => (this.drag = '')} @dragover=${(e: DragEvent) => this.drag && e.preventDefault()} @drop=${(e: DragEvent) => this.onDrop(e, d.key)}>
      <div class="l1">
        <span class="grip" aria-hidden="true">${mIcon('grip')}</span>
        <label class="check"><input type="checkbox" data-mm-on=${d.key} .checked=${c.on} aria-label=${`הצג ${d.name}`} @change=${(e: Event) => this.change(setCard(l, d.key, { on: (e.target as HTMLInputElement).checked }))} /><b>${nameText(bidi(d.name))}</b>${d.area_name ? html`<small>${nameText(bidi(d.area_name))}</small>` : nothing}</label>
        <span class="sp"></span>
        <button type="button" class="ib" data-mm-up ?disabled=${index === 0} aria-label=${`הקדם את ${d.name}`} title="הקדם" @click=${() => this.move(d.key, -1)}>${mIcon('arrowUp')}</button>
        <button type="button" class="ib" data-mm-down ?disabled=${index === count - 1} aria-label=${`אחר את ${d.name}`} title="אחר" @click=${() => this.move(d.key, 1)}>${mIcon('arrowDown')}</button>
      </div>
      <div class="l2">
        ${this.simple ? nothing : html`<span class="seg sm" role="group" aria-label=${`גודל: ${d.name}`}>${SIZES.map((s) => html`<button type="button" data-mm-size=${`${d.key}:${s}`} aria-pressed=${String(c.size === s)} ?disabled=${!c.on} @click=${() => this.change(setCard(l, d.key, { size: s }))}>${SIZE_LABEL[s]}</button>`)}</span>`}
        <span class="sp"></span>
        ${personal ? nothing : html`<button type="button" class="ib" data-mm-pin=${d.key} aria-pressed=${String(pinned)} aria-label=${`מועדף: ${d.name}`} title="מועדף" @click=${() => this.change(togglePin(l, d.key))}>${mIcon('star')}</button>
          ${this.simple ? nothing : html`<button type="button" class="ib" data-mm-phone-toggle=${d.key} aria-expanded=${String(open)} aria-label=${`בנייד: ${d.name}`} title="בנייד" @click=${() => this.togglePhone(d.key)}>${mIcon('phone')}${custom ? html`<i class="dot" aria-hidden="true"></i>` : nothing}</button>`}`}
      </div>
      ${personal || this.simple || !open ? nothing : html`<div class="phone" data-mm-phone=${d.key}>
        <span class="pl">בנייד</span>
        <label class="check"><input type="checkbox" data-mm-phone-on=${d.key} .checked=${phoneOn} aria-label=${`הצג בנייד: ${d.name}`} @change=${(e: Event) => { const v = (e.target as HTMLInputElement).checked; this.change(setCard(l, d.key, { phone_on: v === c.on ? null : v })); }} />הצג</label>
        <select data-mm-phone-size=${d.key} aria-label=${`גודל בנייד: ${d.name}`} ?disabled=${!phoneOn} @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; this.change(setCard(l, d.key, { phone_size: v === 's' || v === 'm' ? v : null })); }}>
          <option value="" ?selected=${!c.phone_size}>אוטומטי (${SIZE_LABEL[c.size === 'l' ? 'm' : c.size]})</option>
          <option value="s" ?selected=${c.phone_size === 's'}>${SIZE_LABEL.s}</option><option value="m" ?selected=${c.phone_size === 'm'}>${SIZE_LABEL.m}</option>
        </select>
      </div>`}
    </div>`;
  }

  render() {
    if (!this.draft) return nothing;
    const l = this.draft;
    const groups = editGroups(this.devices, l);
    const ids = this.floors.map((f) => f.id);
    const floorsOn = this.scope === 'all' && l.group_by === 'floor' && this.floors.length > 1;
    return html`<section class="panel glass" data-mm-edit aria-label=${`הגדרות · ${this.heading}`}>
      <div class="lbl" id="mm-grp">קיבוץ
        <span class="seg sm" role="group" aria-labelledby="mm-grp" data-mm-groupby>${GROUPS.map((g) => html`<button type="button" data-mm-group=${g} aria-pressed=${String(l.group_by === g)} @click=${() => this.change(setGroupBy(l, g))}>${GROUP_LABEL[g]}</button>`)}</span>
      </div>
      ${floorsOn ? html`<div data-mm-floors-col>
        <h3 id="mm-floors">סדר הקומות</h3>
        <ol aria-labelledby="mm-floors" data-mm-floors>
          ${this.floors.map((f, i) => html`<li class=${classMap({ floor: true, dragging: this.dragFloor === f.id })} data-mm-floor=${f.id} draggable="true"
            @dragstart=${(e: DragEvent) => { this.dragFloor = f.id; e.dataTransfer?.setData('text/plain', f.id); if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'; }}
            @dragend=${() => (this.dragFloor = '')} @dragover=${(e: DragEvent) => this.dragFloor && e.preventDefault()}
            @drop=${(e: DragEvent) => { e.preventDefault(); const id = this.dragFloor; this.dragFloor = ''; if (id) this.change(moveFloor(l, ids, id, i)); }}>
            <span class="grip" aria-hidden="true">${mIcon('grip')}</span><span class="nm">${bidi(f.name)}</span>
            <button type="button" class="ib" data-mm-floor-up=${f.id} ?disabled=${i === 0} aria-label=${`הקדם את ${f.name}`} title="הקדם" @click=${() => this.change(moveFloor(l, ids, f.id, i - 1))}>${mIcon('arrowUp')}</button>
            <button type="button" class="ib" data-mm-floor-down=${f.id} ?disabled=${i === ids.length - 1} aria-label=${`אחר את ${f.name}`} title="אחר" @click=${() => this.change(moveFloor(l, ids, f.id, i + 1))}>${mIcon('arrowDown')}</button>
          </li>`)}
        </ol>
      </div>` : nothing}
      <h3>${this.heading}</h3>
      ${groups.map((g) => html`<h4>${nameText(bidi(g.label))}</h4>
        <div class="rows">${repeat(g.items, (i) => i.device.key, (i, idx) => this.row(i.device, idx, g.items.length))}</div>`)}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'multimedia-edit-panel': MultimediaEditPanel;
  }
}
