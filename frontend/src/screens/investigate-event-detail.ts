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
import { listCases, type Case, type NewCaseItem } from '../api/cases';
import '../map/sw-plan-canvas';
import type { PlanMarker } from '../map/sw-plan-canvas';
import { navigate } from '../router';
import { describeError } from '../api/client';
import { isApi } from '../api/session';
import { CERTAINTY_LABEL, EVENT_LABEL, ackEvent, confirmEventRoute, getCorrelation, getEvent, getEventRoute, listEvents, pollThumbnail, thumbnailUrl, type Certainty, type Correlation, type EventDetail, type EventRoute, type RouteConfirmResult, type VmsEvent } from '../api/events';
import type { StateKind } from '../components/sw-badge';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

const CERTAINTY_KIND: Record<Certainty, StateKind> = { measured: 'recorded', inferred: 'unknown', command: 'partial', availability: 'stale' };
import { closePlayback, createPlayback, playbackWsUrl, type PlaybackSession } from '../api/recordings';
import { cameraState, entityName, loadMap, type MapBundle } from '../api/maps';
import { entityMarkerKind } from '../api/ha';
import { geometryFor } from '../api/geometry';
import type { AnchorPosition, CatalogLookup, GeometryDoc } from '../map/geometry';
import { loadLibrary, lookup3dOf, lookupOf } from '../api/plan-catalog';
import { buildScene, type Catalog3DLookup, type SceneAnchor, type SceneDescription } from '../map/scene-builder';
import type { ScenePreset } from '../map/scene-three';
import type { PartSelectDetail } from '../map/sw-plan-3d';
import { boundItemOf } from '../map/part-select';
import { zonesWithChips } from '../map/shared-space';
import { WEBGL_UNAVAILABLE_HE, webglAvailable } from '../map/webgl';
import { sameRefs } from '../map/memo';
import { initialLevel } from '../map/studio-ops';
import { productSettings } from '../api/prefs';

const SOURCE_LABEL = { alertstream: 'אירוע NVR', recording: 'נגזר מהקלטה', system: 'מערכת', ha: 'חיישן התקן' } as const;
const NEARBY_MS = 10 * 60 * 1000;

/**
 * M27 — one event with its video and its place: the recording plays from just before the event, the context
 * panel shows status / source / type / time / window, the camera's floor with the pin (and the room it sits
 * in), events around the same minutes, and the actions "סמן כטופל" and "המשך חקירה במפה". The event time and
 * the played frame time are shown separately (they differ by the keyframe distance).
 */
@customElement('investigate-event-detail')
export class InvestigateEventDetail extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @property() eventId = '';
  @state() private ev: EventDetail | null = null;
  @state() private error = '';
  @state() private tz = 'Asia/Jerusalem';
  @state() private session: PlaybackSession | null = null;
  @state() private playerError = '';
  @state() private bundle: MapBundle | null = null;
  @state() private nearby: VmsEvent[] = [];
  @state() private corr: Correlation | null = null;
  @state() private corrError = '';
  @state() private route: EventRoute | null = null;
  @state() private busy = false;
  @state() private thumbVersion = 0;
  @state() private casePick: NewCaseItem | null = null;
  /** M064: the suggested cameras ticked for the case (all, until the operator unticks), the case to put them in
   * ('' = a new case), the open cases on offer, and the last confirmation. */
  @state() private routeTicked: Set<string> | null = null;
  @state() private routeCase = '';
  @state() private routeCases: Case[] | null = null;
  @state() private routeBusy = false;
  @state() private routeError = '';
  @state() private routeDone: RouteConfirmResult | null = null;
  @state() private geometry: GeometryDoc | null = null;
  /** `plan.levels` (0.1.89) applied once per floor load: null (all levels) or the floor's default level id. There is
   * no level bar on this screen, so it stays fixed for the event's floor and only culls the 3D structure (walls,
   * objects, zones) — cameras and entities keep showing on every level (`anchorsEveryLevel`), matching the 2D,
   * which never hid anchors either; the event's own camera never disappears from "מבט מהמצלמה". */
  @state() private level: string | null = null;
  @state() private catalogLookup: CatalogLookup | null = null;
  /** The loaded plan picture switch (owner request 2026-09-26), a switch of its own like the live map's, the
   * editor's and the historical map's, remembered per floor in this browser. */
  @state() private planImage = true;
  private pollTimer = 0;
  /** T087: the map card's 3D, opened from the event's camera ("מבט מהמצלמה"). Read-only: no actions from the event page. */
  @state() private view3d = false;
  private default3d = false;
  @state() private threeState: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  @state() private catalog3d: Catalog3DLookup | null = null;
  @state() private selected3d: string | null = null;
  /** The "from camera" preset, one object per toggle: the element re-applies a preset only when the property changes. */
  @state() private eventPreset: ScenePreset = 'iso';
  private itemNames = new Map<string, string>();
  /** `refs`: what the scene getter reads, by identity (a hit skips the anchor list and its JSON key); `keys`: the signature. */
  private sceneMemo: { refs: unknown[]; keys: unknown[]; desc: SceneDescription; labels: Record<string, string> } | null = null;

  static styles = [css`
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
      background: var(--sw-video-bg);
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
      color: var(--sw-on-video-2);
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
      background: var(--sw-video-scrim-strong);
      color: var(--sw-on-video);
      border-radius: var(--sw-r-sm);
      padding: 4px 10px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .caption {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      color: var(--sw-on-video);
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
    .map sw-plan-3d {
      min-block-size: 0;
    }
    .tools3d {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      z-index: var(--sw-z-map-ui);
      display: flex;
      gap: 6px;
    }
    .load3d {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-surface);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
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
      border-radius: var(--sw-r-sm);
      padding: 3px 8px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .corr {
      display: flex;
      flex-direction: column;
    }
    .corr .link {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .corr .link:last-child {
      border-block-end: 0;
    }
    .corr small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .corr .num {
      font-variant-numeric: tabular-nums;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
    }
    .corrnotes {
      margin: 8px 0 0;
      padding-inline-start: 18px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    /* M064: a tick per suggested camera and the one-click confirmation row of the route card */
    .corr .link.route {
      grid-template-columns: auto minmax(0, 1fr) auto;
    }
    .corr .link.route .rel {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .corr .link.route input[type='checkbox'] {
      margin: 0;
      accent-color: var(--sw-accent);
    }
    .routeconfirm {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-block-start: 10px;
      padding-block-start: 10px;
      border-block-start: 1px solid var(--sw-border);
    }
    .routeconfirm select {
      font: inherit;
      font-size: var(--sw-fs-sm);
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      max-inline-size: 220px;
    }
    .routeconfirm .ok {
      color: var(--sw-success);
      font-size: var(--sw-fs-sm);
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
  `, bubbleChrome];

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
    // the setting map.default_view (owner 2026-09-29): a floor opens in 3D once its scene is there (no per-device memory
    // of the last view existed before, and none is added: the toggle still switches for the visit)
    if (this.default3d && !this.view3d && this.hasScene && webglAvailable()) {
      this.default3d = false;
      void this.toggle3d();
    }
  }

  private async load() {
    if (!isApi()) return;
    this.error = '';
    await this.stopPlayer();
    try {
      const ev = await getEvent(this.eventId);
      this.ev = ev;
      this.view3d = false; // another event: its map card opens in 2D, the 3D then starts from its own camera
      this.tz = ev.timezone || this.tz;
      if (ev.location?.has_plan) void this.loadMap(ev.location.floor_id);
      else this.bundle = null;
      void this.loadNearby(ev);
      void this.loadCorrelation(ev.id);
      void this.loadRoute(ev.id);
      if (ev.camera_id) void this.play(ev);
      if (ev.thumbnail === 'pending') this.pollThumb(ev.id);
    } catch (err) {
      this.error = describeError(err);
      this.ev = null;
    }
  }

  private async loadRoute(id: string) {
    this.route = null;
    this.routeTicked = null;
    this.routeDone = null;
    this.routeError = '';
    try {
      this.route = await getEventRoute(id);
      if (this.route.suggestions.length && this.routeCases === null) {
        listCases({ status: 'open' }).then((r) => { this.routeCases = r.can_manage ? r.cases : []; if (!r.can_manage) this.routeCases = null; }).catch(() => (this.routeCases = []));
      }
    } catch {
      this.route = null;
    }
  }

  /** The suggested cameras the confirmation takes: every suggestion until the operator unticks some. */
  private routePicks(): string[] {
    const all = (this.route?.suggestions ?? []).map((s) => s.camera_id);
    return this.routeTicked ? all.filter((id) => this.routeTicked!.has(id)) : all;
  }

  private tickRoute(id: string, on: boolean) {
    const next = new Set(this.routeTicked ?? this.routePicks());
    if (on) next.add(id);
    else next.delete(id);
    this.routeTicked = next;
  }

  /** One click (M064): the event and a clip per ticked camera into the chosen case (or a new one). */
  private async confirmRoute() {
    const r = this.route;
    const picks = this.routePicks();
    if (!r || !picks.length || this.routeBusy) return;
    this.routeBusy = true;
    this.routeError = '';
    try {
      this.routeDone = await confirmEventRoute(r.event_id, { camera_ids: picks, case_id: this.routeCase || undefined });
      if (this.routeDone.created) this.routeCases = [...(this.routeCases ?? []), { id: this.routeDone.case_id, title: this.routeDone.title } as Case];
      this.routeCase = this.routeDone.case_id;
    } catch (err) {
      this.routeError = describeError(err);
    } finally {
      this.routeBusy = false;
    }
  }

  private renderRoute() {
    const r = this.route;
    if (!r || !r.spatial) return nothing;
    const picks = new Set(this.routePicks());
    const kind = (rel: string): StateKind => (rel === 'same_zone' ? 'recorded' : rel === 'adjacent_zone' ? 'partial' : rel === 'via_connector' ? 'stale' : 'neutral');
    return html`<sw-card heading="המשך מסלול מוצע" subheading="השערה לפי טופולוגיית המפה · ±${Math.round((new Date(r.window.to).getTime() - new Date(r.window.from).getTime()) / 1000)} שניות" style="margin-block-start:12px" data-route>
      ${r.suggestions.length
        ? html`<div class="corr" data-route-list>${r.suggestions.map((s) => html`<div class="link route" data-route-item data-relation=${s.relation} data-camera=${s.camera_id}>
              <span class="rel"><input type="checkbox" aria-label=${`כלול את ${s.name} במסלול`} data-route-tick=${s.camera_id} .checked=${picks.has(s.camera_id)} @change=${(e: Event) => this.tickRoute(s.camera_id, (e.target as HTMLInputElement).checked)} />${s.via ? html`<sw-icon name=${s.via.kind === 'elevator' ? 'elevator' : 'stairs'} size=${14}></sw-icon>` : nothing}<sw-badge kind=${kind(s.relation)} label=${s.relation_label}></sw-badge></span>
              <span>${s.name}${s.zone ? html` · ${s.zone}` : nothing}${s.via ? html` · ${s.via.floor_name}` : nothing}<small>${s.activity_events ? `${s.activity_events} אירועים בחלון` : 'ללא אירועים בחלון'} · מרחק ${Math.round(s.distance * 100)} יח׳ תוכנית${s.via?.label ? ` · ${s.via.label}` : ''}</small></span>
              <sw-button size="sm" icon="play" @click=${() => navigate('/investigate/playback', { camera: s.camera_id, t: s.playback_at })}>נגן</sw-button>
            </div>`)}</div>
          ${this.routeCases !== null
            ? html`<div class="routeconfirm" data-route-confirm>
                <select aria-label="תיק" data-route-case .value=${this.routeCase} @change=${(e: Event) => (this.routeCase = (e.target as HTMLSelectElement).value)}>
                  <option value="" ?selected=${!this.routeCase}>תיק חדש</option>
                  ${(this.routeCases ?? []).map((c) => html`<option value=${c.id} ?selected=${c.id === this.routeCase}>${c.title}</option>`)}
                </select>
                <sw-button variant="primary" size="sm" icon="case" ?disabled=${!picks.size || this.routeBusy} data-route-confirm-button @click=${() => this.confirmRoute()}>${this.routeBusy ? 'מוסיף…' : `אשר מסלול לתיק (${picks.size})`}</sw-button>
                ${this.routeDone ? html`<span class="ok" data-route-done>נוסף לתיק „${this.routeDone.title}”${this.routeDone.skipped.length ? ` · ${this.routeDone.skipped.length} דולגו` : ''} · <a href=${`#/investigate/cases/${this.routeDone.case_id}`}>פתח</a></span>` : nothing}
                ${this.routeError ? html`<span class="err" role="alert" data-route-error>${this.routeError}</span>` : nothing}
              </div>`
            : nothing}`
        : html`<div class="note" style="margin:0">אין מצלמות נוספות בסביבה על התוכנית.</div>`}
      ${r.notes.length ? html`<ul class="corrnotes">${r.notes.map((n) => html`<li>${n}</li>`)}</ul>` : nothing}
      <div class="note">${r.policy}</div>
    </sw-card>`;
  }

  private async loadCorrelation(id: string) {
    this.corr = null;
    this.corrError = '';
    try {
      this.corr = await getCorrelation(id);
    } catch (err) {
      this.corrError = describeError(err);
    }
  }

  private async loadMap(floorId: string) {
    try {
      const b = await loadMap(floorId);
      this.bundle = b;
      this.restorePlanImage(floorId);
      void productSettings()
        .then((s) => {
          if (this.bundle === b) this.level = initialLevel(s['plan.levels'], b); // 0.1.89: fixed for the floor, no level bar here
          if (this.bundle === b) this.default3d = s['map.default_view'] === '3d' && !this.view3d;
        })
        .catch(() => {}); // settings unavailable: keep every level shown
      if (b.source === 'api') {
        void loadLibrary(b.catalogRevision).then((lib) => {
          this.catalogLookup = lookupOf(lib);
          this.catalog3d = lookup3dOf(lib);
          this.itemNames = new Map(lib.items.map((i) => [i.id, i.names.he]));
        }).catch(() => {}); // without the library objects draw as plain boxes
      }
      this.geometry = null; // the map renders without its structure until the document arrives
      const g = await geometryFor(b);
      if (this.bundle === b) this.geometry = g; // a later event (another floor) may have replaced the bundle meanwhile
    } catch {
      this.bundle = null;
      this.geometry = null;
    }
  }

  /** The plan picture switch, per floor in this browser (its own key: the live map, the editor and the historical
   * map keep theirs). */
  private setPlanImage(on: boolean) {
    this.planImage = on;
    const floorId = this.bundle?.floorId;
    if (!floorId) return;
    try {
      localStorage.setItem(`sw.event.background.${floorId}`, on ? '1' : '0');
    } catch {
      /* private mode or blocked storage: the choice lives for this page only */
    }
  }

  /** A floor never switched shows its picture. */
  private restorePlanImage(floorId: string) {
    try {
      this.planImage = localStorage.getItem(`sw.event.background.${floorId}`) !== '0';
    } catch {
      this.planImage = true;
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

  private renderCorrelation() {
    const c = this.corr;
    const sub = c ? `±${c.window_s} שניות · ${c.spatial ? `סביבת ${c.location?.zone ?? 'המיקום על התוכנית'} (${c.location?.floor_name ?? ''})` : 'לפי זמן בלבד'}` : this.corrError ? 'לא נטען' : 'טוען…';
    return html`<sw-card heading="קורלציה דלת–מצלמה–חיישן" subheading=${sub} style="margin-block-start:12px" data-correlation>
      ${c
        ? html`${c.entities.length
              ? html`<div class="note" style="margin:0 0 6px" data-correlation-entities>בסביבה: ${c.entities.map((e) => `${e.name}${e.state_missing ? ' (ללא מצב)' : e.state ? ` · ${e.state}` : ''}`).join(' · ')}</div>`
              : html`<div class="note" style="margin:0 0 6px" data-correlation-entities>אין חיישנים או מנעולים מוצבים בסביבה.</div>`}
            ${c.links.length
              ? html`<div class="corr" data-correlation-links>${c.links.map((l) => html`<div class="link" data-correlation-link data-certainty=${l.certainty}>
                    <span class="ltr num">${l.delta_s > 0 ? '+' : ''}${l.delta_s}s</span>
                    <span>${l.kind === 'camera' && l.event_id ? html`<a href=${`#/investigate/events/${l.event_id}`}>${l.label}</a>` : l.kind === 'sensor' && l.event_id ? html`<a href=${`#/investigate/events/${l.event_id}`}>${l.label}</a>` : l.label}<small>${l.note}</small></span>
                    <sw-badge kind=${CERTAINTY_KIND[l.certainty]} label=${CERTAINTY_LABEL[l.certainty]}></sw-badge>
                  </div>`)}</div>`
              : html`<div class="note" style="margin:0">לא נרשם דבר בחלון הזמן מהחיישנים, המנעולים והמצלמות שבסביבה.</div>`}
            ${c.notes.length ? html`<ul class="corrnotes">${c.notes.map((n) => html`<li data-correlation-note=${n.code}>${n.text}</li>`)}</ul>` : nothing}
            <div class="note">${c.policy}</div>`
        : this.corrError
          ? html`<div class="note">${this.corrError}</div>`
          : nothing}
    </sw-card>`;
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
      level: a.level_id ?? null,
      state: a.resource_type === 'camera' ? cameraState(a) : 'neutral',
    }));
  }

  // ---- 3D (T087) ----

  /** Cheap: the event's floor has a published structure (the toggle's gate; the scene is built only while the 3D is on). */
  private get hasScene(): boolean {
    return this.bundle?.source === 'api' && this.geometry !== null;
  }

  /** The scene of the event's floor, built only while the 3D is on and memoised on a signature of what the builder reads.
   * The map card shows the current plan (not the plan at the event time), so it carries no states of the instant: an HA
   * state is drawn only when the bundle has it for the instant (state_at), else as unknown with the doors closed, and the
   * circuits stay off. Never today's live value on an event of the past. Read several times per render: while nothing it
   * reads changed (by identity - the page replaces its bundle, structure and library, never mutates them) it answers the
   * memo without building the anchor list or its key (0.1.89 list, item 3). */
  private get sceneDescription(): SceneDescription | null {
    const b = this.bundle;
    const g = this.geometry;
    if (!this.view3d || !b || b.source !== 'api' || !g) return null;
    const refs: unknown[] = [b, g, this.catalog3d, this.level, this.itemNames];
    if (this.sceneMemo && sameRefs(this.sceneMemo.refs, refs)) return this.sceneMemo.desc;
    const stateAt = (a: MapBundle['anchors'][number]) => (a.entity?.state_at?.known ? a.entity.state_at.state : null);
    const anchors: SceneAnchor[] = b.anchors.map((a) => ({
      id: a.id, resource_type: a.resource_type, resource_id: a.resource_id, x: a.position.x, y: a.position.y, rotation: a.rotation_degrees, fov: a.field_of_view_degrees ?? null, radius: a.coverage_radius ?? null,
      polygon: a.coverage_polygon ?? null, level_id: a.level_id ?? null, layer_id: a.layer_id, label: entityName(a), state: stateAt(a),
      online: a.resource_type === 'camera' ? (a.camera ? a.camera.status === 'online' : null) : null, mount_height_m: a.mount_height_m ?? null, tilt_deg: a.tilt_deg ?? null,
    }));
    const entityStates = Object.fromEntries(b.anchors.filter((a) => a.resource_type === 'ha_entity').map((a) => [a.resource_id, stateAt(a)]));
    const zones = b.zones.map((z) => ({ id: z.id, name: z.name, polygon: z.polygon, level_id: z.level_id ?? null }));
    const keys: unknown[] = [JSON.stringify([b.floorId, b.width, b.height, anchors, entityStates, zones]), g, this.catalog3d, this.level, this.itemNames];
    if (this.sceneMemo && sameRefs(this.sceneMemo.keys, keys)) {
      this.sceneMemo = { ...this.sceneMemo, refs };
      return this.sceneMemo.desc;
    }
    const desc = buildScene({ doc: g, width: b.width, height: b.height, anchors, entityStates, circuitStates: {}, catalog: this.catalog3d, zones, level: this.level, anchorsEveryLevel: true });
    const labels: Record<string, string> = {};
    for (const a of b.anchors) labels[a.id] = entityName(a);
    for (const o of g.objects) labels[o.id] = o.label || this.itemNames.get(o.item_id) || o.item_id;
    for (const z of b.zones) labels[z.id] = z.name;
    this.sceneMemo = { refs, keys, desc, labels };
    return desc;
  }

  /** A click in the 3D only selects (no actions from the event page), by the shared rule (part-select.boundItemOf): a
   * camera or an entity, or the entity an object or a door is bound to, becomes the selection; the floor (an empty click)
   * clears it; any other part (a room, a wall, a connector, an unbound object) leaves it unchanged. */
  private onPartSelect(e: CustomEvent<PartSelectDetail>) {
    const { id, kind } = e.detail;
    if (!id) {
      this.selected3d = null;
      return;
    }
    const t = kind ? boundItemOf({ id, kind }, this.geometry, this.bundle?.anchors ?? []) : null;
    if (t && 'anchor' in t) this.selected3d = t.anchor;
  }

  /** The 3D is on screen. The 2D canvas stays mounted underneath (hidden), so its pan and zoom survive a round trip. */
  private get shows3d(): boolean {
    return this.view3d && this.threeState === 'ready' && this.sceneDescription !== null;
  }

  private async toggle3d(): Promise<void> {
    if (this.view3d) {
      this.view3d = false;
      return;
    }
    if (!webglAvailable() || !this.hasScene || this.threeState === 'loading') return;
    if (this.threeState !== 'ready') {
      this.threeState = 'loading';
      try {
        await import('../map/sw-plan-3d');
        this.threeState = 'ready';
      } catch {
        this.threeState = 'error';
        return;
      }
    }
    const anchorId = this.ev?.location?.anchor_id ?? null;
    this.selected3d = anchorId;
    this.eventPreset = anchorId ? { camera: `cam:${anchorId}` } : 'iso';
    this.view3d = true;
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
                ? html`<div class="map" style=${this.view3d ? 'block-size:320px' : ''}>
                    <div class="floorchip"><sw-icon name="building" size=${12}></sw-icon>${loc.floor_name}</div>
                    <div class="tools3d">
                      ${this.bundle.imageUrl
                        ? html`<sw-button size="sm" icon="map" aria-pressed=${this.planImage} data-plan-background title=${this.planImage ? 'הסתר את תמונת התוכנית' : 'הצג את תמונת התוכנית'} @click=${() => this.setPlanImage(!this.planImage)}>תמונת התוכנית</sw-button>`
                        : nothing}
                      <sw-button size="sm" icon="cube" aria-pressed=${this.view3d} data-event-3d-toggle ?disabled=${!this.view3d && (!webglAvailable() || !this.hasScene || this.threeState === 'loading')}
                        title=${!webglAvailable() ? WEBGL_UNAVAILABLE_HE : !this.hasScene ? 'אין מבנה מפורסם לקומה הזו' : 'מבט מהמצלמה בתלת-ממד'} @click=${() => this.toggle3d()}>${this.view3d ? '2D' : '3D'}</sw-button>
                    </div>
                    ${this.shows3d && this.sceneDescription
                      ? html`<sw-plan-3d data-event-3d .description=${this.sceneDescription} .selectedId=${this.selected3d} .preset=${this.eventPreset} .frameKey=${ev.id} .labels=${this.sceneMemo?.labels ?? {}}
                          .cameras=${this.bundle.anchors.filter((a) => a.resource_type === 'camera').map((a) => ({ id: a.id, label: entityName(a) }))} exportName=${`plan-3d-${loc.floor_name}-${ev.id}`}
                          @part-select=${(e: CustomEvent<PartSelectDetail>) => this.onPartSelect(e)}></sw-plan-3d>`
                      : nothing}
                    <sw-plan-canvas style=${this.shows3d ? 'display:none' : ''} .planWidth=${this.bundle.width} .planHeight=${this.bundle.height} .imageUrl=${this.bundle.imageUrl} .hideImage=${!this.planImage} .plan=${this.bundle.planSvg} .markers=${this.markers} .selectedId=${loc.anchor_id} .zones=${zonesWithChips(this.bundle.zones)} .geometry=${this.geometry} .structureLevel=${this.level} .catalog=${this.catalogLookup} .anchorPositions=${Object.fromEntries(this.bundle.anchors.map((a) => [`${a.resource_type}:${a.resource_id}`, { x: a.position.x, y: a.position.y, rotation: a.rotation_degrees } as AnchorPosition]))} alwaysLabel dimEntities></sw-plan-canvas>
                    ${this.threeState === 'loading' ? html`<div class="load3d" data-3d-loading>טוען תלת-ממד…</div>` : nothing}
                  </div>
                  ${webglAvailable() ? nothing : html`<div class="note" data-event-3d-unavailable>${WEBGL_UNAVAILABLE_HE}</div>`}
                  ${this.threeState === 'error' ? html`<div class="note err" data-3d-load-error>תלת-ממד לא נטען.</div>` : nothing}
                  ${this.view3d ? html`<div class="note" data-event-3d-note>מבנה התוכנית הנוכחית; מצבי הישויות בזמן האירוע אינם ידועים כאן ומוצגים כלא ידועים.</div>` : nothing}
                  <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
                    <sw-button size="sm" icon="map" data-history-map @click=${() => navigate(`/investigate/floors/${loc.floor_id}`, { t: ev.occurred_at, camera: ev.camera_id ?? '' })}>המשך חקירה במפה</sw-button>
                    <sw-button size="sm" variant="ghost" icon="live" @click=${() => navigate(`/explore/floors/${loc.floor_id}`)}>מפה חיה</sw-button>
                  </div>`
                : loc
                  ? html`<div class="note">לקומה ${loc.floor_name} אין תוכנית מפורסמת עדיין.</div>`
                  : nothing}
              <div class="note">מיקום סמוך הוא הקשר, לא הוכחת קשר סיבתי; סימון "טופל" נרשם באודיט בשם המשתמש.</div>
            </sw-card>
            ${this.renderCorrelation()}
            ${this.renderRoute()}
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
