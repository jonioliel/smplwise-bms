import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-scene';
import '../components/sw-timeline';
import '../components/sw-live-player';
import '../components/sw-state-panel';
import { minuteLabel } from '../components/sw-timeline';
import type { SwLivePlayer } from '../components/sw-live-player';
import type { DemoSegment } from '../fixtures/catalog';
import { demoEvents, demoScene, demoSegments, demoWall } from '../fixtures/catalog';
import { isApi } from '../api/session';
import { listCameras } from '../api/maps';
import { productSettings } from '../api/prefs';
import { describeError, ApiError } from '../api/client';
import { closePlayback, createPlayback, dateInZone, instantInZone, minuteInZone, playbackWsUrl, recordingsForDay, seekPlayback, type PlaybackSession, type RecordingsResponse } from '../api/recordings';
import type { Camera } from '../api/types';

type Filter = 'all' | 'motion' | 'person' | 'vehicle' | 'door';

/**
 * SC12 — playback & timeline (board 1 screen 7). With a backend: the NVR's recordings for a local day
 * (search with honest coverage), a playback session through the relay (seek = new generation), the blue
 * timeline whose bubble follows the media clock. Time precision is labelled from the session; a gap is
 * shown as a gap, never replaced by live. Without a backend: the demo skeleton.
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
  @state() private loadingRec = false;
  @state() private session: PlaybackSession | null = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private notice = '';
  @state() private playerStatus = '';
  @state() private paused = false;
  @state() private position: Date | null = null; // media clock → source time
  @query('sw-live-player') private player?: SwLivePlayer;
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

  // ---------- API mode ----------

  private async init() {
    try {
      const [settings, list] = await Promise.all([productSettings(), listCameras()]);
      this.tz = settings['time.zone'] ?? 'Asia/Jerusalem';
      this.cams = list.cameras.filter((c) => c.enabled);
      const first = this.cams.find((c) => c.id === this.cameraId) ?? this.cams[0];
      const at = this.at ? new Date(this.at) : null;
      this.date = dateInZone(at && !Number.isNaN(at.getTime()) ? at : new Date(), this.tz);
      if (first) {
        this.cameraId = first.id;
        await this.loadRecordings();
        if (at && !Number.isNaN(at.getTime())) {
          this.cursor = minuteInZone(at, this.tz);
          await this.startAt(at);
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
      this.rec = await recordingsForDay(this.cameraId, this.date);
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.loadingRec = false;
    }
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

  /** Create the session at an instant, or seek the existing one (new generation). */
  private async startAt(at: Date) {
    if (!this.cameraId || this.busy) return;
    this.busy = true;
    this.error = '';
    this.notice = '';
    try {
      const iso = at.toISOString().replace(/\.\d{3}Z$/, 'Z');
      const session = this.session && !['closed', 'expired', 'failed'].includes(this.session.state) ? await seekPlayback(this.session.id, iso) : await createPlayback(this.cameraId, iso);
      this.session = session;
      this.position = new Date(session.requested_at);
      this.cursor = minuteInZone(this.position, this.tz);
      this.paused = false;
      this.playerStatus = 'connecting';
      if (session.moved_to_next_segment) this.notice = `אין הקלטה בזמן שנבחר; הניגון התחיל בקטע הבא (${this.fmt(new Date(session.requested_at))}).`;
    } catch (err) {
      if (err instanceof ApiError && err.body.code === 'no_recording') {
        this.notice = 'אין הקלטה בזמן הזה ובשש השעות שאחריו: פער בכיסוי, לא מדלגים ל־Live.';
        this.position = at;
      } else if (err instanceof ApiError && err.body.code === 'session_over') {
        this.session = null;
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
    this.session = null;
    this.playerStatus = '';
    if (s && !['closed', 'expired', 'failed'].includes(s.state)) {
      try {
        await closePlayback(s.id);
      } catch {
        /* the janitor expires it */
      }
    }
  }

  private currentInstant(): Date | null {
    if (!this.session) return this.position;
    const base = new Date(this.session.requested_at).getTime();
    return new Date(base + (this.player?.mediaTime ?? 0) * 1000);
  }

  private tick() {
    if (!this.session || this.playerStatus !== 'playing' || this.paused) return;
    const now = this.currentInstant();
    if (now) {
      this.position = now;
      this.cursor = minuteInZone(now, this.tz);
    }
  }

  private async onSeek(e: CustomEvent<{ minute: number }>) {
    const minute = e.detail.minute;
    const at = instantInZone(this.date, minute, this.tz);
    if (at.getTime() > Date.now()) {
      this.notice = 'לא ניתן לנגן זמן עתידי.';
      return;
    }
    this.cursor = minute;
    await this.startAt(at);
  }

  private async nudge(seconds: number) {
    const cur = this.currentInstant();
    if (!cur) return;
    await this.startAt(new Date(cur.getTime() + seconds * 1000));
  }

  private togglePause() {
    if (!this.player || this.playerStatus !== 'playing') return;
    if (this.paused) this.player.resume();
    else this.player.pause();
    this.paused = !this.paused;
  }

  private onPlayer(e: CustomEvent<{ status: string; transport?: string; error?: string }>) {
    this.playerStatus = e.detail.status;
    if (this.session && e.detail.status === 'playing') this.session = { ...this.session, state: 'playing' };
    if (e.detail.status === 'ended') {
      // The NVR reached the end of the requested range: continue from there if the day has more.
      const cur = this.currentInstant();
      if (cur && this.session && new Date(this.session.playback_end_at).getTime() - cur.getTime() < 5000) {
        void this.startAt(new Date(new Date(this.session.playback_end_at).getTime() + 1000));
      }
    }
  }

  private fmt(d: Date): string {
    return new Intl.DateTimeFormat('he-IL', { timeZone: this.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(d);
  }

  private renderApi() {
    if (this.error && !this.cams) return html`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.init()}></sw-state-panel>`;
    if (!this.cams) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    if (!this.cams.length) return html`<sw-state-panel state="empty" heading="אין מצלמות" hint="סנכרן מצלמות מה־NVR או בקש הרשאת ניגון."></sw-state-panel>`;
    const cam = this.cams.find((c) => c.id === this.cameraId) ?? this.cams[0];
    const session = this.session;
    const live = session && ['buffering', 'playing', 'seeking', 'paused', 'creating'].includes(session.state);
    const inGap = !live && !this.inRecording(this.cursor);
    const precision = session?.time_precision ?? 'unknown';
    const pos = this.position ?? instantInZone(this.date, this.cursor, this.tz);
    return html`
      <div class="video ${inGap ? 'gap' : ''}">
        ${live
          ? html`<sw-live-player .wsUrl=${playbackWsUrl(session)} mode="mse" .retry=${false} @player-status=${this.onPlayer}></sw-live-player>`
          : inGap
            ? html`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>${this.notice || 'אין הקלטה בזמן הזה: פער בכיסוי, לא מדלגים ל־Live'}</span></div></div>`
            : html`<div class="center"><div><sw-icon name="play" size=${32}></sw-icon><span>${this.busy ? 'מכין ניגון…' : 'לחץ על ציר הזמן (או על נגן) כדי להתחיל מהזמן שנבחר'}</span>${this.busy ? nothing : html`<sw-button variant="primary" size="sm" icon="play" @click=${() => this.startAt(instantInZone(this.date, this.cursor, this.tz))}>נגן מ־${minuteLabel(Math.floor(this.cursor))}</sw-button>`}</div></div>`}
        <div class="tag"><sw-badge kind=${live ? 'recorded' : 'unknown'} ?onImage=${!!live}></sw-badge><span class="nm">${cam.name}</span></div>
        <span class="stamp">${this.date} ${this.fmt(pos)} · ${{ verified: 'מאומת', keyframe_limited: 'דיוק לפי keyframe', estimated: 'משוער', unknown: '—' }[precision]}</span>
        <div class="bar"><div class="inner">
          <sw-button variant="ghost" size="sm" iconOnly icon=${this.paused ? 'play' : 'pause'} label=${this.paused ? 'המשך' : 'השהה'} ?disabled=${!live || this.playerStatus !== 'playing'} @click=${() => this.togglePause()}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="back10" label="10 שניות אחורה" ?disabled=${!live || this.busy} @click=${() => this.nudge(-10)}></sw-button>
          <sw-button variant="ghost" size="sm" iconOnly icon="forward10" label="10 שניות קדימה" ?disabled=${!live || this.busy} @click=${() => this.nudge(10)}></sw-button>
          <span class="sep"></span>
          <button class="q on" title="מהירויות נוספות יוצגו רק אם המסלול תומך">1×</button>
          <span class="sep"></span>
          <sw-button variant="ghost" size="sm" iconOnly icon="expand" label="מסך מלא" ?disabled=${!live} @click=${() => this.player?.fullscreen()}></sw-button>
        </div></div>
      </div>
      <sw-timeline .segments=${this.segmentsMin} .events=${[]} .cursor=${Math.floor(this.cursor)} precision=${precision} @seek=${this.onSeek}></sw-timeline>
      <div class="filters">
        ${this.rec ? html`<sw-chip icon="history">${this.rec.segments.length} מקטעים · ${this.rec.matches} קבצים</sw-chip>` : nothing}
        ${this.rec?.coverage === 'partial' ? html`<span class="warn">כיסוי חלקי: ${this.rec.note}</span>` : nothing}
        ${this.loadingRec ? html`<span class="session">מחפש הקלטות…</span>` : nothing}
        ${this.notice ? html`<span class="warn">${this.notice}</span>` : nothing}
        ${this.error ? html`<span class="err">${this.error}</span>` : nothing}
        <span class="grow"></span>
        <sw-button size="sm" icon="download" disabled title="ייצוא לפי קובץ מגיע בהמשך (T044)">ייצוא</sw-button>
        <a href="#/explore/floors/f0"><sw-button size="sm" icon="map">במפה</sw-button></a>
      </div>
      <div class="session">
        <span>Session: ${session ? `${session.id} · דור ${session.generation} · ${session.state}` : 'אין'}</span>
        <span>נגן: ${this.playerStatus || '—'}${this.paused ? ' (מושהה)' : ''}</span>
        <span>אזור זמן: <span class="ltr">${this.tz}</span></span>
        <span>כיסוי: ${this.rec ? (this.rec.coverage === 'complete' ? 'מלא' : this.rec.coverage === 'partial' ? 'חלקי' : 'לא ידוע') : '—'}</span>
        ${session ? html`<span>סוף הטווח: ${this.fmt(new Date(session.playback_end_at))}</span>` : nothing}
      </div>
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
    const sub = api ? `${this.date} ${minuteLabel(Math.floor(this.cursor))} · אזור זמן ${this.tz}` : `14.09.2026 ${minuteLabel(this.cursor)} · אזור זמן האתר Asia/Jerusalem · נתוני הדגמה`;
    const crumbs = api ? 'הקלטות' : `הקלטות | ${(cam as { floor?: string })?.floor ?? ''}`;
    const today = api ? dateInZone(new Date(), this.tz) : '2026-09-14';
    return html`
      <sw-page heading=${heading} subheading=${sub} crumbs=${crumbs} wide>
        <div slot="actions" class="pick">
          ${api
            ? html`<sw-field><select aria-label="מצלמה" @change=${(e: Event) => this.selectCamera((e.target as HTMLSelectElement).value)}>${(this.cams ?? []).map((c) => html`<option value=${c.id} ?selected=${c.id === this.cameraId}>${c.name}</option>`)}</select></sw-field>`
            : html`<sw-field><select aria-label="מצלמה" @change=${(e: Event) => (this.demoCamera = (e.target as HTMLSelectElement).value)}>${demoWall.map((c) => html`<option value=${c.id} ?selected=${c.id === this.demoCamera}>${c.name}</option>`)}</select></sw-field>`}
          <sw-field><input type="date" .value=${api ? this.date : '2026-09-14'} max=${today} data-ltr aria-label="תאריך" @change=${(e: Event) => api && this.setDate((e.target as HTMLInputElement).value)} /></sw-field>
          <sw-field style="inline-size:96px"><input type="time" .value=${minuteLabel(Math.floor(this.cursor))} data-ltr aria-label="שעה" @change=${(e: Event) => { const [h, m] = (e.target as HTMLInputElement).value.split(':').map(Number); if (api) void this.onSeek(new CustomEvent('seek', { detail: { minute: h * 60 + m } })); else { this.cursor = h * 60 + m; this.generation += 1; } }} /></sw-field>
        </div>
        ${api ? nothing : html`<sw-button slot="actions" variant="ghost" iconOnly icon="download" label="ייצוא קטע"></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="link" label="שיתוף"></sw-button><sw-button slot="actions" variant="ghost" iconOnly icon="more" label="עוד"></sw-button>`}
        ${api ? this.renderApi() : this.renderDemo()}
      </sw-page>
    `;
  }
}
