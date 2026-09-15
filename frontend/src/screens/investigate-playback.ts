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
import { minuteLabel, secondLabel } from '../components/sw-timeline';
import type { SwLivePlayer } from '../components/sw-live-player';
import type { DemoSegment } from '../fixtures/catalog';
import { demoEvents, demoScene, demoSegments, demoWall } from '../fixtures/catalog';
import { isApi } from '../api/session';
import { listCameras } from '../api/maps';
import { productSettings } from '../api/prefs';
import { navigate } from '../router';
import { describeError, ApiError } from '../api/client';
import {
  closeGroup,
  closePlayback,
  createGroup,
  createPlayback,
  dateInZone,
  instantInZone,
  minuteInZone,
  playbackWsUrl,
  recordingsForDay,
  seekGroup,
  seekPlayback,
  type PlaybackGroup,
  type PlaybackSession,
  type RecordingsResponse,
} from '../api/recordings';
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
@customElement('investigate-playback')
export class InvestigatePlayback extends LitElement {
  /** Route params (#/investigate/playback?camera=<id>&t=<utc iso>) */
  @property() cameraId = '';
  @property() at = '';

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
  @state() private busy = false;
  @state() private error = '';
  @state() private notice = '';
  @state() private tileStatus: Record<string, string> = {};
  @state() private drifts: Record<string, number> = {};
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
        const g = this.group && this.group.sessions.some((s) => !FINISHED.includes(s.state)) ? await seekGroup(this.group.id, iso) : await createGroup(this.members, iso);
        this.group = g;
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
    const base = new Date(s.requested_at).getTime();
    return new Date(base + (this.masterPlayer()?.mediaTime ?? 0) * 1000);
  }

  private tick() {
    const s = this.masterSession;
    if (!s || this.paused || this.scrubbing) return;
    const master = this.masterPlayer();
    if (!master || master.status !== 'playing') return;
    const now = this.currentInstant();
    if (now) {
      this.position = now;
      this.cursor = minuteInZone(now, this.tz);
    }
    if (this.groupMode && this.group) {
      const drifts: Record<string, number> = {};
      for (const p of this.players()) {
        const cid = p.dataset.camera ?? '';
        const sess = this.group.sessions.find((x) => x.camera_id === cid);
        if (!sess || cid === this.cameraId) continue;
        const pos = new Date(sess.requested_at).getTime() + p.mediaTime * 1000;
        drifts[cid] = p.status === 'playing' && now ? (pos - now.getTime()) / 1000 : NaN;
      }
      this.drifts = drifts;
    }
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

  private togglePause() {
    const players = this.players();
    if (!players.length) return;
    if (this.paused) players.forEach((p) => p.resume());
    else players.forEach((p) => p.pause());
    this.paused = !this.paused;
  }

  private onTilePlayer(cameraId: string, e: CustomEvent<{ status: string; transport?: string; error?: string }>) {
    this.tileStatus = { ...this.tileStatus, [cameraId]: e.detail.status };
    if (cameraId !== this.cameraId) return;
    if (this.masterSession && e.detail.status === 'playing') {
      if (this.session) this.session = { ...this.session, state: 'playing' };
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
              ? html`<sw-live-player data-camera=${cid} .wsUrl=${playbackWsUrl(sess)} mode="mse" .retry=${false} compact @player-status=${(e: CustomEvent<{ status: string }>) => this.onTilePlayer(cid, e)}></sw-live-player>`
              : html`<div class="center"><div><sw-icon name="offline" size=${20}></sw-icon><span>${missing === 'gap' || missing === 'no_recording' ? 'אין הקלטה בזמן הזה' : missing === 'playback_quota' ? 'מכסת הניגון מלאה' : this.busy ? 'מכין…' : this.group ? 'לא זמין' : 'לחץ על ציר הזמן'}</span></div></div>`}
            <span class="name">${this.cameraName(cid)}${cid === this.cameraId ? html` · מוביל` : nothing}${cid !== this.cameraId && sess && st === 'playing' && Number.isFinite(drift) ? html`<span class="drift ${Math.abs(drift) > 2 ? 'bad' : ''}">${drift >= 0 ? '+' : ''}${drift.toFixed(1)}s</span>` : nothing}</span>
          </div>`;
        })}
      </div>`;
    }
    const session = this.session;
    return html`<div class="video ${inGap ? 'gap' : ''}">
      ${live && session
        ? html`<sw-live-player data-camera=${cam.id} .wsUrl=${playbackWsUrl(session)} mode="mse" .retry=${false} @player-status=${(e: CustomEvent<{ status: string }>) => this.onTilePlayer(cam.id, e)}></sw-live-player>`
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
        <span class="stamp">${this.date} ${this.fmt(pos)} · ${{ verified: 'מאומת', keyframe_limited: 'דיוק לפי keyframe', estimated: 'משוער', unknown: '—' }[precision]}${this.groupMode ? ' · סנכרון best effort' : ''}</span>
        <div class="bar"><div class="inner">
          <sw-button variant="ghost" size="sm" iconOnly icon=${this.paused ? 'play' : 'pause'} label=${this.paused ? 'המשך' : 'השהה'} ?disabled=${!live || masterStatus !== 'playing'} @click=${() => this.togglePause()}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="10 שניות אחורה" ?disabled=${!live || this.busy} @click=${() => this.nudge(-10)}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label="10 שניות קדימה" ?disabled=${!live || this.busy} @click=${() => this.nudge(10)}></sw-button>
          <span class="sep"></span>
          <button class="q on" title="מהירויות נוספות יוצגו רק אם המסלול תומך">1×</button>
          <span class="sep"></span>
          <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא" ?disabled=${!live} @click=${() => this.masterPlayer()?.fullscreen()}></sw-button>
        </div></div>
      </div>
      <sw-timeline .segments=${this.segmentsMin} .events=${this.markers} .cursor=${this.cursor} .limit=${this.limitMinute} precision=${precision} @seek=${this.onSeek} @scrub=${this.onScrub}></sw-timeline>
      <div class="compare">
        <span>השוואה (עד 4):</span>
        ${this.cams.filter((c) => c.id !== this.cameraId).map((c) => html`<sw-chip ?selected=${this.extra.includes(c.id)} @click=${() => this.toggleExtra(c.id)}>${c.name}</sw-chip>`)}
        ${this.groupMode ? html`<span>· ציר הזמן עוקב אחרי המצלמה המובילה; הסטייה של כל אריח מוצגת עליו (best effort, ללא עוגן זמן מאומת)</span>` : nothing}
      </div>
      <div class="filters">
        ${this.rec ? html`<sw-chip icon="history">${this.rec.segments.length} מקטעים · ${this.rec.matches} קבצים</sw-chip>` : nothing}
        ${this.dayEvents.length ? html`<sw-chip icon="bell" @click=${() => navigate('/investigate/events', { camera: this.cameraId, date: this.date })}>${this.dayEvents.length} אירועים${this.dayEvents.every((e) => e.confidence === 'inferred') ? ' (מהקלטות)' : ''}</sw-chip>` : nothing}
        ${this.rec?.coverage === 'partial' ? html`<span class="warn">כיסוי חלקי: ${this.rec.note}</span>` : nothing}
        ${this.loadingRec ? html`<span class="session">מחפש הקלטות…</span>` : nothing}
        ${this.notice ? html`<span class="warn">${this.notice}</span>` : nothing}
        ${this.error ? html`<span class="err">${this.error}</span>` : nothing}
        <span class="grow"></span>
        <sw-button size="sm" icon="download" ?disabled=${!this.rec?.segments.length} @click=${() => this.openExport()}>ייצוא</sw-button>
        <a href="#/explore/floors/f0"><sw-button size="sm" icon="map">במפה</sw-button></a>
      </div>
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
          <sw-field style="inline-size:110px"><input type="time" step="1" .value=${api ? hms(this.cursor) : minuteLabel(this.cursor)} data-ltr aria-label="שעה" @change=${(e: Event) => { const v = (e.target as HTMLInputElement).value; if (api) void this.onSeek(new CustomEvent('seek', { detail: { minute: parseHms(v) } })); else { const [h, m] = v.split(':').map(Number); this.cursor = h * 60 + m; this.generation += 1; } }} /></sw-field>
        </div>
        ${api ? nothing : html`<sw-button slot="actions" variant="ghost" iconOnly icon="download" label="ייצוא קטע"></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="link" label="שיתוף"></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="more" label="עוד"></sw-button>`}
        ${api ? this.renderApi() : this.renderDemo()}
      </sw-page>
    `;
  }
}
