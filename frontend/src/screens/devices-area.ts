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
import type { StateKind } from '../components/sw-badge';
import type { IconName } from '../components/sw-icon';
import { canAnywhere, isApi } from '../api/session';
import { ApiError, describeError } from '../api/client';
import { stateLabel, subscribeHa, type HaSyncState } from '../api/ha';
import { ALARM_HE, CARD_EMPTY, CARD_IDS, HVAC_ACTION_HE, HVAC_HE, getDevicesArea, type CardId, type DeviceAreaDetail, type DeviceCard, type DeviceRow } from '../api/devices';
import { alarmTone, REFRESH_WINDOW_MS } from './devices-building';
import { navigate } from '../router';
import { bidi, ltrNum } from '../i18n/bidi';

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
  private stop: (() => void) | null = null;
  private timer = 0;
  private loading = false;
  private loadAgain = false;

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
      <div class="note">תצוגה לקריאה בלבד: מצב ההתקנים כפי ש־Home Assistant מדווח אותו. שליטה מגיעה בשלב הבא.</div>
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

  private renderTile(r: DeviceRow, card: CardId) {
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
    return html`<div class=${classMap({ tile: true, on: r.active && !unavailable, off: !r.active && !unavailable, unavailable })} data-entity=${r.entity_id} data-active=${String(r.active)} title=${r.entity_id}>
      <div class="t"><sw-icon .name=${icon} size=${15}></sw-icon><span>${bidi(r.name)}</span></div>
      <div class="s">${unavailable ? 'לא זמין' : value}</div>
    </div>`;
  }

  private renderRow(r: DeviceRow, card: CardId) {
    const unavailable = !r.available || r.state === 'unavailable';
    const on = r.active && !unavailable;
    if (card === 'climate') {
      const isClimate = r.domain === 'climate';
      return html`<div class=${classMap({ row: true, on, unavailable })} data-entity=${r.entity_id} data-active=${String(r.active)} title=${r.entity_id}>
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
      </div>`;
    }
    if (card === 'covers') {
      return html`<div class=${classMap({ row: true, on, unavailable })} data-entity=${r.entity_id} data-active=${String(r.active)} title=${r.entity_id}>
        <span class="n">${bidi(r.name)}</span>
        <span class="v">${rowLabel(r)}</span>
        ${r.position !== null && r.position !== undefined && !unavailable ? html`<div class="bar" role="img" aria-label=${`פתוח ${r.position}%`}><i style=${`inline-size:${r.position}%`}></i></div>` : nothing}
        ${r.tilt !== null && r.tilt !== undefined && !unavailable ? html`<div class="d"><span>הטיה ${ltrNum(r.tilt)}%</span></div>` : nothing}
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
    return html`<div class=${classMap({ row: true, on, unavailable })} data-entity=${r.entity_id} data-active=${String(r.active)} title=${r.entity_id}>
      <span class="n"><sw-icon name="play" size=${14}></sw-icon> ${bidi(r.name)}</span>
      <span class="v">${rowLabel(r)}</span>
      ${!unavailable && (r.media_title || r.source || r.volume_pct !== null)
        ? html`<div class="d">
            ${r.media_title ? html`<span>${r.media_title}</span>` : nothing}
            ${r.source ? html`<span>מקור: ${r.source}</span>` : nothing}
            ${r.volume_pct !== null && r.volume_pct !== undefined ? html`<span>עוצמה ${ltrNum(r.volume_pct)}%${r.muted ? ' · מושתק' : ''}</span>` : nothing}
          </div>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'devices-area': DevicesArea;
  }
}
