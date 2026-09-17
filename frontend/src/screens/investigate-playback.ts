import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-dialog';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-scene';
import '../components/sw-timeline';
import '../components/sw-live-player';
import '../components/sw-state-panel';
import '../components/sw-case-picker';
import { clipAround, type NewCaseItem } from '../api/cases';
import { minuteLabel, secondLabel } from '../components/sw-timeline';
import type { SwLivePlayer } from '../components/sw-live-player';
import type { DemoSegment } from '../fixtures/catalog';
import { demoEvents, demoScene, demoSegments, demoWall } from '../fixtures/catalog';
import { isApi } from '../api/session';
import { listCameras } from '../api/maps';
import { productSettings } from '../api/prefs';
import { navigate } from '../router';
import { describeError, ApiError } from '../api/client';
import { closeGroup, closePlayback, createGroup, createPlayback, dateInZone, frameUrl, instantInZone, minuteInZone, playbackWsUrl, recordingsForDay, seekGroup, seekPlayback, type PlaybackGroup, type PlaybackSession, type RecordingsResponse } from '../api/recordings';
import { reportGroupSync, type SyncStats } from '../api/recordings';
import { createExport, estimateExport, formatBytes, type ExportEstimate, type ExportJob } from '../api/exports';
import { cameraEvents, markerKind, EVENT_LABEL, type VmsEvent } from '../api/events';
import type { TimelineEvent } from '../components/sw-timeline';
import type { Camera } from '../api/types';

type Filter = 'all' | 'motion' | 'person' | 'vehicle' | 'door';
const FINISHED = ['closed', 'expired', 'failed'];

function hms(minute: number): string {
  return secondLabel(Math.max(0, Math.min(1439.983, minute)));
}
function parseHms(v: string): number {
  const [h = 0, m = 0, s = 0] = v.split(':').map(Number);
  return h * 60 + m + s / 60;
}

/**
 * SC12 — playback & timeline (board 1 screen 7). With a backend: the NVR's recordings for a local day
 * (search with honest coverage), a playback session through the relay (seek = new generation) or a
 * playback group of up to four cameras (chapter 25, best effort), the blue timeline with day→minute zoom
 * whose bubble follows the media clock, and export of a range as a durable job (chapter 27).
 * Time precision is labelled from the session; a gap is shown as a gap, never replaced by live.
 * Without a backend: the demo skeleton.
 */
/** 95th percentile of |values| (T042): the number the sync quality is judged by, never the mean. */
function p95Abs(values: number[]): number {
  const s = values.map((v) => Math.abs(v)).sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(0.95 * s.length) - 1))];
}

@customElement('investigate-playback')
export class InvestigatePlayback extends LitElement {
  /** Route params (#/investigate/playback?camera=<id>&t=<utc iso>) */
  @property() cameraId = '';
  @property() at = '';
  /** Comma-separated extra camera ids for a synchronized group (from the floor map, T043). */
  @property() extraParam = '';

  // demo
  @state() private demoCamera = 'cam-10';
  @state() private cursor = 615;
  @state() private generation = 3;
  @state() private playing = true;
  @state() private speed = 1;
  @state() private filter: Filter = 'all';

  // api
  @state() private cams: Camera[] | null = null;
  @state() private tz = 'Asia/Jerusalem';
  @state() private date = '';
  @state() private rec: RecordingsResponse | null = null;
  @state() private dayEvents: VmsEvent[] = [];
  @state() private loadingRec = false;
  @state() private session: PlaybackSession | null = null;
  @state() private group: PlaybackGroup | null = null;
  @state() private extra: string[] = [];
  @state() private casePick: NewCaseItem | null = null;
  /** Hover preview over the timeline (T044): a frame from the recording at the hovered instant. */
  @state() private preview: { minute: number; x: number; width: number; url: string; failed: boolean } | null = null;
  private previewTimer = 0;
  @state() private busy = false;
  @state() private error = '';
  @state() private notice = '';
  @state() private tileStatus: Record<string, string> = {};
  @state() private drifts: Record<string, number> = {};
  /** T042: the group's master clock — set once the barrier passes, then driven by the wall clock, never by a tile. */
  @state() private clock: { baseMs: number; startedAt: number } | null = null;
  @state() private barrier: 'none' | 'waiting' | 'passed' = 'none';
  @state() private syncStats: SyncStats | null = null;
  private clockPausedAt = 0;
  private driftSamples: Record<string, number[]> = {};
  private lateSince: Record<string, number> = {};
  private resyncAt: Record<string, number> = {};
  private resyncs: Record<string, number> = {};
  private nudges: Record<string, number> = {};
  private groupStartedAt = 0;
  private lastReport = 0;
  /** Per tile: when the last seek was sent and when it first rendered, so a re-seek can aim ahead by the measured start-up latency. */
  private seekSentAt: Record<string, number> = {};
  private firstPlayAt: Record<string, number> = {};
  private startLatency: Record<string, number> = {};
  @state() private paused = false;
  @state() private scrubbing = false;
  @state() private position: Date | null = null; // media clock → source time
  @state() private exportOpen = false;
  @state() private exportFrom = '';
  @state() private exportTo = '';
  @state() private estimate: ExportEstimate | null = null;
  @state() private exportJob: ExportJob | null = null;
  @state() private exportBusy = false;
  @state() private exportError = '';
  private ticker: number | undefined;

  static styles = css`
    .pick {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .pick sw-field {
      inline-size: 150px;
    }
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      color: #fff;
      background: #0f1729;
      box-shadow: var(--sw-shadow-2);
      max-block-size: 62vh;
      margin-inline: auto;
      inline-size: 100%;
    }
    .video sw-scene,
    .video sw-live-player {
      position: absolute;
      inset: 0;
    }
    .video.gap {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      box-shadow: none;
      border: 1px solid var(--sw-border);
    }
    .grid {
      display: grid;
      gap: 6px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      background: #0f1729;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      box-shadow: var(--sw-shadow-2);
      padding: 6px;
    }
    .grid.one {
      grid-template-columns: 1fr;
    }
    .tile {
      position: relative;
      aspect-ratio: 16 / 9;
      background: #111a2e;
      border-radius: 6px;
      overflow: hidden;
      color: #fff;
    }
    .tile sw-live-player {
      position: absolute;
      inset: 0;
    }
    .tile.master {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .tile .name {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 6px;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      z-index: 2;
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .tile .drift {
      font-family: var(--sw-font-mono);
      font-weight: 400;
      direction: ltr;
      background: rgba(17, 24, 39, 0.55);
      border-radius: 4px;
      padding: 0 5px;
    }
    .tile .drift.bad {
      background: rgba(239, 68, 68, 0.7);
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.12) 0%, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 60%, rgba(0, 0, 0, 0.5) 100%);
      pointer-events: none;
    }
    .tag {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 10px;
      display: flex;
      gap: 6px;
      align-items: center;
      z-index: 2;
    }
    .tag .nm {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.55);
    }
    .video.gap .tag .nm {
      text-shadow: none;
    }
    .demo {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 10px;
      font-size: 10px;
      background: rgba(17, 24, 39, 0.55);
      color: #fff;
      border-radius: 4px;
      padding: 2px 7px;
    }
    .stamp {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 58px;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      z-index: 2;
    }
    .video.gap .stamp {
      text-shadow: none;
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      font-size: var(--sw-fs-sm);
      z-index: 1;
    }
    .center > div {
      display: grid;
      justify-items: center;
      gap: 6px;
      max-inline-size: 420px;
    }
    .tile .center {
      font-size: var(--sw-fs-xs);
      color: rgba(255, 255, 255, 0.75);
    }
    .bar {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 10px;
      display: flex;
      justify-content: center;
      pointer-events: none;
      z-index: 3;
    }
    .bar .inner {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 4px 8px;
      border-radius: var(--sw-r-pill);
      background: rgba(17, 24, 39, 0.72);
      backdrop-filter: blur(8px);
      color: #fff;
      box-shadow: var(--sw-shadow-2);
    }
    .bar sw-button {
      --sw-text-2: #fff;
      --sw-text: #fff;
      --sw-surface-3: rgba(255, 255, 255, 0.14);
    }
    .bar .q {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: var(--sw-r-pill);
      padding: 3px 9px;
      margin-inline: 2px;
      background: transparent;
      color: #fff;
      font-family: inherit;
      cursor: pointer;
    }
    .bar .q.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
    }
    .bar .sep {
      inline-size: 1px;
      block-size: 18px;
      background: rgba(255, 255, 255, 0.25);
      margin-inline: 4px;
    }
    .stage {
      position: relative;
    }
    .stage .bar {
      inset-block-end: 12px;
    }
    .stage .stamp {
      inset-block-end: 60px;
      inset-inline-start: 14px;
    }
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filters .grow {
      flex: 1;
    }
    .session {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .warn {
      font-size: var(--sw-fs-xs);
      color: #b45309;
    }
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .tlwrap {
      position: relative;
    }
    .tlpreview {
      position: absolute;
      inset-block-end: calc(100% + 6px);
      transform: translateX(-50%);
      inline-size: 200px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 4px;
      pointer-events: none;
      z-index: var(--sw-z-map-ui);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      text-align: center;
      direction: ltr;
    }
    .tlpreview img {
      display: block;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
    }
    .tlpreview .none {
      display: grid;
      place-items: center;
      aspect-ratio: 16 / 9;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-sm);
      direction: rtl;
    }
    .compare {
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .dlg {
      display: grid;
      gap: 10px;
      font-size: var(--sw-fs-sm);
      min-inline-size: min(420px, 80vw);
    }
    .dlg .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .est {
      background: var(--sw-surface-2);
      border-radius: var(--sw-r-md);
      padding: 8px 10px;
      font-size: var(--sw-fs-xs);
      display: grid;
      gap: 4px;
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (isApi()) {
      void this.init();
      this.ticker = window.setInterval(() => this.tick(), 500);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.ticker);
    void this.endSession();
  }

  protected updated(changed: Map<string, unknown>) {
    if (isApi() && changed.has('cameraId') && changed.get('cameraId') !== undefined && this.cams) {
      void this.selectCamera(this.cameraId, true);
    }
  }

  // ---------- API mode: data ----------

  private get members(): string[] {
    return [this.cameraId, ...this.extra.filter((c) => c !== this.cameraId)];
  }

  private get groupMode(): boolean {
    return this.extra.filter((c) => c !== this.cameraId).length > 0;
  }

  /** The session whose media clock drives the timeline. */
  private get masterSession(): PlaybackSession | null {
    if (this.groupMode) return this.group?.sessions.find((s) => s.camera_id === this.cameraId) ?? this.group?.sessions[0] ?? null;
    return this.session;
  }

  private get live(): boolean {
    const s = this.masterSession;
    return !!s && !FINISHED.includes(s.state) && (this.groupMode ? !!this.group : true);
  }

  private async init() {
    try {
      const [settings, list] = await Promise.all([productSettings(), listCameras()]);
      this.tz = settings['time.zone'] ?? 'Asia/Jerusalem';
      this.cams = list.cameras.filter((c) => c.enabled);
      const first = this.cams.find((c) => c.id === this.cameraId) ?? this.cams[0];
      const at = this.at ? new Date(this.at) : null;
      const validAt = !!at && !Number.isNaN(at.getTime());
      this.date = dateInZone(validAt ? at! : new Date(), this.tz);
      if (first) {
        this.cameraId = first.id;
        if (this.extraParam) this.extra = this.extraParam.split(',').filter((id) => id && id !== first.id && this.cams!.some((c) => c.id === id)).slice(0, 3);
        await this.loadRecordings();
        if (validAt) {
          this.cursor = minuteInZone(at!, this.tz);
          await this.startAt(at!);
        } else {
          const last = this.rec?.segments.at(-1);
          this.cursor = last ? Math.max(0, minuteInZone(new Date(last.end_at), this.tz) - 5) : Math.max(0, minuteInZone(new Date(), this.tz) - 5);
        }
      }
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private onTlHover = (e: CustomEvent<{ minute: number; x: number; width: number }>) => {
    if (!this.cameraId || !isApi()) return;
    window.clearTimeout(this.previewTimer);
    const d = e.detail;
    this.previewTimer = window.setTimeout(() => {
      const at = instantInZone(this.date, d.minute, this.tz).toISOString().replace(/\.\d{3}Z$/, 'Z');
      this.preview = { minute: d.minute, x: d.x, width: d.width, url: frameUrl(this.cameraId, at), failed: false };
    }, 250);
  };

  private onTlHoverEnd = () => {
    window.clearTimeout(this.previewTimer);
    this.preview = null;
  };

  private async selectCamera(id: string, fromRoute = false) {
    if (!id || (!fromRoute && id === this.cameraId)) return;
    await this.endSession();
    this.cameraId = id;
    this.extra = this.extra.filter((c) => c !== id);
    this.error = '';
    this.notice = '';
    await this.loadRecordings();
  }

  private async setDate(date: string) {
    if (!date || date === this.date) return;
    await this.endSession();
    this.date = date;
    await this.loadRecordings();
    const last = this.rec?.segments.at(-1);
    this.cursor = last ? Math.max(0, minuteInZone(new Date(last.end_at), this.tz) - 5) : 540;
  }

  private async loadRecordings() {
    if (!this.cameraId || !this.date) return;
    this.loadingRec = true;
    this.rec = null;
    try {
      const [rec, ev] = await Promise.all([recordingsForDay(this.cameraId, this.date), cameraEvents(this.cameraId, this.date).catch(() => ({ events: [] as VmsEvent[] }))]);
      this.rec = rec;
      this.dayEvents = ev.events;
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.loadingRec = false;
    }
  }

  /** Event markers for the timeline (measured alerts and recording-derived, inferred ones). */
  private get markers(): TimelineEvent[] {
    return this.dayEvents.map((e) => ({
      minute: minuteInZone(new Date(e.occurred_at), this.tz),
      kind: markerKind(e.type),
      label: `${EVENT_LABEL[e.type] ?? e.type}${e.confidence === 'inferred' ? ' (מהקלטה)' : ''}${e.count > 1 ? ` ×${e.count}` : ''}`,
    }));
  }

  private get segmentsMin(): DemoSegment[] {
    if (!this.rec) return [];
    return this.rec.segments.map((s) => {
      const a = minuteInZone(new Date(s.start_at), this.tz);
      let b = minuteInZone(new Date(s.end_at), this.tz);
      if (b < a) b = 1440; // ends at local midnight
      return { startMin: a, endMin: b, kind: s.kind === 'continuous' ? 'continuous' : 'motion' };
    });
  }

  private inRecording(minute: number): boolean {
    return this.segmentsMin.some((s) => minute >= s.startMin && minute <= s.endMin);
  }

  private get limitMinute(): number {
    return this.date === dateInZone(new Date(), this.tz) ? minuteInZone(new Date(), this.tz) : 1440;
  }

  private cameraName(id: string): string {
    return this.cams?.find((c) => c.id === id)?.name ?? id;
  }

  // ---------- API mode: sessions ----------

  /** Create the session/group at an instant, or seek the existing one (new generation). */
  private async startAt(at: Date) {
    if (!this.cameraId || this.busy) return;
    this.busy = true;
    this.error = '';
    this.notice = '';
    this.scrubbing = false;
    try {
      const iso = at.toISOString().replace(/\.\d{3}Z$/, 'Z');
      if (this.groupMode) {
        const sent = performance.now();
        const g = this.group && this.group.sessions.some((s) => !FINISHED.includes(s.state)) ? await seekGroup(this.group.id, iso) : await createGroup(this.members, iso);
        this.group = g;
        for (const s of g.sessions) {
          this.seekSentAt[s.camera_id] = sent;
          delete this.firstPlayAt[s.camera_id];
        }
        this.session = null;
        this.position = new Date(g.requested_at);
        const missing = Object.keys(g.missing);
        if (missing.length) this.notice = `ללא הקלטה בזמן הזה: ${missing.map((id) => this.cameraName(id)).join(', ')}`;
      } else {
        const session = this.session && !FINISHED.includes(this.session.state) ? await seekPlayback(this.session.id, iso) : await createPlayback(this.cameraId, iso);
        this.session = session;
        this.group = null;
        this.position = new Date(session.requested_at);
        if (session.moved_to_next_segment) this.notice = `אין הקלטה בזמן שנבחר; הניגון התחיל בקטע הבא (${this.fmt(new Date(session.requested_at))}).`;
      }
      this.cursor = minuteInZone(this.position!, this.tz);
      this.paused = false;
      this.tileStatus = {};
      this.drifts = {};
      this.resetClock();
      if (!this.isConnected) {
        // the screen went away while the session was being created (route change): release it, never leak it
        await this.endSession();
        return;
      }
    } catch (err) {
      if (err instanceof ApiError && err.body.code === 'no_recording') {
        this.notice = 'אין הקלטה בזמן הזה ובשש השעות שאחריו: פער בכיסוי, לא מדלגים ל־Live.';
        this.position = at;
      } else if (err instanceof ApiError && (err.body.code === 'session_over' || err.body.code === 'not_found')) {
        this.session = null;
        this.group = null;
        this.busy = false;
        await this.startAt(at);
        return;
      } else {
        this.error = describeError(err);
      }
    } finally {
      this.busy = false;
    }
  }

  private async endSession() {
    const s = this.session;
    const g = this.group;
    this.session = null;
    this.group = null;
    this.tileStatus = {};
    this.drifts = {};
    this.resetClock();
    try {
      if (g) await closeGroup(g.id);
      else if (s && !FINISHED.includes(s.state)) await closePlayback(s.id);
    } catch {
      /* the janitor expires it */
    }
  }

  private async toggleExtra(id: string) {
    const next = this.extra.includes(id) ? this.extra.filter((c) => c !== id) : [...this.extra, id].slice(-3);
    const cur = this.currentInstant();
    await this.endSession();
    this.extra = next;
    if (cur) await this.startAt(cur);
  }

  private players(): SwLivePlayer[] {
    return Array.from(this.renderRoot.querySelectorAll('sw-live-player')) as SwLivePlayer[];
  }

  private masterPlayer(): SwLivePlayer | undefined {
    return this.players().find((p) => p.dataset.camera === this.cameraId) ?? this.players()[0];
  }

  private currentInstant(): Date | null {
    const s = this.masterSession;
    if (!s) return this.position;
    if (this.groupMode && this.clock) return new Date(this.clockNow());
    const base = new Date(s.requested_at).getTime();
    return new Date(base + (this.masterPlayer()?.mediaTime ?? 0) * 1000);
  }

  private tick() {
    const s = this.masterSession;
    if (!s || this.paused || this.scrubbing) return;
    if (this.groupMode && this.group) {
      this.tickGroup();
      return;
    }
    const master = this.masterPlayer();
    if (!master || master.status !== 'playing') return;
    const now = this.currentInstant();
    if (now) {
      this.position = now;
      this.cursor = minuteInZone(now, this.tz);
      // slow motion consumed the bounded look-ahead and later media was dropped: re-seek to where we are (T066)
      if (master.stale && master.bufferAhead < 0.4 && !this.busy) void this.startAt(now);
    }
  }

  // ---- T042: master clock, barrier, measured drift ----

  private resetClock() {
    this.clock = null;
    this.clockPausedAt = 0;
    this.barrier = this.groupMode ? 'waiting' : 'none';
    this.driftSamples = {};
    this.lateSince = {};
    this.resyncAt = {};
    this.resyncs = {};
    this.nudges = {};
    for (const p of this.players()) p.rate = 1;
    if (this.groupMode) this.speed = 1;
    this.syncStats = null;
    this.groupStartedAt = performance.now();
    this.lastReport = 0;
  }

  private clockNow(): number {
    const c = this.clock!;
    return c.baseMs + ((this.paused && this.clockPausedAt ? this.clockPausedAt : performance.now()) - c.startedAt);
  }

  /** Every tick in group mode: pass the barrier once, then measure each tile's rendered time against the clock. */
  private tickGroup() {
    const g = this.group!;
    const nowMs = performance.now();
    const tiles = this.players()
      .map((p) => {
        const cid = p.dataset.camera ?? '';
        const sess = g.sessions.find((x) => x.camera_id === cid);
        return { cid, p, sess, at: sess ? new Date(sess.requested_at).getTime() + p.mediaTime * 1000 : NaN };
      })
      .filter((t) => t.sess && !FINISHED.includes(t.sess.state));
    const playing = tiles.filter((t) => t.p.status === 'playing');
    if (!this.clock) {
      // barrier: every member with a session renders, or 6 s passed since the (re)start — late members are then reported, not waited for
      const allPlaying = tiles.length > 0 && playing.length === tiles.length;
      const timedOut = nowMs - this.groupStartedAt > 12000 && playing.length > 0;
      if (!allPlaying && !timedOut) {
        this.barrier = 'waiting';
        return;
      }
      const lead = playing.find((t) => t.cid === this.cameraId) ?? playing[0];
      this.clock = { baseMs: lead.at, startedAt: nowMs };
      this.barrier = 'passed';
      this.driftSamples = {};
      this.lateSince = {};
    }
    // consensus clock: the median rendered time of the playing tiles (three or more), else the lead's; the wall clock only carries it between ticks
    let masterMs = this.clockNow();
    if (playing.length >= 3) {
      const sorted = playing.map((t) => t.at).sort((a, b) => a - b);
      masterMs = sorted[Math.floor(sorted.length / 2)];
    } else if (playing.length) {
      masterMs = (playing.find((t) => t.cid === this.cameraId) ?? playing[0]).at;
    }
    this.clock = { baseMs: masterMs, startedAt: nowMs };
    const now = new Date(masterMs);
    this.position = now;
    this.cursor = minuteInZone(now, this.tz);
    const drifts: Record<string, number> = {};
    for (const t of tiles) {
      if (t.p.status !== 'playing') {
        drifts[t.cid] = NaN;
        if (!this.lateSince[t.cid]) this.lateSince[t.cid] = nowMs;
        continue;
      }
      delete this.lateSince[t.cid];
      const d = (t.at - masterMs) / 1000;
      drifts[t.cid] = d;
      const arr = (this.driftSamples[t.cid] ??= []);
      arr.push(d);
      if (arr.length > 40) arr.shift();
      // small drifts are closed by playing the tile a little faster (behind) or slower (ahead); no re-seek, no buffer loss
      if (arr.length >= 2 && Math.abs(d) > 0.25 && Math.abs(d) <= 3) {
        const rate = d < 0 ? (Math.abs(d) > 1 ? 1.15 : 1.05) : Math.abs(d) > 1 ? 0.85 : 0.95;
        if (t.p.rate !== rate) this.nudges[t.cid] = (this.nudges[t.cid] ?? 0) + 1;
        t.p.rate = rate;
      } else if (Math.abs(d) <= 0.25 || Math.abs(d) > 3) {
        t.p.rate = 1;
      }
      // out by more than 3 s for four consecutive samples: re-seek this tile alone (never the lead, at most twice per start, 20 s apart);
      // every re-seek costs a stream start, so beyond that the drift is shown rather than chased. The clock and the other tiles stay put.
      if (t.cid !== this.cameraId && arr.length >= 4 && arr.slice(-4).every((x) => Math.abs(x) > 3) && (this.resyncs[t.cid] ?? 0) < 2 && nowMs - (this.resyncAt[t.cid] ?? 0) > 20000) void this.resyncMember(t.cid, masterMs);
    }
    this.drifts = drifts;
    this.syncStats = this.computeSync(tiles.map((t) => t.cid), nowMs);
    if (nowMs - this.lastReport > 5000 && this.syncStats.samples >= 4) {
      this.lastReport = nowMs;
      void reportGroupSync(g.id, this.syncStats).catch(() => undefined);
    }
  }

  private computeSync(cids: string[], nowMs: number): SyncStats {
    const members: SyncStats['members'] = {};
    let worst: number | null = null;
    let samples = 0;
    for (const cid of cids) {
      const arr = this.driftSamples[cid] ?? [];
      const p95 = arr.length ? p95Abs(arr) : null;
      const late = this.lateSince[cid] ? nowMs - this.lateSince[cid] > 8000 : false;
      members[cid] = { p95, samples: arr.length, last: arr.length ? arr[arr.length - 1] : null, resyncs: this.resyncs[cid] ?? 0, state: late ? 'late' : arr.length ? 'measured' : 'waiting', latency_ms: this.startLatency[cid] ?? null, nudges: this.nudges[cid] ?? 0 };
      samples += arr.length;
      if (p95 !== null) worst = worst === null ? p95 : Math.max(worst, p95);
    }
    const missing = Object.keys(this.group?.missing ?? {});
    const anyLate = Object.values(members).some((m) => m.state === 'late');
    const quality: SyncStats['quality'] = this.barrier !== 'passed' || worst === null ? 'waiting' : worst <= 0.5 ? 'synced' : worst <= 2 ? 'slight' : 'out_of_sync';
    return { p95: worst, quality, samples, partial: missing.length > 0 || anyLate, missing, members };
  }

  /** One tile back to the master clock; never the whole group and never the clock itself. */
  private async resyncMember(cid: string, masterMs: number) {
    const g = this.group;
    const sess = g?.sessions.find((x) => x.camera_id === cid);
    if (!g || !sess || FINISHED.includes(sess.state)) return;
    this.resyncAt[cid] = performance.now();
    this.resyncs[cid] = (this.resyncs[cid] ?? 0) + 1;
    this.driftSamples[cid] = [];
    // aim ahead by this tile's measured start-up latency, so it lands on the clock instead of behind it again
    const ahead = Math.min(this.startLatency[cid] ?? 4000, 15000);
    try {
      const next = await seekPlayback(sess.id, new Date(masterMs + ahead).toISOString().replace(/\.\d{3}Z$/, 'Z'));
      if (this.group === g) this.group = { ...g, sessions: g.sessions.map((x) => (x.id === next.id ? next : x)) };
      // the tile reconnects only now (new generation in its socket URL): measure the start-up latency from here
      this.seekSentAt[cid] = performance.now();
      delete this.firstPlayAt[cid];
    } catch {
      /* the next samples decide again */
    }
  }

  private syncLabel(): string {
    const st = this.syncStats;
    if (this.barrier === 'waiting' || !st || st.quality === 'waiting') return 'סנכרון: ממתין לחסם הפתיחה';
    const p95 = st.p95 === null ? '—' : `${st.p95.toFixed(2)} ש׳`;
    const q = { synced: 'מסונכרן', slight: 'סטייה קלה', out_of_sync: 'לא מסונכרן', waiting: '' }[st.quality];
    return `סנכרון: ${q} · p95 ${p95}${st.partial ? ' · חלקי' : ''}`;
  }

  private async onSeek(e: CustomEvent<{ minute: number }>) {
    const minute = e.detail.minute;
    const at = instantInZone(this.date, minute, this.tz);
    if (at.getTime() > Date.now()) {
      this.notice = 'לא ניתן לנגן זמן עתידי.';
      this.scrubbing = false;
      return;
    }
    this.cursor = minute;
    await this.startAt(at);
  }

  private onScrub(e: CustomEvent<{ minute: number }>) {
    this.scrubbing = true;
    this.cursor = e.detail.minute;
    this.position = instantInZone(this.date, e.detail.minute, this.tz);
  }

  private async nudge(seconds: number) {
    const cur = this.currentInstant();
    if (!cur) return;
    await this.startAt(new Date(cur.getTime() + seconds * 1000));
  }

  /** T066: a rate the source can honour — slow motion consumes the real-time buffer slower, so the rendered time
   * (and the position derived from it) stays the source time. Faster than 1× is never offered on this path. */
  private setSpeed(s: number) {
    if (this.groupMode || s > 1) return;
    this.speed = s;
    const p = this.masterPlayer();
    if (p) p.rate = s;
  }

  /** T066: one frame back or forward inside the buffered media (paused); a real seek is needed beyond the buffer. */
  private stepFrame(frames: number) {
    const p = this.masterPlayer();
    const cam = this.cams?.find((c) => c.id === this.cameraId);
    const fps = cam?.stream?.fps && cam.stream.fps > 0 ? cam.stream.fps : 25;
    if (!p) return;
    if (!p.stepFrame(frames, fps)) {
      this.notice = 'הפריים המבוקש מחוץ למאגר שכבר הגיע מה־NVR — השתמש בקפיצה של 10 שניות או בציר הזמן.';
      return;
    }
    this.notice = '';
    const now = this.currentInstant();
    if (now) {
      this.position = now;
      this.cursor = minuteInZone(now, this.tz);
    }
  }

  private togglePause() {
    const players = this.players();
    if (!players.length) return;
    if (this.paused) {
      const master = this.masterPlayer();
      if (!this.groupMode && master?.stale && this.position) {
        // the look-ahead buffer filled up while paused and later media was dropped: resume from where we stand
        void this.startAt(this.position);
        return;
      }
      players.forEach((p) => p.resume());
      if (this.clock && this.clockPausedAt) this.clock = { ...this.clock, startedAt: this.clock.startedAt + (performance.now() - this.clockPausedAt) };
      this.clockPausedAt = 0;
    } else {
      players.forEach((p) => p.pause());
      this.clockPausedAt = performance.now();
    }
    this.paused = !this.paused;
  }

  private onTilePlayer(cameraId: string, e: CustomEvent<{ status: string; transport?: string; error?: string }>) {
    this.tileStatus = { ...this.tileStatus, [cameraId]: e.detail.status };
    if (e.detail.status === 'playing' && this.seekSentAt[cameraId] && !this.firstPlayAt[cameraId]) {
      this.firstPlayAt[cameraId] = performance.now();
      this.startLatency[cameraId] = this.firstPlayAt[cameraId] - this.seekSentAt[cameraId];
    }
    if (cameraId !== this.cameraId) return;
    if (this.masterSession && e.detail.status === 'playing') {
      if (this.session) this.session = { ...this.session, state: 'playing' };
      // a fresh media element starts at 1×: keep the chosen slow-motion rate across reconnects and seeks (T066)
      if (!this.groupMode && this.speed !== 1) {
        const p = this.masterPlayer();
        if (p && p.rate !== this.speed) p.rate = this.speed;
      }
    }
    if (e.detail.status === 'ended') {
      // The NVR reached the end of the requested range: continue from there if the day has more.
      const cur = this.currentInstant();
      const s = this.masterSession;
      if (cur && s && new Date(s.playback_end_at).getTime() - cur.getTime() < 5000) {
        void this.startAt(new Date(new Date(s.playback_end_at).getTime() + 1000));
      }
    }
  }

  private fmt(d: Date): string {
    return new Intl.DateTimeFormat('he-IL', { timeZone: this.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(d);
  }

  // ---------- export ----------

  private openExport() {
    const c = Math.floor(this.cursor * 60) / 60;
    this.exportFrom = hms(Math.max(0, c - 1));
    this.exportTo = hms(Math.min(this.limitMinute, c + 1));
    this.estimate = null;
    this.exportJob = null;
    this.exportError = '';
    this.exportOpen = true;
  }

  private exportRange(): [string, string] | null {
    const a = instantInZone(this.date, parseHms(this.exportFrom), this.tz);
    const b = instantInZone(this.date, parseHms(this.exportTo), this.tz);
    if (b.getTime() <= a.getTime()) {
      this.exportError = 'זמן הסיום חייב להיות אחרי ההתחלה.';
      return null;
    }
    return [a.toISOString().replace(/\.\d{3}Z$/, 'Z'), b.toISOString().replace(/\.\d{3}Z$/, 'Z')];
  }

  private async runEstimate() {
    const r = this.exportRange();
    if (!r) return;
    this.exportBusy = true;
    this.exportError = '';
    try {
      this.estimate = await estimateExport(this.cameraId, r[0], r[1]);
    } catch (err) {
      this.exportError = describeError(err);
    } finally {
      this.exportBusy = false;
    }
  }

  private async runExport() {
    const r = this.exportRange();
    if (!r) return;
    this.exportBusy = true;
    this.exportError = '';
    try {
      this.exportJob = await createExport(this.cameraId, r[0], r[1]);
    } catch (err) {
      this.exportError = describeError(err);
    } finally {
      this.exportBusy = false;
    }
  }

  private renderExportDialog() {
    const est = this.estimate;
    const job = this.exportJob;
    return html`<sw-dialog ?open=${this.exportOpen} heading="ייצוא קטע" subheading=${`${this.cameraName(this.cameraId)} · ${this.date} · ${this.tz}`} @close=${() => (this.exportOpen = false)}>
      <div class="dlg">
        ${job
          ? html`<div class="est"><strong>עבודת הייצוא נוצרה</strong><span>${job.files.length} קבצים · משוער ${formatBytes(job.estimate_bytes)} · מצב: ${job.state}</span><span>ההתקדמות וההורדה במסך "ייצוא".</span></div>`
          : html`
              <div class="row">
                <sw-field label="מ־"><input type="time" step="1" data-ltr .value=${this.exportFrom} @change=${(e: Event) => { this.exportFrom = (e.target as HTMLInputElement).value; this.estimate = null; }} /></sw-field>
                <sw-field label="עד"><input type="time" step="1" data-ltr .value=${this.exportTo} @change=${(e: Event) => { this.exportTo = (e.target as HTMLInputElement).value; this.estimate = null; }} /></sw-field>
              </div>
              ${est
                ? html`<div class="est">
                    <span>${est.files} קבצי NVR בטווח · נפח משוער ${formatBytes(est.estimate_bytes)} (מקסימום ${formatBytes(est.max_bytes)}) · כיסוי ${est.coverage === 'complete' ? 'מלא' : 'חלקי'}</span>
                    ${est.first_file_at ? html`<span class="ltr">${this.fmt(new Date(est.first_file_at))} → ${this.fmt(new Date(est.last_file_end_at ?? est.first_file_at))}</span>` : nothing}
                    <span>${est.note}</span>
                    ${est.ffmpeg ? nothing : html`<span class="warn">ffmpeg לא זמין בשרת: הקובץ יימסר במיכל המקורי (Hikvision PS) ללא חיתוך.</span>`}
                  </div>`
                : html`<div class="session">הייצוא מוריד את הקבצים המקוריים מה־NVR (לפי קובץ, כך המכשיר תומך) ואז חותך לטווח ב־keyframe. חשב נפח לפני היצירה.</div>`}
            `}
        ${this.exportError ? html`<div class="err">${this.exportError}</div>` : nothing}
      </div>
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        ${job
          ? html`<sw-button variant="primary" icon="download" @click=${() => navigate('/investigate/exports')}>למסך הייצוא</sw-button><sw-button @click=${() => (this.exportOpen = false)}>סגור</sw-button>`
          : html`<sw-button ?disabled=${this.exportBusy} @click=${() => this.runEstimate()}>חשב נפח</sw-button>
              <sw-button variant="primary" icon="download" ?disabled=${this.exportBusy || !est || !est.files} @click=${() => this.runExport()}>צור ייצוא</sw-button>
              <sw-button variant="ghost" @click=${() => (this.exportOpen = false)}>ביטול</sw-button>`}
      </div>
    </sw-dialog>`;
  }

  // ---------- API mode: render ----------

  private renderStage(cam: Camera) {
    const live = this.live;
    const inGap = !live && !this.inRecording(this.cursor);
    if (this.groupMode) {
      const members = this.members;
      return html`<div class="grid ${members.length === 1 ? 'one' : ''}">
        ${members.map((cid) => {
          const sess = this.group?.sessions.find((s) => s.camera_id === cid);
          const missing = this.group?.missing[cid];
          const drift = this.drifts[cid];
          const st = this.tileStatus[cid];
          return html`<div class="tile ${cid === this.cameraId ? 'master' : ''}">
            ${sess && !FINISHED.includes(sess.state)
              ? html`<sw-live-player data-camera=${cid} .wsUrl=${playbackWsUrl(sess)} mode="mse" .retry=${false} recorded compact @player-status=${(e: CustomEvent<{ status: string }>) => this.onTilePlayer(cid, e)}></sw-live-player>`
              : html`<div class="center"><div><sw-icon name="offline" size=${20}></sw-icon><span>${missing === 'gap' || missing === 'no_recording' ? 'אין הקלטה בזמן הזה' : missing === 'playback_quota' ? 'מכסת הניגון מלאה' : this.busy ? 'מכין…' : this.group ? 'לא זמין' : 'לחץ על ציר הזמן'}</span></div></div>`}
            <span class="name" data-tile=${cid} data-tile-state=${this.syncStats?.members[cid]?.state ?? ''}>${this.cameraName(cid)}${cid === this.cameraId ? html` · מוביל` : nothing}${sess && st === 'playing' && Number.isFinite(drift) ? html`<span class="drift ${Math.abs(drift) > 2 ? 'bad' : ''}" title="סטייה מהשעון־אב, נמדדת מהפריים המוצג">${drift >= 0 ? '+' : ''}${drift.toFixed(1)}s</span>` : nothing}${this.syncStats?.members[cid]?.state === 'late' ? html`<span class="drift bad">מאחרת</span>` : nothing}${(this.syncStats?.members[cid]?.resyncs ?? 0) > 0 ? html`<span class="drift">סונכרן מחדש ×${this.syncStats!.members[cid].resyncs}</span>` : nothing}</span>
          </div>`;
        })}
      </div>`;
    }
    const session = this.session;
    return html`<div class="video ${inGap ? 'gap' : ''}">
      ${live && session
        ? html`<sw-live-player data-camera=${cam.id} .wsUrl=${playbackWsUrl(session)} mode="mse" .retry=${false} recorded @player-status=${(e: CustomEvent<{ status: string }>) => this.onTilePlayer(cam.id, e)}></sw-live-player>`
        : inGap
          ? html`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>${this.notice || 'אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live'}</span></div></div>`
          : html`<div class="center"><div><sw-icon name="play" size=${32}></sw-icon><span>${this.busy ? 'מכין ניגון…' : 'לחץ על ציר הזמן (או על נגן) כדי להתחיל מהזמן שנבחר'}</span>${this.busy ? nothing : html`<sw-button variant="primary" size="sm" icon="play" @click=${() => this.startAt(instantInZone(this.date, this.cursor, this.tz))}>נגן מ־${hms(this.cursor)}</sw-button>`}</div></div>`}
      <div class="tag"><sw-badge kind=${live ? 'recorded' : 'unknown'} ?onImage=${!!live}></sw-badge><span class="nm">${cam.name}</span></div>
    </div>`;
  }

  private renderApi() {
    if (this.error && !this.cams) return html`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.init()}></sw-state-panel>`;
    if (!this.cams) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    if (!this.cams.length) return html`<sw-state-panel state="empty" heading="אין מצלמות" hint="סנכרן מצלמות מה־NVR או בקש הרשאת ניגון."></sw-state-panel>`;
    const cam = this.cams.find((c) => c.id === this.cameraId) ?? this.cams[0];
    const master = this.masterSession;
    const live = this.live;
    const precision = master?.time_precision ?? 'unknown';
    const pos = this.position ?? instantInZone(this.date, this.cursor, this.tz);
    const masterStatus = this.tileStatus[this.cameraId] ?? '';
    return html`
      <div class="stage">
        ${this.renderStage(cam)}
        <span class="stamp">${this.date} ${this.fmt(pos)} · ${{ verified: 'מאומת', keyframe_limited: 'דיוק לפי keyframe', estimated: 'משוער', unknown: '—' }[precision]}${!this.groupMode && this.speed !== 1 ? html` · <span data-speed-active=${this.speed}>${this.speed}× הילוך איטי</span>` : nothing}${this.paused && !this.groupMode ? html` · <span data-paused>מושהה · צעד־פריים</span>` : nothing}${this.groupMode ? html` · <span data-sync-quality=${this.syncStats?.quality ?? 'waiting'} data-sync-p95=${this.syncStats?.p95 ?? ''} data-sync-samples=${this.syncStats?.samples ?? 0}>${this.syncLabel()}</span>` : ''}</span>
        <div class="bar"><div class="inner">
          <sw-button variant="ghost" size="sm" iconOnly icon=${this.paused ? 'play' : 'pause'} label=${this.paused ? 'המשך' : 'השהה'} data-pause ?disabled=${!live || masterStatus !== 'playing'} @click=${() => this.togglePause()}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="10 שניות אחורה" ?disabled=${!live || this.busy} @click=${() => this.nudge(-10)}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label="10 שניות קדימה" ?disabled=${!live || this.busy} @click=${() => this.nudge(10)}></sw-button>
          <span class="sep"></span>
          ${[0.25, 0.5, 1, 2, 4].map((s) => {
            const supported = (master?.capabilities.supported_speeds ?? [1]).includes(s);
            const mse = this.masterPlayer()?.transport === 'mse';
            const ok = s === 1 || (!this.groupMode && supported && (s > 1 || mse));
            const why = ok ? (s < 1 ? 'הילוך איטי: המאגר מתמלא בזמן אמת ונצרך לאט יותר — זמן המקור נשאר מדויק' : '') : this.groupMode ? 'בסנכרון רב־מצלמות נתמך רק 1×' : s > 1 ? 'לא נתמך במסלול הזה: הזרם מגיע מה־NVR בזמן אמת; מהירות מוגברת דורשת מקור ששולח מהר מזמן אמת' : 'הילוך איטי זמין רק בנתיב MSE';
            return html`<button class="q ${this.speed === s ? 'on' : ''}" data-speed=${s} ?disabled=${!ok} title=${why} @click=${() => this.setSpeed(s)}>${s}×</button>`;
          })}
          <span class="sep"></span>
          <button class="q" data-frame-step="-1" ?disabled=${!live || this.groupMode || !this.paused} title=${this.groupMode ? 'צעד־פריים זמין במצלמה בודדת' : this.paused ? 'פריים אחד אחורה (בתוך המאגר)' : 'צעד־פריים זמין בהשהיה'} @click=${() => this.stepFrame(-1)}>‹ פריים</button>
          <button class="q" data-frame-step="1" ?disabled=${!live || this.groupMode || !this.paused} title=${this.groupMode ? 'צעד־פריים זמין במצלמה בודדת' : this.paused ? 'פריים אחד קדימה (בתוך המאגר)' : 'צעד־פריים זמין בהשהיה'} @click=${() => this.stepFrame(1)}>פריים ›</button>
          <span class="sep"></span>
          <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא" ?disabled=${!live} @click=${() => this.masterPlayer()?.fullscreen()}></sw-button>
        </div></div>
      </div>
      <div class="tlwrap">
        <sw-timeline .segments=${this.segmentsMin} .events=${this.markers} .cursor=${this.cursor} .limit=${this.limitMinute} precision=${precision} @seek=${this.onSeek} @scrub=${this.onScrub} @hover=${this.onTlHover} @hover-end=${this.onTlHoverEnd}></sw-timeline>
        ${this.preview
          ? html`<div class="tlpreview" data-tl-preview style="left:${Math.max(104, Math.min(this.preview.width - 104, this.preview.x))}px">
              ${this.preview.failed ? html`<div class="none">אין פריים בזמן זה</div>` : html`<img src=${this.preview.url} alt="" @error=${() => { if (this.preview) this.preview = { ...this.preview, failed: true }; }} />`}
              <span>${secondLabel(this.preview.minute)}</span>
            </div>`
          : nothing}
      </div>
      <div class="compare">
        <span>השוואה (עד 4):</span>
        ${this.cams.filter((c) => c.id !== this.cameraId).map((c) => html`<sw-chip ?selected=${this.extra.includes(c.id)} @click=${() => this.toggleExtra(c.id)}>${c.name}</sw-chip>`)}
        ${this.groupMode ? html`<span>· שעון־אב אחד לכל האריחים (חסם פתיחה, ואז חציון זמני הפריימים המוצגים; מתחת לשלושה אריחים — המוביל); הסטייה של כל אריח נמדדת מול השעון, p95 על החלון האחרון; אריח מאחר מסונכרן לבד ואינו מזיז את האחרים (best effort, ללא עוגן זמן מאומת)</span>` : nothing}
      </div>
      <div class="filters">
        ${this.rec ? html`<sw-chip icon="history">${this.rec.segments.length} מקטעים · ${this.rec.matches} קבצים</sw-chip>` : nothing}
        ${this.dayEvents.length ? html`<sw-chip icon="bell" @click=${() => navigate('/investigate/events', { camera: this.cameraId, date: this.date })}>${this.dayEvents.length} אירועים${this.dayEvents.every((e) => e.confidence === 'inferred') ? ' (מהקלטות)' : ''}</sw-chip>` : nothing}
        ${this.rec?.coverage === 'partial' ? html`<span class="warn">כיסוי חלקי: ${this.rec.note}</span>` : nothing}
        ${this.loadingRec ? html`<span class="session">מחפש הקלטות…</span>` : nothing}
        ${this.notice ? html`<span class="warn">${this.notice}</span>` : nothing}
        ${this.error ? html`<span class="err">${this.error}</span>` : nothing}
        <span class="grow"></span>
        <sw-button size="sm" icon="case" data-add-to-case ?disabled=${!this.cameraId} @click=${() => (this.casePick = { kind: 'clip', camera_id: this.cameraId, ...clipAround(instantInZone(this.date, this.cursor, this.tz)) })}>הוסף לתיק</sw-button>
        <sw-button size="sm" icon="download" ?disabled=${!this.rec?.segments.length} @click=${() => this.openExport()}>ייצוא</sw-button>
        <a href="#/explore/floors/f0"><sw-button size="sm" icon="map">במפה</sw-button></a>
      </div>
      <sw-case-picker .item=${this.casePick} subheading=${`${this.cams?.find((c) => c.id === this.cameraId)?.name ?? ''} · ${this.date} ${secondLabel(this.cursor)}`} @close=${() => (this.casePick = null)}></sw-case-picker>
      <div class="session">
        <span>Session: ${master ? `${master.id} · דור ${this.groupMode ? this.group?.generation ?? master.generation : master.generation} · ${master.state}` : 'אין'}</span>
        <span>נגן: ${masterStatus || '—'}${this.paused ? ' (מושהה)' : ''}</span>
        <span>אזור זמן: <span class="ltr">${this.tz}</span></span>
        <span>כיסוי: ${this.rec ? (this.rec.coverage === 'complete' ? 'מלא' : this.rec.coverage === 'partial' ? 'חלקי' : 'לא ידוע') : '—'}</span>
        ${master ? html`<span>סוף הטווח: ${this.fmt(new Date(master.playback_end_at))}</span>` : nothing}
      </div>
      ${this.renderExportDialog()}
    `;
  }

  // ---------- demo mode ----------

  private seekDemo(e: CustomEvent<{ minute: number }>) {
    this.cursor = e.detail.minute;
    this.generation += 1;
  }

  private renderDemo() {
    const cam = demoWall.find((c) => c.id === this.demoCamera) ?? demoWall[0];
    const inGap = !demoSegments.some((s) => this.cursor >= s.startMin && this.cursor <= s.endMin);
    const events = demoEvents.filter((e) => e.minuteOfDay < 1440).filter((e) => this.filter === 'all' || e.type === this.filter).map((e) => ({ minute: e.minuteOfDay, kind: e.type, label: e.title }));
    return html`
      <div class="video ${inGap ? 'gap' : ''}">
        ${inGap
          ? html`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live</span></div></div>`
          : html`<sw-scene kind=${demoScene[cam.id] ?? 'lobby'}></sw-scene><div class="shade"></div><span class="demo">דמו · אין שרת מחובר</span>`}
        <div class="tag"><sw-badge kind=${inGap ? 'unknown' : 'recorded'} ?onImage=${!inGap}></sw-badge><span class="nm">${cam.name}</span></div>
        <span class="stamp">2026-09-14 ${minuteLabel(this.cursor)}:00 · actual: ${inGap ? '—' : minuteLabel(this.cursor)}</span>
        <div class="bar"><div class="inner">
          <sw-button variant="ghost" size="sm" iconOnly icon=${this.playing ? 'pause' : 'play'} label=${this.playing ? 'השהה' : 'נגן'} @click=${() => (this.playing = !this.playing)}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="10 שניות אחורה"></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label="10 שניות קדימה"></sw-button>
          <span class="sep"></span>
          ${[1, 2, 4].map((s) => html`<button class="q ${this.speed === s ? 'on' : ''}" @click=${() => (this.speed = s)}>${s}×</button>`)}
          <span class="sep"></span>
          <sw-button variant="ghost" size="sm" iconOnly icon="aperture" label="צילום מהקלטה"></sw-button>
          <button class="q on">1080p</button>
          <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא"></sw-button>
        </div></div>
      </div>
      <sw-timeline .segments=${demoSegments} .events=${events} .cursor=${this.cursor} precision="estimated" @seek=${this.seekDemo}></sw-timeline>
      <div class="filters">
        <sw-chip ?selected=${this.filter === 'all'} @click=${() => (this.filter = 'all')}>הכל</sw-chip>
        <sw-chip dot="#ef4444" ?selected=${this.filter === 'motion'} @click=${() => (this.filter = 'motion')}>תנועה</sw-chip>
        <sw-chip dot="#2f6bff" ?selected=${this.filter === 'person'} @click=${() => (this.filter = 'person')}>אדם</sw-chip>
        <sw-chip dot="#22c55e" ?selected=${this.filter === 'vehicle'} @click=${() => (this.filter = 'vehicle')}>רכב</sw-chip>
        <sw-chip dot="#8b5cf6" ?selected=${this.filter === 'door'} @click=${() => (this.filter = 'door')}>דלת</sw-chip>
        <span class="grow"></span>
        <sw-button size="sm" icon="case">הוסף לתיק</sw-button>
        <a href="#/investigate/floors/f0/history"><sw-button size="sm" icon="map">במפה בזמן הזה</sw-button></a>
      </div>
      <div class="session">
        <span>Session: ${this.playing ? 'playing' : 'paused'} · ${this.speed}×</span>
        <span>דור ${this.generation}</span>
        <span>דיוק זמן: משוער</span>
        <span>כיסוי: ${inGap ? 'פער' : 'מלא'} · 6 מקטעים ביום</span>
        <span>WebRTC → MSE</span>
        ${inGap ? nothing : html`<span>מצלמה: ${cam.name}</span>`}
      </div>
    `;
  }

  render() {
    const api = isApi();
    const cam = api ? this.cams?.find((c) => c.id === this.cameraId) : demoWall.find((c) => c.id === this.demoCamera) ?? demoWall[0];
    const heading = cam?.name ?? 'הקלטות';
    const sub = api ? `${this.date} ${hms(this.cursor)} · אזור זמן ${this.tz}` : `14.09.2026 ${minuteLabel(this.cursor)} · אזור זמן האתר Asia/Jerusalem · נתוני הדגמה`;
    const crumbs = api ? 'הקלטות' : `הקלטות | ${(cam as { floor?: string })?.floor ?? ''}`;
    const today = api ? dateInZone(new Date(), this.tz) : '2026-09-14';
    return html`
      <sw-page heading=${heading} subheading=${sub} crumbs=${crumbs} wide>
        <div slot="actions" class="pick">
          ${api
            ? html`<sw-field><select aria-label="מצלמה" @change=${(e: Event) => this.selectCamera((e.target as HTMLSelectElement).value)}>${(this.cams ?? []).map((c) => html`<option value=${c.id} ?selected=${c.id === this.cameraId}>${c.name}</option>`)}</select></sw-field>`
            : html`<sw-field><select aria-label="מצלמה" @change=${(e: Event) => (this.demoCamera = (e.target as HTMLSelectElement).value)}>${demoWall.map((c) => html`<option value=${c.id} ?selected=${c.id === this.demoCamera}>${c.name}</option>`)}</select></sw-field>`}
          <sw-field><input type="date" .value=${api ? this.date : '2026-09-14'} max=${today} data-ltr aria-label="תאריך" @change=${(e: Event) => api && this.setDate((e.target as HTMLInputElement).value)} /></sw-field>
          <sw-field style="inline-size:132px"><input type="time" step="1" .value=${api ? hms(this.cursor) : minuteLabel(this.cursor)} data-ltr aria-label="שעה" @change=${(e: Event) => { const v = (e.target as HTMLInputElement).value; if (api) void this.onSeek(new CustomEvent('seek', { detail: { minute: parseHms(v) } })); else { const [h, m] = v.split(':').map(Number); this.cursor = h * 60 + m; this.generation += 1; } }} /></sw-field>
        </div>
        ${api ? nothing : html`<sw-button slot="actions" variant="ghost" iconOnly icon="download" label="ייצוא קטע"></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="link" label="שיתוף"></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="more" label="עוד"></sw-button>`}
        ${api ? this.renderApi() : this.renderDemo()}
      </sw-page>
    `;
  }
}
