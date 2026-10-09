import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { describeError } from '../api/client';
import {
  DIRECTION_LABEL, DIRECTION_LETTER, DIRECTIONS, HOME_PERSONAL_EVENT, PHONE_LAYOUT_LABEL, PHONE_LAYOUTS, loadHomeSettings, loadPersonal, moveWidget, PERSONAL_EMPTY, personalIsEmpty, savePersonal, SIZE_LABEL, SIZES, WIDGET_NAME,
  type Direction, type HomeConfig, type HomePersonal, type PhoneLayout, type Size, type WidgetId,
} from '../api/home';
import { effectiveRows, loadPersonalRow, personalDiff, savePersonalRow, type AreaRowPersonal } from '../api/area-row';
import { productSettings } from '../api/prefs';
import { devicesPrefsOf } from '../screens/devices-style';
import '../screens/area-row-editor';
import type { AreaRowChange } from '../screens/area-row-editor';


/**
 * החשבון שלי › המסך שלי (home redesign, owner decision 2026-09-30): the user's OWN home screen - a direction of their own
 * and, per widget, on / off, size and place. Exists only for a holder of `screen.personalize` (the user menu shows the
 * section only then; the server refuses the write and ignores a stored value without the permission). A choice equal to the
 * installation's is not stored, so a later change of the installation's default still reaches this user; "ברירת מחדל של
 * המערכת" clears everything. Each change is saved at once (PUT /me/prefs `home.personal`). Mounted only while its section of
 * the user menu is open.
 */
@customElement('sw-home-personal')
export class SwHomePersonal extends LitElement {
  @state() private personal: HomePersonal = PERSONAL_EMPTY;
  @state() private base: { direction: Direction; config: HomeConfig } | null = null;
  @state() private busy = false;
  /** Release 0.1.149: the user's own choice of what shows next to an area's name, and the installation's it is laid over. */
  @state() private row: AreaRowPersonal = {};
  @state() private rowBase: ReturnType<typeof devicesPrefsOf> | null = null;
  @state() private failed = '';

  static styles = css`
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px 12px;
      flex-wrap: wrap;
      min-block-size: 40px;
    }
    .lbl {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      min-inline-size: 84px;
    }
    .seg {
      display: inline-flex;
      background: var(--sw-surface-3);
      padding: 2px;
      border-radius: 999px;
      gap: 1px;
    }
    .seg button {
      border: 0;
      background: transparent;
      padding: 2px 10px;
      min-block-size: 28px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      border-radius: 999px;
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    .seg button:disabled {
      opacity: 0.45;
    }
    .w {
      border-block-start: 1px solid var(--sw-border);
      padding-block: 6px;
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .grow {
      flex: 1;
    }
    .ib {
      display: inline-grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
    }
    .ib:disabled {
      opacity: 0.35;
      cursor: default;
    }
    button:focus-visible,
    input:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .err {
      margin: 4px 0 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .reset {
      margin-block-start: 6px;
      border: 0;
      background: none;
      padding: 4px 0;
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-accent-text);
      cursor: pointer;
    }
    .reset:disabled {
      opacity: 0.4;
      cursor: default;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void Promise.all([loadPersonal(), loadHomeSettings(true), loadPersonalRow(), productSettings().catch(() => null)]).then(([p, h, r, s]) => {
      this.personal = p;
      this.base = { direction: h.direction, config: h.config };
      this.row = r;
      this.rowBase = devicesPrefsOf(s);
    });
  }

  /** The direction that ends up shown, and the order the widgets are listed in. */
  private get direction(): Direction {
    return this.personal.direction ?? this.base?.direction ?? 'a';
  }

  private get order(): WidgetId[] {
    return this.personal.order ?? this.base?.config.order ?? [];
  }

  private async commit(next: HomePersonal) {
    const before = this.personal;
    this.personal = next;
    this.busy = true;
    this.failed = '';
    try {
      this.personal = await savePersonal(next);
      window.dispatchEvent(new CustomEvent(HOME_PERSONAL_EVENT));
    } catch (err) {
      this.personal = before;
      this.failed = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  /** An area-row choice: only what differs from the installation's is stored (null = follow it entirely). */
  private async commitRow(change: AreaRowChange | null) {
    if (!this.rowBase) return;
    const before = this.row;
    const next = change ? personalDiff(change.area, change.floor, this.rowBase.areaRow, this.rowBase.floorRow) : null;
    this.row = next ?? {};
    this.busy = true;
    this.failed = '';
    try {
      this.row = await savePersonalRow(next);
      window.dispatchEvent(new CustomEvent(HOME_PERSONAL_EVENT));
    } catch (err) {
      this.row = before;
      this.failed = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private setDirection(d: Direction | null) {
    this.commit({ ...this.personal, direction: d });
  }

  private setPhoneLayout(p: PhoneLayout | null) {
    this.commit({ ...this.personal, phone_layout: p });
  }

  private setOn(id: WidgetId, on: boolean) {
    const cur = { ...(this.personal.widgets[id] ?? {}) };
    if (on === this.base?.config[id].on) delete cur.on;
    else cur.on = on;
    this.setWidget(id, cur);
  }

  private setSize(id: WidgetId, size: Size | null) {
    const cur = { ...(this.personal.widgets[id] ?? {}) };
    if (size === null) delete cur.size;
    else cur.size = size;
    this.setWidget(id, cur);
  }

  private setWidget(id: WidgetId, entry: { on?: boolean; size?: Size }) {
    const widgets = { ...this.personal.widgets };
    if (Object.keys(entry).length) widgets[id] = entry;
    else delete widgets[id];
    this.commit({ ...this.personal, widgets });
  }

  private move(id: WidgetId, to: number) {
    const order = moveWidget(this.order, id, to);
    const same = JSON.stringify(order) === JSON.stringify(this.base?.config.order);
    this.commit({ ...this.personal, order: same ? null : order });
  }

  render() {
    if (!this.base) return nothing;
    const d = this.direction;
    const order = this.order;
    return html`
      <div class="row" data-home-personal-direction>
        <span class="lbl" id="hp-dir">כיוון</span>
        <span class="seg" role="group" aria-labelledby="hp-dir">
          <button type="button" data-home-personal-dir="" aria-pressed=${String(this.personal.direction === null)} ?disabled=${this.busy} @click=${() => this.setDirection(null)}>ברירת מחדל</button>
          ${DIRECTIONS.map((x) => html`<button type="button" data-home-personal-dir=${x} aria-pressed=${String(this.personal.direction === x)} ?disabled=${this.busy} title=${DIRECTION_LABEL[x]} @click=${() => this.setDirection(x)}>${DIRECTION_LETTER[x]} · ${DIRECTION_LABEL[x]}</button>`)}
        </span>
      </div>
      <div class="row" data-home-personal-phone>
        <span class="lbl" id="hp-phone">בנייד</span>
        <span class="seg" role="group" aria-labelledby="hp-phone">
          <button type="button" data-home-personal-phone-layout="" aria-pressed=${String(this.personal.phone_layout === null)} ?disabled=${this.busy} @click=${() => this.setPhoneLayout(null)}>ברירת מחדל</button>
          ${PHONE_LAYOUTS.map((p) => html`<button type="button" data-home-personal-phone-layout=${p} aria-pressed=${String(this.personal.phone_layout === p)} ?disabled=${this.busy} @click=${() => this.setPhoneLayout(p)}>${PHONE_LAYOUT_LABEL[p]}</button>`)}
        </span>
      </div>
      ${order.map((id, i) => {
        const cfg = this.base!.config[id];
        const own = this.personal.widgets[id] ?? {};
        const on = own.on ?? cfg.on;
        const size = own.size ?? null;
        return html`<div class="w" data-home-personal-widget=${id}>
          <div class="row">
            <label class="check"><input type="checkbox" data-home-personal-on=${id} .checked=${on} ?disabled=${this.busy} @change=${(e: Event) => this.setOn(id, (e.target as HTMLInputElement).checked)} /><span class="lbl">${WIDGET_NAME[id]}</span></label>
            <span class="grow"></span>
            <button type="button" class="ib" data-home-personal-earlier=${id} aria-label=${`הקדם את ${WIDGET_NAME[id]}`} ?disabled=${this.busy || i === 0} @click=${() => this.move(id, i - 1)}>↑</button>
            <button type="button" class="ib" data-home-personal-later=${id} aria-label=${`אחר את ${WIDGET_NAME[id]}`} ?disabled=${this.busy || i === order.length - 1} @click=${() => this.move(id, i + 1)}>↓</button>
          </div>
          <div class="row">
            <span class="seg" role="group" aria-label=${`גודל: ${WIDGET_NAME[id]}`}>
              <button type="button" data-home-personal-size=${`${id}:`} aria-pressed=${String(size === null)} ?disabled=${this.busy || !on} @click=${() => this.setSize(id, null)}>ברירת מחדל</button>
              ${SIZES.map((s) => html`<button type="button" data-home-personal-size=${`${id}:${s}`} aria-pressed=${String(size === s)} ?disabled=${this.busy || !on} @click=${() => this.setSize(id, s)}>${SIZE_LABEL[s]}</button>`)}
            </span>
          </div>
        </div>`;
      })}
      ${this.rowBase
        ? html`<div class="w" data-home-personal-area-row>
            <div class="row"><span class="lbl">ליד שם האזור</span></div>
            <area-row-editor .area=${effectiveRows(this.rowBase.areaRow, this.rowBase.floorRow, this.row).area} .floor=${effectiveRows(this.rowBase.areaRow, this.rowBase.floorRow, this.row).floor} ?disabled=${this.busy} @area-row-change=${(e: CustomEvent<AreaRowChange>) => void this.commitRow(e.detail)}></area-row-editor>
          </div>`
        : nothing}
      <button type="button" class="reset" data-home-personal-reset ?disabled=${this.busy || (personalIsEmpty(this.personal) && !Object.keys(this.row).length)} @click=${async () => { await this.commit({ ...PERSONAL_EMPTY, widgets: {} }); if (Object.keys(this.row).length) await this.commitRow(null); }}>ברירת מחדל של המערכת</button>
      ${this.failed ? html`<p class="err" role="alert" data-home-personal-error>${this.failed}</p>` : nothing}
      <span hidden data-home-personal-direction-now=${d}></span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-home-personal': SwHomePersonal;
  }
}
