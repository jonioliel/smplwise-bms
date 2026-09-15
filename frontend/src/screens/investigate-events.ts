import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-table';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-drawer';
import '../components/sw-live-player';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-scene';
import '../components/sw-state-panel';
import type { TableColumn } from '../components/sw-table';
import { demoEvents, eventTypeLabel, type DemoEvent } from '../fixtures/catalog';
import { isApi } from '../api/session';
import { listCameras } from '../api/maps';
import { productSettings } from '../api/prefs';
import { navigate } from '../router';
import { describeError } from '../api/client';
import { ackEvent, EVENT_LABEL, EVENT_TONE, listEvents, subscribeEvents, type EventKind, type IngestState, type VmsEvent, pollThumbnail, thumbnailUrl } from '../api/events';
import { dateInZone, closePlayback, createPlayback, playbackWsUrl, type PlaybackSession } from '../api/recordings';
import type { Camera } from '../api/types';

const TONE: Record<DemoEvent['type'], string> = { person: '#2f6bff', vehicle: '#22c55e', motion: '#ef4444', line: '#f59e0b', offline: '#6b7280', door: '#8b5cf6' };
const SCENE: Record<string, string> = { 'כניסה ראשית': 'entrance', 'חצר אחורית': 'backyard', מחסן: 'warehouse', לובי: 'lobby', 'חניה מקורה': 'parking', 'מסדרון מזרחי': 'corridor' };
const SEV_LABEL = { info: 'מידע', alert: 'התראה', critical: 'קריטי' } as const;

/**
 * SC14 — event centre (board 1 screen 8): filters, thumbnail | event | camera | time | severity, drawer with
 * source, confidence and coverage. With a backend: the stored events (measured alerts + recording-derived,
 * both labelled), live updates over the push socket, acknowledge, jump to the recording. Without: the demo.
 */
@customElement('investigate-events')
export class InvestigateEvents extends LitElement {
  /** Route params (#/investigate/events?camera=&date=) */
  @property() cameraId = '';
  @property() date = '';

  @state() private selected: string | null = null;
  @state() private filter: 'all' | 'unacked' | 'acked' = 'all';
  // api
  @state() private cams: Camera[] | null = null;
  @state() private tz = 'Asia/Jerusalem';
  @state() private type = '';
  @state() private events: VmsEvent[] | null = null;
  @state() private ingest: IngestState | null = null;
  @state() private live = false;
  @state() private error = '';
  @state() private busy = false;
  @state() private thumbVersion = new Map<string, number>();
  @state() private player: { eventId: string; session: PlaybackSession | null; error: string } | null = null;
  private unsubscribe: (() => void) | undefined;
  private thumbTimers = new Map<string, number>();
  private thumbInFlight = 0;

  static styles = css`
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .filters sw-field {
      inline-size: 150px;
    }
    .filters .grow {
      flex: 1;
    }
    .stage {
      position: relative;
      min-block-size: 420px;
    }
    sw-scene.thumb,
    .thumb.none {
      inline-size: 64px;
      block-size: 40px;
      border-radius: 6px;
      overflow: hidden;
    }
    .thumb.none {
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
    }
    .thumb img {
      inline-size: 64px;
      block-size: 40px;
      object-fit: cover;
      border-radius: 6px;
      display: block;
      background: var(--sw-surface-3);
    }
    .thumb.pending {
      background: linear-gradient(90deg, var(--sw-surface-3) 25%, var(--sw-surface-2) 50%, var(--sw-surface-3) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.6s linear infinite;
    }
    @keyframes shimmer {
      from {
        background-position: 200% 0;
      }
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .thumb.pending {
        animation: none;
      }
    }
    .big {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      text-align: center;
    }
    .big img,
    .big sw-live-player {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: cover;
      display: block;
    }
    .big .hint {
      padding: 10px;
    }
    .big .err {
      position: absolute;
      inset-inline: 8px;
      inset-block-end: 8px;
      background: rgba(17, 24, 39, 0.7);
      color: #fff;
      border-radius: 6px;
      padding: 4px 8px;
    }
    .ty {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-weight: var(--sw-fw-semibold);
    }
    .ty i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--tone);
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .preview {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-xs);
      text-align: center;
      padding: 10px;
    }
    .preview sw-scene {
      position: absolute;
      inset: 0;
    }
    .preview .demo {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-start: 8px;
      font-size: 10px;
      background: rgba(17, 24, 39, 0.55);
      color: #fff;
      border-radius: 4px;
      padding: 1px 6px;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
    }
    .banner {
      font-size: var(--sw-fs-xs);
      padding: 6px 10px;
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .banner.warn {
      background: var(--sw-stale-soft);
      color: #7c2d12;
    }
    .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-offline);
      display: inline-block;
    }
    .dot.on {
      background: var(--sw-live);
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
      this.unsubscribe = subscribeEvents(
        (ev) => this.onPushed(ev),
        (state, connected) => {
          this.live = connected;
          if (state) this.ingest = state;
        },
      );
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
    for (const t of this.thumbTimers.values()) window.clearTimeout(t);
    this.thumbTimers.clear();
    void this.stopPlayer();
  }

  // ---- thumbnails (grabbed lazily from the recording; the list marks pending rows, we poll them) ----

  /** Rendered inside sw-table's shadow root, so the box is styled inline (the screen's stylesheet does not reach it). */
  private renderThumb(ev: VmsEvent) {
    const box = 'inline-size:64px;block-size:40px;border-radius:6px;overflow:hidden;background:var(--sw-surface-3);display:grid;place-items:center;color:var(--sw-text-3)';
    if (ev.thumbnail === 'ready') {
      return html`<img class="thumb" src=${thumbnailUrl(ev.id, this.thumbVersion.get(ev.id) ?? 0)} alt="" loading="lazy" style="inline-size:64px;block-size:40px;object-fit:cover;border-radius:6px;display:block;background:var(--sw-surface-3)" />`;
    }
    if ((ev.thumbnail === 'pending' || ev.thumbnail === 'none') && ev.camera_id) {
      this.schedulePoll(ev.id, 3000, 0);
      return html`<div class="thumb pending" style=${box} title="מכין תמונה מההקלטה…"><sw-icon name="camera" size=${14} style="opacity:.45"></sw-icon></div>`;
    }
    return html`<div class="thumb none" style=${box}><sw-icon name=${ev.type === 'offline' || ev.type === 'coverage_gap' ? 'offline' : ev.type === 'person' ? 'user' : ev.type === 'vehicle' ? 'route' : ev.type === 'door' || ev.type === 'io' ? 'door' : 'bell'} size=${14}></sw-icon></div>`;
  }

  private schedulePoll(id: string, delay: number, attempt: number) {
    if (this.thumbTimers.has(id)) return;
    this.thumbTimers.set(id, window.setTimeout(() => void this.poll(id, attempt), delay));
  }

  private cancelPoll(id: string) {
    const t = this.thumbTimers.get(id);
    if (t !== undefined) window.clearTimeout(t);
    this.thumbTimers.delete(id);
  }

  private async poll(id: string, attempt: number) {
    this.thumbTimers.delete(id);
    if (!this.isConnected || !this.events?.some((e) => e.id === id)) return;
    if (this.thumbInFlight >= 2) {
      this.schedulePoll(id, 1500, attempt);
      return;
    }
    this.thumbInFlight++;
    let st: 'ready' | 'pending' | 'unavailable';
    try {
      st = await pollThumbnail(id);
    } finally {
      this.thumbInFlight--;
    }
    if (st === 'pending') {
      if (attempt < 14) this.schedulePoll(id, Math.min(15000, 3000 * 1.35 ** attempt), attempt + 1);
      return;
    }
    this.setThumb(id, st);
  }

  private setThumb(id: string, st: 'ready' | 'unavailable') {
    if (st === 'ready') this.thumbVersion = new Map(this.thumbVersion).set(id, Date.now());
    this.events = (this.events ?? []).map((e) => (e.id === id ? { ...e, thumbnail: st } : e));
  }

  // ---- inline playback from the event time (a playback session; closed with the drawer) ----

  private select(id: string | null) {
    if (id !== this.player?.eventId) void this.stopPlayer();
    this.selected = id;
  }

  private closeDrawer() {
    this.select(null);
  }

  private async play(ev: VmsEvent) {
    if (this.player?.eventId === ev.id) {
      await this.stopPlayer();
      return;
    }
    await this.stopPlayer();
    if (!ev.camera_id) return;
    this.player = { eventId: ev.id, session: null, error: '' };
    try {
      const startAt = new Date(new Date(ev.occurred_at).getTime() - 2000).toISOString().replace(/\.\d{3}Z$/, 'Z');
      const session = await createPlayback(ev.camera_id, startAt);
      if (this.player?.eventId === ev.id) this.player = { eventId: ev.id, session, error: '' };
      else await closePlayback(session.id).catch(() => undefined);
    } catch (err) {
      this.player = { eventId: ev.id, session: null, error: describeError(err) };
    }
  }

  private async stopPlayer() {
    const p = this.player;
    this.player = null;
    if (p?.session) await closePlayback(p.session.id).catch(() => undefined);
  }

  private async init() {
    try {
      const [settings, list] = await Promise.all([productSettings(), listCameras()]);
      this.tz = settings['time.zone'] ?? 'Asia/Jerusalem';
      this.cams = list.cameras;
      if (!this.date) this.date = dateInZone(new Date(), this.tz);
      await this.load();
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async load() {
    try {
      const r = await listEvents({ date: this.date || undefined, cameraId: this.cameraId || undefined, type: this.type || undefined, unacked: this.filter === 'unacked', acked: this.filter === 'acked', limit: 500 });
      this.events = r.events;
      this.ingest = r.ingest;
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private onPushed(ev: VmsEvent) {
    if (!this.events) return;
    const today = dateInZone(new Date(ev.occurred_at), this.tz);
    if (this.date && today !== this.date) return;
    if (this.cameraId && ev.camera_id !== this.cameraId) return;
    if (this.type && ev.type !== this.type) return;
    const name = this.cams?.find((c) => c.id === ev.camera_id)?.name ?? null;
    const row = { ...ev, camera_name: ev.camera_name ?? name };
    if (ev.thumbnail === 'ready' || ev.thumbnail === 'unavailable') {
      this.cancelPoll(ev.id);
      if (ev.thumbnail === 'ready') this.thumbVersion = new Map(this.thumbVersion).set(ev.id, Date.now());
    }
    const idx = this.events.findIndex((e) => e.id === ev.id);
    this.events = idx >= 0 ? this.events.map((e, i) => (i === idx ? { ...e, ...row } : e)) : [row, ...this.events];
  }

  private fmt(iso: string): string {
    return new Intl.DateTimeFormat('he-IL', { timeZone: this.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
  }

  private fmtDate(iso: string): string {
    return new Intl.DateTimeFormat('he-IL', { timeZone: this.tz, day: '2-digit', month: '2-digit' }).format(new Date(iso));
  }

  private async ack(ev: VmsEvent) {
    this.busy = true;
    try {
      const updated = await ackEvent(ev.id);
      this.events = (this.events ?? []).map((e) => (e.id === ev.id ? { ...e, ...updated } : e));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private apiColumns: TableColumn[] = [
    { key: 'thumb', label: '', width: '72px', render: (r) => this.renderThumb(r as unknown as VmsEvent) },
    { key: 'type', label: 'אירוע', render: (r) => html`<span class="ty" style="--tone:${EVENT_TONE[r.type as EventKind] ?? '#6b7280'}"><i></i>${EVENT_LABEL[r.type as EventKind] ?? String(r.type)}${Number(r.count) > 1 ? html` <span class="sub">×${String(r.count)}</span>` : nothing}</span><div class="sub">${r.confidence === 'inferred' ? 'נגזר מהקלטה' : 'התראה מה־NVR'} · ${r.acked_at ? `טופל · ${String(r.acked_by_username ?? '')}` : 'ממתין לטיפול'}</div>` },
    { key: 'camera_name', label: 'מצלמה', render: (r) => html`${String(r.camera_name ?? (r.channel ? `ערוץ ${String(r.channel)}` : 'מערכת'))}<div class="sub ltr">${String(r.raw_type)}</div>` },
    { key: 'occurred_at', label: 'זמן', render: (r) => html`${this.fmt(String(r.occurred_at))}<div class="sub">${this.fmtDate(String(r.occurred_at))}${r.ended_at ? ` · עד ${this.fmt(String(r.ended_at))}` : ''}</div>` },
    { key: 'severity', label: 'חומרה', render: (r) => html`<sw-badge kind=${r.severity === 'critical' ? 'error' : r.severity === 'alert' ? 'stale' : 'neutral'} label=${SEV_LABEL[r.severity as keyof typeof SEV_LABEL] ?? String(r.severity)}></sw-badge>` },
  ];

  private columns: TableColumn[] = [
    { key: 'thumb', label: 'תמונה', width: '80px', render: (r) => (r.type === 'offline' || r.type === 'door' ? html`<div class="thumb none"><sw-icon name=${r.type === 'offline' ? 'offline' : 'door'} size=${14}></sw-icon></div>` : html`<sw-scene class="thumb" kind=${(SCENE[String(r.camera)] ?? 'lobby') as 'lobby'}></sw-scene>`) },
    { key: 'title', label: 'אירוע', render: (r) => html`<span class="ty" style="--tone:${TONE[r.type as DemoEvent['type']]}"><i></i>${eventTypeLabel[r.type as DemoEvent['type']]}</span><div class="sub">${String(r.title)} · ${r.acked ? 'טופל' : 'ממתין לטיפול'}</div>` },
    { key: 'camera', label: 'מצלמה', render: (r) => html`${String(r.camera)}<div class="sub">${String(r.floor)}</div>` },
    { key: 'time', label: 'זמן', render: (r) => html`${String(r.time)}<div class="sub ltr">${String(r.source)}</div>` },
    { key: 'severity', label: 'חומרה', render: (r) => html`<sw-badge kind=${r.severity === 'critical' ? 'error' : r.severity === 'alert' ? 'stale' : 'neutral'} label=${{ info: 'מידע', alert: 'התראה', critical: 'קריטי' }[r.severity as DemoEvent['severity']]}></sw-badge>` },
    { key: 'more', label: '', width: '40px', render: () => html`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>` },
  ];

  private renderApi() {
    if (this.error && !this.events) return html`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.init()}></sw-state-panel>`;
    if (!this.events) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const ev = this.events.find((e) => e.id === this.selected) ?? null;
    const ing = this.ingest;
    const unacked = this.events.filter((e) => !e.acked_at).length;
    return html`
      <div class="banner ${ing && !ing.connected ? 'warn' : ''}">
        <span class="dot ${ing?.connected ? 'on' : ''}"></span>
        <span>קליטה מה־NVR: ${ing ? (ing.connected ? 'מחובר' : `מנותק${ing.last_error ? ` (${ing.last_error})` : ''}`) : '—'}${ing?.last_heartbeat_at ? ` · פעימה ${this.fmt(ing.last_heartbeat_at)}` : ''}</span>
        <span>· עדכונים חיים: ${this.live ? 'פעיל' : 'מתחבר…'}</span>
        <span>· אירועים "נגזר מהקלטה" הם עדות מקובץ ההקלטה (inferred), לא התראה שנמדדה</span>
      </div>
      <div class="filters">
        <sw-field><select aria-label="מצלמה" @change=${(e: Event) => { this.cameraId = (e.target as HTMLSelectElement).value; void this.load(); }}><option value="" ?selected=${!this.cameraId}>כל המצלמות</option>${(this.cams ?? []).map((c) => html`<option value=${c.id} ?selected=${c.id === this.cameraId}>${c.name}</option>`)}</select></sw-field>
        <sw-field><select aria-label="סוג" @change=${(e: Event) => { this.type = (e.target as HTMLSelectElement).value; void this.load(); }}><option value="" ?selected=${!this.type}>כל סוגי האירועים</option>${(Object.keys(EVENT_LABEL) as EventKind[]).map((t) => html`<option value=${t} ?selected=${t === this.type}>${EVENT_LABEL[t]}</option>`)}</select></sw-field>
        <sw-field><input type="date" .value=${this.date} max=${dateInZone(new Date(), this.tz)} data-ltr aria-label="תאריך" @change=${(e: Event) => { this.date = (e.target as HTMLInputElement).value; void this.load(); }} /></sw-field>
        <span class="grow"></span>
        <sw-chip ?selected=${this.filter === 'all'} @click=${() => { this.filter = 'all'; void this.load(); }} count=${this.events.length}>הכל</sw-chip>
        <sw-chip ?selected=${this.filter === 'unacked'} @click=${() => { this.filter = 'unacked'; void this.load(); }} count=${unacked}>לבדיקה</sw-chip>
        <sw-chip ?selected=${this.filter === 'acked'} @click=${() => { this.filter = 'acked'; void this.load(); }}>טופלו</sw-chip>
      </div>
      ${this.error ? html`<div class="banner warn">${this.error}</div>` : nothing}
      <div class="stage">
        ${this.events.length
          ? html`<sw-table .columns=${this.apiColumns} .rows=${this.events as unknown as Record<string, unknown>[]} .selected=${this.selected} @row-select=${(e: CustomEvent<{ id: string }>) => this.select(e.detail.id)}></sw-table>`
          : html`<sw-state-panel state="empty" heading="אין אירועים ביום הזה" hint="התראות מגיעות מה־NVR רק כשהטריגר מוגדר עם 'Notify Surveillance Center'; אירועי תנועה נגזרים מקובצי ההקלטה בהפעלה ובכל 10 דקות."></sw-state-panel>`}
        ${ev
          ? html`<sw-drawer open heading=${EVENT_LABEL[ev.type] ?? ev.type} subheading=${`${ev.camera_name ?? (ev.channel ? `ערוץ ${ev.channel}` : 'מערכת')} · ${this.fmt(ev.occurred_at)}`} @close=${() => this.closeDrawer()}>
              <div class="big">
                ${this.player?.eventId === ev.id && this.player.session
                  ? html`<sw-live-player .wsUrl=${playbackWsUrl(this.player.session)} mode="mse" .retry=${false}></sw-live-player>`
                  : ev.thumbnail === 'ready'
                    ? html`<img src=${thumbnailUrl(ev.id, this.thumbVersion.get(ev.id) ?? 0)} alt="תמונת האירוע מההקלטה" />`
                    : html`<div class="hint">${!ev.camera_id ? 'אירוע ללא מצלמה' : ev.thumbnail === 'unavailable' ? 'אין פריים זמין בהקלטה בזמן האירוע' : this.player?.eventId === ev.id ? 'פותח את ההקלטה…' : 'מכין תמונה מההקלטה…'}</div>`}
                ${this.player?.eventId === ev.id && this.player.error ? html`<div class="err">${this.player.error}</div>` : nothing}
              </div>
              <dl>
                <dt>מקור</dt><dd>${ev.source === 'alertstream' ? 'התראה מה־NVR (alertStream)' : ev.source === 'recording' ? 'קובץ הקלטה (חיפוש)' : 'מערכת'} · raw: <span class="ltr">${ev.raw_type}</span></dd>
                <dt>ודאות</dt><dd>${ev.confidence === 'measured' ? 'נמדד על ידי המכשיר' : 'נגזר (inferred)'}</dd>
                <dt>זמן אירוע</dt><dd><span class="ltr">${this.fmtDate(ev.occurred_at)} ${this.fmt(ev.occurred_at)}</span>${ev.ended_at ? html` → <span class="ltr">${this.fmt(ev.ended_at)}</span>` : nothing} · נקלט <span class="ltr">${this.fmt(ev.received_at)}</span>${typeof ev.details.time_precision === 'string' ? html` · דיוק: ${String(ev.details.time_precision)}` : nothing}</dd>
                <dt>חזרות</dt><dd>${ev.count} · מצב ${ev.state === 'active' ? 'פעיל' : ev.state === 'inactive' ? 'הסתיים' : '—'}</dd>
                <dt>טיפול</dt><dd>${ev.acked_at ? `טופל בידי ${ev.acked_by_username ?? ''} · ${this.fmt(ev.acked_at)}` : 'ממתין'}</dd>
                ${typeof ev.details.description === 'string' && ev.details.description ? html`<dt>תיאור</dt><dd class="ltr">${String(ev.details.description)}</dd>` : nothing}
                ${typeof ev.details.seconds === 'number' ? html`<dt>משך ההקלטה</dt><dd>${String(ev.details.seconds)} שנ׳</dd>` : nothing}
              </dl>
              <div slot="footer">
                <sw-button variant="primary" size="sm" icon="expand" data-review @click=${() => navigate(`/investigate/events/${ev.id}`)}>סקירה מלאה</sw-button>
                ${ev.camera_id ? html`<sw-button size="sm" icon="play" @click=${() => this.play(ev)}>${this.player?.eventId === ev.id ? 'עצור' : 'נגן כאן'}</sw-button>
                    <sw-button size="sm" icon="history" @click=${() => navigate('/investigate/playback', { camera: ev.camera_id!, t: ev.occurred_at })}>להקלטה</sw-button>` : nothing}
                <sw-button variant="ghost" size="sm" icon="check" ?disabled=${!!ev.acked_at || this.busy} @click=${() => this.ack(ev)}>סמן טופל</sw-button>
              </div>
            </sw-drawer>`
          : nothing}
      </div>
    `;
  }

  private renderDemo() {
    const rows = demoEvents.filter((e) => this.filter === 'all' || !e.acked);
    const ev = demoEvents.find((e) => e.id === this.selected);
    return html`
      <div class="filters">
        <sw-field><select aria-label="אתר"><option>כל האתרים</option><option>אתר הדגמה</option></select></sw-field>
        <sw-field><select aria-label="מצלמה"><option>כל המצלמות</option></select></sw-field>
        <sw-field><select aria-label="סוג"><option>כל סוגי האירועים</option><option>אדם</option><option>רכב</option><option>תנועה</option><option>ניתוק</option></select></sw-field>
        <sw-field><input type="date" value="2026-09-14" data-ltr aria-label="תאריך" /></sw-field>
        <span class="grow"></span>
        <sw-chip ?selected=${this.filter === 'all'} @click=${() => (this.filter = 'all')} count=${demoEvents.length}>הכל</sw-chip>
        <sw-chip ?selected=${this.filter === 'unacked'} @click=${() => (this.filter = 'unacked')} count=${demoEvents.filter((e) => !e.acked).length}>ללא טיפול</sw-chip>
      </div>
      <div class="stage">
        <sw-table .columns=${this.columns} .rows=${rows} .selected=${this.selected} @row-select=${(e: CustomEvent<{ id: string }>) => (this.selected = e.detail.id)}></sw-table>
        ${ev
          ? html`<sw-drawer open heading=${eventTypeLabel[ev.type]} subheading=${`${ev.camera} · ${ev.time}`} @close=${() => (this.selected = null)}>
              <div class="preview">${ev.type === 'offline' || ev.type === 'door' ? 'אין תמונה לאירוע זה' : html`<sw-scene kind=${(SCENE[ev.camera] ?? 'lobby') as 'lobby'}></sw-scene><span class="demo">דמו · תמונת אירוע מה־NVR (T044)</span>`}</div>
              <dl>
                <dt>מקור</dt><dd><span class="ltr">${ev.source}</span> · raw: <span class="ltr">${ev.type}</span></dd>
                <dt>זמן אירוע</dt><dd>${ev.time} · נקלט +1.2s</dd>
                <dt>קומה</dt><dd>${ev.floor}</dd>
                <dt>כיסוי הקלטה</dt><dd>${ev.type === 'offline' ? 'אין' : 'קיים · 10 שנ׳ לפני/אחרי'}</dd>
                <dt>טיפול</dt><dd>${ev.acked ? 'טופל בידי יוני, 09:50' : 'ממתין'}</dd>
              </dl>
              <div slot="footer">
                <a href="#/investigate/playback"><sw-button variant="primary" size="sm" icon="history">להקלטה</sw-button></a>
                <a href="#/investigate/floors/f0/history"><sw-button size="sm" icon="map">במפה</sw-button></a>
                <sw-button variant="ghost" size="sm" icon="check" ?disabled=${ev.acked}>סמן טופל</sw-button>
              </div>
            </sw-drawer>`
          : ''}
      </div>
    `;
  }

  render() {
    const api = isApi();
    return html`
      <sw-page heading="מרכז אירועים" subheading=${api ? `חיפוש, סינון וסקירה · מקור, ודאות וזמן קליטה נשמרים · אזור זמן ${this.tz}` : 'חיפוש, סינון וסקירה של כל האירועים · מקור וזמן קליטה נשמרים · נתוני הדגמה'}>
        ${api ? nothing : html`<sw-button slot="actions" icon="download">ייצוא</sw-button>`}
        ${api ? this.renderApi() : this.renderDemo()}
      </sw-page>
    `;
  }
}
