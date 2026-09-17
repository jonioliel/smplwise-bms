import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-chip';
import '../components/sw-card';
import '../components/sw-icon';
import '../components/sw-field';
import '../components/sw-state-panel';
import '../components/sw-timeline';
import '../components/sw-case-picker';
import { clipAround, type NewCaseItem } from '../api/cases';
import '../map/sw-plan-canvas';
import type { PlanMarker, MarkerSelectDetail } from '../map/sw-plan-canvas';
import { minuteLabel, secondLabel, type TimelineEvent } from '../components/sw-timeline';
import type { DemoSegment } from '../fixtures/catalog';
import { demoCameras, demoEntities, demoFloors, demoPlan } from '../fixtures/demo';
import { isApi } from '../api/session';
import { bidi } from '../i18n/bidi';
import { navigate } from '../router';
import { describeError } from '../api/client';
import { productSettings } from '../api/prefs';
import { loadTree, type CatalogTree } from '../api/catalog';
import { loadMap, type MapBundle } from '../api/maps';
import { EVENT_LABEL, listEvents, type EventKind, type VmsEvent } from '../api/events';
import { dateInZone, frameUrl, instantInZone, minuteInZone, recordingsForDay, type RecordingsResponse } from '../api/recordings';
import { entityMarkerKind, stateLabel } from '../api/ha';

const NEAR_MIN = 10;

function markerKind(t: EventKind): TimelineEvent['kind'] {
  return t === 'person' || t === 'vehicle' || t === 'motion' || t === 'line' || t === 'offline' || t === 'door' ? t : 'motion';
}

/**
 * SC11 / M16 — historical map: the floor at a chosen instant. Cameras show whether a recording covers that
 * instant (blue) or not (dashed "unknown"), HA entities are always "unknown" because no state history is
 * stored yet (never the last live value), events around the instant are listed and the timeline at the
 * bottom scrubs the day. Physical actions are not offered here. Without a backend the demo rendering stays.
 */
@customElement('investigate-history-map')
export class InvestigateHistoryMap extends LitElement {
  @property() floorId = 'f0';
  /** Instant to open at (UTC ISO), e.g. an event time; empty = now. */
  @property() at = '';
  /** Camera to preselect. */
  @property() camera = '';
  @state() private minute = 615;
  @state() private tz = 'Asia/Jerusalem';
  @state() private date = '';
  @state() private tree: CatalogTree | null = null;
  @state() private bundle: MapBundle | null = null;
  @state() private events: VmsEvent[] = [];
  @state() private recordings = new Map<string, RecordingsResponse | null>();
  @state() private selectedId: string | null = null;
  @state() private loading = false;
  @state() private error = '';
  /** Instant (UTC ISO) whose frame is shown for the selected camera; updated after the cursor settles. */
  @state() private frameAt = '';
  @state() private frameFailed = false;
  @state() private casePick: NewCaseItem | null = null;
  private frameTimer = 0;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      padding: 14px 24px 12px;
    }
    h1 {
      margin: 0;
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-semibold);
    }
    .sub {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-3);
      margin-block-start: 2px;
    }
    .grow {
      flex: 1;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0 24px 10px;
      padding: 8px 12px;
      background: var(--sw-recorded-soft);
      border: 1px solid #cddcff;
      border-radius: var(--sw-r-md);
      font-size: var(--sw-fs-sm);
      flex-wrap: wrap;
    }
    .time {
      font-family: var(--sw-font-mono);
      direction: ltr;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-accent-text);
    }
    input[type='range'] {
      inline-size: 260px;
      direction: ltr;
      accent-color: var(--sw-accent);
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 14px;
      margin: 0 24px 12px;
      align-items: start;
    }
    .stage {
      position: relative;
      block-size: 540px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      overflow: hidden;
    }
    .stage.alone {
      block-size: auto;
      min-block-size: 480px;
      flex: 1;
      margin: 0 24px 24px;
    }
    .stage sw-plan-canvas {
      block-size: 100%;
    }
    .legend {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      gap: 12px;
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 3px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .chip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 10px;
      padding: 5px 10px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }
    .hist {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      background: #f3e8ff;
      color: #6d28d9;
      border-radius: 10px;
      padding: 4px 10px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
      font-weight: var(--sw-fw-medium);
    }
    .evl {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .evl a {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      text-decoration: none;
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
    }
    .evl a.hit {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .evl .s {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-family: var(--sw-font-mono);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .frame {
      margin-block-start: 8px;
      border-radius: var(--sw-r-sm);
      overflow: hidden;
      background: var(--sw-surface-3);
      aspect-ratio: 16 / 9;
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .frame img {
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    .tl {
      margin: 0 24px 24px;
    }
    .tl sw-field {
      inline-size: 160px;
    }
    .tlbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-end: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 767px) {
      .head,
      .bar,
      .tl {
        margin-inline: 12px;
        padding-inline: 12px;
      }
      .head {
        padding-inline: 0;
      }
      .layout {
        margin-inline: 0;
      }
      .stage {
        border-radius: 0;
      }
      .legend {
        display: none;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (isApi()) void this.init();
  }

  protected updated(changed: Map<string, unknown>) {
    if (!isApi()) return;
    if ((changed.has('floorId') && changed.get('floorId') !== undefined) || (changed.has('at') && changed.get('at') !== undefined)) void this.init();
  }

  // ---- data ----

  private async init() {
    this.loading = true;
    this.error = '';
    try {
      const [settings, tree] = await Promise.all([productSettings(), this.tree ? Promise.resolve(this.tree) : loadTree()]);
      this.tz = settings['time.zone'] ?? this.tz;
      this.tree = tree;
      // the navigation links the generic 'f0': with a backend, land on the first real floor (3.11)
      if (isApi() && this.floors.length && !this.floors.some((f) => f.id === this.floorId)) {
        const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '').toString();
        window.location.replace(`#/investigate/floors/${this.floors[0].id}/history${q ? `?${q}` : ''}`);
        return;
      }
      const start = this.at ? new Date(this.at) : new Date();
      this.date = dateInZone(start, this.tz);
      this.minute = minuteInZone(start, this.tz);
      this.bundle = await loadMap(this.floorId, false, this.instant.toISOString().replace(/\.\d{3}Z$/, 'Z'));
      this.scheduleFrame();
      if (this.camera) {
        const a = this.bundle.anchors.find((x) => x.resource_type === 'camera' && x.resource_id === this.camera);
        this.selectedId = a?.id ?? null;
      }
      await this.loadDay();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.loading = false;
    }
  }

  private async loadDay() {
    const b = this.bundle;
    if (!b) return;
    const camIds = b.anchors.filter((a) => a.resource_type === 'camera').map((a) => a.resource_id);
    const [ev, recs] = await Promise.all([
      listEvents({ date: this.date, limit: 1000 }).then((r) => r.events.filter((e) => e.camera_id && camIds.includes(e.camera_id))).catch(() => [] as VmsEvent[]),
      Promise.allSettled(camIds.map((id) => recordingsForDay(id, this.date))),
    ]);
    this.events = ev;
    const m = new Map<string, RecordingsResponse | null>();
    camIds.forEach((id, i) => {
      const r = recs[i];
      m.set(id, r.status === 'fulfilled' ? r.value : null);
    });
    this.recordings = m;
  }

  private get instant(): Date {
    return instantInZone(this.date, this.minute, this.tz);
  }

  /** Whole-day minutes of a recording segment list for one camera (null = search failed / unknown). */
  private segmentsFor(cameraId: string): DemoSegment[] | null {
    const r = this.recordings.get(cameraId);
    if (!r) return null;
    return r.segments.map((s) => {
      const a = minuteInZone(new Date(s.start_at), this.tz);
      let bMin = minuteInZone(new Date(s.end_at), this.tz);
      if (bMin < a) bMin = 1440;
      return { startMin: a, endMin: bMin, kind: s.kind === 'continuous' ? 'continuous' : 'motion' };
    });
  }

  private coverageAt(cameraId: string): { state: 'historic' | 'unknown'; segment?: DemoSegment } {
    const segs = this.segmentsFor(cameraId);
    if (!segs) return { state: 'unknown' };
    const seg = segs.find((s) => this.minute >= s.startMin && this.minute <= s.endMin);
    return seg ? { state: 'historic', segment: seg } : { state: 'unknown' };
  }

  private eventsNear(cameraId?: string, minutes = NEAR_MIN): VmsEvent[] {
    const t = this.instant.getTime();
    return this.events
      .filter((e) => (!cameraId || e.camera_id === cameraId) && Math.abs(new Date(e.occurred_at).getTime() - t) <= minutes * 60 * 1000)
      .sort((a, b) => Math.abs(new Date(a.occurred_at).getTime() - t) - Math.abs(new Date(b.occurred_at).getTime() - t));
  }

  private get apiMarkers(): PlanMarker[] {
    const b = this.bundle;
    if (!b) return [];
    return b.anchors.map((a) => {
      if (a.resource_type === 'camera') {
        const cov = this.coverageAt(a.resource_id);
        const near = this.eventsNear(a.resource_id, 5).length;
        const name = a.camera?.name ?? a.label ?? a.resource_id;
        return { id: a.id, kind: 'camera' as const, label: near ? `${name} · ${near} אירועים` : name, x: a.position.x, y: a.position.y, rotation: a.rotation_degrees, fov: a.field_of_view_degrees ?? undefined, state: cov.state };
      }
      const sa = a.entity?.state_at;
      const name = a.entity?.name ?? a.label ?? a.resource_id;
      return { id: a.id, kind: entityMarkerKind(a.layer_id, a.entity?.domain), label: sa?.known && sa.state ? `${name} · ${stateLabel({ ...(a.entity ?? { domain: '', unit: null, device_class: null, attributes: {} }), state: sa.state })}` : name, x: a.position.x, y: a.position.y, state: sa?.known ? ('historic' as const) : ('unknown' as const) };
    });
  }

  private get selectedAnchor() {
    return this.bundle?.anchors.find((a) => a.id === this.selectedId) ?? null;
  }

  private get limitMinute(): number {
    return this.date === dateInZone(new Date(), this.tz) ? minuteInZone(new Date(), this.tz) : 1440;
  }

  setMinute(m: number) {
    this.minute = Math.max(0, Math.min(this.limitMinute, m));
    this.scheduleFrame();
  }

  /** The recording frame follows the cursor once it settles (a grab takes a few seconds; hovering must not flood). */
  private scheduleFrame() {
    window.clearTimeout(this.frameTimer);
    this.frameTimer = window.setTimeout(() => {
      this.frameAt = this.instant.toISOString().replace(/\.\d{3}Z$/, 'Z');
      this.frameFailed = false;
      void this.ensureVersion();
    }, 600);
  }

  /** The plan version and the anchors follow the instant (T038): reload the bundle once the cursor leaves the shown version's period. */
  private async ensureVersion() {
    const b = this.bundle;
    if (!b || b.source !== 'api' || !b.at) return;
    const t = this.instant.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const inside = b.history === 'current' ? !b.historyFrom || t < b.historyFrom : (!b.planPublishedAt || b.planPublishedAt <= t) && (!b.planArchivedAt || t < b.planArchivedAt);
    if (inside) return;
    try {
      const nb = await loadMap(this.floorId, false, t);
      const before = b.anchors.map((a) => a.resource_id).sort().join(',');
      this.bundle = nb;
      if (this.selectedId && !nb.anchors.some((a) => a.id === this.selectedId)) this.selectedId = null;
      if (nb.anchors.map((a) => a.resource_id).sort().join(',') !== before) await this.loadDay();
    } catch {
      /* keep the bundle that is shown */
    }
  }

  private renderEntityStates(b: MapBundle) {
    const ents = b.anchors.filter((a) => a.resource_type === 'ha_entity');
    if (!ents.length) return html`אין ישויות מוצבות בקומה`;
    const known = ents.filter((a) => a.entity?.state_at?.known);
    const cov = b.haHistory;
    return html`${known.length} מתוך ${ents.length} ידועות בזמן זה${cov?.from ? html` <span class="note">(היסטוריה מקומית מ־<span class="ltr">${this.fmtWhen(cov.from)}</span>, ${cov.retention_days} ימים)</span>` : html` <span class="note">(אין עדיין היסטוריה מקומית)</span>`}
      <div class="evl" style="margin-block-start:4px">${ents.slice(0, 8).map((a) => {
        const sa = a.entity?.state_at;
        const name = a.entity?.name ?? a.label ?? a.resource_id;
        return html`<div data-history-entity data-known=${sa?.known ? 'true' : 'false'}><span>${name}</span><span class="note">${sa?.known && sa.state ? html`${stateLabel({ ...(a.entity ?? { domain: '', unit: null, device_class: null, attributes: {} }), state: sa.state })} · מ־<span class="ltr">${sa.changed_at ? this.fmt(sa.changed_at) : ''}</span>` : html`לא ידוע${sa?.reason ? ` · ${sa.reason}` : ''}${sa?.state ? html` <span class="ltr">(אחרון: ${sa.state})</span>` : ''}`}</span></div>`;
      })}</div>`;
  }

  private fmtWhen(iso: string) {
    return new Intl.DateTimeFormat('he-IL', { timeZone: this.tz, dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  }

  private setDate(date: string) {
    this.date = date;
    this.minute = Math.min(this.minute, this.limitMinute);
    void this.loadDay();
  }

  private fmt(iso: string) {
    return new Intl.DateTimeFormat('he-IL', { timeZone: this.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  }

  private get floors(): { id: string; name: string }[] {
    if (this.tree?.source !== 'api') return [];
    return this.tree.sites.flatMap((s) => (s.buildings ?? []).flatMap((b) => (b.floors ?? []).map((f) => ({ id: f.id, name: `${b.name} · ${f.name}` }))));
  }

  // ---- render ----

  private renderPanel(b: MapBundle) {
    const a = this.selectedAnchor;
    const cam = a?.resource_type === 'camera' ? a : null;
    const cov = cam ? this.coverageAt(cam.resource_id) : null;
    const recs = cam ? this.recordings.get(cam.resource_id) : undefined;
    const near = this.eventsNear(undefined, NEAR_MIN);
    const tISO = this.instant.toISOString().replace(/\.\d{3}Z$/, 'Z');
    return html`<div class="panel">
      <sw-card heading="בנקודת הזמן שנבחרה" subheading="זמן ונתונים מאותו רגע" data-history-panel>
        <dl>
          <dt>זמן</dt><dd><span class="ltr" data-history-time>${this.date} ${secondLabel(this.minute)}</span> <span class="note">${this.tz}</span></dd>
          <dt>מצלמה נבחרת</dt><dd data-history-camera>${cam ? cam.camera?.name ?? cam.resource_id : 'לחץ על מצלמה במפה'}</dd>
          ${cam
            ? html`<dt>הקלטה</dt><dd>${recs === undefined ? 'טוען…' : recs === null ? 'לא ניתן לבדוק מול ה־NVR' : cov?.segment ? html`יש הקלטה · ${minuteLabel(cov.segment.startMin)}–${minuteLabel(cov.segment.endMin)} · ${cov.segment.kind === 'continuous' ? 'רציף' : 'תנועה'}` : 'אין הקלטה בזמן זה (פער)'}</dd>
                <dt>אירועים ±5 דק׳</dt><dd>${this.eventsNear(cam.resource_id, 5).length}</dd>`
            : nothing}
          <dt>ישויות HA</dt><dd data-history-entities>${this.renderEntityStates(b)}</dd>
          ${cam && this.frameAt ? html`<dt>פריים</dt><dd><div class="frame" data-history-frame>${this.frameFailed ? html`<span>אין פריים בהקלטה בזמן זה</span>` : html`<img src=${frameUrl(cam.resource_id, this.frameAt)} alt="פריים מההקלטה בזמן שנבחר" @error=${() => (this.frameFailed = true)} />`}</div></dd>` : nothing}
          <dt>גרסת תוכנית</dt><dd data-history-plan-version data-history-mode=${b.history ?? 'live'}>${b.history === 'exact' && b.planPublishedAt ? html`בתוקף באותו זמן · פורסמה <span class="ltr">${this.fmtWhen(b.planPublishedAt)}</span>${b.planArchivedAt ? html` · הוחלפה <span class="ltr">${this.fmtWhen(b.planArchivedAt)}</span>` : ''}` : b.historyFrom ? html`המפה הנוכחית · היסטוריית המפה מתחילה <span class="ltr">${this.fmtWhen(b.historyFrom)}</span>` : 'המפה הנוכחית'}</dd>
        </dl>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-block-start:10px">
          ${cam ? html`<sw-button variant="primary" size="sm" icon="history" @click=${() => navigate('/investigate/playback', { camera: cam.resource_id, t: tISO })}>נגן מכאן</sw-button>` : nothing}
          <sw-button size="sm" icon="case" data-add-to-case ?disabled=${!cam} title=${cam ? 'קטע של המצלמה הנבחרת סביב הזמן שנבחר (15 שניות לפני, 45 אחרי)' : 'בחר מצלמה במפה'} @click=${() => { if (cam) this.casePick = { kind: 'clip', camera_id: cam.resource_id, ...clipAround(this.instant) }; }}>הוסף לתיק</sw-button>
        </div>
      </sw-card>
      <sw-case-picker .item=${this.casePick} subheading=${cam ? `${cam.camera?.name ?? cam.resource_id} · ${this.date} ${secondLabel(this.minute)}` : ''} @close=${() => (this.casePick = null)}></sw-case-picker>
      <sw-card heading="אירועים סביב הזמן" subheading=${`±${NEAR_MIN} דקות · מצלמות הקומה`}>
        ${near.length
          ? html`<div class="evl" data-history-events>${near.slice(0, 8).map((e) => html`<a class=${cam && e.camera_id === cam.resource_id ? 'hit' : ''} href=${`#/investigate/events/${e.id}`}><span>${EVENT_LABEL[e.type] ?? e.type} · ${e.camera_name ?? e.channel ?? ''}<div class="s">${e.confidence === 'inferred' ? 'נגזר מהקלטה' : 'התראה מה־NVR'}${e.acked_at ? ' · טופל' : ''}</div></span><span class="ltr">${this.fmt(e.occurred_at)}</span></a>`)}</div>`
          : html`<div class="note">אין אירועים בחלון הזה.</div>`}
      </sw-card>
    </div>`;
  }

  private renderApi() {
    const b = this.bundle;
    if (this.error && !b) return html`<div class="head"><h1>מפה היסטורית</h1></div><sw-state-panel state="error" hint=${this.error}></sw-state-panel>`;
    if (!b) return html`<div class="head"><h1>מפה היסטורית</h1></div><sw-state-panel state="loading"></sw-state-panel>`;
    const sel = this.selectedAnchor;
    const segs = sel?.resource_type === 'camera' ? this.segmentsFor(sel.resource_id) ?? [] : Array.from(this.recordings.keys()).flatMap((id) => this.segmentsFor(id) ?? []);
    const tlEvents: TimelineEvent[] = (sel?.resource_type === 'camera' ? this.events.filter((e) => e.camera_id === sel.resource_id) : this.events).map((e) => ({ minute: minuteInZone(new Date(e.occurred_at), this.tz), kind: markerKind(e.type), label: `${EVENT_LABEL[e.type] ?? e.type}${e.count > 1 ? ` ×${e.count}` : ''}` }));
    return html`
      <div class="head">
        <div><h1>המפה בזמן שנבחר · ${b.floorName}</h1><div class="sub">${b.buildingName} · <span class="ltr">${this.date} ${secondLabel(this.minute)}</span> · ${this.tz}</div></div>
        <span class="grow"></span>
        ${this.floors.length > 1 ? html`<sw-field><select aria-label="קומה" @change=${(e: Event) => navigate(`/investigate/floors/${(e.target as HTMLSelectElement).value}`, { t: this.instant.toISOString() })}>${this.floors.map((f) => html`<option value=${f.id} ?selected=${f.id === this.floorId}>${bidi(f.name)}</option>`)}</select></sw-field>` : nothing}
        <sw-button icon="live" data-back-live @click=${() => navigate(`/explore/floors/${b.floorId}`)}>חזרה למצב חי</sw-button>
      </div>
      <div class="bar"><sw-icon name="clock" size=${14}></sw-icon><span>מצב חקירה היסטורי — פעולות פיזיות אינן זמינות. מצב ללא היסטוריה מוצג כלא ידוע, לא כערך החי האחרון.</span>${this.loading ? html`<span class="note">טוען הקלטות ואירועים…</span>` : nothing}</div>
      <div class="layout">
        <div class="stage">
          <div class="chip"><sw-icon name="building" size=${14}></sw-icon>${b.floorName}</div>
          <div class="hist">מצב היסטורי · <span class="ltr">${secondLabel(this.minute)}</span></div>
          <sw-plan-canvas alwaysLabel .planWidth=${b.width} .planHeight=${b.height} .plan=${b.planSvg} .imageUrl=${b.imageUrl} .markers=${this.apiMarkers} .selectedId=${this.selectedId} .zones=${b.zones} dimEntities
            @marker-select=${(e: CustomEvent<MarkerSelectDetail>) => { this.selectedId = e.detail.id; this.frameFailed = false; }}></sw-plan-canvas>
          <div class="legend"><span>כחול = יש הקלטה בזמן זה</span><span>מקווקו = אין הקלטה / לא ידוע</span><span>ישויות HA = מצב מההיסטוריה המקומית או לא ידוע</span></div>
        </div>
        ${this.renderPanel(b)}
      </div>
      <div class="tl">
        <div class="tlbar">
          <sw-badge kind="historic"></sw-badge>
          <span class="time">${this.date} ${secondLabel(this.minute)}</span>
          <sw-chip @click=${() => this.setMinute(this.minute - 60)}>-1 שעה</sw-chip><sw-chip @click=${() => this.setMinute(this.minute - 5)}>-5 דק׳</sw-chip><sw-chip @click=${() => this.setMinute(this.minute + 5)}>+5 דק׳</sw-chip><sw-chip @click=${() => this.setMinute(this.minute + 60)}>+1 שעה</sw-chip>
          <span class="grow"></span>
          <sw-field><input type="date" .value=${this.date} max=${dateInZone(new Date(), this.tz)} data-ltr aria-label="תאריך" @change=${(e: Event) => this.setDate((e.target as HTMLInputElement).value)} /></sw-field>
          <span class="note">${sel?.resource_type === 'camera' ? `ציר הזמן: ${sel.camera?.name ?? ''}` : 'ציר הזמן: כל מצלמות הקומה'}</span>
        </div>
        <sw-timeline .segments=${segs} .events=${tlEvents} .cursor=${this.minute} .limit=${this.limitMinute} .follow=${false} precision="estimated" @seek=${(e: CustomEvent<{ minute: number }>) => this.setMinute(e.detail.minute)} @scrub=${(e: CustomEvent<{ minute: number }>) => this.setMinute(e.detail.minute)}></sw-timeline>
      </div>
    `;
  }

  // ---- demo (design preview without a backend) ----

  private get demoMarkers(): PlanMarker[] {
    const covered = (id: string) => (id === 'cam-3' ? 'unknown' : this.minute >= 190 && this.minute <= 205 ? 'unknown' : 'historic');
    const cams: PlanMarker[] = demoCameras.filter((c) => c.floorId === this.floorId).map((c) => ({ id: c.id, kind: 'camera', label: c.name, x: c.x, y: c.y, rotation: c.rotation, fov: c.fov, state: c.state === 'forbidden' ? 'forbidden' : covered(c.id) }));
    const ents: PlanMarker[] = demoEntities.filter((e) => e.floorId === this.floorId).map((e, i) => ({ id: e.id, kind: e.domain, label: e.name, x: e.x, y: e.y, state: i % 2 ? 'unknown' : 'historic' }));
    return [...cams, ...ents];
  }

  private renderDemo() {
    const floor = demoFloors.find((f) => f.id === this.floorId) ?? demoFloors[0];
    return html`
      <div class="head">
        <div><h1>מפה היסטורית · ${bidi(floor.name)}</h1><div class="sub">מצב המפה בזמן נבחר · פעולות פיזיות כבויות בחקירה · נתוני הדגמה</div></div>
        <span class="grow"></span>
        <a href="#/explore/floors/${floor.id}"><sw-button icon="live">חזרה ל־Live</sw-button></a>
      </div>
      <div class="bar">
        <sw-badge kind="historic"></sw-badge>
        <span class="time">2026-09-14 ${minuteLabel(this.minute)}</span>
        <input type="range" min="0" max="1439" .value=${String(this.minute)} @input=${(e: Event) => (this.minute = Number((e.target as HTMLInputElement).value))} aria-label="זמן" />
        <sw-chip @click=${() => (this.minute = Math.max(0, this.minute - 60))}>-1 שעה</sw-chip><sw-chip @click=${() => (this.minute = Math.min(1439, this.minute + 60))}>+1 שעה</sw-chip>
        <span class="grow"></span>
        <span style="font-size:var(--sw-fs-xs);color:var(--sw-text-2)">גרסת מפה 3 (תקפה מ־01.09)</span>
      </div>
      <div class="stage alone">
        <sw-plan-canvas .planWidth=${floor.planWidth} .planHeight=${floor.planHeight} .plan=${demoPlan(floor.id)} .markers=${this.demoMarkers}></sw-plan-canvas>
        <div class="legend"><span>כחול = יש הקלטה בזמן זה</span><span>מקווקו = לא ידוע / פער</span><span>ישות: מצב ידוע אחרון</span></div>
      </div>
    `;
  }

  render() {
    return isApi() ? this.renderApi() : this.renderDemo();
  }
}
