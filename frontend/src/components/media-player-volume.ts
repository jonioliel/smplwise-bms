import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { MEMBER_OUTCOME_LABEL, type MemberOutcome, type PlayerDevice } from '../api/media-players';
import { bidi } from '../i18n/bidi';
import { ic } from './media-player-icons';
import { playerBase } from './media-player-css';
import { VOLUME_DEBOUNCE_MS, groupSliderLevel, volumeDisplay, zoneView, type RoomRow } from './media-player-logic';

/** The result of the last group run for a room, shown under its name ("הוגבל לתקרה", "לא הצטרף" ...). */
export interface RoomOutcome {
  outcome: MemberOutcome;
}

export interface VolumeEvent {
  key: string;
  level: number;
  zone?: string;
}

/**
 * CR-016 S3: the volume of a player panel. Two shapes, one element:
 *  - `single` (default): the device's own volume (`device`, a receiver's second zone through `zone`): mute, the slider with its
 *    value; a device that only steps shows the `−` / `+` pair (hold repeats - the panel's `KeyPress` reads the `data-key` of the
 *    buttons, exactly like the TV remote's rockers).
 *  - `group` (`group` set): the group slider (relative by default: the loudest room lands on the value and the balance is kept; the
 *    server's `mode`) and "לפי חדר" - one slider per room with the outcome of the last run named by room.
 *
 * The ceiling is drawn ONLY where an administrator set one (`volumeDisplay`: no default, decision 7ב): a marker on that room's
 * slider and the thumb never shows more than the ceiling. Sliders fill from the inline-start; with `caps_known` false everything
 * is greyed. The element sends nothing itself: it fires `pv-volume` { key, level, zone? } (a room or the device, after
 * `VOLUME_DEBOUNCE_MS` of quiet), `pv-group-volume` { level }, `pv-equalize` and `pv-rooms` { open }; the panel owns the command path.
 */
@customElement('media-player-volume')
export class MediaPlayerVolume extends LitElement {
  @property({ attribute: false }) device: PlayerDevice | null = null;
  @property({ attribute: false }) zone: string | null = null;
  /** Group shape: the leader (or static group) and its rooms. */
  @property({ type: Boolean }) group = false;
  @property({ attribute: false }) rooms: RoomRow[] = [];
  @property({ type: Boolean }) byRoom = false;
  /** The group slider is offered (`media.group` + `volume_group`); else it is drawn greyed. */
  @property({ type: Boolean }) groupOffered = false;
  @property({ attribute: false }) outcomes: Record<string, RoomOutcome> = {};
  /** Pending ids of the panel: `vol:<key>` (`vol:<key>@<zone>`), `gvol`. */
  @property({ attribute: false }) pend: ReadonlySet<string> = new Set();
  /** Rooms whose slider may be moved by this caller (control permission). */
  @property({ type: Boolean }) interactive = true;
  /** The clock of the night window (specs pin it). */
  @property({ attribute: false }) now: Date | null = null;

  @state() private drafts = new Map<string, number>();
  private timers = new Map<string, number>();

  static styles = [
    playerBase,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-inline-size: 0;
        color: var(--mr-text);
        font-family: var(--mr-font);
      }
      .vrock {
        display: inline-flex;
        align-items: center;
        block-size: 48px;
        padding: 2px;
        border-radius: 999px;
        background: var(--mr-surface-3);
        flex: none;
        direction: ltr;
      }
      .vrock button {
        inline-size: 44px;
        block-size: 44px;
        border-radius: 50%;
        border: 0;
        background: transparent;
        display: grid;
        place-items: center;
        color: var(--mr-text);
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
      }
      .vrock button:hover {
        background: var(--mr-seg-thumb);
        box-shadow: var(--mr-shadow-control);
      }
      .vrock button:active {
        transform: scale(0.9);
      }
      .vrock button[disabled] {
        opacity: 0.4;
        pointer-events: none;
      }
      .vrock .vv {
        min-inline-size: 44px;
        text-align: center;
        font-weight: 700;
        font-size: var(--sw-fs-lg);
      }
      .spacer {
        flex: 1;
      }
      .psh {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 2px 4px 0;
        min-block-size: 28px;
      }
      .psh h4 {
        margin: 0;
        font-size: var(--sw-fs-base);
        font-weight: 700;
        color: var(--mr-text-2);
        letter-spacing: 0.01em;
      }
      .psh small {
        font-size: var(--sw-fs-sm);
        color: var(--mr-text-3);
        font-variant-numeric: tabular-nums;
      }
      .psh .lnk {
        all: unset;
        cursor: pointer;
        margin-inline-start: auto;
        min-block-size: 28px;
        padding-inline: 6px;
        font-size: var(--sw-fs-sm);
        font-weight: 600;
        color: var(--mr-accent-text);
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border-radius: var(--sw-r-sm);
      }
      .psh .lnk + .lnk {
        margin-inline-start: 0;
      }
      .psh .lnk .ic {
        font-size: var(--sw-fs-md);
        transition: transform var(--mr-motion) var(--mr-ease);
      }
      .psh .lnk[aria-expanded='true'] .ic {
        transform: rotate(180deg);
      }
      .psh .lnk:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 2px;
      }
      .psh .lnk[disabled] {
        opacity: 0.4;
        pointer-events: none;
      }
    `,
  ];

  disconnectedCallback() {
    super.disconnectedCallback();
    for (const t of this.timers.values()) window.clearTimeout(t);
    this.timers.clear();
  }

  protected willUpdate(changed: PropertyValues<this>) {
    // a draft lives while its change is being sent or in flight; after that the live level is the truth again
    if (changed.has('pend') && this.drafts.size) {
      const next = new Map(this.drafts);
      for (const k of this.drafts.keys()) {
        if (!this.timers.has(k) && !this.pend.has(k === '*' ? 'gvol' : `vol:${k}`)) next.delete(k);
      }
      if (next.size !== this.drafts.size) this.drafts = next;
    }
  }

  // ------------------------------------------------------------------------------------------------ input

  private setDraft(key: string, level: number, fire: () => void) {
    this.drafts = new Map(this.drafts).set(key, level);
    window.clearTimeout(this.timers.get(key));
    this.timers.set(key, window.setTimeout(() => {
      this.timers.delete(key);
      fire();
    }, VOLUME_DEBOUNCE_MS));
  }

  private emit(name: string, detail: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  private onRoom(d: PlayerDevice, zone: string | null, e: Event) {
    const raw = Number((e.target as HTMLInputElement).value);
    const level = volumeDisplay(d, raw, this.now ?? new Date()).level;
    (e.target as HTMLInputElement).value = String(level);
    this.setDraft(d.key + (zone ? `@${zone}` : ''), level, () => this.emit('pv-volume', { key: d.key, level, ...(zone ? { zone } : {}) } satisfies VolumeEvent));
  }

  private onGroup(e: Event) {
    const level = Math.max(0, Math.min(100, Math.round(Number((e.target as HTMLInputElement).value))));
    this.setDraft('*', level, () => this.emit('pv-group-volume', { level }));
  }

  // ------------------------------------------------------------------------------------------------ render

  private muteButton(d: PlayerDevice, off: boolean): TemplateResult | typeof nothing {
    if (!d.caps.mute) return nothing;
    const muted = d.live.volume.muted === true;
    return html`<button type="button" class=${classMap({ rb: true, muted })} data-mute-key=${d.key} aria-pressed=${String(muted)} aria-label=${`${muted ? 'בטל השתקה' : 'השתק'} · ${d.name}`}
      title=${muted ? 'בטל השתקה' : 'השתק'} ?disabled=${off}>${ic(muted ? 'volOff' : 'vol')}</button>`;
  }

  /** One slider of a device: the value, the ceiling marker only where one is set, the draft while it is being sent. */
  private slider(d: PlayerDevice, zone: string | null, small: boolean, off: boolean): TemplateResult {
    const z = zone ? zoneView(d, zone) : null;
    const base = z && !z.main ? z.volume : d.live.volume.level;
    const draft = this.drafts.get(d.key + (zone && z && !z.main ? `@${zone}` : ''));
    const raw = draft ?? base ?? 0;
    const v = volumeDisplay(d, raw, this.now ?? new Date());
    const label = `עוצמה · ${z && !z.main ? `${d.name} · ${z.name}` : d.name}`;
    return html`<span class=${classMap({ rngwrap: true, sm: small })}>${v.ceiling !== null ? html`<span class="cap" style="--capn:${v.ceiling}" title=${`תקרה ${v.ceiling}`} data-pv-cap=${v.ceiling}></span>` : nothing}
      <input class=${classMap({ rng: true, sm: small })} type="range" min="0" max="100" step="1" .value=${String(v.level)} style="--v:${v.level}%" aria-label=${label}
        data-pv-slider=${d.key} ?disabled=${off || !d.caps.volume_set} @input=${(e: Event) => this.onRoom(d, zone, e)} /></span>`;
  }

  private single(d: PlayerDevice): TemplateResult | typeof nothing {
    const off = !this.interactive || !d.live.caps_known || (this.zone ? zoneView(d, this.zone)?.power !== 'on' : d.live.power !== 'on');
    const z = this.zone ? zoneView(d, this.zone) : null;
    const level = z && !z.main ? z.volume : d.live.volume.level;
    const shown = this.drafts.get(d.key + (z && !z.main ? `@${this.zone}` : '')) ?? level;
    if (d.caps.volume_set) {
      return html`<div class="vrow" data-pv="single">${z && !z.main ? nothing : this.muteButton(d, off)}${this.slider(d, this.zone, false, off)}
        <span class="vv n" data-pv-value>${shown !== null ? volumeDisplay(d, shown, this.now ?? new Date()).level : '–'}</span></div>`;
    }
    if (d.caps.volume_step) {
      return html`<div class="vrow" data-pv="step">${this.muteButton(d, off)}<span class="spacer"></span><span class="vrock" role="group" aria-label=${`עוצמה · ${d.name}`}>
        <button type="button" data-key="voldown" aria-label="הנמך" ?disabled=${off}>${ic('minus')}</button><span class="vv n" data-pv-value>${level ?? '–'}</span>
        <button type="button" data-key="volup" aria-label="הגבר" ?disabled=${off}>${ic('plus')}</button></span></div>`;
    }
    return html`${d.caps.mute ? html`<div class="vrow" data-pv="mute">${this.muteButton(d, off)}</div>` : nothing}`;
  }

  private room(r: RoomRow, off: boolean): TemplateResult {
    const o = this.outcomes[r.key]?.outcome;
    const bad = o === 'not_joined' || o === 'unknown' || o === 'not_allowed';
    const sub = o && o !== 'set' && o !== 'joined' && o !== 'left'
      ? html`<small class=${bad ? 'bad' : 'ok'} data-pv-outcome=${o}>${MEMBER_OUTCOME_LABEL[o]}</small>`
      : html`<small>${[r.room ? bidi(r.room) : 'ללא חדר', r.leader ? 'מוביל' : null].filter(Boolean).join(' · ')}</small>`;
    const dis = off || !r.available || r.dev.live.power !== 'on';
    const has = r.dev.caps.volume_set;
    const shown = this.drafts.get(r.key) ?? r.level;
    return html`<div class=${classMap({ mrow: true, lead: r.leader, dim: !r.available })} data-pv-room=${r.key}>
      <div class="nm"><b>${bidi(r.name)}</b>${sub}</div>
      ${has ? this.slider(r.dev, null, true, dis) : html`<span></span>`}
      <span class="vv n" data-pv-value>${has && shown !== null ? volumeDisplay(r.dev, shown, this.now ?? new Date()).level : '–'}</span>
      ${r.dev.caps.mute ? this.muteButton(r.dev, dis) : html`<span></span>`}</div>`;
  }

  private grouped(lead: PlayerDevice): TemplateResult {
    const level = groupSliderLevel(this.rooms.map((r) => r.dev));
    const draft = this.drafts.get('*');
    const v = draft ?? level ?? 0;
    const off = !this.interactive || !this.groupOffered || !lead.live.caps_known;
    const pend = this.pend.has('gvol');
    return html`<div class="vrow" data-pv="group"><span class="lbl">קבוצה</span>
      <span class="rngwrap"><input class="rng" type="range" min="0" max="100" step="1" .value=${String(v)} style="--v:${v}%" aria-label="עוצמת הקבוצה" data-pv-group ?disabled=${off} aria-busy=${String(pend)} @input=${this.onGroup} /></span>
      <span class="vv n" data-pv-value>${draft ?? level ?? '–'}</span></div>
      <div class="psh"><h4>לפי חדר</h4><small>${this.rooms.length}</small>
        ${this.byRoom ? html`<button type="button" class="lnk" data-pv-equalize ?disabled=${off || level === null} @click=${() => this.emit('pv-equalize', {})}>אותה עוצמה</button>` : nothing}
        <button type="button" class="lnk" data-pv-rooms aria-expanded=${String(this.byRoom)} @click=${() => this.emit('pv-rooms', { open: !this.byRoom })}>${this.byRoom ? 'הסתר' : 'הצג'}${ic('chevronDown')}</button></div>
      ${this.byRoom ? html`<div class="members" data-pv-members>${repeat(this.rooms, (r) => r.key, (r) => this.room(r, !this.interactive || !lead.live.caps_known))}</div>` : nothing}`;
  }

  render() {
    const d = this.device;
    if (this.group) {
      const lead = this.device;
      return lead && this.rooms.length ? this.grouped(lead) : nothing;
    }
    return d ? this.single(d) : nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'media-player-volume': MediaPlayerVolume;
  }
}
