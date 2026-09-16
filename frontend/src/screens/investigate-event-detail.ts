import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-icon';
import '../components/sw-state-panel';
import '../components/sw-live-player';
import '../components/sw-case-picker';
import type { NewCaseItem } from '../api/cases';
import '../map/sw-plan-canvas';
import type { PlanMarker } from '../map/sw-plan-canvas';
import { navigate } from '../router';
import { describeError } from '../api/client';
import { isApi } from '../api/session';
import { ackEvent, EVENT_LABEL, getEvent, listEvents, pollThumbnail, thumbnailUrl, type EventDetail, type VmsEvent } from '../api/events';
import { closePlayback, createPlayback, playbackWsUrl, type PlaybackSession } from '../api/recordings';
import { cameraState, loadMap, type MapBundle } from '../api/maps';
import { entityMarkerKind } from '../api/ha';

const SOURCE_LABEL = { alertstream: 'אירוע NVR', recording: 'נגזר מהקלטה', system: 'מערכת' } as const;
const NEARBY_MS = 10 * 60 * 1000;

/**
 * M27 — one event with its video and its place: the recording plays from just before the event, the context
 * panel shows status / source / type / time / window, the camera's floor with the pin (and the room it sits
 * in), events around the same minutes, and the actions "סמן כטופל" and "המשך חקירה במפה". The event time and
 * the played frame time are shown separately (they differ by the keyframe distance).
 */
@customElement('investigate-event-detail')
export class InvestigateEventDetail extends LitElement {
  @property() eventId = '';
  @state() private ev: EventDetail | null = null;
  @state() private error = '';
  @state() private tz = 'Asia/Jerusalem';
  @state() private session: PlaybackSession | null = null;
  @state() private playerError = '';
  @state() private bundle: MapBundle | null = null;
  @state() private nearby: VmsEvent[] = [];
  @state() private busy = false;
  @state() private thumbVersion = 0;
  @state() private casePick: NewCaseItem | null = null;
  private pollTimer = 0;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 16px;
      align-items: start;
    }
    .player {
      position: relative;
      aspect-ratio: 16 / 9;
      background: #0f172a;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      box-shadow: var(--sw-shadow-1);
    }
    .player sw-live-player,
    .player img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: contain;
    }
    .player .hint {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: rgba(255, 255, 255, 0.8);
      font-size: var(--sw-fs-sm);
      text-align: center;
      padding: 20px;
    }
    .chip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(17, 24, 39, 0.72);
      color: #fff;
      border-radius: 8px;
      padding: 4px 10px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .caption {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      color: #fff;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      font-size: var(--sw-fs-sm);
    }
    .caption small {
      display: block;
      opacity: 0.85;
      font-size: var(--sw-fs-xs);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-start: 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .bar .grow {
      flex: 1;
    }
    dl.meta {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dl.meta dt {
      color: var(--sw-text-3);
    }
    dl.meta dd {
      margin: 0;
      font-weight: var(--sw-fw-medium);
    }
    .map {
      position: relative;
      block-size: 230px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-map-bg);
      margin-block-start: 10px;
    }
    .map sw-plan-canvas {
      block-size: 100%;
      min-block-size: 0;
    }
    .floorchip {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
      z-index: var(--sw-z-map-ui);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      padding: 3px 8px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .nearby {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-block-start: 6px;
    }
    .nearby a {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 8px;
      border-radius: var(--sw-r-sm);
      text-decoration: none;
      color: var(--sw-text);
      font-size: var(--sw-fs-sm);
      border: 1px solid var(--sw-border);
    }
    .nearby a:hover {
      background: var(--sw-surface-3);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 8px;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      font-family: var(--sw-font-mono);
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearTimeout(this.pollTimer);
    void this.stopPlayer();
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('eventId') && changed.get('eventId') !== undefined) void this.load();
  }

  private async load() {
    if (!isApi()) return;
    this.error = '';
    await this.stopPlayer();
    try {
      const ev = await getEvent(this.eventId);
      this.ev = ev;
      this.tz = ev.timezone || this.tz;
      if (ev.location?.has_plan) void this.loadMap(ev.location.floor_id);
      else this.bundle = null;
      void this.loadNearby(ev);
      if (ev.camera_id) void this.play(ev);
      if (ev.thumbnail === 'pending') this.pollThumb(ev.id);
    } catch (err) {
      this.error = describeError(err);
      this.ev = null;
    }
  }

  private async loadMap(floorId: string) {
    try {
      this.bundle = await loadMap(floorId);
    } catch {
      this.bundle = null;
    }
  }

  private async loadNearby(ev: VmsEvent) {
    try {
      const at = new Date(ev.occurred_at).getTime();
      const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const r = await listEvents({ from: iso(at - NEARBY_MS), to: iso(at + NEARBY_MS), limit: 30 });
      this.nearby = r.events.filter((e) => e.id !== ev.id).slice(0, 6);
    } catch {
      this.nearby = [];
    }
  }

  private pollThumb(id: string) {
    window.clearTimeout(this.pollTimer);
    this.pollTimer = window.setTimeout(async () => {
      const st = await pollThumbnail(id).catch(() => 'unavailable' as const);
      if (this.ev?.id !== id) return;
      if (st === 'pending') this.pollThumb(id);
      else {
        this.ev = { ...this.ev, thumbnail: st };
        if (st === 'ready') this.thumbVersion = Date.now();
      }
    }, 1500);
  }

  private async play(ev: VmsEvent) {
    if (!ev.camera_id) return;
    this.playerError = '';
    try {
      const startAt = new Date(new Date(ev.occurred_at).getTime() - 2000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const session = await createPlayback(ev.camera_id, startAt);
      if (this.ev?.id === ev.id) this.session = session;
      else await closePlayback(session.id).catch(() => undefined);
    } catch (err) {
      this.playerError = describeError(err);
    }
  }

  private async stopPlayer() {
    const s = this.session;
    this.session = null;
    if (s) await closePlayback(s.id).catch(() => undefined);
  }

  private async ack() {
    const ev = this.ev;
    if (!ev || ev.acked_at) return;
    this.busy = true;
    try {
      const r = await ackEvent(ev.id);
      this.ev = { ...ev, acked_at: r.acked_at, acked_by_username: r.acked_by_username };
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private fmt(iso: string, withDate = false): string {
    const d = new Date(iso);
    const time = new Intl.DateTimeFormat('he-IL', { timeZone: this.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(d);
    if (!withDate) return time;
    return `${new Intl.DateTimeFormat('he-IL', { timeZone: this.tz, day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)} · ${time}`;
  }

  private duration(ev: VmsEvent): string {
    if (!ev.ended_at) return typeof ev.details.seconds === 'number' ? `${ev.details.seconds} שנ׳ (הקלטה)` : '—';
    const s = Math.max(0, Math.round((new Date(ev.ended_at).getTime() - new Date(ev.occurred_at).getTime()) / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  private get markers(): PlanMarker[] {
    const b = this.bundle;
    if (!b) return [];
    return b.anchors.map((a) => ({
      id: a.id,
      kind: a.resource_type === 'camera' ? 'camera' : entityMarkerKind(a.layer_id, a.entity?.domain),
      label: a.camera?.name ?? a.entity?.name ?? a.label ?? a.resource_id,
      x: a.position.x,
      y: a.position.y,
      rotation: a.rotation_degrees,
      fov: a.field_of_view_degrees ?? undefined,
      state: a.resource_type === 'camera' ? cameraState(a) : 'neutral',
    }));
  }

  render() {
    if (!isApi()) return html`<sw-page heading="אירוע"><sw-state-panel state="empty" heading="דף האירוע זמין עם השרת" hint="במצב הדגמה אין אירועים אמיתיים."></sw-state-panel></sw-page>`;
    if (this.error && !this.ev) return html`<sw-page heading="אירוע"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel></sw-page>`;
    const ev = this.ev;
    if (!ev) return html`<sw-page heading="אירוע"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    const label = EVENT_LABEL[ev.type] ?? ev.type;
    const camera = ev.camera_name ?? (ev.channel ? `ערוץ ${ev.channel}` : 'מערכת');
    const loc = ev.location;
    const where = loc ? `${loc.building_name} · ${loc.floor_name}${loc.zone ? ` / ${loc.zone}` : ''}` : null;
    const acked = !!ev.acked_at;
    return html`
      <sw-page heading=${`${label} · ${camera}`} subheading=${`${SOURCE_LABEL[ev.source] ?? ev.source} · ${this.fmt(ev.occurred_at, true)}`} crumbs=${`חקירה | אירועים | ${label}`} wide>
        <sw-button slot="actions" variant=${acked ? 'ghost' : 'primary'} icon="check" ?disabled=${acked || this.busy} @click=${() => this.ack()}>${acked ? 'טופל' : 'סמן כטופל'}</sw-button>
        <sw-button slot="actions" icon="case" data-add-to-case @click=${() => (this.casePick = { kind: 'event', event_id: ev.id })}>הוסף לתיק</sw-button>
        <sw-button slot="actions" variant="ghost" icon="list" @click=${() => navigate('/investigate/events')}>למרכז האירועים</sw-button>
        ${this.error ? html`<div class="err">${this.error}</div>` : nothing}
        <div class="layout">
          <div>
            <div class="player" data-player>
              ${this.session
                ? html`<sw-live-player .wsUrl=${playbackWsUrl(this.session)} mode="mse" .retry=${false}></sw-live-player>`
                : ev.thumbnail === 'ready'
                  ? html`<img src=${thumbnailUrl(ev.id, this.thumbVersion)} alt="תמונת האירוע מההקלטה" />`
                  : html`<div class="hint">${!ev.camera_id ? 'אירוע ללא מצלמה — אין וידאו' : this.playerError ? `ההקלטה לא נפתחה: ${this.playerError}` : ev.thumbnail === 'unavailable' ? 'אין הקלטה זמינה בזמן האירוע' : 'פותח את ההקלטה…'}</div>`}
              <span class="chip"><sw-icon name="clock" size=${12}></sw-icon>${this.session ? 'הקלטה' : ev.thumbnail === 'ready' && !this.session ? 'תמונה מההקלטה' : 'אירוע'}</span>
              <div class="caption">${camera}<small>זמן האירוע <span class="ltr">${this.fmt(ev.occurred_at)}</span>${this.session?.actual_start_at ? html` · הנגן מתחיל <span class="ltr">${this.fmt(this.session.actual_start_at)}</span>${this.session.time_precision !== 'verified' ? ` (${this.session.time_precision === 'keyframe_limited' ? 'לפי keyframe' : 'משוער'})` : ''}` : nothing}</small></div>
            </div>
            <div class="bar">
              <span>${this.session ? 'הנגן פותח את ההקלטה שתי שניות לפני זמן האירוע; זמן האירוע וזמן הפריים המנוגן מוצגים בנפרד.' : ev.playerHint ?? ''}</span>
              <span class="grow"></span>
              ${ev.camera_id ? html`<sw-button size="sm" icon="history" @click=${() => navigate('/investigate/playback', { camera: ev.camera_id!, t: ev.occurred_at })}>הנגן המלא עם ציר הזמן</sw-button>` : nothing}
              ${ev.camera_id ? html`<sw-button size="sm" variant="ghost" icon="play" @click=${() => (this.session ? this.stopPlayer() : this.play(ev))}>${this.session ? 'עצור' : 'נגן שוב'}</sw-button>` : nothing}
            </div>
          </div>
          <div>
            <sw-card heading="הקשר האירוע" data-context>
              <dl class="meta">
                <dt>מצב</dt><dd data-status>${acked ? html`<sw-badge kind="live" label=${`טופל · ${ev.acked_by_username ?? ''}`}></sw-badge> <span class="note" style="margin:0">${this.fmt(ev.acked_at!, true)}</span>` : html`<sw-badge kind="stale" label="טרם טופל"></sw-badge>`}</dd>
                <dt>מקור</dt><dd>${SOURCE_LABEL[ev.source] ?? ev.source}${ev.camera_id ? html` / ${camera}` : nothing} <span class="note" style="margin:0">raw <span class="ltr">${ev.raw_type}</span></span></dd>
                <dt>סוג</dt><dd>${label}${ev.confidence === 'inferred' ? ' · נגזר (inferred)' : ''}</dd>
                <dt>זמן התחלה</dt><dd><span class="ltr">${this.fmt(ev.occurred_at, true)}</span></dd>
                <dt>משך החלון</dt><dd>${this.duration(ev)}${ev.count > 1 ? ` · ${ev.count} חזרות` : ''}</dd>
                <dt>מיקום</dt><dd data-where>${where ?? (ev.camera_id ? 'המצלמה עדיין לא מוצבת על תוכנית' : '—')}</dd>
              </dl>
              ${loc && loc.has_plan && this.bundle
                ? html`<div class="map">
                    <div class="floorchip"><sw-icon name="building" size=${12}></sw-icon>${loc.floor_name}</div>
                    <sw-plan-canvas .planWidth=${this.bundle.width} .planHeight=${this.bundle.height} .imageUrl=${this.bundle.imageUrl} .plan=${this.bundle.planSvg} .markers=${this.markers} .selectedId=${loc.anchor_id} .zones=${this.bundle.zones} alwaysLabel dimEntities></sw-plan-canvas>
                  </div>
                  <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
                    <sw-button size="sm" icon="map" data-history-map @click=${() => navigate(`/investigate/floors/${loc.floor_id}`, { t: ev.occurred_at, camera: ev.camera_id ?? '' })}>המשך חקירה במפה</sw-button>
                    <sw-button size="sm" variant="ghost" icon="live" @click=${() => navigate(`/explore/floors/${loc.floor_id}`)}>מפה חיה</sw-button>
                  </div>`
                : loc
                  ? html`<div class="note">לקומה ${loc.floor_name} אין תוכנית מפורסמת עדיין.</div>`
                  : nothing}
              <div class="note">מיקום סמוך הוא הקשר, לא הוכחת קשר סיבתי; סימון "טופל" נרשם באודיט בשם המשתמש.</div>
            </sw-card>
            <sw-card heading="אירועים קרובים" subheading="±10 דקות סביב האירוע" style="margin-block-start:12px">
              ${this.nearby.length
                ? html`<div class="nearby">${this.nearby.map((n) => html`<a href=${`#/investigate/events/${n.id}`}><span>${EVENT_LABEL[n.type] ?? n.type} · ${n.camera_name ?? (n.channel ? `ערוץ ${n.channel}` : 'מערכת')}</span><span class="ltr">${this.fmt(n.occurred_at)}</span></a>`)}</div>`
                : html`<div class="note" style="margin:0">אין אירועים נוספים בחלון הזה.</div>`}
            </sw-card>
          </div>
        </div>
        <sw-case-picker .item=${this.casePick} subheading=${`${label} · ${camera} · ${this.fmt(ev.occurred_at, true)}`} @close=${() => (this.casePick = null)}></sw-case-picker>
      </sw-page>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'investigate-event-detail': InvestigateEventDetail;
  }
}
