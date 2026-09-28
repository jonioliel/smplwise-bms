import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-chip';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-toggle';
import '../components/sw-button';
import type { StateKind } from '../components/sw-badge';
import type { IconName } from '../components/sw-icon';
import { canAnywhere, isApi } from '../api/session';
import { ApiError, describeError } from '../api/client';
import { stateLabel, subscribeHa, type HaSyncState } from '../api/ha';
import { ALARM_HE, CARD_EMPTY, CARD_IDS, HVAC_ACTION_HE, HVAC_HE, getDevicesArea, type CardId, type DeviceAreaDetail, type DeviceCard, type DeviceRow } from '../api/devices';
import { debouncedCommand, runCommand, type CommandState } from '../api/device-commands';
import { alarmTone, REFRESH_WINDOW_MS } from './devices-building';
import { navigate } from '../router';
import { bidi, ltrNum } from '../i18n/bidi';

const HVAC_SELECTABLE = ['off', 'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only'];
/** How long a "one tap to arm, one more to confirm" button stays armed (cover open / close: attention risk in the
 * allow-list, services/ha_bridge.py - a confirmation is required, but a modal is overkill for a card tap). */
const ARM_MS = 3000;

const CARD_ICON: Record<CardId, IconName> = { lighting: 'light', switches: 'bolt', climate: 'activity', covers: 'layers', security: 'shield', media: 'play', sensors: 'sensor' };

function deg(n: number | null | undefined, unit = '°'): string {
  return n === null || n === undefined ? '—' : `${ltrNum(Number.isInteger(n) ? n : n.toFixed(1))}${unit}`;
}

/** The read-only label of a row in words: "דולק · 50%", "פתוח · 70%", "נעול", "23.5 °C" ... (api/ha stateLabel's rules). */
export function rowLabel(r: DeviceRow): string {
  if (r.state === 'unavailable' || !r.available) return 'לא זמין';
  if (r.domain === 'light') return r.active ? (r.brightness_pct !== null && r.brightness_pct !== undefined ? `דולק · ${ltrNum(r.brightness_pct)}%` : 'דולק') : 'כבוי';
  if (r.domain === 'cover') {
    const s = r.state === 'open' ? 'פתוח' : r.state === 'closed' ? 'סגור' : r.state === 'opening' ? 'נפתח…' : r.state === 'closing' ? 'נסגר…' : (r.state ?? 'לא ידוע');
    return r.position !== null && r.position !== undefined && !r.moving ? `${s} · ${ltrNum(r.position)}%` : s;
  }
  if (r.domain === 'climate') return r.hvac_mode ? (HVAC_HE[r.hvac_mode] ?? r.hvac_mode) : 'לא ידוע';
  if (r.domain === 'alarm_control_panel') return ALARM_HE[r.state ?? ''] ?? r.state ?? 'לא ידוע';
  if (r.domain === 'media_player') return r.state === 'playing' ? 'מנגן' : r.state === 'paused' ? 'מושהה' : r.state === 'idle' ? 'דולק · ללא תוכן' : r.state === 'on' ? 'דולק' : r.state === 'standby' ? 'המתנה' : r.state === 'off' ? 'כבוי' : (r.state ?? 'לא ידוע');
  if (r.domain === 'fan') return r.active ? (r.percentage !== null && r.percentage !== undefined ? `פועל · ${ltrNum(r.percentage)}%` : 'פועל') : 'כבוי';
  if (r.domain === 'humidifier') return r.active ? 'פועל' : 'כבוי';
  return stateLabel({ domain: r.domain, state: r.state, unit: r.unit ?? null, device_class: r.device_class, attributes: {} });
}

/**
 * חשמל והתקנים › אזור (CR-007 slice 1, read-only): one Home Assistant area as the mockup's cards - lighting, switches,
 * climate, covers, security, media, sensors - with the sibling areas of the same floor as chips and a breadcrumb back
 * to the building tree. Cards with something in them come first; empty ones close the grid with the honest empty
 * state (DomusUI's own layout choice for phones, applied everywhere). No controls in this slice: a lit light is a
 * warm tile, a cover's position is a bar, nothing is a switch or a slider.
 */
@customElement('devices-area')
export class DevicesArea extends LitElement {
  @property() areaId = '';
  @state() private detail: DeviceAreaDetail | null = null;
  @state() private error = '';
  @state() private forbidden = false;
  @state() private notFound = false;
  @state() private sync: HaSyncState | null = null;
  /** One control's command state per key (`entityId:control` - power, brightness, position, temp, mode, fan,
   * mute, playpause; each independent so a slider drag never supersedes a button tap on the same entity). */
  @state() private commands: Record<string, CommandState<unknown>> = {};
  /** A sensitive button (cover open/close) armed by a first tap, expiring if the second tap never comes. */
  @state() private armed: Record<string, number> = {};
  private stop: (() => void) | null = null;
  private timer = 0;
  private loading = false;
  private loadAgain = false;
  private debouncedRange = debouncedCommand<number>();

  static styles = css`
    :host {
      display: block;
    }
    .chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .chips .lbl {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-inline-end: 4px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 12px;
      align-items: start;
    }
    sw-card[data-empty] {
      background: var(--sw-surface-2);
    }
    .count {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-variant-numeric: tabular-nums;
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      min-inline-size: 0;
    }
    .tile.on {
      background: var(--sw-warning-soft);
      border-color: color-mix(in srgb, var(--sw-warning) 40%, var(--sw-border));
    }
    .tile.off {
      color: var(--sw-text-2);
    }
    .tile.unavailable,
    .row.unavailable {
      opacity: 0.6;
    }
    .tile .t {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .tile .t span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tile.on .t sw-icon {
      color: var(--sw-warning);
    }
    .tile .s {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      font-variant-numeric: tabular-nums;
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 4px 10px;
      align-items: center;
      padding: 8px 10px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    .row.on {
      border-color: color-mix(in srgb, var(--sw-warning) 40%, var(--sw-border));
      background: var(--sw-warning-soft);
    }
    .row .n {
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-sm);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row .v {
      font-size: var(--sw-fs-sm);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      text-align: end;
    }
    .row .v.big {
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-semibold);
    }
    .row .d {
      grid-column: 1 / -1;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .bar {
      grid-column: 1 / -1;
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
      border-radius: 3px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    /* CR-007 slice 2: single-entity controls */
    .tile.pending,
    .row.pending {
      opacity: 0.7;
    }
    .tile sw-toggle {
      margin-inline-start: auto;
    }
    input[type='range'].ctl-range {
      grid-column: 1 / -1;
      inline-size: 100%;
      accent-color: var(--sw-accent);
      block-size: 20px;
      margin: 2px 0;
    }
    .tile input[type='range'].ctl-range {
      margin-top: 4px;
    }
    .ctl-row {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .ctl-val {
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      min-inline-size: 34px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .ctl-select {
      font: inherit;
      font-size: var(--sw-fs-xs);
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
      padding: 3px 6px;
    }
    .rollback-note {
      grid-column: 1 / -1;
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .tile .rollback-note {
      white-space: normal;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (!isApi()) return;
    if (!canAnywhere('devices.read')) {
      this.forbidden = true;
      return;
    }
    this.stop = subscribeHa(
      (m) => {
        // only pushes about this area's own entities refetch it; until the area is loaded every push may be one of them
        if (m.type === 'entity_state_changed') {
          if (!this.detail || this.entityIds.has(m.entity.entity_id)) this.scheduleReload();
        } else if (m.type === 'ha_sync_state') {
          if (this.sync) this.sync = { ...this.sync, connected: m.connected };
          this.scheduleReload();
        } else if (m.type === 'heartbeat') this.sync = m.sync;
      },
      (connected) => {
        if (connected) this.scheduleReload();
      },
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.stop?.();
    this.stop = null;
    window.clearTimeout(this.timer);
    this.timer = 0;
  }

  /** The loaded area's entity ids (all cards), for the push filter. */
  private get entityIds(): Set<string> {
    if (!this.detail) return new Set();
    return new Set(CARD_IDS.flatMap((id) => this.detail!.cards[id].entities.map((r) => r.entity_id)));
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('areaId') && isApi() && !this.forbidden) {
      this.detail = null;
      this.notFound = false;
      this.error = '';
      void this.load();
    }
  }

  /** Throttle, as devices-building: one refetch per window while pushes keep coming, one more after they stop. */
  private scheduleReload() {
    if (this.timer) return;
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      void this.load();
    }, REFRESH_WINDOW_MS);
  }

  private async load() {
    if (!this.areaId) return;
    if (this.loading) {
      this.loadAgain = true;
      return;
    }
    this.loading = true;
    const id = this.areaId;
    try {
      const d = await getDevicesArea(id);
      if (id !== this.areaId) return; // the route moved on while this was in flight
      this.detail = d;
      this.sync = d.sync;
      this.error = '';
      this.notFound = false;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) this.forbidden = true;
      else if (err instanceof ApiError && err.status === 404) this.notFound = true;
      else this.error = describeError(err);
    } finally {
      this.loading = false;
      if (this.loadAgain) {
        this.loadAgain = false;
        void this.load();
      }
    }
  }

  // ---------------------------------------------------------------- CR-007 slice 2: single-entity controls

  private setCmd = (key: string, s: CommandState<unknown>) => {
    this.commands = { ...this.commands, [key]: s };
    if (s.phase === 'confirmed') window.setTimeout(() => this.clearCmd(key, s), 1200);
    else if (s.phase === 'rolled_back') window.setTimeout(() => this.clearCmd(key, s), 4000);
  };

  /** Only clears the slot if nothing newer took it over in the meantime (a superseded rollback must not erase a
   * fresher pending/confirmed state the user already triggered again). */
  private clearCmd(key: string, was: CommandState<unknown>) {
    if (this.commands[key] === was) {
      const next = { ...this.commands };
      delete next[key];
      this.commands = next;
    }
  }

  private rowPending(entityId: string): boolean {
    return Object.entries(this.commands).some(([k, v]) => (k === entityId || k.startsWith(`${entityId}:`)) && v.phase === 'pending');
  }

  private rowNote(entityId: string): string | null {
    for (const [k, v] of Object.entries(this.commands)) {
      if ((k === entityId || k.startsWith(`${entityId}:`)) && v.phase === 'rolled_back') return v.note;
    }
    return null;
  }

  private isArmed(key: string): boolean {
    const exp = this.armed[key];
    return !!exp && exp > Date.now();
  }

  /** First tap arms a sensitive button (shows "לאשר?" for ARM_MS); the second tap within the window runs it. */
  private tapArmed(key: string, run: () => void) {
    if (this.isArmed(key)) {
      const next = { ...this.armed };
      delete next[key];
      this.armed = next;
      run();
      return;
    }
    this.armed = { ...this.armed, [key]: Date.now() + ARM_MS };
    window.setTimeout(() => {
      if (this.armed[key] && this.armed[key] <= Date.now()) {
        const next = { ...this.armed };
        delete next[key];
        this.armed = next;
      }
    }, ARM_MS + 50);
  }

  /** `r` with any live (pending or already-confirmed-but-not-yet-refetched) command values overlaid, so the row's
   * own text - not only the control the user is dragging - shows the target, and keeps showing it through the
   * confirmed phase until the next data refresh catches up. A rolled-back command overlays nothing: the row falls
   * back to the last real value, which is exactly what "never claim the target as fact" means for plain text. */
  private overlay(r: DeviceRow): DeviceRow {
    const live = <T,>(control: string): T | undefined => {
      const c = this.commands[`${r.entity_id}:${control}`] as CommandState<T> | undefined;
      return c && c.phase !== 'rolled_back' ? c.optimistic : undefined;
    };
    let out = r;
    const power = live<boolean>('power');
    if (power !== undefined) out = { ...out, active: power, state: power ? (out.state && out.state !== 'off' ? out.state : 'on') : 'off' };
    const brightness = live<number>('brightness');
    if (brightness !== undefined) out = { ...out, brightness_pct: brightness };
    const position = live<number>('position');
    if (position !== undefined) out = { ...out, position, moving: false };
    const temp = live<number>('temp');
    if (temp !== undefined) out = { ...out, target_temperature: temp };
    const percentage = live<number>('percentage');
    if (percentage !== undefined) out = { ...out, percentage, active: true };
    const mode = live<string>('mode');
    if (mode !== undefined) out = { ...out, hvac_mode: mode, state: mode, active: mode !== 'off' };
    const fan = live<string>('fan');
    if (fan !== undefined) out = { ...out, fan_mode: fan };
    const mute = live<boolean>('mute');
    if (mute !== undefined) out = { ...out, muted: mute };
    const playpause = live<string>('playpause');
    if (playpause !== undefined) out = { ...out, state: playpause };
    return out;
  }

  private renderPowerToggle(r: DeviceRow) {
    const key = `${r.entity_id}:power`;
    const pending = this.commands[key]?.phase === 'pending';
    const onId = r.domain === 'light' ? 'light.turn_on' : r.domain === 'input_boolean' ? 'input_boolean.turn_on' : r.domain === 'media_player' ? 'media_player.turn_on' : r.domain === 'fan' ? 'fan.turn_on' : 'switch.turn_on';
    const offId = r.domain === 'light' ? 'light.turn_off' : r.domain === 'input_boolean' ? 'input_boolean.turn_off' : r.domain === 'media_player' ? 'media_player.turn_off' : r.domain === 'fan' ? 'fan.turn_off' : 'switch.turn_off';
    const change = (ev: Event) => {
      ev.stopPropagation();
      if (pending) return;
      const next = !r.active;
      void runCommand(key, r.domain, r.entity_id, next ? onId : offId, {}, next, (s) => this.setCmd(key, s));
    };
    return html`<sw-toggle data-control="power" .checked=${r.active} ?disabled=${pending} label=${bidi(r.name)} labelHidden @click=${(e: Event) => e.stopPropagation()} @change=${change}></sw-toggle>`;
  }

  private renderBrightnessSlider(r: DeviceRow) {
    const key = `${r.entity_id}:brightness`;
    const onInput = (ev: Event) => {
      const pct = Number((ev.target as HTMLInputElement).value);
      this.debouncedRange(key, 'light', r.entity_id, 'light.turn_on', { brightness_pct: pct }, pct, (s) => this.setCmd(key, s));
    };
    return html`<input type="range" class="ctl-range" data-control="brightness" min="1" max="100" .value=${String(r.brightness_pct ?? 100)} @input=${onInput} @click=${(e: Event) => e.stopPropagation()} aria-label="בהירות" />`;
  }

  private renderCoverControls(r: DeviceRow) {
    const entityId = r.entity_id;
    const openKey = `${entityId}:open`;
    const closeKey = `${entityId}:close`;
    const stopKey = `${entityId}:stop`;
    const posKey = `${entityId}:position`;
    const busy = this.rowPending(entityId);
    const doOpen = () => this.tapArmed(openKey, () => void runCommand(openKey, 'cover', entityId, 'cover.open_cover', {}, 'open', (s) => this.setCmd(openKey, s)));
    const doClose = () => this.tapArmed(closeKey, () => void runCommand(closeKey, 'cover', entityId, 'cover.close_cover', {}, 'closed', (s) => this.setCmd(closeKey, s)));
    const doStop = () => void runCommand(stopKey, 'cover', entityId, 'cover.stop_cover', {}, 'stopped', (s) => this.setCmd(stopKey, s));
    const onPos = (ev: Event) => {
      const pct = Number((ev.target as HTMLInputElement).value);
      this.debouncedRange(posKey, 'cover', entityId, 'cover.set_cover_position', { position: pct }, pct, (s) => this.setCmd(posKey, s));
    };
    return html`<div class="ctl-row" data-control="cover">
      <sw-button size="sm" ?disabled=${busy} data-control="open" @click=${doOpen}>${this.isArmed(openKey) ? 'לאשר פתיחה?' : 'פתיחה'}</sw-button>
      <sw-button size="sm" ?disabled=${busy} data-control="stop" @click=${doStop}>עצירה</sw-button>
      <sw-button size="sm" ?disabled=${busy} data-control="close" @click=${doClose}>${this.isArmed(closeKey) ? 'לאשר סגירה?' : 'סגירה'}</sw-button>
      ${r.position !== null && r.position !== undefined ? html`<input type="range" class="ctl-range" data-control="position" min="0" max="100" .value=${String(r.position)} @input=${onPos} aria-label="מיקום התריס" />` : nothing}
    </div>`;
  }

  private renderClimateControls(r: DeviceRow) {
    const entityId = r.entity_id;
    if (r.domain === 'climate') {
      const tempKey = `${entityId}:temp`;
      const pending = this.commands[tempKey]?.phase === 'pending';
      const target = r.target_temperature ?? 22;
      const setTemp = (next: number) => this.debouncedRange(tempKey, 'climate', entityId, 'climate.set_temperature', { temperature: next }, next, (s) => this.setCmd(tempKey, s));
      const modeKey = `${entityId}:mode`;
      const changeMode = (ev: Event) => {
        const v = (ev.target as HTMLSelectElement).value;
        if (v === 'off') void runCommand(modeKey, 'climate', entityId, 'climate.turn_off', {}, 'off', (s) => this.setCmd(modeKey, s));
        else void runCommand(modeKey, 'climate', entityId, 'climate.set_hvac_mode', { hvac_mode: v }, v, (s) => this.setCmd(modeKey, s));
      };
      const fanKey = `${entityId}:fan`;
      const changeFan = (ev: Event) => {
        const v = (ev.target as HTMLInputElement).value.trim();
        if (v) void runCommand(fanKey, 'climate', entityId, 'climate.set_fan_mode', { fan_mode: v }, v, (s) => this.setCmd(fanKey, s));
      };
      return html`<div class="ctl-row" data-control="climate">
        <sw-button size="sm" iconOnly icon="minus" label="הורדת טמפרטורה" data-control="temp-down" ?disabled=${pending} @click=${() => setTemp(Math.round((target - 0.5) * 10) / 10)}></sw-button>
        <span class="ctl-val" data-control="temp-value">${deg(target)}</span>
        <sw-button size="sm" iconOnly icon="plus" label="העלאת טמפרטורה" data-control="temp-up" ?disabled=${pending} @click=${() => setTemp(Math.round((target + 0.5) * 10) / 10)}></sw-button>
        <select class="ctl-select" data-control="mode" aria-label="מצב פעולה" .value=${r.hvac_mode ?? 'off'} @change=${changeMode}>
          ${HVAC_SELECTABLE.map((m) => html`<option value=${m}>${HVAC_HE[m] ?? m}</option>`)}
        </select>
        <input class="ctl-select" data-control="fan-mode" type="text" placeholder="מצב מאוורר" .value=${r.fan_mode ?? ''} maxlength="40" @change=${changeFan} aria-label="מצב מאוורר" />
      </div>`;
    }
    if (r.domain === 'fan') {
      const pctKey = `${entityId}:percentage`;
      const setPct = (ev: Event) => {
        const v = Number((ev.target as HTMLInputElement).value);
        this.debouncedRange(pctKey, 'fan', entityId, 'fan.set_percentage', { percentage: v }, v, (s) => this.setCmd(pctKey, s));
      };
      return html`<div class="ctl-row" data-control="fan">
        ${this.renderPowerToggle(r)}
        <input type="range" class="ctl-range" data-control="percentage" min="0" max="100" .value=${String(r.percentage ?? 0)} @input=${setPct} aria-label="עוצמת מאוורר" />
      </div>`;
    }
    return nothing; // humidifier: read-only this slice
  }

  private renderMediaControls(r: DeviceRow) {
    const entityId = r.entity_id;
    const muteKey = `${entityId}:mute`;
    const ppKey = `${entityId}:playpause`;
    const muted = Boolean(r.muted);
    const toggleMute = () => void runCommand(muteKey, 'media_player', entityId, 'media_player.volume_mute', { is_volume_muted: !muted }, !muted, (s) => this.setCmd(muteKey, s));
    const playing = r.state === 'playing';
    const playPause = () => void runCommand(ppKey, 'media_player', entityId, 'media_player.media_play_pause', {}, playing ? 'paused' : 'playing', (s) => this.setCmd(ppKey, s));
    return html`<div class="ctl-row" data-control="media">
      ${this.renderPowerToggle(r)}
      <sw-button size="sm" icon=${playing ? 'pause' : 'play'} iconOnly label="נגן / השהה" data-control="playpause" @click=${playPause}></sw-button>
      <sw-button size="sm" icon="volume" iconOnly label=${muted ? 'בטל השתקה' : 'השתקה'} data-control="mute" @click=${toggleMute}></sw-button>
    </div>`;
  }

  render() {
    const heading = 'חשמל והתקנים';
    if (!isApi()) {
      return html`<sw-page heading="אזור" subheading="חשמל והתקנים · נתוני הדגמה" backHref="/devices/building" crumbs=${`${heading} | אזור`}><sw-state-panel state="empty" heading="מסך האזור עובד מול השרת" hint="במצב הדגמה אין אזורים של Home Assistant להצגה; עץ המבנה מציג נתוני הדגמה."></sw-state-panel></sw-page>`;
    }
    if (this.forbidden) {
      return html`<sw-page heading=${heading} subheading="אזור" backHref="/devices/building"><sw-state-panel data-devices-state="no_permission" state="forbidden" heading="אין לך הרשאת צפייה בחשמל והתקנים" hint="נדרשת ההרשאה צפייה בחשמל והתקנים. פנה למנהל המערכת."></sw-state-panel></sw-page>`;
    }
    if (this.notFound) {
      return html`<sw-page heading=${heading} subheading="אזור" backHref="/devices/building" crumbs=${`${heading} | אזור`}><sw-state-panel data-devices-state="not_found" state="empty" heading="האזור לא נמצא" hint="האזור אינו קיים ב־Home Assistant, או שאין בו התקנים שבהרשאתך."></sw-state-panel></sw-page>`;
    }
    const d = this.detail;
    if (!d) {
      return html`<sw-page heading=${heading} subheading="אזור" backHref="/devices/building">${this.error
        ? html`<sw-state-panel data-devices-state="load_error" state="error" heading="לא ניתן לטעון את האזור" hint=${this.error}></sw-state-panel>`
        : html`<sw-state-panel state="loading"></sw-state-panel>`}</sw-page>`;
    }
    const floorName = d.area.floor_name ?? '';
    const crumbs = [heading, floorName, d.area.name].filter(Boolean).join(' | ');
    const sub = `${floorName ? `${bidi(floorName)} · ` : ''}${d.counts.entities} התקנים${d.scoped ? ' · לפי הקומות שלך' : ''}`;
    const connected = this.sync?.connected ?? false;
    const cards = CARD_IDS.map((id) => d.cards[id]);
    const filled = cards.filter((c) => c.count > 0);
    const empty = cards.filter((c) => c.count === 0);
    const anyControllable = cards.some((c) => c.entities.some((r) => r.can_control));
    return html`<sw-page heading=${bidi(d.area.name)} subheading=${sub} backHref="/devices/building" crumbs=${crumbs} wide>
      <div slot="actions">
        ${d.counts.alarm ? html`<sw-badge data-area-alarm kind=${alarmTone(d.counts.alarm)} label=${`אזעקה: ${ALARM_HE[d.counts.alarm] ?? d.counts.alarm}`}></sw-badge>` : nothing}
        <sw-badge data-devices-sync kind=${connected ? 'live' : 'stale'} label=${connected ? 'מסונכרן עם Home Assistant' : 'לא מסונכרן עם Home Assistant'}></sw-badge>
      </div>
      ${d.floor_areas.length > 1
        ? html`<div class="chips" role="navigation" aria-label="אזורים בקומה">
            <span class="lbl">${floorName ? bidi(floorName) : 'אזורים'}:</span>
            ${d.floor_areas.map(
              (a) => html`<sw-chip data-area-chip=${a.area_id} ?selected=${a.area_id === d.area.area_id} .count=${a.counts.entities} @click=${() => navigate(`/devices/areas/${encodeURIComponent(a.area_id)}`)}>${bidi(a.name)}</sw-chip>`,
            )}
          </div>`
        : nothing}
      ${this.error ? html`<sw-state-panel compact state="error" heading="הרענון האחרון נכשל" hint=${this.error}></sw-state-panel>` : nothing}
      <div class="grid">
        ${repeat([...filled, ...empty], (c) => c.id, (c) => this.renderCard(c))}
      </div>
      <div class="note">
        ${anyControllable
          ? 'הקשה על מתג, כפתור או החלקה לשליטה בהתקן; המצב מוצג באופן זמני עד לאישור בפועל מ־Home Assistant, ומתאפס אם האישור לא מגיע בזמן.'
          : 'תצוגה לקריאה בלבד: מצב ההתקנים כפי ש־Home Assistant מדווח אותו.'}
      </div>
    </sw-page>`;
  }

  private renderCard(c: DeviceCard) {
    const e = CARD_EMPTY[c.id];
    return html`<sw-card data-card=${c.id} ?data-empty=${c.count === 0} heading=${c.label} subheading=${c.count ? `${c.count} התקנים${c.id === 'lighting' || c.id === 'switches' || c.id === 'climate' || c.id === 'covers' || c.id === 'media' ? ` · ${c.active} פעילים` : ''}` : ''}>
      <sw-icon slot="actions" .name=${CARD_ICON[c.id]} size=${18}></sw-icon>
      ${c.count === 0
        ? html`<sw-state-panel compact data-card-empty state="empty" heading=${e.heading} hint=${e.hint}></sw-state-panel>`
        : c.id === 'lighting' || c.id === 'switches' || c.id === 'sensors'
          ? html`<div class="tiles">${repeat(c.entities, (r) => r.entity_id, (r) => this.renderTile(r, c.id))}</div>`
          : html`<div class="rows">${repeat(c.entities, (r) => r.entity_id, (r) => this.renderRow(r, c.id))}</div>`}
    </sw-card>`;
  }

  private renderTile(raw: DeviceRow, card: CardId) {
    const controllable = raw.can_control && raw.available && raw.state !== 'unavailable' && (card === 'lighting' || card === 'switches');
    const r = controllable ? this.overlay(raw) : raw; // only overlay what the caller may actually have commanded
    const unavailable = !r.available || r.state === 'unavailable';
    const icon: IconName = card === 'lighting' ? 'light' : card === 'switches' ? 'bolt' : 'sensor';
    const value =
      card === 'sensors'
        ? r.domain === 'sensor'
          ? r.value !== null && r.value !== undefined
            ? `${ltrNum(Number.isInteger(r.value) ? r.value : r.value.toFixed(1))}${r.unit ? ` ${r.unit}` : ''}`
            : (r.state ?? '—')
          : rowLabel(r)
        : rowLabel(r);
    const on = r.active && !unavailable;
    const note = controllable ? this.rowNote(r.entity_id) : null;
    return html`<div class=${classMap({ tile: true, on, off: !on && !unavailable, unavailable, pending: controllable && this.rowPending(r.entity_id) })} data-entity=${r.entity_id} data-active=${String(on)} ?data-can-control=${controllable} title=${r.entity_id}>
      <div class="t"><sw-icon .name=${icon} size=${15}></sw-icon><span>${bidi(r.name)}</span>${controllable ? this.renderPowerToggle(r) : nothing}</div>
      <div class="s">${unavailable ? 'לא זמין' : value}</div>
      ${controllable && card === 'lighting' && on ? this.renderBrightnessSlider(r) : nothing}
      ${note ? html`<div class="rollback-note" data-rollback>${note}</div>` : nothing}
    </div>`;
  }

  private renderRow(raw: DeviceRow, card: CardId) {
    const controllable = raw.can_control && raw.available && raw.state !== 'unavailable' && (card === 'climate' || card === 'covers' || card === 'media');
    const r = controllable ? this.overlay(raw) : raw;
    const unavailable = !r.available || r.state === 'unavailable';
    const on = r.active && !unavailable;
    const note = controllable ? this.rowNote(r.entity_id) : null;
    const pendingCls = controllable && this.rowPending(r.entity_id);
    if (card === 'climate') {
      const isClimate = r.domain === 'climate';
      return html`<div class=${classMap({ row: true, on, unavailable, pending: pendingCls })} data-entity=${r.entity_id} data-active=${String(r.active)} ?data-can-control=${controllable} title=${r.entity_id}>
        <span class="n">${bidi(r.name)}</span>
        <span class="v big">${unavailable ? 'לא זמין' : isClimate ? deg(r.current_temperature) : rowLabel(r)}</span>
        ${isClimate && !unavailable
          ? html`<div class="d">
              <span>מצב: ${rowLabel(r)}</span>
              ${r.hvac_action ? html`<span>${HVAC_ACTION_HE[r.hvac_action] ?? r.hvac_action}</span>` : nothing}
              ${r.target_temperature !== null && r.target_temperature !== undefined ? html`<span>יעד ${deg(r.target_temperature)}</span>` : nothing}
              ${r.target_temp_low !== null && r.target_temp_low !== undefined && r.target_temp_high !== null && r.target_temp_high !== undefined ? html`<span>טווח ${deg(r.target_temp_low)}–${deg(r.target_temp_high)}</span>` : nothing}
              ${r.fan_mode ? html`<span>מאוורר: ${r.fan_mode}</span>` : nothing}
              ${r.preset_mode ? html`<span>מצב מוגדר: ${r.preset_mode}</span>` : nothing}
            </div>`
          : r.domain === 'humidifier' && !unavailable
            ? html`<div class="d">${r.current_humidity !== null && r.current_humidity !== undefined ? html`<span>לחות ${ltrNum(r.current_humidity)}%</span>` : nothing}${r.target_humidity !== null && r.target_humidity !== undefined ? html`<span>יעד ${ltrNum(r.target_humidity)}%</span>` : nothing}</div>`
            : nothing}
        ${controllable ? this.renderClimateControls(r) : nothing}
        ${note ? html`<div class="rollback-note" data-rollback>${note}</div>` : nothing}
      </div>`;
    }
    if (card === 'covers') {
      return html`<div class=${classMap({ row: true, on, unavailable, pending: pendingCls })} data-entity=${r.entity_id} data-active=${String(r.active)} ?data-can-control=${controllable} title=${r.entity_id}>
        <span class="n">${bidi(r.name)}</span>
        <span class="v">${rowLabel(r)}</span>
        ${r.position !== null && r.position !== undefined && !unavailable ? html`<div class="bar" role="img" aria-label=${`פתוח ${r.position}%`}><i style=${`inline-size:${r.position}%`}></i></div>` : nothing}
        ${r.tilt !== null && r.tilt !== undefined && !unavailable ? html`<div class="d"><span>הטיה ${ltrNum(r.tilt)}%</span></div>` : nothing}
        ${controllable ? this.renderCoverControls(r) : nothing}
        ${note ? html`<div class="rollback-note" data-rollback>${note}</div>` : nothing}
      </div>`;
    }
    if (card === 'security') {
      let badge: { kind: StateKind; label: string };
      if (unavailable) badge = { kind: 'offline', label: 'לא זמין' };
      else if (r.kind === 'lock') badge = r.locked ? { kind: 'live', label: 'נעול' } : { kind: 'stale', label: rowLabel(r) };
      else if (r.kind === 'alarm') badge = { kind: alarmTone(r.state), label: rowLabel(r) };
      else if (r.kind === 'camera') badge = { kind: 'neutral', label: 'מצלמת HA' };
      else badge = { kind: r.state === 'on' ? 'stale' : 'neutral', label: rowLabel(r) };
      const kindIcon: IconName = r.kind === 'lock' ? (r.locked ? 'lock' : 'unlock') : r.kind === 'alarm' ? 'shield' : r.kind === 'camera' ? 'camera' : 'sensor';
      return html`<div class=${classMap({ row: true, unavailable })} data-entity=${r.entity_id} data-kind=${r.kind ?? ''} title=${r.entity_id}>
        <span class="n"><sw-icon .name=${kindIcon} size=${14}></sw-icon> ${bidi(r.name)}</span>
        <sw-badge kind=${badge.kind} label=${badge.label}></sw-badge>
        ${r.kind === 'camera' ? html`<div class="d"><span>אין תמונה ממצלמת Home Assistant במסך הזה עדיין; מצלמות ה־NVR מוצגות ב"מצלמות".</span></div>` : nothing}
      </div>`;
    }
    // media
    return html`<div class=${classMap({ row: true, on, unavailable, pending: pendingCls })} data-entity=${r.entity_id} data-active=${String(r.active)} ?data-can-control=${controllable} title=${r.entity_id}>
      <span class="n"><sw-icon name="play" size=${14}></sw-icon> ${bidi(r.name)}</span>
      <span class="v">${rowLabel(r)}</span>
      ${!unavailable && (r.media_title || r.source || r.volume_pct !== null)
        ? html`<div class="d">
            ${r.media_title ? html`<span>${r.media_title}</span>` : nothing}
            ${r.source ? html`<span>מקור: ${r.source}</span>` : nothing}
            ${r.volume_pct !== null && r.volume_pct !== undefined ? html`<span>עוצמה ${ltrNum(r.volume_pct)}%${r.muted ? ' · מושתק' : ''}</span>` : nothing}
          </div>`
        : nothing}
      ${controllable ? this.renderMediaControls(r) : nothing}
      ${note ? html`<div class="rollback-note" data-rollback>${note}</div>` : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-area': DevicesArea;
  }
}
