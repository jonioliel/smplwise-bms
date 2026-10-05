import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import '../components/sw-camera-tile';
import '../components/sw-icon';
import { ApiError } from '../api/client';
import { healthSummary } from '../api/health';
import { effectiveTransport, productSettings } from '../api/prefs';
import { loadSession, session } from '../api/session';
import type { ProductSettings } from '../api/media';
import { getWallConfig, getWallStates, wallSocketUrl, type WallDisplayConfig, type WallState } from '../api/wall';
import { classifyDevice, readDeviceEnv } from './device-class';
import { isAwake, pageCameras, pixelShift, reconnectDelayMs, resolveLayout, serverHealth, tileHealth, wallScale } from './wall-logic';

type Phase = 'loading' | 'ready' | 'removed' | 'remote-refused' | 'no-connection';
const RETRY_BACKOFF_S = [2, 4, 8, 15];

/**
 * CR-030 section 4: the wall display. Mounted by the shell INSTEAD of the application when an enabled wall user signs in
 * on a tablet-class device (device-class.ts). No rail, no router, no user menu: the only interactive element is a
 * long-press (1.2 s) on the clock that shows the read-only installer panel for 10 s. Control is impossible by design
 * (the `kiosk` role is live video and map only).
 * Built here: layout presets, strip, page rotation, pixel shift / shuffle / dim, schedule sleep, camera and server
 * offline ladders, live configuration over the websocket. Not built here (WDX): alert tiles, picture frame.
 */
@customElement('sw-wall')
export class SwWall extends LitElement {
  @state() private phase: Phase = 'loading';
  @state() private data: WallDisplayConfig | null = null;
  @state() private states: WallState[] = [];
  @state() private healthOk: boolean | null = null;
  @state() private now = Date.now();
  @state() private vw = window.innerWidth;
  @state() private vh = window.innerHeight;
  @state() private panel = false;
  @state() private updated = false;
  @state() private touchedAt = Date.now();
  @state() private wakeUntil = 0;
  @state() private tick = 0;
  private settings: ProductSettings | null = null;
  private ws: WebSocket | null = null;
  private downSince: number | null = null;
  private timer = 0;
  private retry = 0;
  private longPress = 0;
  private panelTimer = 0;
  private updatedTimer = 0;
  private lastStates = 0;
  private lastHealth = 0;
  private ok = new Map<string, boolean>();
  private drop = new Map<string, number>();
  private epoch = new Map<string, number>();
  private tries = new Map<string, number>();
  private nextTry = new Map<string, number>();
  private readonly env = readDeviceEnv();
  private readonly onResize = () => {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
  };
  private readonly onTouch = () => {
    this.touchedAt = Date.now();
    if (this.data?.config.schedule.wake_on_touch) this.wakeUntil = Date.now() + 10 * 60_000;
  };

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      display: block;
      direction: rtl;
      background: var(--wall-bg, #05070c);
      color: var(--wall-text, #f3f6fc);
      font-family: var(--sw-font, 'Heebo', 'Segoe UI', sans-serif);
      overflow: hidden;
      --wall-tile: #060912;
      --wall-tile-border: rgba(255, 255, 255, 0.08);
      --wall-strip: rgba(255, 255, 255, 0.06);
      --wall-text-2: rgba(243, 246, 252, 0.72);
    }
    :host([data-wall-theme='light']) {
      --wall-bg: #dfe5f0;
      --wall-text: #1e2e47;
      --wall-text-2: #5b6a85;
      --wall-strip: rgba(255, 255, 255, 0.85);
    }
    :host(:not([data-wall-theme='light'])) {
      --wall-bg: #05070c;
    }
    .wall {
      position: absolute;
      inset: 0;
      display: grid;
      padding: var(--pad);
      gap: var(--gap);
      --pad: calc(14px * var(--s, 1));
      --gap: calc(10px * var(--s, 1));
      --strip-h: calc(56px * var(--s, 1));
      --chip-h: calc(40px * var(--s, 1));
      grid-template-rows: var(--strip-h) minmax(0, 1fr);
      transition: opacity 0.6s;
    }
    .wall[data-preset='tablet-portrait'] {
      grid-template-rows: var(--strip-h) minmax(0, 1fr) auto;
    }
    .wall[data-preset='single'] {
      grid-template-rows: minmax(0, 1fr);
    }
    .wall[data-preset='single'] .strip {
      position: absolute;
      inset: var(--pad) var(--pad) auto;
      z-index: 2;
      background: linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0));
      color: #f3f6fc;
    }
    .strip {
      display: flex;
      align-items: center;
      gap: var(--gap);
      block-size: var(--strip-h);
      padding: 0 calc(var(--pad) * 0.5);
      background: var(--wall-strip);
      border-radius: var(--sw-r-md, 12px);
    }
    :host-context(html[data-skin='bubble']) .strip {
      border-radius: var(--sw-r-pill, 999px);
    }
    .place {
      font-size: calc(17px * var(--s, 1));
      font-weight: 600;
      white-space: nowrap;
    }
    .clock {
      margin-inline: auto;
      display: flex;
      align-items: baseline;
      gap: 10px;
      font-size: calc(30px * var(--s, 1));
      font-weight: 700;
      letter-spacing: 0.02em;
      font-variant-numeric: tabular-nums;
      user-select: none;
      touch-action: manipulation;
    }
    .clock .date {
      font-size: calc(13px * var(--s, 1));
      font-weight: 400;
      color: var(--wall-text-2);
    }
    .dim .clock {
      -webkit-text-stroke: 1px currentColor;
      color: transparent;
    }
    .chips {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      block-size: var(--chip-h);
      padding: 0 12px;
      border-radius: var(--sw-r-pill, 999px);
      background: rgba(127, 140, 170, 0.18);
      font-size: calc(15px * var(--s, 1));
      white-space: nowrap;
    }
    .chip i {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: var(--sw-live, #3ddc84);
    }
    .chip[data-tone='stale'] i {
      background: var(--sw-stale, #f5b043);
    }
    .chip[data-tone='danger'] {
      background: rgba(255, 107, 98, 0.2);
      color: #ffb3ad;
    }
    .chip[data-tone='danger'] i {
      background: var(--sw-danger, #ff6b62);
    }
    .grid {
      display: grid;
      gap: var(--gap);
      min-block-size: 0;
      grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr));
      grid-template-rows: repeat(var(--rows, 2), minmax(0, 1fr));
    }
    .wall[data-preset='tablet-portrait'] .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .tile {
      position: relative;
      background: var(--wall-tile);
      border: 1px solid var(--wall-tile-border);
      border-radius: var(--sw-r-md, 12px);
      overflow: hidden;
      min-block-size: 0;
      direction: ltr;
    }
    .tile sw-camera-tile {
      position: absolute;
      inset: 0;
      display: block;
    }
    .tile[data-health='stale'] sw-camera-tile {
      filter: brightness(0.55) saturate(0.7);
    }
    .tile[data-health='stale']::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(135deg, rgba(0, 0, 0, 0.28) 0 6px, transparent 6px 14px);
      pointer-events: none;
    }
    .tile[data-health='lost'] sw-camera-tile {
      visibility: hidden;
    }
    .badge,
    .lost {
      position: absolute;
      z-index: 1;
      font-size: calc(14px * var(--s, 1));
      direction: rtl;
    }
    .badge {
      inset-block-start: 8px;
      inset-inline-start: 8px;
      padding: 4px 10px;
      border-radius: var(--sw-r-pill, 999px);
      background: rgba(245, 176, 67, 0.25);
      color: #ffd08a;
    }
    .lost {
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      gap: 6px;
      font-size: calc(18px * var(--s, 1));
      color: var(--wall-text-2);
    }
    .banner {
      background: rgba(255, 107, 98, 0.2);
      color: #ffb3ad;
      padding: 0 14px;
      border-radius: var(--sw-r-pill, 999px);
      block-size: var(--chip-h);
      display: inline-flex;
      align-items: center;
      font-size: calc(15px * var(--s, 1));
    }
    .band {
      display: flex;
      gap: var(--gap);
      flex-wrap: wrap;
      align-items: center;
      padding: calc(6px * var(--s, 1)) 0;
    }
    .dots {
      position: absolute;
      inset-block-end: calc(6px * var(--s, 1));
      inset-inline: 0;
      display: flex;
      justify-content: center;
      gap: 8px;
      pointer-events: none;
    }
    .dots i {
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.35);
    }
    .dots i[data-on] {
      background: #fff;
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      gap: 10px;
      padding: 24px;
    }
    .center h1 {
      margin: 0;
      font-size: calc(26px * var(--s, 1));
    }
    .center p {
      margin: 0;
      color: var(--wall-text-2);
      font-size: calc(16px * var(--s, 1));
    }
    .empty {
      display: grid;
      place-content: center;
      text-align: center;
      color: var(--wall-text-2);
      font-size: calc(18px * var(--s, 1));
    }
    .sleep .bigclock {
      position: absolute;
      font-size: calc(64px * var(--s, 1));
      font-weight: 700;
      opacity: 0.2;
      font-variant-numeric: tabular-nums;
      transition: inset 1s;
    }
    .panel {
      position: absolute;
      inset-block-start: calc(var(--pad) + var(--strip-h) + 6px);
      inset-inline-start: 50%;
      transform: translateX(50%);
      z-index: 5;
      min-inline-size: 320px;
      padding: 14px 18px;
      border-radius: var(--sw-r-md, 12px);
      background: rgba(20, 24, 38, 0.96);
      color: #f3f6fc;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55);
      font-size: calc(15px * var(--s, 1));
    }
    .panel dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 16px;
      margin: 0;
    }
    .panel dt {
      color: rgba(243, 246, 252, 0.7);
    }
    .panel dd {
      margin: 0;
      direction: ltr;
      text-align: end;
    }
    .updated {
      position: absolute;
      inset-block-end: calc(var(--pad) + 4px);
      inset-inline-start: 50%;
      transform: translateX(50%);
      z-index: 4;
    }
    @media (prefers-reduced-motion: reduce) {
      * {
        transition: none !important;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    this.addEventListener('pointerdown', this.onTouch);
    this.timer = window.setInterval(() => this.onTick(), 1000);
    void productSettings().then((s) => (this.settings = s)).catch(() => undefined);
    void this.load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    this.removeEventListener('pointerdown', this.onTouch);
    window.clearInterval(this.timer);
    window.clearTimeout(this.retry);
    window.clearTimeout(this.longPress);
    window.clearTimeout(this.panelTimer);
    window.clearTimeout(this.updatedTimer);
    this.closeSocket();
  }

  // ---- data
  private async load(): Promise<void> {
    try {
      const cfg = await getWallConfig();
      const first = !this.data;
      this.data = cfg;
      this.phase = 'ready';
      this.downSince = null;
      if (!first) this.flashUpdated();
      this.openSocket();
      void this.refreshStates(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        this.phase = 'removed';
        return;
      }
      if (err instanceof ApiError && err.status === 403) {
        if (err.body.code === 'wall_user_remote_not_allowed') this.phase = 'remote-refused';
        else void loadSession(); // wall mode is off or removed: the shell drops to the normal limited application
        return;
      }
      this.downSince ??= Date.now();
      if (!this.data) this.phase = 'no-connection';
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    window.clearTimeout(this.retry);
    this.retry = window.setTimeout(() => void this.load(), reconnectDelayMs(this.downSince ? Date.now() - this.downSince : 0));
  }

  private openSocket(): void {
    if (this.ws && this.ws.readyState <= 1) return;
    try {
      const ws = new WebSocket(wallSocketUrl());
      this.ws = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', payload: { class: classifyDevice(this.env), screen: `${this.env.screenWidth}x${this.env.screenHeight}` } }));
      ws.onmessage = (m) => {
        try {
          const msg = JSON.parse(String(m.data)) as { type: string; payload?: { version?: number } };
          if (msg.type === 'config' && msg.payload?.version !== this.data?.version) void this.load();
          else if (msg.type === 'disabled') void loadSession();
          else if (msg.type === 'revoked') this.phase = 'removed';
          else if (msg.type === 'hello') this.downSince = null;
        } catch {
          /* a frame we do not know */
        }
      };
      ws.onclose = (ev) => {
        this.ws = null;
        if (ev.code === 4401 && this.phase === 'ready') {
          void this.load(); // a 401 on the next request decides: removed, or an expired session
          return;
        }
        this.downSince ??= Date.now();
        this.scheduleRetry();
      };
    } catch {
      this.downSince ??= Date.now();
    }
  }

  private closeSocket(): void {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  }

  private flashUpdated(): void {
    this.updated = true;
    window.clearTimeout(this.updatedTimer);
    this.updatedTimer = window.setTimeout(() => (this.updated = false), 3000);
  }

  private async refreshStates(force = false): Promise<void> {
    const ids = this.data?.config.state_entities ?? [];
    const now = Date.now();
    if (ids.length && (force || now - this.lastStates > 30_000)) {
      this.lastStates = now;
      try {
        this.states = (await getWallStates(ids)).states;
      } catch {
        /* the chips keep their last value until the next poll */
      }
    }
    if (force || now - this.lastHealth > 60_000) {
      this.lastHealth = now;
      try {
        this.healthOk = (await healthSummary()).status === 'ok';
      } catch {
        this.healthOk = null;
      }
    }
  }

  // ---- time
  private onTick(): void {
    this.now = Date.now();
    this.tick += 1;
    if (this.phase !== 'ready' || !this.data) return;
    const cfg = this.data.config;
    for (const [id, ok] of this.ok) {
      if (ok) continue;
      const due = this.nextTry.get(id) ?? 0;
      if (this.now >= due) {
        const n = this.tries.get(id) ?? 0;
        this.epoch.set(id, (this.epoch.get(id) ?? 0) + 1);
        this.tries.set(id, n + 1);
        this.nextTry.set(id, this.now + RETRY_BACKOFF_S[Math.min(n, RETRY_BACKOFF_S.length - 1)] * 1000);
      }
    }
    void this.refreshStates();
    const w = cfg.schedule.windows;
    if (w.length) this.emitSleepState(!this.awake());
  }

  private lastEmit = '';
  private emitSleepState(asleep: boolean): void {
    const s = asleep ? 'sleep' : 'wake';
    if (s === this.lastEmit) return;
    this.lastEmit = s;
    document.title = asleep ? 'SmplWise Arx - sleep' : 'SmplWise Arx';
    try {
      window.parent.postMessage({ type: 'arx-wall', state: s }, '*');
    } catch {
      /* no parent */
    }
  }

  private awake(): boolean {
    if (!this.data) return true;
    if (this.now < this.wakeUntil) return true;
    return isAwake(this.data.config.schedule.windows, this.data.zone, new Date(this.now));
  }

  private onPlayer(id: string, e: CustomEvent<{ status?: string }>): void {
    const status = e.detail?.status;
    if (status === 'playing') {
      this.ok.set(id, true);
      this.drop.delete(id);
      this.tries.set(id, 0);
      this.nextTry.delete(id);
    } else if (status === 'error' || status === 'ended') {
      if (this.ok.get(id) !== false) this.drop.set(id, Date.now());
      this.ok.set(id, false);
    }
    this.requestUpdate();
  }

  private pressStart = (): void => {
    window.clearTimeout(this.longPress);
    this.longPress = window.setTimeout(() => {
      this.panel = true;
      window.clearTimeout(this.panelTimer);
      this.panelTimer = window.setTimeout(() => (this.panel = false), 10_000);
    }, 1200);
  };
  private pressEnd = (): void => window.clearTimeout(this.longPress);

  // ---- render
  private clockParts(): { time: string; date: string } {
    const zone = this.data?.zone || 'Asia/Jerusalem';
    const d = new Date(this.now);
    try {
      return {
        time: new Intl.DateTimeFormat('he-IL', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d),
        date: new Intl.DateTimeFormat('he-IL', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long' }).format(d),
      };
    } catch {
      return { time: d.toTimeString().slice(0, 5), date: '' };
    }
  }

  private hhmmss(ms: number): string {
    return new Date(ms).toTimeString().slice(0, 8);
  }

  protected render() {
    if (this.phase === 'loading') return html`<div class="center" data-wall-state="loading"><p>טוען…</p></div>`;
    if (this.phase === 'no-connection') return html`<div class="center" data-wall-state="no-connection"><h1>אין חיבור לשרת</h1><p>מנסה שוב אוטומטית</p></div>`;
    if (this.phase === 'removed') return html`<div class="center" data-wall-state="access-removed"><h1>הגישה למסך הזה הוסרה</h1><p>יש להתחבר מחדש עם משתמש מסך קיר</p></div>`;
    if (this.phase === 'remote-refused') return html`<div class="center" data-wall-state="remote-refused"><h1>המסך הזה אינו מורשה להתחבר מרחוק</h1><p>יש להתחבר מהרשת המקומית, או לאפשר גישה מרחוק בהגדרות מסכי קיר</p></div>`;
    const data = this.data;
    if (!data) return nothing;
    const cfg = data.config;
    const scale = wallScale(this.env.screenWidth, this.env.screenHeight);
    this.setAttribute('data-wall-theme', cfg.theme === 'light' ? 'light' : 'dark');
    const clock = this.clockParts();
    const asleep = !this.awake();
    if (asleep) {
      const [x, y] = [10 + ((this.now / 60000) % 60) * 1.3, 15 + ((this.now / 90000) % 60) * 1.2];
      return html`<div class="wall sleep" data-wall-state="sleep" style=${`--s:${scale};display:block`}><div class="bigclock" style=${`inset-inline-start:${x}%;inset-block-start:${y}%`}>${clock.time}</div></div>`;
    }
    const layout = resolveLayout({ layout: cfg.layout, grid: cfg.grid, cameras: data.cameras.length, viewportW: this.vw, viewportH: this.vh, showMap: cfg.show_map, rotateS: cfg.rotate_s });
    const page = layout.rotateS > 0 ? Math.floor(this.now / (layout.rotateS * 1000)) % layout.pages : 0;
    const shuffle = cfg.burn_in.shuffle_h > 0 && data.cameras.length > 1 && layout.preset !== 'single' ? Math.floor(this.now / (cfg.burn_in.shuffle_h * 3_600_000)) : 0;
    const cams = pageCameras(data.cameras, page, layout.perPage, shuffle);
    const [dx, dy] = pixelShift(this.now, cfg.burn_in.shift);
    const idleMin = (this.now - this.touchedAt) / 60_000;
    const dim = cfg.burn_in.dim_after_min > 0 && idleMin >= cfg.burn_in.dim_after_min;
    const down = serverHealth(this.downSince, this.now);
    if (down === 'clock') {
      return html`<div class="wall sleep" data-wall-state="server-offline-clock" style=${`--s:${scale};display:block`}><div class="bigclock" style="inset-inline-start:30%;inset-block-start:30%;opacity:.5">${clock.time}</div><div class="banner" style="position:absolute;inset-block-end:24px;inset-inline-start:24px">אין חיבור למערכת · מנסה שוב</div></div>`;
    }
    const transport = effectiveTransport(this.settings);
    const chips = (cfg.strip.includes('health') ? [this.healthChip()] : []).concat(this.states.map((s) => html`<span class="chip" data-chip=${s.id}>${s.name} <b>${s.state ?? ''}${s.unit ? ` ${s.unit}` : ''}</b></span>`));
    const stripEl = html`<div class="strip" data-wall-strip>
      <span class="place" data-wall-title>${data.title}</span>
      ${cfg.strip.includes('clock')
        ? html`<span class="clock" data-wall-clock @pointerdown=${this.pressStart} @pointerup=${this.pressEnd} @pointerleave=${this.pressEnd} @pointercancel=${this.pressEnd}>${clock.time}${cfg.strip.includes('date') && clock.date ? html`<span class="date">${clock.date}</span>` : nothing}</span>`
        : html`<span style="margin-inline:auto"></span>`}
      <span class="chips">${down === 'banner' ? html`<span class="banner" data-wall-banner>אין חיבור למערכת · מנסה שוב</span>` : chips}</span>
    </div>`;
    return html`<div class=${`wall ${dim ? 'dim' : ''}`} data-wall-state="base" data-preset=${layout.preset} data-wall-class=${classifyDevice(this.env)} style=${`--s:${scale};--cols:${layout.cols};--rows:${layout.rows};transform:translate(${dx}px,${dy}px);opacity:${dim ? cfg.burn_in.dim_to : 1}`}>
      ${stripEl}
      ${cams.length
        ? html`<div class="grid" data-wall-grid>${cams.map((c) => this.renderTile(c, transport, cfg.offline.show_last_frame_s))}${layout.pages > 1 ? html`<div class="dots" data-wall-dots>${Array.from({ length: layout.pages }, (_, i) => html`<i ?data-on=${i === page}></i>`)}</div>` : nothing}</div>`
        : html`<div class="empty" data-wall-state="no-cameras">לא הוגדרו מצלמות למסך הזה</div>`}
      ${layout.preset === 'tablet-portrait' ? html`<div class="band" data-wall-band>${chips}</div>` : nothing}
      ${this.panel ? this.renderPanel(data) : nothing}
      ${this.updated ? html`<span class="chip updated" data-wall-updated>ההגדרות עודכנו</span>` : nothing}
    </div>`;
  }

  private healthChip() {
    if (this.healthOk === null) return html`<span class="chip" data-tone="stale" data-wall-health><i></i>מצב המערכת</span>`;
    return this.healthOk ? html`<span class="chip" data-tone="live" data-wall-health><i></i>המערכת תקינה</span>` : html`<span class="chip" data-tone="stale" data-wall-health><i></i>יש תקלות</span>`;
  }

  private renderTile(c: { id: string; name: string }, transport: ReturnType<typeof effectiveTransport>, showLastFrameS: number) {
    const ok = this.ok.get(c.id);
    const drop = this.drop.get(c.id) ?? null;
    const health = ok === false ? tileHealth(drop, this.now, 0, showLastFrameS) : 'live';
    return html`<div class="tile" data-wall-tile=${c.id} data-health=${health} @player-status=${(e: CustomEvent<{ status?: string }>) => this.onPlayer(c.id, e)}>
      ${keyed(`${c.id}:${this.epoch.get(c.id) ?? 0}`, html`<sw-camera-tile dark noDemo name=${c.name} state=${health === 'live' ? 'live' : 'stale'} ?live=${health !== 'lost'} cameraId=${c.id} profile="sub" transport=${transport}></sw-camera-tile>`)}
      ${health === 'stale' ? html`<span class="badge" data-wall-badge>אין וידאו${drop ? ` · ${this.hhmmss(drop)}` : ''}</span>` : nothing}
      ${health === 'lost' ? html`<div class="lost" data-wall-lost><b>${c.name}</b><span>אין וידאו</span></div>` : nothing}
    </div>`;
  }

  private renderPanel(data: WallDisplayConfig) {
    const me = session.me;
    const cls = classifyDevice(this.env);
    return html`<div class="panel" data-wall-panel role="status"><dl>
      <dt>משתמש</dt><dd>${me?.user.username ?? ''}</dd>
      <dt>מסך</dt><dd>${data.title}</dd>
      <dt>סוג מכשיר</dt><dd>${cls} · ${this.env.screenWidth}x${this.env.screenHeight}</dd>
      <dt>ערוץ</dt><dd>${me?.channel ?? 'local'}</dd>
      <dt>חיבור</dt><dd>${this.downSince ? 'מנותק' : 'מחובר'}</dd>
      <dt>גרסת הגדרות</dt><dd>${data.version}</dd>
    </dl></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-wall': SwWall;
  }
}
