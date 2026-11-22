import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { describeError } from '../api/client';
import {
  DIRECTION_LABEL, DIRECTION_LETTER, DIRECTIONS, HOME_PERSONAL_EVENT, PHONE_LAYOUT_LABEL, PHONE_LAYOUTS, loadHomeSettings, moveWidget, PERSONAL_EMPTY, personalIsEmpty, savePersonal, SIZE_LABEL, SIZES, WIDGET_NAME,
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
import { getBuildingPresence } from '../api/building-presence'; // PRESENCE-2280
import { presenceWidgetAvailable } from '../screens/building-presence-widget';
import { canAnywhere, isApi } from '../api/session';
import { MODE_KEY, personalHidden } from '../elevators/personal-mode'; // CR-NAV-LABELS-2436: not the whole elevators model
import { elt } from '../i18n/elevators';
import { effectiveRows, personalDiff, savePersonalRow, type AreaRowPersonal } from '../api/area-row';
import { productSettings } from '../api/prefs';
import { loadTree as loadCatalogTree } from '../api/catalog';
import { multiBuildingOn } from '../api/mapping';
import { devicesPrefsOf } from '../screens/devices-style';
import '../screens/area-row-editor';
import { HOME_SCREEN_DEFAULT, homeScreenOf, SUMMARY_KINDS, type HomeScreenOptions, type PersonalScreen, type SummaryKind } from '../api/home-screen';
import { hs } from '../i18n/home-screen';
import { tr } from '../i18n/msg/shell';
import { firstRead, noChoices, readOwnChoices } from './home-personal-read';
import type { AreaRowChange } from '../screens/area-row-editor';
import '../components/sw-segmented';
import '../components/sw-chip-choice';
import type { ChipChoiceChange } from '../components/sw-chip-choice';
import type { SegmentedChange } from '../components/sw-segmented';


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
  /** PRESENCE-2280: whether this user is offered the building presence widget. */
  @state() private presence = false;
  /** XS-MINI-WIDGET-2351: the mini cross-section is offered to a viewer who may read the devices (the home screen hides it while no building has floors). */
  @state() private xsection = false;
  /** HOME-295: the installation's home screen options (whether users may choose their own summary tiles). */
  @state() private screenSite: HomeScreenOptions = HOME_SCREEN_DEFAULT;
  /** MULTIBUILDING-HOME-2330: the buildings this user sees (the site choices show only with two or more). */
  @state() private buildings: { id: string; name: string; shared: boolean }[] = [];

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
    select {
      font: inherit;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      min-block-size: 32px;
      padding: 0 8px;
    }
    /* CR-CMP2-TABS-2460: the summary tiles (a multi-choice - each tile on or off, "follow the installation" beside them) are
       sw-chip-choice multi, at this panel's compact size: the 28 px chip, the small label, the 0.45 disabled dimming */
    sw-chip-choice.tiles {
      --sw-chipc-h: 28px;
      --sw-chipc-pad: 10px;
      --sw-chipc-fs: var(--sw-fs-xs);
      --sw-chipc-gap: 4px;
      --sw-disabled-opacity: 0.45;
    }
    /* CR-CMP2-SEGMENTED-C-2450: the one-of-N choices are sw-segmented, in this panel's compact pill (2 px track, 1 px apart, the 28 px
       key with the small label, the plain chosen key of segThumbPlainStyles and the panel's 0.45 disabled dimming) */
    sw-segmented {
      --sw-seg-pad: 2px;
      --sw-seg-gap: 1px;
      --sw-seg-radius: 999px;
      --sw-seg-btn-radius: 999px;
      --sw-seg-h: 28px;
      --sw-seg-key-pad: 10px;
      --sw-seg-fs: var(--sw-fs-xs);
      --sw-seg-fw: 400;
      --sw-seg-on-fw: var(--sw-fw-semibold);
      --sw-seg-on-fg: var(--sw-seg-key-ink, var(--sw-text));
      --sw-disabled-opacity: 0.45;
      /* CR-SEG-MODULE-LOOK-2470: the sw-segmented default is the module look now; this key keeps the old default values it used */
      --sw-seg-on-bg: var(--sw-seg-key, var(--sw-surface));
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
    // CR-UI-POLISH-2443: the user's own choices are read strictly (readOwnChoices: a failed read rejects instead of answering "no
    // choices"), and a first read that fails is the section's red note with the reason - not an empty section, and not the
    // installation's defaults shown as if nothing was stored. The installation's side keeps its fallbacks (loadHomeSettings and
    // the settings answer the defaults). No retry control: the section is mounted only while it is open in the user menu, so
    // opening it again reads again.
    void firstRead(
      () => Promise.all([isApi() ? readOwnChoices() : noChoices(), loadHomeSettings(true), productSettings().catch(() => null)]),
      ([own, h, s]) => {
        this.personal = own.personal;
        this.screenSite = homeScreenOf((s as unknown as Record<string, unknown> | null)?.['home.screen']);
        this.base = { direction: h.direction, config: h.config };
        this.row = own.row;
        this.rowBase = devicesPrefsOf(s);
      },
    ).then((reason) => (this.failed = reason));
    if (elevatorsAccess().view) void listElevators().then((r) => (this.elevators = r.elevators)).catch(() => (this.elevators = []));
    if (temperatureAccess().view) void listUnits(false).then((r) => (this.tempUnits = r.home_widget === false ? 0 : r.units.length)).catch(() => (this.tempUnits = 0));
    void loadHomeGenerators().then((g) => (this.generators = generatorsAvailable(g)));
    // MAPPING-ASSIST-2330: the site choices only while the multi-building view is switched on (owner 31.10: off by default)
    void Promise.all([multiBuildingOn(), loadCatalogTree()]).then(([on, c]) => {
      this.buildings = on ? c.sites.flatMap((s) => (s.buildings ?? []).map((b) => ({ id: b.id, name: b.name, shared: !!b.is_shared }))) : [];
      // XS-MINI-WIDGET-2351: the mini cross-section needs the devices and a building with floors
      this.xsection = (!isApi() || canAnywhere('devices.read')) && c.sites.some((s) => (s.buildings ?? []).some((x) => (x.floors?.length ?? 0) > 0));
    }).catch(() => (this.buildings = []));
    void loadHomeDoors().then((d) => (this.doors = doorsWidgetAvailable(d, doorWindowsTabOn())));
    if (isApi() && canAnywhere('presence.building.view')) void getBuildingPresence().then((s) => (this.presence = presenceWidgetAvailable(s))).catch(() => (this.presence = false));
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
        <sw-segmented label=${elt('displayMode')} value=${own.mode ?? ''} ?disabled=${this.busy} @change=${(e: CustomEvent<SegmentedChange>) => this.setElevators({ mode: (e.detail.value || null) as ElevatorMode | null })}
          .options=${[{ value: '', label: elt('personalDefault'), attrs: { 'data-home-personal-elevators-mode': '' } }, ...ELEVATOR_MODES.map((m) => ({ value: m, label: elt(MODE_KEY[m]), attrs: { 'data-home-personal-elevators-mode': m } }))]}></sw-segmented>
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
    void this.commit({ ...this.personal, screen: next });
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
        <sw-segmented label=${hs('phoneArea')} value=${own.phone_area ?? ''} ?disabled=${this.busy} @change=${(e: CustomEvent<SegmentedChange>) => this.setScreen({ phone_area: (e.detail.value || undefined) as 'sheet' | 'full' | undefined })}
          .options=${[{ value: '', label: tr('ברירת מחדל'), attrs: { 'data-home-personal-phone-area': '' } }, ...(['sheet', 'full'] as const).map((v) => ({ value: v, label: hs(`area_${v}`), attrs: { 'data-home-personal-phone-area': v } }))]}></sw-segmented>
      </div>
      ${site.summary_chooser === 'user'
        ? html`<div class="row" data-home-personal-tiles>
            <span class="lbl">${hs('personalTiles')}</span>
            <sw-chip-choice multi class="tiles" label=${hs('personalTiles')} ?disabled=${this.busy} .values=${tiles === null ? [''] : tiles}
              .options=${[{ value: '', label: hs('personalFollow'), attrs: { 'data-home-personal-tile': '' } }, ...SUMMARY_KINDS.map((k) => ({ value: k, label: hs(`k_${k}`), attrs: { 'data-home-personal-tile': k } }))]}
              @change=${(e: CustomEvent<ChipChoiceChange>) => { e.stopPropagation(); if (e.detail.value) toggle(e.detail.value as SummaryKind); else this.setScreen({ summary_tiles: undefined }); }}></sw-chip-choice>
          </div>`
        : nothing}
      ${this.siteChoices()}`;
  }

  /** MULTIBUILDING-HOME-2330: on a site of several buildings - my own entry view (or the installation's) and "הסתר משותף". */
  private siteChoices() {
    if (this.buildings.length < 2) return nothing;
    const own = this.personal.screen ?? {};
    const shared = this.buildings.some((b) => b.shared);
    return html`<div class="row" data-home-personal-site-entry>
        <span class="lbl" id="hp-sentry">${hs('personalEntry')}</span>
        <sw-segmented label=${hs('personalEntry')} value=${own.site_entry ?? ''} ?disabled=${this.busy}
          @change=${(e: CustomEvent<SegmentedChange>) => {
            const v = e.detail.value as '' | 'site' | 'last' | 'fixed';
            this.setScreen(v ? { site_entry: v, site_entry_building: v === 'fixed' ? own.site_entry_building ?? this.buildings[0].id : undefined } : { site_entry: undefined, site_entry_building: undefined });
          }}
          .options=${[{ value: '', label: tr('ברירת מחדל'), attrs: { 'data-home-personal-site-entry': '' } }, ...(['site', 'last', 'fixed'] as const).map((v) => ({ value: v, label: hs(`se_${v}`), attrs: { 'data-home-personal-site-entry': v } }))]}></sw-segmented>
        ${own.site_entry === 'fixed'
          ? html`<select data-home-personal-site-building aria-label=${hs('siteEntryBuilding')} ?disabled=${this.busy} @change=${(e: Event) => this.setScreen({ site_entry_building: (e.target as HTMLSelectElement).value })}>
              ${this.buildings.map((b) => html`<option value=${b.id} ?selected=${own.site_entry_building === b.id}>${b.name}</option>`)}
            </select>`
          : nothing}
      </div>
      ${shared
        ? html`<div class="row" data-home-personal-hide-shared>
            <span class="lbl" id="hp-hshared">${hs('hideShared')}</span>
            <sw-segmented label=${hs('hideShared')} value=${own.hide_shared ? 'on' : 'off'} ?disabled=${this.busy} @change=${(e: CustomEvent<SegmentedChange>) => this.setScreen({ hide_shared: e.detail.value === 'on' ? true : undefined })}
              .options=${[{ value: 'off', label: hs('hideSharedOff'), attrs: { 'data-home-personal-hide-shared': 'off' } }, { value: 'on', label: hs('hideSharedOn'), attrs: { 'data-home-personal-hide-shared': 'on' } }]}></sw-segmented>
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

  /**
   * Saves one choice at once. Never rejects (CR-FE-PROMISES-2442): a refused or failed save puts the previous choice back and
   * shows the reason in the red note under the list (errorNote), so the setters start it with `void`.
   */
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
    void this.commit({ ...this.personal, direction: d });
  }

  private setPhoneLayout(p: PhoneLayout | null) {
    void this.commit({ ...this.personal, phone_layout: p });
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
    void this.commit({ ...this.personal, widgets });
  }

  /** The widgets offered here: the elevators / generators widget only to a user who sees one (no such device = the module is never named). */
  private get offered(): WidgetId[] {
    return this.order.filter((id) => (id !== 'elevators' || this.elevators.length > 0) && (id !== 'temperature' || this.tempUnits > 0) && (id !== 'generators' || this.generators) && (id !== 'doors' || this.doors) && (id !== 'notices' || this.notices) && (id !== 'presence' || this.presence) && (id !== 'xsection' || this.xsection));
  }

  /** `to` is a place among the OFFERED widgets (review L6, GENWIDGET 2.9.3: a widget left out of the list is skipped, like the home editor). */
  private move(id: WidgetId, to: number) {
    const offered = this.offered;
    const target = offered[Math.max(0, Math.min(offered.length - 1, to))];
    const order = target === undefined || target === id ? this.order : moveWidget(this.order, id, this.order.indexOf(target));
    const same = JSON.stringify(order) === JSON.stringify(this.base?.config.order);
    void this.commit({ ...this.personal, order: same ? null : order });
  }

  /** The section's one error note: a save that failed (under the list) or the first read that failed (instead of the list). */
  private errorNote() {
    return this.failed ? html`<p class="err" role="alert" data-home-personal-error>${this.failed}</p>` : nothing;
  }

  render() {
    if (!this.base) return this.errorNote(); // nothing while the first read is on its way; its reason when it failed
    const d = this.direction;
    const order = this.offered;
    return html`
      <div class="row" data-home-personal-direction>
        <span class="lbl" id="hp-dir">${tr('כיוון')}</span>
        <sw-segmented label=${tr('כיוון')} value=${this.personal.direction ?? ''} ?disabled=${this.busy} @change=${(e: CustomEvent<SegmentedChange>) => this.setDirection((e.detail.value || null) as Direction | null)}
          .options=${[{ value: '', label: tr('ברירת מחדל'), attrs: { 'data-home-personal-dir': '' } }, ...DIRECTIONS.map((x) => ({ value: x, label: `${DIRECTION_LETTER[x]} · ${DIRECTION_LABEL[x]}`, title: DIRECTION_LABEL[x], attrs: { 'data-home-personal-dir': x } }))]}></sw-segmented>
      </div>
      ${this.screenChoices()}
      <div class="row" data-home-personal-phone>
        <span class="lbl" id="hp-phone">${tr('בנייד')}</span>
        <sw-segmented label=${tr('בנייד')} value=${this.personal.phone_layout ?? ''} ?disabled=${this.busy} @change=${(e: CustomEvent<SegmentedChange>) => this.setPhoneLayout((e.detail.value || null) as PhoneLayout | null)}
          .options=${[{ value: '', label: tr('ברירת מחדל'), attrs: { 'data-home-personal-phone-layout': '' } }, ...PHONE_LAYOUTS.map((p) => ({ value: p, label: PHONE_LAYOUT_LABEL[p], attrs: { 'data-home-personal-phone-layout': p } }))]}></sw-segmented>
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
            <button type="button" class="ib" data-home-personal-earlier=${id} aria-label=${tr('הקדם את {name}', { name: WIDGET_NAME[id] })} ?disabled=${this.busy || i === 0} @click=${() => this.move(id, i - 1)}>↑</button>
            <button type="button" class="ib" data-home-personal-later=${id} aria-label=${tr('אחר את {name}', { name: WIDGET_NAME[id] })} ?disabled=${this.busy || i === order.length - 1} @click=${() => this.move(id, i + 1)}>↓</button>
          </div>
          <div class="row">
            <sw-segmented label=${tr('גודל: {name}', { name: WIDGET_NAME[id] })} value=${size ?? ''} ?disabled=${this.busy || !on} @change=${(e: CustomEvent<SegmentedChange>) => this.setSize(id, (e.detail.value || null) as Size | null)}
              .options=${[{ value: '', label: tr('ברירת מחדל'), attrs: { 'data-home-personal-size': `${id}:` } }, ...SIZES.map((sz) => ({ value: sz, label: SIZE_LABEL[sz], attrs: { 'data-home-personal-size': `${id}:${sz}` } }))]}></sw-segmented>
          </div>
          ${id === 'elevators' && on ? this.elevatorChoices() : nothing}
        </div>`;
      })}
      ${this.rowBase
        ? html`<div class="w" data-home-personal-area-row>
            <div class="row"><span class="lbl">${tr('ליד שם האזור')}</span></div>
            <area-row-editor .area=${effectiveRows(this.rowBase.areaRow, this.rowBase.floorRow, this.row).area} .floor=${effectiveRows(this.rowBase.areaRow, this.rowBase.floorRow, this.row).floor} ?disabled=${this.busy} @area-row-change=${(e: CustomEvent<AreaRowChange>) => void this.commitRow(e.detail)}></area-row-editor>
          </div>`
        : nothing}
      <button type="button" class="reset" data-home-personal-reset ?disabled=${this.busy || (personalIsEmpty(this.personal) && !Object.keys(this.row).length)} @click=${async () => { await this.commit({ ...PERSONAL_EMPTY, widgets: {} }); if (Object.keys(this.row).length) await this.commitRow(null); }}>${tr('ברירת מחדל של המערכת')}</button>
      ${this.errorNote()}
      <span hidden data-home-personal-direction-now=${d}></span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-home-personal': SwHomePersonal;
  }
}
