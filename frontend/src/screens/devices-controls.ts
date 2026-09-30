import { html, css, nothing, type ReactiveController, type ReactiveControllerHost } from 'lit';
import '../components/sw-toggle';
import '../components/sw-button';
import { ALARM_HE, climateRange, HVAC_HE, type DeviceRow } from '../api/devices';
import { stateLabel } from '../api/ha';
import { debouncedCommand, runCommand, supersede, type CommandState } from '../api/device-commands';
import { bidi, ltrNum } from '../i18n/bidi';

/**
 * CR-007 single-entity controls, shared by the area screen (devices-area.ts) and the overview tiles' panel
 * (devices-tiles-panel.ts) so both behave exactly alike: the same action envelope (api/device-commands.ts - optimistic,
 * confirmed by the state Home Assistant reports, rolled back on timeout), the same "one gesture to arm, one tap to
 * confirm" for cover movement (CR-007 §7.8), the same honest status line (§7.9). Moved here unchanged from the area
 * screen (slice 2 / 4); the lock control is new (the panel's "מנעולים" tile): lock is one tap, unlock opens the
 * screen's own confirmation first and is sent with the confirmation grant - the server still requires door.unlock.
 *
 * A "key" is `${entityId}:${control}`; each control supersedes only its own kind.
 */

/** The modes the add-on's allow-list accepts (services/ha_bridge.HVAC_MODES); the menu shows the entity's own
 * hvac_modes that are among them - never a mode the entity does not report. */
const HVAC_SELECTABLE = ['off', 'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only'];
/** How long a "one gesture to arm, one tap to confirm" control stays armed (cover open / close / position: attention
 * risk in the allow-list, services/ha_bridge.py - a confirmation is required, but a modal is overkill for a card). */
export const ARM_MS = 4000;

export function deg(n: number | null | undefined, unit = '°'): string {
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

/** The styles of the controls and their status line (include in the host's static styles). */
export const deviceControlStyles = css`
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
  .rollback-note,
  .cmd-status {
    grid-column: 1 / -1;
    font-size: var(--sw-fs-xs);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .rollback-note {
    color: var(--sw-danger);
  }
  .cmd-status.pending {
    color: var(--sw-text);
    background: var(--sw-warning-soft);
    border-radius: var(--sw-r-sm);
    padding: 2px 6px;
    font-weight: var(--sw-fw-medium);
  }
  .cmd-status.pending .dot {
    flex: none;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--sw-warning);
    animation: sw-cmd-pulse 1s ease-in-out infinite;
  }
  .cmd-status.sent {
    color: var(--sw-text-2);
  }
  .cmd-status.confirmed {
    color: var(--sw-text-2);
  }
  .cmd-status.confirmed::before {
    content: '';
    flex: none;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--sw-success);
  }
  @keyframes sw-cmd-pulse {
    50% {
      opacity: 0.3;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .cmd-status.pending .dot {
      animation: none;
    }
  }
  .tile .rollback-note,
  .tile .cmd-status {
    white-space: normal;
  }
  .ctl-note {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
`;

export interface LockRequest {
  row: DeviceRow;
}

export class DeviceControls implements ReactiveController {
  /** One control's command state per key (`entityId:control` - power, brightness, position, temp, mode, fan, mute,
   * playpause, lock; each independent so a slider drag never supersedes a button tap on the same entity). */
  commands: Record<string, CommandState<unknown>> = {};
  /** A cover movement control (open / close / position) armed by a first gesture, expiring if no confirming tap comes. */
  armed: Record<string, number> = {};
  /** A cover position dragged but not yet confirmed (per `entityId:position`): shown on the slider only, never sent. */
  drafts: Record<string, number> = {};
  private debouncedRange = debouncedCommand<number>();

  /** onSettle: called when a command ends (confirmed, sent or rolled back) - a screen whose caller may not receive
   * the state push (no entity.state.read) refetches then, so the row's reported state still follows. */
  constructor(private host: ReactiveControllerHost, private onSettle?: () => void) {
    host.addController(this);
  }

  hostConnected() {}

  private changed() {
    this.host.requestUpdate();
  }

  setCmd = (key: string, s: CommandState<unknown>) => {
    this.commands = { ...this.commands, [key]: s };
    this.changed();
    if (s.phase !== 'pending') this.onSettle?.();
    if (s.phase === 'confirmed' || s.phase === 'sent') window.setTimeout(() => this.clearCmd(key, s), 2500);
    else if (s.phase === 'rolled_back') window.setTimeout(() => this.clearCmd(key, s), 4000);
  };

  /** Only clears the slot if nothing newer took it over in the meantime (a superseded rollback must not erase a
   * fresher pending/confirmed state the user already triggered again). */
  private clearCmd(key: string, was: CommandState<unknown>) {
    if (this.commands[key] === was) {
      const next = { ...this.commands };
      delete next[key];
      this.commands = next;
      this.changed();
    }
  }

  entityCommands(entityId: string): CommandState<unknown>[] {
    return Object.entries(this.commands)
      .filter(([k]) => k.startsWith(`${entityId}:`))
      .map(([, v]) => v);
  }

  rowPending(entityId: string): boolean {
    return this.entityCommands(entityId).some((v) => v.phase === 'pending');
  }

  /** The value a control shows: the target while its command is pending (or just confirmed, until the refetch lands),
   * otherwise the real one. Only controls read this - the row's own text always shows what HA last reported. */
  live<T>(entityId: string, control: string): T | undefined {
    const c = this.commands[`${entityId}:${control}`] as CommandState<T> | undefined;
    return c && (c.phase === 'pending' || c.phase === 'confirmed') ? c.optimistic : undefined;
  }

  /** The visible command line under a row: "ממתין לאישור" while pending (never the target as the row's fact), "נשלח"
   * for an action with nothing observable, "אושר" once HA reported the effect, the rollback reason otherwise. */
  renderCmdStatus(entityId: string) {
    const all = this.entityCommands(entityId);
    const pick = (p: CommandState<unknown>['phase']) => all.find((c) => c.phase === p);
    const pending = pick('pending');
    if (pending) return html`<div class="cmd-status pending" data-cmd-status="pending" role="status"><span class="dot"></span>ממתין לאישור${pending.label ? ` · ${pending.label}` : ''}</div>`;
    const rolled = pick('rolled_back');
    if (rolled) return html`<div class="rollback-note" data-rollback data-cmd-status="rolled_back" role="status">${rolled.label ? `${rolled.label}: ` : ''}${rolled.note}</div>`;
    const sent = pick('sent');
    if (sent) return html`<div class="cmd-status sent" data-cmd-status="sent" role="status">נשלח${sent.label ? ` · ${sent.label}` : ''} · אין דיווח מצב שמאשר את הביצוע</div>`;
    const confirmed = pick('confirmed');
    if (confirmed) return html`<div class="cmd-status confirmed" data-cmd-status="confirmed" role="status">אושר${confirmed.label ? ` · ${confirmed.label}` : ''}</div>`;
    return nothing;
  }

  isArmed(key: string): boolean {
    const exp = this.armed[key];
    return !!exp && exp > Date.now();
  }

  disarm(key: string) {
    const next = { ...this.armed };
    delete next[key];
    this.armed = next;
    if (key in this.drafts) {
      const d = { ...this.drafts };
      delete d[key];
      this.drafts = d;
    }
    this.changed();
  }

  arm(key: string) {
    this.armed = { ...this.armed, [key]: Date.now() + ARM_MS };
    this.changed();
    window.setTimeout(() => {
      if (this.armed[key] && this.armed[key] <= Date.now()) this.disarm(key);
    }, ARM_MS + 50);
  }

  /** First tap arms a sensitive button (shows "לאשר?" for ARM_MS); the second tap within the window runs it. */
  tapArmed(key: string, run: () => void) {
    if (this.isArmed(key)) {
      this.disarm(key);
      run();
      return;
    }
    this.arm(key);
  }

  private setDraft(key: string, v: number) {
    this.drafts = { ...this.drafts, [key]: v };
    this.changed();
  }

  renderPowerToggle(r: DeviceRow) {
    const key = `${r.entity_id}:power`;
    const pending = this.commands[key]?.phase === 'pending';
    const domain = ['light', 'input_boolean', 'media_player', 'fan'].includes(r.domain) ? r.domain : 'switch';
    const checked = this.live<boolean>(r.entity_id, 'power') ?? r.active;
    const change = (ev: Event) => {
      ev.stopPropagation();
      if (pending) return;
      const next = !checked;
      void runCommand(key, r.domain, r.entity_id, `${domain}.${next ? 'turn_on' : 'turn_off'}`, {}, next, (s) => this.setCmd(key, s), { label: next ? 'הדלקה' : 'כיבוי' });
    };
    return html`<sw-toggle data-control="power" .checked=${checked} ?disabled=${pending} label=${bidi(r.name)} labelHidden @click=${(e: Event) => e.stopPropagation()} @change=${change}></sw-toggle>`;
  }

  renderBrightnessSlider(r: DeviceRow) {
    const key = `${r.entity_id}:brightness`;
    const value = this.live<number>(r.entity_id, 'brightness') ?? r.brightness_pct ?? 100;
    const onInput = (ev: Event) => {
      const pct = Number((ev.target as HTMLInputElement).value);
      this.debouncedRange(key, 'light', r.entity_id, 'light.turn_on', { brightness_pct: pct }, pct, (s) => this.setCmd(key, s), { label: `בהירות ${pct}%` });
    };
    return html`<input type="range" class="ctl-range" data-control="brightness" min="1" max="100" .value=${String(value)} @input=${onInput} @click=${(e: Event) => e.stopPropagation()} aria-label=${`בהירות · ${r.name}`} />`;
  }

  /** Cover movement - open, close or a position - is one physical action whichever control starts it (coordinator
   * ruling, CR-007 s7): all three are "attention" in the allow-list, so each arms on the first gesture (a tap, or
   * the slider's release) and runs on the confirming tap, with confirmation_grant sent. Stop is never gated or
   * disabled: it must work exactly while something moves. */
  renderCoverControls(r: DeviceRow) {
    const entityId = r.entity_id;
    const openKey = `${entityId}:open`;
    const closeKey = `${entityId}:close`;
    const stopKey = `${entityId}:stop`;
    const posKey = `${entityId}:position`;
    const moving = [openKey, closeKey, posKey].some((k) => this.commands[k]?.phase === 'pending');
    const move = (key: string, actionId: string, args: Record<string, unknown>, target: unknown, label: string) =>
      void runCommand(key, 'cover', entityId, actionId, args, target, (s) => this.setCmd(key, s), { confirmed: true, label });
    const doOpen = () => this.tapArmed(openKey, () => move(openKey, 'cover.open_cover', {}, 'open', 'פתיחה'));
    const doClose = () => this.tapArmed(closeKey, () => move(closeKey, 'cover.close_cover', {}, 'closed', 'סגירה'));
    const doStop = () => {
      // Stop ends the movement: whatever open / close / position is still awaiting its confirmation is superseded at
      // once (its late outcome is dropped, no "not confirmed in time" note follows) and the controls come back now
      const next = { ...this.commands };
      for (const k of [openKey, closeKey, posKey]) {
        supersede(k);
        delete next[k];
        if (k in this.armed || k in this.drafts) this.disarm(k);
      }
      this.commands = next;
      this.changed();
      void runCommand(stopKey, 'cover', entityId, 'cover.stop_cover', {}, 'stopped', (s) => this.setCmd(stopKey, s), { label: 'עצירה' });
    };
    const draft = this.drafts[posKey];
    const armedPos = this.isArmed(posKey) && draft !== undefined;
    const posValue = draft ?? this.live<number>(entityId, 'position') ?? r.position ?? 0;
    const onPosInput = (ev: Event) => this.setDraft(posKey, Number((ev.target as HTMLInputElement).value)); // local only: nothing is sent while dragging
    const onPosRelease = (ev: Event) => {
      this.setDraft(posKey, Number((ev.target as HTMLInputElement).value));
      this.arm(posKey);
    };
    const confirmPos = () => {
      const pct = this.drafts[posKey];
      if (pct === undefined || !this.isArmed(posKey)) return;
      this.disarm(posKey);
      move(posKey, 'cover.set_cover_position', { position: pct }, pct, `מיקום ${pct}%`);
    };
    // CR-007 slice 4: tilt - open/close/stop/position, the same arm-then-confirm pattern (one physical movement
    // whichever control starts it), independent of the top position/open/close (a device may decouple the two axes)
    const openTiltKey = `${entityId}:open-tilt`;
    const closeTiltKey = `${entityId}:close-tilt`;
    const stopTiltKey = `${entityId}:stop-tilt`;
    const tiltPosKey = `${entityId}:tilt-position`;
    const tiltMoving = [openTiltKey, closeTiltKey, tiltPosKey].some((k) => this.commands[k]?.phase === 'pending');
    const moveTilt = (key: string, actionId: string, args: Record<string, unknown>, target: unknown, label: string) =>
      void runCommand(key, 'cover', entityId, actionId, args, target, (s) => this.setCmd(key, s), { confirmed: true, label });
    const doOpenTilt = () => this.tapArmed(openTiltKey, () => moveTilt(openTiltKey, 'cover.open_cover_tilt', {}, 'open', 'פתיחת הטיה'));
    const doCloseTilt = () => this.tapArmed(closeTiltKey, () => moveTilt(closeTiltKey, 'cover.close_cover_tilt', {}, 'closed', 'סגירת הטיה'));
    const doStopTilt = () => {
      const next = { ...this.commands };
      for (const k of [openTiltKey, closeTiltKey, tiltPosKey]) {
        supersede(k);
        delete next[k];
        if (k in this.armed || k in this.drafts) this.disarm(k);
      }
      this.commands = next;
      this.changed();
      void runCommand(stopTiltKey, 'cover', entityId, 'cover.stop_cover_tilt', {}, 'stopped', (s) => this.setCmd(stopTiltKey, s), { label: 'עצירת הטיה' });
    };
    const tiltDraft = this.drafts[tiltPosKey];
    const armedTiltPos = this.isArmed(tiltPosKey) && tiltDraft !== undefined;
    const tiltValue = tiltDraft ?? this.live<number>(entityId, 'tilt-position') ?? r.tilt ?? 0;
    const onTiltInput = (ev: Event) => this.setDraft(tiltPosKey, Number((ev.target as HTMLInputElement).value));
    const onTiltRelease = (ev: Event) => {
      this.setDraft(tiltPosKey, Number((ev.target as HTMLInputElement).value));
      this.arm(tiltPosKey);
    };
    const confirmTiltPos = () => {
      const pct = this.drafts[tiltPosKey];
      if (pct === undefined || !this.isArmed(tiltPosKey)) return;
      this.disarm(tiltPosKey);
      moveTilt(tiltPosKey, 'cover.set_cover_tilt_position', { tilt_position: pct }, pct, `מיקום הטיה ${pct}%`);
    };
    return html`<div class="ctl-row" data-control="cover">
        <sw-button size="sm" ?disabled=${moving} data-control="open" @click=${doOpen}>${this.isArmed(openKey) ? 'לאשר פתיחה?' : 'פתיחה'}</sw-button>
        <sw-button size="sm" data-control="stop" @click=${doStop}>עצירה</sw-button>
        <sw-button size="sm" ?disabled=${moving} data-control="close" @click=${doClose}>${this.isArmed(closeKey) ? 'לאשר סגירה?' : 'סגירה'}</sw-button>
        ${r.position !== null && r.position !== undefined
          ? html`<input type="range" class="ctl-range" data-control="position" min="0" max="100" ?disabled=${moving} .value=${String(posValue)} @input=${onPosInput} @change=${onPosRelease} aria-label="מיקום התריס" />
              ${armedPos ? html`<sw-button size="sm" variant="primary" data-control="position-confirm" @click=${confirmPos}>${`לאשר מיקום ${draft}%?`}</sw-button>` : nothing}`
          : nothing}
      </div>
      ${r.tilt !== null && r.tilt !== undefined
        ? html`<div class="ctl-row" data-control="cover-tilt">
            <sw-button size="sm" ?disabled=${tiltMoving} data-control="open-tilt" @click=${doOpenTilt}>${this.isArmed(openTiltKey) ? 'לאשר פתיחת הטיה?' : 'פתיחת הטיה'}</sw-button>
            <sw-button size="sm" data-control="stop-tilt" @click=${doStopTilt}>עצירת הטיה</sw-button>
            <sw-button size="sm" ?disabled=${tiltMoving} data-control="close-tilt" @click=${doCloseTilt}>${this.isArmed(closeTiltKey) ? 'לאשר סגירת הטיה?' : 'סגירת הטיה'}</sw-button>
            <input type="range" class="ctl-range" data-control="tilt-position" min="0" max="100" ?disabled=${tiltMoving} .value=${String(tiltValue)} @input=${onTiltInput} @change=${onTiltRelease} aria-label="מיקום הטיה" />
            ${armedTiltPos ? html`<sw-button size="sm" variant="primary" data-control="tilt-position-confirm" @click=${confirmTiltPos}>${`לאשר הטיה ${tiltDraft}%?`}</sw-button>` : nothing}
          </div>`
        : nothing}`;
  }

  renderClimateControls(r: DeviceRow) {
    const entityId = r.entity_id;
    if (r.domain === 'climate') {
      const tempKey = `${entityId}:temp`;
      const { min, max, step } = climateRange(r);
      const reported = r.target_temperature;
      const target = this.live<number>(entityId, 'temp') ?? reported;
      const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 10) / 10));
      const setTemp = (next: number) => this.debouncedRange(tempKey, 'climate', entityId, 'climate.set_temperature', { temperature: next }, next, (s) => this.setCmd(tempKey, s), { label: `טמפרטורת יעד ${next}°` });
      const modeKey = `${entityId}:mode`;
      const modePending = this.commands[modeKey]?.phase === 'pending';
      const modes = (r.hvac_modes ?? []).filter((m) => HVAC_SELECTABLE.includes(m));
      const mode = this.live<string>(entityId, 'mode') ?? r.hvac_mode ?? '';
      const changeMode = (ev: Event) => {
        const v = (ev.target as HTMLSelectElement).value;
        const label = `מצב ${HVAC_HE[v] ?? v}`;
        if (v === 'off') void runCommand(modeKey, 'climate', entityId, 'climate.turn_off', {}, 'off', (s) => this.setCmd(modeKey, s), { label });
        else void runCommand(modeKey, 'climate', entityId, 'climate.set_hvac_mode', { hvac_mode: v }, v, (s) => this.setCmd(modeKey, s), { label });
      };
      const fanKey = `${entityId}:fan`;
      const fanPending = this.commands[fanKey]?.phase === 'pending';
      const fanModes = r.fan_modes ?? [];
      const fan = this.live<string>(entityId, 'fan') ?? r.fan_mode ?? '';
      const changeFan = (ev: Event) => {
        const v = (ev.target as HTMLSelectElement).value;
        if (v) void runCommand(fanKey, 'climate', entityId, 'climate.set_fan_mode', { fan_mode: v }, v, (s) => this.setCmd(fanKey, s), { label: `מאוורר ${v}` });
      };
      // CR-007 slice 4: preset / swing - only the modes this entity itself reports
      const presetKey = `${entityId}:preset`;
      const presetPending = this.commands[presetKey]?.phase === 'pending';
      const presetModes = r.preset_modes ?? [];
      const preset = this.live<string>(entityId, 'preset') ?? r.preset_mode ?? '';
      const changePreset = (ev: Event) => {
        const v = (ev.target as HTMLSelectElement).value;
        if (v) void runCommand(presetKey, 'climate', entityId, 'climate.set_preset_mode', { preset_mode: v }, v, (s) => this.setCmd(presetKey, s), { label: `מצב מוגדר ${v}` });
      };
      const swingKey = `${entityId}:swing`;
      const swingPending = this.commands[swingKey]?.phase === 'pending';
      const swingModes = r.swing_modes ?? [];
      const swing = this.live<string>(entityId, 'swing') ?? r.swing_mode ?? '';
      const changeSwing = (ev: Event) => {
        const v = (ev.target as HTMLSelectElement).value;
        if (v) void runCommand(swingKey, 'climate', entityId, 'climate.set_swing_mode', { swing_mode: v }, v, (s) => this.setCmd(swingKey, s), { label: `נדנוד ${v}` });
      };
      // CR-007 slice 4: a climate entity's own target humidity (separate from a humidifier's) - only when it reports one
      const humKey = `${entityId}:humidity`;
      const humMin = r.min_humidity ?? 0;
      const humMax = r.max_humidity ?? 100;
      const humidity = this.live<number>(entityId, 'humidity') ?? r.target_humidity;
      const setHumidity = (next: number) => void runCommand(humKey, 'climate', entityId, 'climate.set_humidity', { humidity: next }, next, (s) => this.setCmd(humKey, s), { label: `לחות יעד ${next}%` });
      return html`<div class="ctl-row" data-control="climate">
        ${target !== null && target !== undefined
          ? html`<sw-button size="sm" iconOnly icon="minus" label="הורדת טמפרטורה" data-control="temp-down" ?disabled=${target <= min} @click=${() => setTemp(clamp(target - step))}></sw-button>
              <span class="ctl-val" data-control="temp-value">${deg(target)}</span>
              <sw-button size="sm" iconOnly icon="plus" label="העלאת טמפרטורה" data-control="temp-up" ?disabled=${target >= max} @click=${() => setTemp(clamp(target + step))}></sw-button>`
          : nothing}
        ${modes.length
          ? html`<select class="ctl-select" data-control="mode" aria-label="מצב פעולה" ?disabled=${modePending} @change=${changeMode}>
              ${modes.includes(mode) ? nothing : html`<option value="" selected disabled>${HVAC_HE[mode] ?? (mode || 'מצב')}</option>`}
              ${modes.map((m) => html`<option value=${m} ?selected=${m === mode}>${HVAC_HE[m] ?? m}</option>`)}
            </select>`
          : nothing}
        ${fanModes.length
          ? html`<select class="ctl-select" data-control="fan-mode" aria-label="מצב מאוורר" ?disabled=${fanPending} @change=${changeFan}>
              ${fanModes.includes(fan) ? nothing : html`<option value="" selected disabled>${fan || 'מאוורר'}</option>`}
              ${fanModes.map((m) => html`<option value=${m} ?selected=${m === fan}>${m}</option>`)}
            </select>`
          : nothing}
        ${presetModes.length
          ? html`<select class="ctl-select" data-control="preset-mode" aria-label="מצב מוגדר מראש" ?disabled=${presetPending} @change=${changePreset}>
              ${presetModes.includes(preset) ? nothing : html`<option value="" selected disabled>${preset || 'מצב מוגדר'}</option>`}
              ${presetModes.map((m) => html`<option value=${m} ?selected=${m === preset}>${m}</option>`)}
            </select>`
          : nothing}
        ${swingModes.length
          ? html`<select class="ctl-select" data-control="swing-mode" aria-label="מצב נדנוד" ?disabled=${swingPending} @change=${changeSwing}>
              ${swingModes.includes(swing) ? nothing : html`<option value="" selected disabled>${swing || 'נדנוד'}</option>`}
              ${swingModes.map((m) => html`<option value=${m} ?selected=${m === swing}>${m}</option>`)}
            </select>`
          : nothing}
        ${humidity !== null && humidity !== undefined
          ? html`<sw-button size="sm" iconOnly icon="minus" label="הפחתת לחות יעד" data-control="humidity-down" ?disabled=${humidity <= humMin} @click=${() => setHumidity(Math.max(humMin, humidity - 5))}></sw-button>
              <span class="ctl-val" data-control="humidity-value">${ltrNum(humidity)}%</span>
              <sw-button size="sm" iconOnly icon="plus" label="הגברת לחות יעד" data-control="humidity-up" ?disabled=${humidity >= humMax} @click=${() => setHumidity(Math.min(humMax, humidity + 5))}></sw-button>`
          : nothing}
      </div>`;
    }
    if (r.domain === 'fan') {
      const pctKey = `${entityId}:percentage`;
      const value = this.live<number>(entityId, 'percentage') ?? r.percentage ?? 0;
      const setPct = (ev: Event) => {
        const v = Number((ev.target as HTMLInputElement).value);
        this.debouncedRange(pctKey, 'fan', entityId, 'fan.set_percentage', { percentage: v }, v, (s) => this.setCmd(pctKey, s), { label: `עוצמה ${v}%` });
      };
      return html`<div class="ctl-row" data-control="fan">
        ${this.renderPowerToggle(r)}
        <input type="range" class="ctl-range" data-control="percentage" min="0" max="100" .value=${String(value)} @input=${setPct} aria-label="עוצמת מאוורר" />
      </div>`;
    }
    // CR-007 slice 4: humidifier - its own mode list and target humidity (turn_on/off is not in the allow-list;
    // the row's own badge already shows on/off from the state HA reports)
    const modeKeyH = `${entityId}:mode`;
    const modePendingH = this.commands[modeKeyH]?.phase === 'pending';
    const modesH = r.available_modes ?? [];
    const modeH = this.live<string>(entityId, 'mode') ?? r.mode ?? '';
    const changeModeH = (ev: Event) => {
      const v = (ev.target as HTMLSelectElement).value;
      if (v) void runCommand(modeKeyH, 'humidifier', entityId, 'humidifier.set_mode', { mode: v }, v, (s) => this.setCmd(modeKeyH, s), { label: `מצב ${v}` });
    };
    const humKeyH = `${entityId}:humidity`;
    const humMinH = r.min_humidity ?? 0;
    const humMaxH = r.max_humidity ?? 100;
    const humidityH = this.live<number>(entityId, 'humidity') ?? r.target_humidity;
    const setHumidityH = (next: number) => void runCommand(humKeyH, 'humidifier', entityId, 'humidifier.set_humidity', { humidity: next }, next, (s) => this.setCmd(humKeyH, s), { label: `לחות יעד ${next}%` });
    return html`<div class="ctl-row" data-control="humidifier">
      ${modesH.length
        ? html`<select class="ctl-select" data-control="mode" aria-label="מצב לחות" ?disabled=${modePendingH} @change=${changeModeH}>
            ${modesH.includes(modeH) ? nothing : html`<option value="" selected disabled>${modeH || 'מצב'}</option>`}
            ${modesH.map((m) => html`<option value=${m} ?selected=${m === modeH}>${m}</option>`)}
          </select>`
        : nothing}
      ${humidityH !== null && humidityH !== undefined
        ? html`<sw-button size="sm" iconOnly icon="minus" label="הפחתת לחות יעד" data-control="humidity-down" ?disabled=${humidityH <= humMinH} @click=${() => setHumidityH(Math.max(humMinH, humidityH - 5))}></sw-button>
            <span class="ctl-val" data-control="humidity-value">${ltrNum(humidityH)}%</span>
            <sw-button size="sm" iconOnly icon="plus" label="הגברת לחות יעד" data-control="humidity-up" ?disabled=${humidityH >= humMaxH} @click=${() => setHumidityH(Math.min(humMaxH, humidityH + 5))}></sw-button>`
        : nothing}
    </div>`;
  }

  renderMediaControls(r: DeviceRow) {
    const entityId = r.entity_id;
    const muteKey = `${entityId}:mute`;
    const ppKey = `${entityId}:playpause`;
    const muted = this.live<boolean>(entityId, 'mute') ?? Boolean(r.muted);
    const toggleMute = () =>
      void runCommand(muteKey, 'media_player', entityId, 'media_player.volume_mute', { is_volume_muted: !muted }, !muted, (s) => this.setCmd(muteKey, s), { label: muted ? 'ביטול השתקה' : 'השתקה' });
    const playing = (this.live<string>(entityId, 'playpause') ?? r.state) === 'playing';
    // media_play / media_pause (not play_pause): each has a state Home Assistant reports, so it can be confirmed
    const playPause = () =>
      void runCommand(ppKey, 'media_player', entityId, playing ? 'media_player.media_pause' : 'media_player.media_play', {}, playing ? 'paused' : 'playing', (s) => this.setCmd(ppKey, s), { label: playing ? 'השהיה' : 'ניגון' });
    return html`<div class="ctl-row" data-control="media">
      ${this.renderPowerToggle(r)}
      <sw-button size="sm" icon=${playing ? 'pause' : 'play'} iconOnly label=${playing ? 'השהה' : 'נגן'} data-control="playpause" ?disabled=${this.commands[ppKey]?.phase === 'pending'} @click=${playPause}></sw-button>
      <sw-button size="sm" icon="volume" iconOnly label=${muted ? 'בטל השתקה' : 'השתקה'} data-control="mute" ?disabled=${this.commands[muteKey]?.phase === 'pending'} @click=${toggleMute}></sw-button>
    </div>`;
  }

  /** Lock (overview tiles' panel): "נעל" is one tap (routine in the allow-list); "פתח" never sends by itself - it asks
   * the screen to confirm (`onUnlock`, the screen's own dialog), and only `runUnlock` - called from that dialog's
   * confirm button - sends lock.unlock with the confirmation grant. Unlock is offered only when the server said this
   * caller holds door.unlock at the lock's scope (`can_unlock`); the action route checks both again. */
  renderLockControls(r: DeviceRow & { can_unlock?: boolean }, onUnlock: (r: DeviceRow) => void) {
    const key = `${r.entity_id}:lock`;
    const pending = this.commands[key]?.phase === 'pending';
    const locked = this.live<string>(r.entity_id, 'lock') ?? (r.locked ? 'locked' : r.state);
    const doLock = () => void runCommand(key, 'lock', r.entity_id, 'lock.lock', {}, 'locked', (s) => this.setCmd(key, s), { label: 'נעילה' });
    return html`<div class="ctl-row" data-control="lock">
      ${locked === 'locked'
        ? r.can_unlock
          ? html`<sw-button size="sm" icon="unlock" data-control="unlock" ?disabled=${pending} @click=${() => onUnlock(r)}>פתיחה…</sw-button>`
          : html`<span class="ctl-note" data-control="unlock-denied" title="פתיחת מנעול דורשת הרשאה נפרדת (פתיחת דלת)">פתיחה דורשת הרשאה נפרדת</span>`
        : html`<sw-button size="sm" icon="lock" data-control="lock" ?disabled=${pending} @click=${doLock}>נעילה</sw-button>
            ${r.can_unlock && locked !== 'unlocked' ? html`<sw-button size="sm" icon="unlock" data-control="unlock" ?disabled=${pending} @click=${() => onUnlock(r)}>פתיחה…</sw-button>` : nothing}`}
    </div>`;
  }

  /** The confirmed unlock: sent only from the screen's confirmation dialog, with the confirmation grant. */
  runUnlock(r: DeviceRow) {
    const key = `${r.entity_id}:lock`;
    void runCommand(key, 'lock', r.entity_id, 'lock.unlock', {}, 'unlocked', (s) => this.setCmd(key, s), { confirmed: true, label: 'פתיחה' });
  }
}
