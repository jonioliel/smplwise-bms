import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { describeError } from '../api/client';
import {
  DIRECTION_LABEL, DIRECTION_LETTER, DIRECTIONS, HOME_PERSONAL_EVENT, PHONE_LAYOUT_LABEL, PHONE_LAYOUTS, loadHomeSettings, loadPersonal, moveWidget, PERSONAL_EMPTY, personalIsEmpty, savePersonal, SIZE_LABEL, SIZES, WIDGET_NAME,
  type Direction, type ElevatorMode, type HomeConfig, type HomePersonal, type PersonalWidget, type PhoneLayout, type Size, type WidgetId, ELEVATOR_MODES,
} from '../api/home';
import { listElevators, type Elevator } from '../api/elevators';
import { elevatorsAccess } from '../elevators/access';
import { listUnits } from '../api/temperature';
import { temperatureAccess } from '../temperature/access';
import { loadHomeGenerators } from '../generator/access'; // GENWIDGET 2.9.3
import { generatorsAvailable } from '../generator/home-widget-model';
import { loadHomeDoors } from '../door-windows/access'; // DOORWIN2-295
import { loadHomeNoticesChecked, noticesWidgetOffered } from '../notices/home-widget'; // NOTICEPAGE-295
import { doorsWidgetAvailable } from '../door-windows/home-widget-model';
import { doorWindowsTabOn, noticesModuleOn } from './nav';
import { MODE_KEY, personalHidden } from '../elevators/model';
import { elt } from '../i18n/elevators';
import { effectiveRows, loadPersonalRow, personalDiff, savePersonalRow, type AreaRowPersonal } from '../api/area-row';
import { productSettings } from '../api/prefs';
import { devicesPrefsOf } from '../screens/devices-style';
import '../screens/area-row-editor';
import { HOME_SCREEN_DEFAULT, homeScreenOf, SUMMARY_KINDS, type HomeScreenOptions, type PersonalScreen, type SummaryKind } from '../api/home-screen';
import { hs } from '../i18n/home-screen';
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
  /** CR-INFRA-ELEVATORS 2.8.0: the elevators this user sees (empty = the elevators widget is not offered here at all). */
  @state() private elevators: Elevator[] = [];
  /** CR-INFRA-TEMPERATURE phase 3: how many units the user sees (0 = the temperatures widget is never named here) */
  @state() private tempUnits = 0;
  /** GENWIDGET 2.9.3: whether this user sees a generator (false = the generators widget is not offered here at all). */
  @state() private generators = false;
  /** DOORWIN2-295: whether this user sees the doors widget (false = it is not offered here at all). */
  @state() private doors = false;
  /** NOTICEPAGE-295: whether this user is offered the notices widget (false = not offered here at all). */
  @state() private notices = false;
  /** HOME-295: the installation's home screen options (whether users may choose their own summary tiles). */
  @state() private screenSite: HomeScreenOptions = HOME_SCREEN_DEFAULT;

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
      this.screenSite = homeScreenOf((s as unknown as Record<string, unknown> | null)?.['home.screen']);
      this.base = { direction: h.direction, config: h.config };
      this.row = r;
      this.rowBase = devicesPrefsOf(s);
    });
    if (elevatorsAccess().view) void listElevators().then((r) => (this.elevators = r.elevators)).catch(() => (this.elevators = []));
    if (temperatureAccess().view) void listUnits(false).then((r) => (this.tempUnits = r.home_widget === false ? 0 : r.units.length)).catch(() => (this.tempUnits = 0));
    void loadHomeGenerators().then((g) => (this.generators = generatorsAvailable(g)));
    void loadHomeDoors().then((d) => (this.doors = doorsWidgetAvailable(d, doorWindowsTabOn())));
    void loadHomeNoticesChecked().then((d) => (this.notices = !!d && noticesWidgetOffered(d, noticesModuleOn())));
  }

  /** The elevators widget's own choices: how they appear (null = the installation's) and which are left out (null = the installation's list). */
  private setElevators(patch: { mode?: ElevatorMode | null; hidden?: string[] | null }) {
    const cur: PersonalWidget = { ...(this.personal.widgets.elevators ?? {}) };
    if (patch.mode !== undefined) {
      if (patch.mode === null) delete cur.mode;
      else cur.mode = patch.mode;
    }
    if (patch.hidden !== undefined) {
      if (patch.hidden === null) delete cur.hidden;
      else cur.hidden = patch.hidden;
    }
    this.setWidget('elevators', cur);
  }

  private elevatorChoices() {
    const base = this.base!.config.elevators;
    const own = this.personal.widgets.elevators ?? {};
    // review L5: the user's own list ADDS to the installation's - an elevator the administrator hid stays hidden (its box is disabled)
    const mine = own.hidden ?? [];
    return html`<div class="row" data-home-personal-elevators-mode>
        <span class="seg" role="group" aria-label=${elt('displayMode')}>
          <button type="button" data-home-personal-elevators-mode="" aria-pressed=${String(own.mode === undefined)} ?disabled=${this.busy} @click=${() => this.setElevators({ mode: null })}>${elt('personalDefault')}</button>
          ${ELEVATOR_MODES.map((m) => html`<button type="button" data-home-personal-elevators-mode=${m} aria-pressed=${String(own.mode === m)} ?disabled=${this.busy} @click=${() => this.setElevators({ mode: m })}>${elt(MODE_KEY[m])}</button>`)}
        </span>
      </div>
      <div class="row" role="group" aria-label=${elt('include')} data-home-personal-elevators-include>
        ${this.elevators.map((e) => {
          const byAdmin = base.hidden.includes(e.id);
          return html`<label class="check"><input type="checkbox" data-home-personal-elevator=${e.id} .checked=${!byAdmin && !mine.includes(e.id)} ?disabled=${this.busy || byAdmin}
          @change=${(ev: Event) => {
            const next = personalHidden(mine, e.id, (ev.target as HTMLInputElement).checked);
            this.setElevators({ hidden: next.length ? next : null });
          }} />${e.name}</label>`;
        })}
      </div>`;
  }

  /** HOME-295: the user's own phone area (sheet / full screen) and - only while the installation lets users choose - his summary tiles. */
  private setScreen(patch: Partial<PersonalScreen>) {
    const next: PersonalScreen = { ...(this.personal.screen ?? {}), ...patch };
    for (const k of Object.keys(next) as (keyof PersonalScreen)[]) if (next[k] === undefined) delete next[k];
    this.commit({ ...this.personal, screen: next });
  }

  private screenChoices() {
    const own = this.personal.screen ?? {};
    const site = this.screenSite;
    const tiles = own.summary_tiles ?? null;
    const toggle = (k: SummaryKind) => {
      const cur = tiles ?? site.summary_tiles ?? [...SUMMARY_KINDS];
      const next = cur.includes(k) ? cur.filter((x) => x !== k) : SUMMARY_KINDS.filter((x) => x === k || cur.includes(x));
      this.setScreen({ summary_tiles: next });
    };
    return html`<div class="row" data-home-personal-phone-area>
        <span class="lbl" id="hp-parea">${hs('phoneArea')}</span>
        <span class="seg" role="group" aria-labelledby="hp-parea">
          <button type="button" data-home-personal-phone-area="" aria-pressed=${String(!own.phone_area)} ?disabled=${this.busy} @click=${() => this.setScreen({ phone_area: undefined })}>ברירת מחדל</button>
          ${(['sheet', 'full'] as const).map((v) => html`<button type="button" data-home-personal-phone-area=${v} aria-pressed=${String(own.phone_area === v)} ?disabled=${this.busy} @click=${() => this.setScreen({ phone_area: v })}>${hs(`area_${v}`)}</button>`)}
        </span>
      </div>
      ${site.summary_chooser === 'user'
        ? html`<div class="row" data-home-personal-tiles>
            <span class="lbl">${hs('personalTiles')}</span>
            <span class="seg" role="group" aria-label=${hs('personalTiles')}>
              <button type="button" data-home-personal-tile="" aria-pressed=${String(tiles === null)} ?disabled=${this.busy} @click=${() => this.setScreen({ summary_tiles: undefined })}>${hs('personalFollow')}</button>
              ${SUMMARY_KINDS.map((k) => html`<button type="button" data-home-personal-tile=${k} aria-pressed=${String(tiles !== null && tiles.includes(k))} ?disabled=${this.busy} @click=${() => toggle(k)}>${hs(`k_${k}`)}</button>`)}
            </span>
          </div>`
        : nothing}`;
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

  private setWidget(id: WidgetId, entry: PersonalWidget) {
    const widgets = { ...this.personal.widgets };
    if (Object.keys(entry).length) widgets[id] = entry;
    else delete widgets[id];
    this.commit({ ...this.personal, widgets });
  }

  /** The widgets offered here: the elevators / generators widget only to a user who sees one (no such device = the module is never named). */
  private get offered(): WidgetId[] {
    return this.order.filter((id) => (id !== 'elevators' || this.elevators.length > 0) && (id !== 'temperature' || this.tempUnits > 0) && (id !== 'generators' || this.generators) && (id !== 'doors' || this.doors) && (id !== 'notices' || this.notices));
  }

  /** `to` is a place among the OFFERED widgets (review L6, GENWIDGET 2.9.3: a widget left out of the list is skipped, like the home editor). */
  private move(id: WidgetId, to: number) {
    const offered = this.offered;
    const target = offered[Math.max(0, Math.min(offered.length - 1, to))];
    const order = target === undefined || target === id ? this.order : moveWidget(this.order, id, this.order.indexOf(target));
    const same = JSON.stringify(order) === JSON.stringify(this.base?.config.order);
    this.commit({ ...this.personal, order: same ? null : order });
  }

  render() {
    if (!this.base) return nothing;
    const d = this.direction;
    const order = this.offered;
    return html`
      <div class="row" data-home-personal-direction>
        <span class="lbl" id="hp-dir">כיוון</span>
        <span class="seg" role="group" aria-labelledby="hp-dir">
          <button type="button" data-home-personal-dir="" aria-pressed=${String(this.personal.direction === null)} ?disabled=${this.busy} @click=${() => this.setDirection(null)}>ברירת מחדל</button>
          ${DIRECTIONS.map((x) => html`<button type="button" data-home-personal-dir=${x} aria-pressed=${String(this.personal.direction === x)} ?disabled=${this.busy} title=${DIRECTION_LABEL[x]} @click=${() => this.setDirection(x)}>${DIRECTION_LETTER[x]} · ${DIRECTION_LABEL[x]}</button>`)}
        </span>
      </div>
      ${this.screenChoices()}
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
          ${id === 'elevators' && on ? this.elevatorChoices() : nothing}
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
