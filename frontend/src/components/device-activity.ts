import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import './sw-sheet';
import './sw-icon';
import './sw-button';
import './sw-toggle';
import './sw-dropdown';
import './sw-state-panel';
import '../screens/schedule-editor';
import { t, tf } from '../i18n/he';
import { bidi, ltrNum } from '../i18n/bidi';
import type { IconName } from './sw-icon';
import type { DropdownChange } from './sw-dropdown';
import { ActivityError, getDeviceActivity, type ActivityItem, type ActivityPage } from '../api/device-activity';
import { createSchedule, daysLabel, deleteSchedule, listSchedules, nextRunLabel, setScheduleEnabled, whenLabel, type Schedule } from '../api/schedules';
import { getEntityRows, type EntityRow } from '../api/devices';
import { runCommand } from '../api/device-commands';
import { DeviceControls, deviceControlStyles } from '../screens/devices-controls';
import { ApiError } from '../api/client';
import { can } from '../api/session';
import { OPEN_EVENT, type ActivityOpen, type ActivityTarget } from './device-activity-press';
import {
  ACTOR_FILTERS, DEFAULT_FILTERS, EVENT_FILTERS, KIND_ICON, PERIODS, PERIOD_LABEL, actorView, clockOf, describeEvent, footnote, gapText, groupByDay,
  isFiltered, queryOf, trackedSince, type Filters, type Period,
} from './device-activity-logic';
import {
  AUTO_CLOSE_MINUTES, BOOST_MINUTES, HOLD_MS, VACUUM_ACTIONS, autoOffDraft, cardKindOf, domainOf, fanSpeedKey, findAutoOff, isMovingState, isOnState, lastCleaningAt,
  powerActions, stateKey, type CardAction, type CardKind,
} from './device-card-logic';

type Tab = 'activity' | 'schedules';
type FeedStatus = 'loading' | 'ready' | 'forbidden' | 'unavailable';
type SchedStatus = 'loading' | 'ready' | 'forbidden' | 'unavailable';
/** CARD1: the equipment card's own row - loading, the server's row, or none (no API / not visible: state from the tile only, no controls). */
type RowStatus = 'idle' | 'loading' | 'ready' | 'missing';

/**
 * CR-032 device activity: the compact popup of an electrical device (opened by a long press, the context menu item or Alt+Enter - see
 * device-activity-press.ts) with the tabs "פעילות" and "תזמונים". One instance lives in the shell and listens for `sw-device-activity`.
 * Activity: filters (period, actor, event type), day groups, per-kind icon and Hebrew wording (device-activity-logic.ts), load more, the
 * states loading / empty / no permission / unavailable / partial and the "tracked since" note. Schedules: the device's schedules
 * (GET /schedules?entity=), enable switch, edit through the EXISTING schedule editor in a sheet, and "add a schedule for this device".
 * Everything the user may not do is the server's decision (`can`, `read_only`); the popup only shows it.
 *
 * CARD1 (2026-10-07): for a water heater, a tap / valve and a robot vacuum (the server's `activity_kind`) an equipment card sits between
 * the head and the tabs: the state at a glance (the device's own row, GET /devices/entities?ids=), one to three quick actions through
 * the SAME action envelope the area tiles use (api/device-commands.ts, shared DeviceControls - optimistic, confirmed by the reported
 * state, rolled back on timeout), a time-boxed run whose auto-off is a one-off schedule of the EXISTING scheduler (device-card-logic.ts),
 * and a hold-to-confirm for the one action that lets water flow. Controls render only with the server's `can_control`.
 */
@customElement('device-activity')
export class DeviceActivity extends LitElement {
  @state() private open = false;
  @state() private target: ActivityTarget | null = null;
  @state() private area = '';
  @state() private tab: Tab = 'activity';
  @state() private menu: { x: number; y: number } | null = null;
  @state() private filters: Filters = { ...DEFAULT_FILTERS };
  @state() private feed: ActivityItem[] = [];
  @state() private page: ActivityPage | null = null;
  @state() private feedStatus: FeedStatus = 'loading';
  @state() private loadingMore = false;
  @state() private sched: Schedule[] = [];
  @state() private schedStatus: SchedStatus = 'loading';
  @state() private editing: { id: string } | null = null;
  @state() private busy = new Set<string>();
  // CARD1: the equipment card
  @state() private row: EntityRow | null = null;
  @state() private rowStatus: RowStatus = 'idle';
  @state() private holding = false;
  @state() private timerBusy = false;
  @state() private timerNote = '';

  private opener: HTMLElement | null = null;
  private token = 0;
  private schedToken = 0;
  private rowToken = 0;
  private holdTimer: number | undefined;
  /** The same command envelope as the area tiles (optimistic, confirmed, rolled back); a settled command refetches the row. */
  private ctl = new DeviceControls(this, () => void this.loadRow());

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener(OPEN_EVENT, this.onOpen as EventListener);
  }

  disconnectedCallback() {
    window.removeEventListener(OPEN_EVENT, this.onOpen as EventListener);
    super.disconnectedCallback();
  }

  private onOpen = (e: CustomEvent<ActivityOpen>) => {
    const d = e.detail;
    this.opener = d.opener ?? null;
    this.target = d.target;
    this.area = d.area ?? '';
    if (d.menu) {
      this.menu = d.menu;
      this.open = false;
      return;
    }
    this.openPopup(d.tab);
  };

  private openPopup(tab: Tab) {
    this.menu = null;
    this.tab = tab;
    this.filters = { ...DEFAULT_FILTERS };
    this.feed = [];
    this.page = null;
    this.editing = null;
    this.open = true;
    this.row = null;
    this.rowStatus = 'idle';
    this.timerNote = '';
    this.cancelHold();
    void this.loadFeed();
    void this.loadSched();
    if (this.target && cardKindOf(this.target.kind)) void this.loadRow();
  }

  private closePopup() {
    this.open = false;
    this.editing = null;
    this.token++;
    this.schedToken++;
    this.rowToken++;
    this.cancelHold();
    const back = this.opener;
    this.opener = null;
    if (back?.isConnected) requestAnimationFrame(() => back.focus({ preventScroll: true }));
  }

  // ---------------------------------------------------------------------------------------------- data

  private async loadFeed(more = false) {
    const target = this.target;
    if (!target) return;
    const mine = ++this.token;
    if (more) this.loadingMore = true;
    else this.feedStatus = 'loading';
    try {
      const page = await getDeviceActivity(target.id, queryOf(this.filters, Date.now(), more ? this.page?.next_cursor : null));
      if (mine !== this.token) return;
      this.feed = more ? [...this.feed, ...page.items] : page.items;
      this.page = page;
      this.feedStatus = page.availability === 'unavailable' && !page.items.length ? 'unavailable' : 'ready';
    } catch (e) {
      if (mine !== this.token) return;
      this.feedStatus = e instanceof ActivityError && e.reason === 'forbidden' ? 'forbidden' : 'unavailable';
    } finally {
      if (mine === this.token) this.loadingMore = false;
    }
  }

  private async loadSched() {
    const target = this.target;
    if (!target) return;
    const mine = ++this.schedToken;
    this.schedStatus = 'loading';
    try {
      const r = await listSchedules({ entity: target.id, limit: 50, sort: 'next_run' });
      if (mine !== this.schedToken) return;
      this.sched = r.items;
      this.schedStatus = 'ready';
    } catch (e) {
      if (mine !== this.schedToken) return;
      this.schedStatus = e instanceof ApiError && e.status === 403 ? 'forbidden' : 'unavailable';
    }
  }

  /** CARD1: the device's own card row (state, can_control, battery ...). No API session / not visible: the card shows the tile's state only. */
  private async loadRow() {
    const target = this.target;
    if (!target || !cardKindOf(target.kind)) return;
    const mine = ++this.rowToken;
    if (this.rowStatus !== 'ready') this.rowStatus = 'loading';
    try {
      const r = await getEntityRows([target.id]);
      if (mine !== this.rowToken) return;
      const row = r.entities.find((e) => e.entity_id === target.id) ?? null;
      this.row = row;
      this.rowStatus = row ? 'ready' : 'missing';
    } catch {
      if (mine !== this.rowToken) return;
      this.row = null;
      this.rowStatus = 'missing';
    }
  }

  private setFilter(patch: Partial<Filters>) {
    this.filters = { ...this.filters, ...patch };
    void this.loadFeed();
  }

  private async toggle(s: Schedule, enabled: boolean) {
    if (this.busy.has(s.id)) return;
    this.busy = new Set(this.busy).add(s.id);
    try {
      const r = await setScheduleEnabled(s.id, enabled);
      this.sched = this.sched.map((x) => (x.id === s.id ? r.schedule : x));
    } catch {
      await this.loadSched();
    } finally {
      const b = new Set(this.busy);
      b.delete(s.id);
      this.busy = b;
    }
  }

  private onSaved = () => {
    this.editing = null;
    void this.loadSched();
  };

  // ---------------------------------------------------------------------------------------------- render

  render() {
    const tg = this.target;
    return html`${this.renderMenu()}${tg ? this.renderPopup(tg) : nothing}${this.renderEditor()}`;
  }

  private renderMenu() {
    const m = this.menu;
    if (!m) return nothing;
    const x = Math.min(Math.max(8, m.x), Math.max(8, window.innerWidth - 188));
    const y = Math.min(Math.max(8, m.y), Math.max(8, window.innerHeight - 100));
    return html`<div class="scrim" data-activity-menu-scrim @pointerdown=${() => (this.menu = null)} @contextmenu=${(e: Event) => { e.preventDefault(); this.menu = null; }}></div>
      <div class="menu" role="menu" aria-label=${t('deviceActivity.menuLabel')} style=${`inset-inline-start:auto;left:${x}px;top:${y}px`} data-activity-menu @keydown=${this.onMenuKey}>
        <button type="button" role="menuitem" data-activity-menu-activity @click=${() => this.openPopup('activity')}><sw-icon name="history" size=${16}></sw-icon>${t('deviceActivity.menuActivity')}</button>
        <button type="button" role="menuitem" data-activity-menu-schedules @click=${() => this.openPopup('schedules')}><sw-icon name="calendar" size=${16}></sw-icon>${t('deviceActivity.menuSchedules')}</button>
      </div>`;
  }

  private onMenuKey = (e: KeyboardEvent) => {
    const items = [...this.renderRoot.querySelectorAll<HTMLButtonElement>('.menu button')];
    const i = items.indexOf((this.renderRoot as ShadowRoot).activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      this.menu = null;
      const back = this.opener;
      if (back?.isConnected) requestAnimationFrame(() => back.focus({ preventScroll: true }));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    }
  };

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('menu') && this.menu) requestAnimationFrame(() => this.renderRoot.querySelector<HTMLButtonElement>('.menu button')?.focus());
  }

  private renderPopup(tg: ActivityTarget) {
    const card = cardKindOf(tg.kind);
    const on = card ? isOnState(card, this.row?.state ?? null) || (!this.row && !!tg.state && !/כבוי|סגור|לא זמין/.test(tg.state)) : !!tg.state && !/כבוי|סגור|לא זמין/.test(tg.state);
    return html`<sw-sheet ?open=${this.open && !this.editing} heading=${`${t('deviceActivity.popupLabel')}: ${tg.name}`} data-device-activity style="--sw-sheet-w:380px" @close=${() => this.closePopup()}>
      <div slot="head" class="ph ${on ? '' : 'off'}">
        <span class="ic"><sw-icon name=${KIND_ICON[tg.kind] as IconName} size=${18}></sw-icon></span>
        <div class="tt"><h3>${bidi(tg.name)}</h3><div class="sub">${card
          ? html`${this.area ? bidi(this.area) : nothing}`
          : html`${this.area ? html`${bidi(this.area)} · ` : nothing}<span data-activity-state>${tg.state}</span>${this.powerText()}`}</div></div>
      </div>
      ${card ? this.renderCard(card, tg) : nothing}
      <div class="segt" role="tablist" aria-label=${t('deviceActivity.tabs')}>
        ${(['activity', 'schedules'] as Tab[]).map(
          (id) => html`<button type="button" role="tab" id=${`da-tab-${id}`} aria-selected=${String(this.tab === id)} aria-controls="da-panel" tabindex=${this.tab === id ? 0 : -1}
            class=${this.tab === id ? 'on' : ''} data-tab=${id} @click=${() => (this.tab = id)} @keydown=${this.onTabKey}>${id === 'activity' ? t('deviceActivity.tabActivity') : t('deviceActivity.tabSchedules')}${id === 'schedules' && this.schedStatus === 'ready' && this.sched.length ? html`<span class="cnt">${this.sched.length}</span>` : nothing}</button>`,
        )}
      </div>
      <div id="da-panel" class="pbody" role="tabpanel" aria-labelledby=${`da-tab-${this.tab}`}>${this.tab === 'activity' ? this.renderActivity(tg) : this.renderSchedules()}</div>
    </sw-sheet>`;
  }

  /** An outlet's current power, only when the server linked a power sensor of the same device. */
  private powerText() {
    const p = this.page?.entity?.power;
    return p && p.value !== null && p.value !== undefined ? html` · <bdi data-activity-power>${Math.round(p.value).toLocaleString('en')} ${p.unit}</bdi>` : nothing;
  }

  private onTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    this.tab = this.tab === 'activity' ? 'schedules' : 'activity';
    requestAnimationFrame(() => this.renderRoot.querySelector<HTMLElement>(`#da-tab-${this.tab}`)?.focus());
  };

  // ---------------------------------------------------------------------------------------------- CARD1: the equipment card

  /** The state the card shows: the server's row (live through the refetch), else the tile's own text. */
  private cardState(card: CardKind, tg: ActivityTarget): { state: string | null; text: string } {
    const row = this.row;
    if (row) {
      const live = this.ctl.live<string>(row.entity_id, card === 'vacuum' ? 'vacuum' : 'power');
      const st = live ?? row.state;
      return { state: st, text: t(stateKey(card, st)) };
    }
    return { state: null, text: tg.state || t('deviceCard.stateUnknown') };
  }

  private renderCard(card: CardKind, tg: ActivityTarget) {
    const row = this.row;
    const loading = this.rowStatus === 'loading' && !row;
    const canControl = !!row && row.can_control && row.available && row.state !== 'unavailable';
    const { state, text } = this.cardState(card, tg);
    const on = isOnState(card, state);
    return html`<section class="card ${on ? 'on' : ''}" data-device-card=${card} data-card-state=${state ?? ''} ?data-can-control=${canControl} aria-label=${text}>
      ${loading
        ? html`<div class="skels tight" data-card-loading role="status" aria-label=${t('deviceCard.loading')}><div class="sk"><span><i class="skel a"></i><i class="skel b"></i></span><i class="skel d"></i></div></div>`
        : html`<div class="st">
              <span class="big" data-card-big>${text}</span>
              <span class="meta" data-card-meta>${this.renderMeta(card, row, tg)}</span>
            </div>
            ${canControl ? this.renderActions(card, row!, state) : nothing}
            ${row ? this.ctl.renderCmdStatus(row.entity_id) : nothing}
            ${this.timerNote ? html`<div class="rollback-note" data-timer-note role="status">${this.timerNote}</div>` : nothing}`}
    </section>`;
  }

  /** The second line: power / since for a heater, position for a tap, battery · suction · last cleaning for a vacuum. */
  private renderMeta(card: CardKind, row: EntityRow | null, tg: ActivityTarget) {
    const parts: unknown[] = [];
    if (card === 'water_heater') {
      const p = this.page?.entity?.power ?? row?.power;
      if (p && p.value !== null && p.value !== undefined) parts.push(html`<bdi data-card-power>${Math.round(p.value).toLocaleString('en')} ${p.unit}</bdi>`);
      if (row?.current_temperature !== null && row?.current_temperature !== undefined) parts.push(tf('deviceCard.heaterCurrent', { n: ltrNum(row.current_temperature) }));
      if (row?.target_temperature !== null && row?.target_temperature !== undefined) parts.push(tf('deviceCard.heaterTarget', { n: ltrNum(row.target_temperature) }));
      if (row?.last_changed) parts.push(html`<span data-card-since>${tf('deviceCard.since', { t: whenLabel(row.last_changed) })}</span>`);
    } else if (card === 'valve') {
      if (row?.position !== null && row?.position !== undefined && row.position > 0 && row.position < 100 && !isMovingState(row.state)) parts.push(tf('deviceCard.valvePosition', { n: ltrNum(row.position) }));
      if (row?.last_changed) parts.push(html`<span data-card-since>${tf('deviceCard.since', { t: whenLabel(row.last_changed) })}</span>`);
    } else {
      if (row?.battery_level !== null && row?.battery_level !== undefined) parts.push(html`<span class="bat ${row.battery_level <= 20 ? 'low' : ''}" data-card-battery><sw-icon name="storage" size=${12}></sw-icon>${tf('deviceCard.vacBattery', { n: ltrNum(row.battery_level) })}</span>`);
      const fk = fanSpeedKey(row?.fan_speed);
      if (row?.fan_speed) parts.push(tf('deviceCard.vacFan', { v: fk ? t(fk) : row.fan_speed }));
      const last = lastCleaningAt(this.feed);
      if (this.feedStatus === 'ready') parts.push(html`<span data-card-last-clean>${last ? tf('deviceCard.vacLastClean', { t: whenLabel(last) }) : t('deviceCard.vacLastCleanNone')}</span>`);
    }
    void tg;
    return parts.length ? parts.map((p, i) => html`${i ? ' · ' : ''}${p}`) : nothing;
  }

  private renderActions(card: CardKind, row: EntityRow, state: string | null) {
    if (card === 'vacuum') return this.renderVacuumActions(row, state);
    const pa = powerActions(card, row.entity_id);
    if (!pa) return nothing;
    const on = isOnState(card, state);
    const pending = this.ctl.rowPending(row.entity_id);
    const autoOff = findAutoOff(this.sched, row.entity_id, pa.schedulableOff);
    const minutes = card === 'water_heater' ? BOOST_MINUTES : AUTO_CLOSE_MINUTES;
    // the time-boxed run: a heater offers it off (turn on + auto-off) and on (auto-off only); a tap only while open (auto-close) - opening
    // water stays behind the hold, never behind a chip
    const timers = can('schedule.manage') && pa.schedulableOff && !autoOff && (card === 'water_heater' || on);
    const timersLabel = card === 'valve' ? 'deviceCard.autoClose' : on ? 'deviceCard.autoOffLabel' : 'deviceCard.boost';
    return html`<div class="acts" data-card-actions>
        ${on
          ? html`<sw-button size="lg" icon="power" data-card-off ?disabled=${pending} @click=${() => this.send(row, pa.off, 'power')}>${t(pa.off.label)}</sw-button>`
          : pa.on.confirm
            ? this.renderHold(row, pa.on)
            : html`<sw-button size="lg" variant="primary" icon="power" data-card-on ?disabled=${pending} @click=${() => this.send(row, pa.on, 'power')}>${t(pa.on.label)}</sw-button>`}
        ${timers
          ? html`<span class="chips" role="group" aria-label=${t(timersLabel)} data-card-timers data-card-timers-mode=${on ? 'off-only' : 'boost'}>
              <span class="cl">${t(timersLabel)}</span>
              ${minutes.map((m) => html`<button type="button" class="chip" data-card-timer=${m} ?disabled=${pending || this.timerBusy} @click=${() => void this.startTimed(card, row, pa, m)}>${tf('deviceCard.boostFor', { n: ltrNum(m) })}</button>`)}
            </span>`
          : nothing}
      </div>
      ${autoOff
        ? html`<div class="auto" data-card-auto-off>
            <sw-icon name="clock" size=${14}></sw-icon>
            <span>${tf(card === 'water_heater' ? 'deviceCard.autoOffAt' : 'deviceCard.autoCloseAt', { t: whenLabel(autoOff.next_run!.at) })}</span>
            ${autoOff.can.delete
              ? html`<sw-button iconOnly size="sm" variant="ghost" icon="close" label=${t(card === 'water_heater' ? 'deviceCard.autoOffCancel' : 'deviceCard.autoCloseCancel')} data-card-auto-off-cancel ?disabled=${this.timerBusy} @click=${() => void this.cancelTimed(autoOff)}></sw-button>`
              : nothing}
          </div>`
        : nothing}`;
  }

  private renderVacuumActions(row: EntityRow, state: string | null) {
    const pending = this.ctl.rowPending(row.entity_id);
    const cleaning = state === 'cleaning';
    const away = state === 'cleaning' || state === 'paused' || state === 'returning' || state === 'idle' || state === 'error';
    return html`<div class="acts" data-card-actions>
      ${cleaning
        ? html`<sw-button size="lg" icon="pause" data-card-vac-pause ?disabled=${pending} @click=${() => this.send(row, VACUUM_ACTIONS.pause, 'vacuum')}>${t('deviceCard.vacPause')}</sw-button>`
        : html`<sw-button size="lg" variant="primary" icon="play" data-card-vac-start ?disabled=${pending} @click=${() => this.send(row, VACUUM_ACTIONS.start, 'vacuum')}>${t('deviceCard.vacStart')}</sw-button>`}
      ${away ? html`<sw-button size="lg" icon="home" data-card-vac-dock ?disabled=${pending || state === 'returning'} @click=${() => this.send(row, VACUUM_ACTIONS.dock, 'vacuum')}>${t('deviceCard.vacDock')}</sw-button>` : nothing}
    </div>`;
  }

  /** The hold-to-confirm button of the action that lets water flow: a HOLD_MS press fills it and sends with the grant; a release before cancels.
   * Keyboard: Enter / Space arm it ("לאשר?"), a second press within the window confirms (the shared arm-then-confirm rule). */
  private renderHold(row: EntityRow, act: CardAction) {
    const key = `${row.entity_id}:power`;
    const armed = this.ctl.isArmed(key);
    const pending = this.ctl.rowPending(row.entity_id);
    const fire = () => this.send(row, act, 'power');
    return html`<button type="button" class="hbtn ${this.holding ? 'holding' : ''} ${armed ? 'armed' : ''}" data-card-hold ?disabled=${pending} aria-label=${t('deviceCard.holdToOpen')}
        style=${`--hold:${HOLD_MS}ms`}
        @pointerdown=${(e: PointerEvent) => this.startHold(e, fire)} @pointerup=${this.cancelHold} @pointerleave=${this.cancelHold} @pointercancel=${this.cancelHold}
        @contextmenu=${(e: Event) => e.preventDefault()}
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.ctl.tapArmed(key, fire); } }}
        @click=${(e: Event) => e.preventDefault()}>
      <i class="prog" aria-hidden="true"></i>
      <span class="lb"><sw-icon name="power" size=${15}></sw-icon>${armed ? t('deviceCard.armedConfirm') : this.holding ? t('deviceCard.holdHint') : t(act.label)}</span>
    </button>`;
  }

  private startHold(e: PointerEvent, fire: () => void) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.cancelHold();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* no capture */
    }
    this.holding = true;
    this.holdTimer = window.setTimeout(() => {
      this.holdTimer = undefined;
      this.holding = false;
      try {
        navigator.vibrate?.(10);
      } catch {
        /* no haptics */
      }
      fire();
    }, HOLD_MS);
  }

  private cancelHold = () => {
    if (this.holdTimer !== undefined) window.clearTimeout(this.holdTimer);
    this.holdTimer = undefined;
    if (this.holding) this.holding = false;
  };

  /** One allow-listed action through the shared envelope; an "attention" action carries the confirmation grant the hold just gave. */
  private send(row: EntityRow, act: CardAction, control: 'power' | 'vacuum') {
    const key = `${row.entity_id}:${control}`;
    if (this.ctl.commands[key]?.phase === 'pending') return;
    void runCommand(key, domainOf(row.entity_id), row.entity_id, act.action, {}, act.expect, (s) => this.ctl.setCmd(key, s), { confirmed: act.confirm, label: t(act.label) });
  }

  /** The time-boxed run: turn it on now, and ask the scheduler for a one-off "off" `minutes` from now (the schedule shows in the tab too). */
  private async startTimed(card: CardKind, row: EntityRow, pa: NonNullable<ReturnType<typeof powerActions>>, minutes: number) {
    if (!pa.schedulableOff || this.timerBusy) return;
    this.timerBusy = true;
    this.timerNote = '';
    try {
      const name = tf(card === 'water_heater' ? 'deviceCard.autoOffScheduleName' : 'deviceCard.autoCloseScheduleName', { name: row.name });
      const draft = autoOffDraft(row.entity_id, pa.schedulableOff, name, new Date(), minutes);
      const r = await createSchedule(draft);
      if ('status' in r && r.status === 'unknown') this.timerNote = t('deviceCard.autoOffFailed');
      else if (!isOnState(card, this.cardState(card, this.target!).state)) this.send(row, pa.on, 'power'); // only after the auto-off exists: never an unbounded run by accident
      await this.loadSched();
    } catch {
      this.timerNote = t('deviceCard.autoOffFailed');
    } finally {
      this.timerBusy = false;
    }
  }

  private async cancelTimed(s: Schedule) {
    if (this.timerBusy) return;
    this.timerBusy = true;
    try {
      await deleteSchedule(s.id, s.revision);
    } catch {
      /* the list below tells the truth */
    } finally {
      this.timerBusy = false;
      await this.loadSched();
    }
  }

  // ---------------------------------------------------------------------------------------------- activity tab

  private renderFilters() {
    const f = this.filters;
    const dd = (label: string, items: { id: string; label: string }[], value: string, on: (id: string) => void, key: string) =>
      html`<sw-dropdown class="fchip" data-filter=${key} .items=${items} .value=${value} label=${label} @change=${(e: CustomEvent<DropdownChange>) => on(e.detail.id)}></sw-dropdown>`;
    return html`<div class="fl" role="group">
      ${dd(t('deviceActivity.filterPeriod'), PERIODS.map((p) => ({ id: p, label: PERIOD_LABEL[p] })), f.period, (id) => this.setFilter({ period: id as Period }), 'period')}
      ${dd(t('deviceActivity.filterActor'), ACTOR_FILTERS, f.actor, (id) => this.setFilter({ actor: id as Filters['actor'] }), 'actor')}
      ${dd(t('deviceActivity.filterKind'), EVENT_FILTERS, f.kind, (id) => this.setFilter({ kind: id as Filters['kind'] }), 'kind')}
    </div>`;
  }

  private renderActivity(tg: ActivityTarget) {
    if (this.feedStatus === 'forbidden') {
      return html`<sw-state-panel state="forbidden" heading=${t('deviceActivity.forbiddenTitle')} hint=${t('deviceActivity.forbiddenHint')} compact data-feed-state="forbidden"></sw-state-panel>`;
    }
    const head = this.renderFilters();
    if (this.feedStatus === 'loading') {
      return html`${head}<div class="skels" data-feed-state="loading" role="status" aria-label=${t('deviceActivity.loading')}>${[0, 1, 2].map(() => html`<div class="sk"><i class="skel c"></i><span><i class="skel a"></i><i class="skel b"></i></span><i class="skel d"></i></div>`)}</div>`;
    }
    if (this.feedStatus === 'unavailable') {
      return html`${head}<sw-state-panel state="error" heading=${t('deviceActivity.unavailableTitle')} hint=${t('deviceActivity.unavailableHint')} actionLabel=${t('deviceActivity.retry')} compact data-feed-state="unavailable" @action=${() => void this.loadFeed()}></sw-state-panel>`;
    }
    const page = this.page;
    const gap = page?.coverage.gaps[0];
    const since = trackedSince(page?.tracked_since);
    const body = this.feed.length
      ? html`${page?.availability === 'partial' || gap ? html`<div class="gap" role="note" data-feed-state="partial"><sw-icon name="warning" size=${14}></sw-icon><span>${gap ? gapText(gap) : t('deviceActivity.partialBanner')}</span></div>` : nothing}
          ${groupByDay(this.feed).map(
            (g) => html`<div class="day" data-day>${g.label}</div>${repeat(g.items, (i) => i.id, (i) => this.renderEvent(i, tg))}`,
          )}
          ${page?.next_cursor ? html`<div class="more"><sw-button size="sm" ?disabled=${this.loadingMore} data-load-more @click=${() => void this.loadFeed(true)}>${this.loadingMore ? t('deviceActivity.loadingMore') : t('deviceActivity.loadMore')}</sw-button></div>` : nothing}`
      : isFiltered(this.filters)
        ? html`<sw-state-panel state="empty" heading=${t('deviceActivity.emptyTitle')} actionLabel=${t('deviceActivity.widen')} compact data-feed-state="empty-filtered" @action=${() => this.setFilter({ period: 'month' })}></sw-state-panel>`
        : html`<sw-state-panel state="empty" heading=${page?.tracked_since ? t('deviceActivity.emptyTitle') : t('deviceActivity.emptyNone')} compact data-feed-state="empty"></sw-state-panel>`;
    return html`${head}${body}<div class="pf" data-foot>${since ? html`<span data-tracked-since>${since}</span> · ` : nothing}${footnote(page?.retention_days ?? 90, this.feed.some((x) => x.actor.type === 'device'))}</div>`;
  }

  private renderEvent(it: ActivityItem, tg: ActivityTarget) {
    const a = actorView(it);
    const d = describeEvent(it, tg.kind);
    return html`<div class="ev" data-event=${it.id} data-actor=${a.type}>
      <span class=${`av ${a.type}`} aria-hidden="true">${a.type === 'person' && a.initials ? a.initials : html`<sw-icon name=${a.glyph as IconName} size=${14}></sw-icon>`}</span>
      <div class="c">
        <div class="l1">${a.prefix ? html`<span class="kd">${a.prefix}:</span> ` : nothing}<b>${bidi(a.name)}</b><span class="vb">${d.verb}</span>${a.qualifier ? html`<span class="mt">${a.qualifier}</span>` : nothing}</div>
        <div class="l2">${d.from || d.to ? html`<span class="ba">${d.from ? html`<i><bdi>${d.from}</bdi></i><span class="arr" aria-hidden="true">←</span>` : nothing}<b><bdi>${d.to}</bdi></b></span>` : nothing}${it.note ? html`<span class="mt">${it.note}</span>` : nothing}</div>
      </div>
      <time class="t" datetime=${it.at}>${clockOf(it.at)}</time>
    </div>`;
  }

  // ---------------------------------------------------------------------------------------------- schedules tab

  private renderSchedules() {
    const canManage = can('schedule.manage');
    const add = canManage || this.sched.some((s) => s.can.edit)
      ? html`<div class="addrow"><sw-button size="sm" icon="plus" data-sched-add @click=${() => (this.editing = { id: '' })}>${t('deviceActivity.schedAdd')}</sw-button></div>`
      : nothing;
    if (this.schedStatus === 'loading') return html`<div class="skels" data-sched-state="loading" role="status" aria-label=${t('deviceActivity.schedLoading')}>${[0, 1].map(() => html`<div class="sk"><span><i class="skel a"></i><i class="skel b"></i></span><i class="skel d"></i></div>`)}</div>`;
    if (this.schedStatus === 'forbidden') return html`<sw-state-panel state="forbidden" heading=${t('deviceActivity.schedForbidden')} compact data-sched-state="forbidden"></sw-state-panel>`;
    if (this.schedStatus === 'unavailable') return html`<sw-state-panel state="error" heading=${t('deviceActivity.schedUnavailable')} actionLabel=${t('deviceActivity.retry')} compact data-sched-state="unavailable" @action=${() => void this.loadSched()}></sw-state-panel>`;
    if (!this.sched.length) return html`<sw-state-panel state="empty" heading=${t('deviceActivity.schedEmpty')} compact data-sched-state="empty"></sw-state-panel>${add}`;
    return html`${this.sched.map((s) => this.renderSched(s))}${add}`;
  }

  private renderSched(s: Schedule) {
    const ro = !s.can.edit;
    const roTag = ro || s.read_only;
    const more = s.entities.length > 1;
    return html`<div class="sr" data-schedule=${s.id}>
      <div class="c"><div class="nm">${bidi(s.display_name)}${roTag ? html` <span class="tag" data-readonly><sw-icon name="lock" size=${11}></sw-icon>${t('deviceActivity.schedReadOnly')}</span>` : nothing}${more ? html` <span class="tag">${t('deviceActivity.schedMore')}</span>` : nothing}</div>
        <div class="nx"><span>${nextRunLabel(s)}</span><span class="dy"> · ${daysLabel(s.days.tokens)}</span></div></div>
      <sw-toggle .checked=${s.enabled} ?disabled=${!s.can.toggle || this.busy.has(s.id)} label=${s.enabled ? t('deviceActivity.schedEnabled') : t('deviceActivity.schedDisabled')} labelHidden data-sched-toggle @change=${(e: CustomEvent<{ checked: boolean }>) => void this.toggle(s, e.detail.checked)}></sw-toggle>
      <sw-button iconOnly size="sm" variant="ghost" icon=${ro ? 'eye' : 'edit'} label=${ro ? t('deviceActivity.schedView') : t('deviceActivity.schedEdit')} data-sched-edit @click=${() => (this.editing = { id: s.id })}></sw-button>
    </div>`;
  }

  private renderEditor() {
    const e = this.editing;
    const tg = this.target;
    if (!e || !tg) return nothing;
    return html`<sw-sheet open wide heading=${e.id ? t('deviceActivity.schedEditTitle') : t('deviceActivity.schedNewTitle')} data-device-activity-editor @close=${() => { this.editing = null; this.open = true; void this.loadSched(); }}>
      <schedule-editor .scheduleId=${e.id} .entity=${tg.id} @saved=${this.onSaved}></schedule-editor>
    </sw-sheet>`;
  }

  static styles = [deviceControlStyles, css`
    :host { display: contents; }

    /* CARD1: the equipment card between the head and the tabs */
    .card { display: grid; gap: var(--sw-s-2); padding: var(--sw-s-3) var(--sw-s-3h); margin-block: 2px var(--sw-s-3); border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 1px solid var(--sw-border); }
    .card.on { background: var(--sw-accent-soft); border-color: transparent; }
    .card .st { display: flex; align-items: baseline; gap: var(--sw-s-2); flex-wrap: wrap; min-inline-size: 0; }
    .card .big { font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-semibold); color: var(--sw-heading, var(--sw-text)); }
    .card.on .big { color: var(--sw-accent-text); }
    .card .meta { color: var(--sw-text-2); font-size: var(--sw-fs-sm); display: inline-flex; flex-wrap: wrap; gap: 0 var(--sw-s-1); align-items: center; }
    .card .bat { display: inline-flex; align-items: center; gap: 3px; }
    .card .bat.low { color: var(--sw-danger-text); }
    .card .acts { display: flex; align-items: center; gap: var(--sw-s-2); flex-wrap: wrap; }
    .card .acts sw-button { --sw-touch-desktop: 36px; }
    .chips { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .chips .cl { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .chip {
      min-block-size: 30px; padding: 0 10px; border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border-strong); background: var(--sw-surface-solid); color: var(--sw-text);
      font: inherit; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-medium); cursor: pointer; font-variant-numeric: tabular-nums;
    }
    .chip:hover { background: var(--sw-surface-3); }
    .chip:disabled { opacity: .45; cursor: not-allowed; }
    .chip:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 1px; }
    .auto { display: flex; align-items: center; gap: var(--sw-s-2); color: var(--sw-text-2); font-size: var(--sw-fs-sm); min-block-size: 28px; }
    .auto span { flex: 1; min-inline-size: 0; }
    /* the hold-to-confirm button: a bar fills it over HOLD_MS while the pointer is held */
    .hbtn {
      position: relative; overflow: hidden; isolation: isolate; display: inline-flex; align-items: center; justify-content: center; min-block-size: 36px; padding-inline: 16px;
      border-radius: var(--sw-r-sm); border: 1px solid var(--sw-accent); background: var(--sw-accent); color: var(--sw-text-inverse); font: inherit; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-medium);
      cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
    }
    .hbtn .lb { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 6px; }
    .hbtn .prog { position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: 0; background: rgba(255, 255, 255, .35); }
    .hbtn.holding .prog { inline-size: 100%; transition: inline-size var(--hold, 1100ms) linear; }
    .hbtn.armed { background: var(--sw-warning-soft); border-color: var(--sw-warning); color: var(--sw-warning-text); }
    .hbtn:disabled { opacity: .45; cursor: not-allowed; }
    .hbtn:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { .hbtn.holding .prog { transition: none; inline-size: 100%; opacity: .5; } }
    .skels.tight { padding: 0; }
    .scrim { position: fixed; inset: 0; z-index: calc(var(--sw-z-modal) + 1); }
    .menu {
      position: fixed; z-index: calc(var(--sw-z-modal) + 2); min-inline-size: 176px; padding: var(--sw-s-1);
      background: var(--sw-surface-solid); color: var(--sw-text); border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); box-shadow: var(--sw-shadow-3);
      display: grid; gap: 2px;
    }
    .menu button {
      display: flex; align-items: center; gap: var(--sw-s-2); min-block-size: var(--sw-touch-desktop); padding: 0 var(--sw-s-3);
      background: transparent; border: 0; border-radius: var(--sw-r-sm); color: inherit; font: inherit; font-size: var(--sw-fs-md); cursor: pointer; text-align: start;
    }
    .menu button:hover, .menu button:focus-visible { background: var(--sw-accent-soft); color: var(--sw-accent-text); outline: none; }
    .menu button:focus-visible { box-shadow: 0 0 0 2px var(--sw-focus); }

    .ph { display: flex; align-items: center; gap: var(--sw-s-3); min-inline-size: 0; flex: 1; }
    .ic { display: grid; place-items: center; inline-size: 36px; block-size: 36px; border-radius: var(--sw-r-md); background: var(--sw-accent-soft); color: var(--sw-accent-text); flex: none; }
    .ph.off .ic { background: var(--sw-surface-3); color: var(--sw-text-2); }
    .tt { min-inline-size: 0; }
    .tt h3 { margin: 0; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-semibold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sub { color: var(--sw-text-2); font-size: var(--sw-fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .segt { display: flex; gap: 2px; padding: 3px; margin-block-end: var(--sw-s-2); background: var(--sw-surface-3); border-radius: var(--sw-r-pill); }
    .segt button {
      flex: 1; min-block-size: 36px; border: 0; border-radius: var(--sw-r-pill); background: transparent; color: var(--sw-text-2); font: inherit; font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: var(--sw-s-1h);
    }
    .segt button.on { background: var(--sw-surface-solid); color: var(--sw-accent-text); box-shadow: var(--sw-shadow-1); }
    .segt button:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 1px; }
    .cnt { font-size: var(--sw-fs-xs); background: var(--sw-accent-soft); color: var(--sw-accent-text); border-radius: var(--sw-r-pill); padding: 0 6px; }

    .pbody { min-block-size: 120px; max-block-size: min(60vh, 520px); overflow: auto; margin-inline: calc(var(--sw-s-1) * -1); padding-inline: var(--sw-s-1); }
    .fl { display: flex; flex-wrap: wrap; gap: var(--sw-s-2); padding-block: var(--sw-s-1h) var(--sw-s-2); }
    .day { padding: var(--sw-s-2) 0 var(--sw-s-1); color: var(--sw-text-3); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); }
    .ev { display: grid; grid-template-columns: 28px 1fr auto; gap: var(--sw-s-3); align-items: center; min-block-size: 52px; border-block-end: 1px solid var(--sw-border); padding-block: var(--sw-s-1h); }
    .av { display: grid; place-items: center; inline-size: 28px; block-size: 28px; border-radius: 50%; background: var(--sw-accent-soft); color: var(--sw-accent-text); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); }
    .av.unknown { background: transparent; border: 1px dashed var(--sw-border-strong); color: var(--sw-text-3); }
    .av.automation, .av.schedule, .av.scene, .av.device, .av.system { background: var(--sw-surface-3); color: var(--sw-text-2); }
    .c { min-inline-size: 0; }
    .l1 { font-size: var(--sw-fs-md); display: flex; flex-wrap: wrap; gap: 0 var(--sw-s-1h); align-items: baseline; }
    .l1 .kd, .vb { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .l2 { display: flex; flex-wrap: wrap; gap: 0 var(--sw-s-2); color: var(--sw-text-2); font-size: var(--sw-fs-sm); align-items: baseline; }
    .ba i { font-style: normal; } .ba b { color: var(--sw-text); font-weight: var(--sw-fw-medium); } .arr { margin-inline: var(--sw-s-1); }
    .mt { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .t { color: var(--sw-text-3); font-size: var(--sw-fs-sm); direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
    .more { display: flex; justify-content: center; padding: var(--sw-s-3); }
    .pf { padding-block: var(--sw-s-2) 0; color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .gap { display: flex; gap: var(--sw-s-2); align-items: center; padding: var(--sw-s-2) var(--sw-s-3); margin-block: var(--sw-s-1h); border-radius: var(--sw-r-sm); background: var(--sw-warning-soft); color: var(--sw-warning-text); font-size: var(--sw-fs-sm); }

    .skels { display: grid; gap: var(--sw-s-3); padding: var(--sw-s-2) 0; }
    .sk { display: grid; grid-template-columns: auto 1fr 30px; gap: var(--sw-s-3); align-items: center; }
    .sk > span { display: grid; gap: 6px; }
    .skel { display: block; block-size: 12px; border-radius: var(--sw-r-xs); background: var(--sw-surface-3); animation: pulse 1.2s ease-in-out infinite; }
    .skel.c { inline-size: 28px; block-size: 28px; border-radius: 50%; } .skel.a { inline-size: 60%; } .skel.b { inline-size: 35%; block-size: 10px; } .skel.d { block-size: 10px; }
    @keyframes pulse { 50% { opacity: .5; } }
    @media (prefers-reduced-motion: reduce) { .skel { animation: none; } }

    .sr { display: grid; grid-template-columns: 1fr auto auto; gap: var(--sw-s-3); align-items: center; min-block-size: 56px; border-block-end: 1px solid var(--sw-border); padding-block: var(--sw-s-1h); }
    .nm { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-medium); } .nx { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .tag { display: inline-flex; align-items: center; gap: 3px; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-regular); color: var(--sw-text-2); background: var(--sw-surface-3); border-radius: var(--sw-r-pill); padding: 1px 7px; }
    .addrow { display: flex; padding-block: var(--sw-s-3) var(--sw-s-1); }
  `];
}

declare global {
  interface HTMLElementTagNameMap {
    'device-activity': DeviceActivity;
  }
}
