import { LitElement, html, css, nothing, svg } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-camera-tile';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-card';
import '../components/sw-icon';
import '../components/sw-chip';
import '../components/sw-scene';
import '../components/sw-live-player';
import '../components/sw-state-panel';
import type { SwLivePlayer } from '../components/sw-live-player';
import { demoScene, demoWall } from '../fixtures/catalog';
import { navigate } from '../router';
import { setMotion } from '../api/nvr';
import '../components/sw-dialog';
import { isApi } from '../api/session';
import { cameraCapabilities, cameraZones, snapshotUrl, setTransportOverride, transportOverride, type CameraCapabilities, type CameraZones, type ProductSettings, type Transport } from '../api/media';
import '../components/sw-chip';
import { listCameras } from '../api/maps';
import { effectiveTransport, productSettings } from '../api/prefs';
import { describeError } from '../api/client';
import type { Camera } from '../api/types';

/**
 * SC08 — live camera view (board 1 screen 5). With a backend: real stream through the relay
 * (WebRTC → MSE), snapshot poster, transport override, fullscreen, audio only when the camera has it.
 * Without a backend: illustrated demo. Unsupported controls are hidden or explained, never simulated.
 */
@customElement('live-camera')
export class LiveCamera extends LitElement {
  @property() cameraId = 'cam-1';
  @state() private cam: Camera | null = null;
  /** T075: the NVR's detection configuration for this camera (read-only), drawn over the snapshot. */
  @state() private zones: CameraZones | null = null;
  @state() private zonesBusy = false;
  @state() private zonesError = '';
  /** B2 (0.1.65): editing the motion grid - a working copy of the cells, the sensitivity and the enabled flag. */
  @state() private motionEdit: { cells: boolean[][]; sensitivity: number; enabled: boolean } | null = null;
  @state() private motionConfirm = false;
  @state() private motionBusy = false;
  @state() private motionMsg = '';
  private paintValue: boolean | null = null;
  @state() private zoneLayers = { motion: true, privacy: true, intrusion: true, lines: true };
  /** T045 / T012: capability facts from the NVR (PTZ, presets, two-way audio), read-only. */
  @state() private caps: CameraCapabilities | null = null;
  @state() private capsError = '';
  @state() private cams: Camera[] = [];
  @state() private settings: ProductSettings | null = null;
  @state() private error = '';
  @state() private loading = true;
  @state() private profile: 'main' | 'sub' = 'main';
  @state() private transport: Transport = 'auto';
  @state() private playerStatus = '';
  @state() private playerTransport = '';
  @state() private posterBust = Date.now();
  @state() private ptzMode: 'presets' | 'track' | 'patrol' = 'presets';
  @query('sw-live-player') private player?: SwLivePlayer;

  static styles = css`
    .video {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      background: #0f1729;
      color: #fff;
      box-shadow: var(--sw-shadow-2);
    }
    .video sw-scene,
    .video sw-live-player {
      position: absolute;
      inset: 0;
    }
    .video.off {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      box-shadow: none;
      border: 1px solid var(--sw-border);
    }
    .shade {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 65%, rgba(0, 0, 0, 0.45) 100%);
      pointer-events: none;
    }
    .demo {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 10px;
      font-size: 10px;
      letter-spacing: 0.04em;
      background: rgba(17, 24, 39, 0.55);
      color: #fff;
      border-radius: 4px;
      padding: 2px 7px;
      z-index: 2;
    }
    .stamp {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 10px;
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      color: rgba(255, 255, 255, 0.92);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .quality {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-end: 10px;
      font-size: var(--sw-fs-xs);
      color: rgba(255, 255, 255, 0.92);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      direction: ltr;
      z-index: 2;
    }
    .center {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      text-align: center;
      font-size: var(--sw-fs-sm);
    }
    .center > div {
      display: grid;
      justify-items: center;
      gap: 6px;
    }
    .controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-block-start: 12px;
    }
    .round {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .round button {
      inline-size: 38px;
      block-size: 38px;
      border-radius: 50%;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
    }
    .round button:hover {
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    .round button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .round .q {
      inline-size: auto;
      border-radius: var(--sw-r-pill);
      padding-inline: 10px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      block-size: 30px;
    }
    .round .q.on {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: #fff;
    }
    .transport {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: 8px;
      padding: 2px;
    }
    .round .transport button {
      display: inline-block;
      inline-size: auto;
      block-size: 26px;
      border: 0;
      background: transparent;
      box-shadow: none;
      font: inherit;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      padding: 0 9px;
      border-radius: 6px;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .round .transport button.on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    .ptz {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .joy {
      position: relative;
      inline-size: 64px;
      block-size: 64px;
      border-radius: 50%;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      box-shadow: var(--sw-shadow-1);
    }
    .joy button {
      position: absolute;
      inline-size: 20px;
      block-size: 20px;
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      cursor: pointer;
      border-radius: 50%;
    }
    .joy .u {
      inset-block-start: 3px;
      inset-inline-start: 22px;
    }
    .joy .d {
      inset-block-end: 3px;
      inset-inline-start: 22px;
    }
    .joy .l {
      inset-inline-start: 3px;
      inset-block-start: 22px;
    }
    .joy .r {
      inset-inline-end: 3px;
      inset-block-start: 22px;
    }
    .joy .c {
      inset-inline-start: 26px;
      inset-block-start: 26px;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      background: var(--sw-accent);
    }
    .zoom {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .zoom button {
      inline-size: 28px;
      block-size: 28px;
      border-radius: 8px;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      display: grid;
      place-items: center;
      cursor: pointer;
    }
    .modes {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-block-start: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
      margin-block-start: 12px;
      align-items: start;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 14px;
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
    .tiles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('cameraId') && changed.get('cameraId') !== undefined) void this.load();
    if (changed.has('cam') && this.cam && isApi() && !this.zonesBusy && (!this.zones || this.zones.camera_id !== this.cam.id)) {
      this.zonesError = '';
      void this.loadZones();
    }
    if (changed.has('cam') && this.cam && isApi() && (!this.caps || this.caps.camera_id !== this.cam.id)) void this.loadCaps();
  }

  private async loadZones(refresh = false) {
    if (!this.cam) return;
    this.zonesBusy = true;
    this.zonesError = '';
    try {
      this.zones = await cameraZones(this.cam.id, refresh);
    } catch (err) {
      this.zonesError = describeError(err);
    } finally {
      this.zonesBusy = false;
    }
  }

  private async loadCaps(refresh = false) {
    if (!this.cam) return;
    this.capsError = '';
    try {
      this.caps = await cameraCapabilities(this.cam.id, refresh);
    } catch (err) {
      this.capsError = describeError(err);
    }
  }

  private renderCaps() {
    const c = this.caps;
    if (this.capsError && !c) return html`<div class="note" data-caps>יכולות המצלמה לא נקראו מה־NVR: ${this.capsError}</div>`;
    if (!c) return html`<div class="note" data-caps>קורא יכולות מה־NVR…</div>`;
    const ptzKind = c.ptz.state === 'supported' ? 'live' : c.ptz.state === 'unsupported' ? 'neutral' : 'unknown';
    const ptzLabel = c.ptz.state === 'supported' ? `PTZ: נתמך${c.ptz.preset_count !== null ? ` · ${c.ptz.preset_count} presets` : ''}` : c.ptz.state === 'unsupported' ? 'PTZ: לא נתמך במצלמה זו' : 'PTZ: לא ידוע';
    const audioKind = c.audio.state === 'available' ? 'live' : c.audio.state === 'disabled' ? 'stale' : c.audio.state === 'unsupported' ? 'neutral' : 'unknown';
    const audioLabel = c.audio.state === 'available' ? `שמע דו־כיווני: ערוץ פעיל${c.audio.codec ? ` (${c.audio.codec})` : ''}` : c.audio.state === 'disabled' ? 'שמע דו־כיווני: ערוץ קיים אך כבוי במכשיר' : c.audio.state === 'unsupported' ? 'שמע דו־כיווני: אין ערוץ למצלמה זו' : 'שמע דו־כיווני: לא ידוע';
    return html`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center" data-caps data-ptz=${c.ptz.state} data-audio=${c.audio.state}>
      <sw-badge kind=${ptzKind} label=${ptzLabel} title=${c.ptz.reason ?? ''}></sw-badge>
      <sw-badge kind=${audioKind} label=${audioLabel} title=${c.audio.reason ?? ''}></sw-badge>
      <sw-badge kind="neutral" label="זום דיגיטלי: הגדלה בדפדפן בלבד, לא הנעת מצלמה"></sw-badge>
      <span>${c.ptz.reason ? `PTZ לפי המכשיר: ${c.ptz.reason}. ` : ''}הנעת PTZ, קריאת preset ודיבור הם כתיבה למכשיר ואינם מוצעים בפיילוט ללא אישור מפורש — אין פקד מדומה. נקרא מה־NVR ${c.fetched_at.replace('T', ' ').replace('Z', ' UTC')}${c.cached ? ' (מהמטמון)' : ''}.</span>
    </div>`;
  }

  private startMotionEdit() {
    const m = this.zones?.motion;
    if (!m || !m.rows || !m.cols) return;
    this.motionMsg = '';
    this.motionEdit = { cells: m.cells.map((r) => [...r]), sensitivity: m.sensitivity ?? 50, enabled: m.enabled };
  }

  private paintCell(r: number, c: number, start = false) {
    const e = this.motionEdit;
    if (!e) return;
    if (start) this.paintValue = !e.cells[r][c];
    if (this.paintValue === null) return;
    if (e.cells[r][c] === this.paintValue) return;
    const cells = e.cells.map((row) => [...row]);
    cells[r][c] = this.paintValue;
    this.motionEdit = { ...e, cells };
  }

  private fillMotion(on: boolean) {
    const e = this.motionEdit;
    if (!e) return;
    this.motionEdit = { ...e, cells: e.cells.map((row) => row.map(() => on)) };
  }

  private motionDiff() {
    const m = this.zones?.motion;
    const e = this.motionEdit;
    if (!m || !e) return { added: 0, removed: 0, sensitivity: false, enabled: false };
    let added = 0;
    let removed = 0;
    e.cells.forEach((row, r) => row.forEach((on, c) => { const was = m.cells[r]?.[c] ?? false; if (on && !was) added++; if (!on && was) removed++; }));
    return { added, removed, sensitivity: e.sensitivity !== (m.sensitivity ?? 50), enabled: e.enabled !== m.enabled };
  }

  private async saveMotion() {
    const e = this.motionEdit;
    const cam = this.cam;
    if (!e || !cam || this.motionBusy) return;
    const d = this.motionDiff();
    this.motionBusy = true;
    try {
      const rec = await setMotion(cam.id, { ...(d.added || d.removed ? { cells: e.cells } : {}), ...(d.sensitivity ? { sensitivity: e.sensitivity } : {}), ...(d.enabled ? { enabled: e.enabled } : {}) });
      this.motionMsg = rec.status === 'unchanged' ? 'ה־NVR כבר היה במצב הזה, לא נכתב דבר.' : `נכתב ל־NVR (שינוי ${rec.id.slice(0, 8)}). ניתן להחזיר מהגדרות › חיבורים › שינויים אחרונים.`;
      this.motionEdit = null;
      this.motionConfirm = false;
      await this.loadZones(true);
    } catch (err) {
      this.motionMsg = describeError(err);
      this.motionConfirm = false;
    } finally {
      this.motionBusy = false;
    }
  }

  private renderMotionEditor(m: NonNullable<CameraZones['motion']>) {
    const e = this.motionEdit!;
    const d = this.motionDiff();
    const changed = d.added || d.removed || d.sensitivity || d.enabled;
    const active = e.cells.flat().filter(Boolean).length;
    return html`<div class="legend" data-motion-editor>
      <span class="note">לחץ או גרור על התמונה כדי לסמן תאים שמזהים תנועה · ${active} מתוך ${m.rows * m.cols} תאים</span>
      <sw-button size="sm" variant="ghost" @click=${() => this.fillMotion(true)}>בחר הכל</sw-button>
      <sw-button size="sm" variant="ghost" @click=${() => this.fillMotion(false)}>נקה</sw-button>
      <label class="note" style="display:inline-flex;align-items:center;gap:6px">רגישות <input type="range" min=${this.zones?.sensitivity_caps?.min ?? 0} max=${this.zones?.sensitivity_caps?.max ?? 100} step=${this.zones?.sensitivity_caps?.step ?? 20} .value=${String(e.sensitivity)} data-motion-sensitivity @input=${(ev: Event) => (this.motionEdit = { ...e, sensitivity: Number((ev.target as HTMLInputElement).value) })} /> <b class="ltr">${e.sensitivity}</b></label>
      <label class="note" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" .checked=${e.enabled} data-motion-enabled @change=${(ev: Event) => (this.motionEdit = { ...e, enabled: (ev.target as HTMLInputElement).checked })} /> זיהוי תנועה פעיל</label>
      <span class="grow"></span>
      <sw-button variant="primary" size="sm" icon="check" ?disabled=${!changed || this.motionBusy} data-motion-save @click=${() => (this.motionConfirm = true)}>שמור ל־NVR</sw-button>
      <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.motionBusy} data-motion-cancel @click=${() => (this.motionEdit = null)}>ביטול</sw-button>
      ${this.motionConfirm
        ? html`<sw-dialog open heading="כתיבה ל־NVR: זיהוי תנועה" subheading=${`${this.cam?.name ?? ''} · ערוץ ${this.zones?.channel ?? ''}`} data-motion-confirm @close=${() => (this.motionConfirm = false)}>
            <div style="font-size:var(--sw-fs-sm);line-height:1.6">
              <div>${d.added ? `+${d.added} תאים נוספים לזיהוי` : ''}${d.added && d.removed ? ' · ' : ''}${d.removed ? `−${d.removed} תאים מוסרים` : ''}${!d.added && !d.removed ? 'הרשת ללא שינוי' : ''}</div>
              <div>רגישות: ${d.sensitivity ? `${m.sensitivity ?? '—'} → ${e.sensitivity}` : 'ללא שינוי'} · זיהוי: ${d.enabled ? (e.enabled ? 'כבוי → פעיל' : 'פעיל → כבוי') : 'ללא שינוי'}</div>
              <div style="margin-block-start:6px;color:var(--sw-text-3)">המסמך לפני ואחרי נשמר, השינוי נרשם באודיט וניתן להחזרה. ההקלטות אינן מושפעות; אזור שלא מסומן לא יפעיל הקלטת תנועה.</div>
            </div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.motionBusy} data-motion-confirm-run @click=${() => this.saveMotion()}>${this.motionBusy ? 'כותב…' : 'כתוב ל־NVR'}</sw-button><sw-button variant="ghost" @click=${() => (this.motionConfirm = false)}>ביטול</sw-button></div>
          </sw-dialog>`
        : nothing}
    </div>`;
  }

  private renderZones(cam: Camera) {
    const z = this.zones;
    if (this.zonesBusy && !z) return html`<div class="note">קורא את הגדרות הזיהוי מה־NVR…</div>`;
    if (this.zonesError && !z) return html`<div class="note">${this.zonesError} <sw-button size="sm" @click=${() => this.loadZones(true)}>נסה שוב</sw-button></div>`;
    if (!z) return html`<div class="note">—</div>`;
    const L = this.zoneLayers;
    const m = z.motion;
    const scale = (pts: number[][], n: { width: number; height: number }) => pts.map(([x, y]) => `${(x / n.width) * 1000},${(y / n.height) * 1000}`).join(' ');
    const target = (t: string) => (t === 'human' ? 'אדם' : t === 'vehicle' ? 'רכב' : t);
    return html`
      <style>
        .zones .frame { position: relative; aspect-ratio: 16 / 9; background: #0f1729; border-radius: 8px; overflow: hidden; }
        .zones .frame img { inline-size: 100%; block-size: 100%; object-fit: fill; display: block; }
        .zones .frame svg { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; }
        .zones .cell { fill: rgba(239, 68, 68, 0.28); stroke: rgba(239, 68, 68, 0.55); stroke-width: 1; }
        .zones .mask { fill: rgba(15, 23, 42, 0.78); stroke: #0f172a; stroke-width: 3; }
        .zones .field { fill: rgba(245, 158, 11, 0.25); stroke: #f59e0b; stroke-width: 4; }
        .zones .line { fill: none; stroke: #2f6bff; stroke-width: 6; }
        .zones .line.off { stroke-dasharray: 14 10; opacity: 0.6; }
        .zones .legend { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-block-start: 8px; }
      </style>
      <div class="zones" data-zones-loaded>
        <div class="frame">
          <img src=${snapshotUrl(cam.id)} alt="" />
          <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="אזורי זיהוי מעל תמונת המצלמה">
            ${this.motionEdit && m && m.rows && m.cols
              ? this.motionEdit.cells.flatMap((row, r) => row.map((on, c) => svg`<rect class=${on ? 'cell' : 'cell off'} data-motion-cell=${`${r}-${c}`} x=${(c * 1000) / m.cols} y=${(r * 1000) / m.rows} width=${1000 / m.cols} height=${1000 / m.rows} style="cursor:crosshair;${on ? '' : 'fill:rgba(255,255,255,0.03);stroke:rgba(255,255,255,0.18)'}" @pointerdown=${(ev: PointerEvent) => { ev.preventDefault(); this.paintCell(r, c, true); }} @pointerenter=${(ev: PointerEvent) => { if (ev.buttons & 1) this.paintCell(r, c); }} @pointerup=${() => (this.paintValue = null)}></rect>`))
              : nothing}
            ${!this.motionEdit && L.motion && m && m.rows && m.cols ? m.cells.flatMap((row, r) => row.map((on, c) => (on ? svg`<rect x=${(c * 1000) / m.cols} y=${(r * 1000) / m.rows} width=${1000 / m.cols} height=${1000 / m.rows} class="cell"></rect>` : nothing))) : nothing}
            ${L.privacy && z.privacy_mask ? z.privacy_mask.regions.map((reg) => svg`<polygon points=${scale(reg.points, z.privacy_mask!.normalized)} class="mask"></polygon>`) : nothing}
            ${L.intrusion && z.intrusion ? z.intrusion.regions.map((reg) => svg`<polygon points=${scale(reg.points, z.intrusion!.normalized)} class="field"></polygon>`) : nothing}
            ${L.lines && z.line_crossing ? z.line_crossing.lines.map((ln) => svg`<polyline points=${scale(ln.points, z.line_crossing!.normalized)} class="line ${ln.enabled ? '' : 'off'}"></polyline>`) : nothing}
          </svg>
        </div>
        <div class="legend">
          <sw-chip data-zone-layer="motion" ?selected=${L.motion} @click=${() => (this.zoneLayers = { ...L, motion: !L.motion })}>תנועה${m ? ` · ${m.enabled ? 'פעיל' : 'כבוי'} · ${m.coverage_pct}% מהתמונה · רגישות ${m.sensitivity ?? '?'}${m.target_types.length ? ` · ${m.target_types.map(target).join('/')}` : ''}` : ' · לא נקרא'}</sw-chip>
          <sw-chip data-zone-layer="privacy" ?selected=${L.privacy} @click=${() => (this.zoneLayers = { ...L, privacy: !L.privacy })}>מסכת פרטיות${z.privacy_mask ? ` · ${z.privacy_mask.enabled ? 'פעילה' : 'כבויה'} · ${z.privacy_mask.regions.length} אזורים` : ' · לא נקרא'}</sw-chip>
          <sw-chip data-zone-layer="intrusion" ?selected=${L.intrusion} @click=${() => (this.zoneLayers = { ...L, intrusion: !L.intrusion })}>חדירה לאזור${z.intrusion ? ` · ${z.intrusion.enabled ? 'פעיל' : 'כבוי'} · ${z.intrusion.regions.length} אזורים` : ' · לא נקרא'}</sw-chip>
          <sw-chip data-zone-layer="lines" ?selected=${L.lines} @click=${() => (this.zoneLayers = { ...L, lines: !L.lines })}>חציית קו${z.line_crossing ? ` · ${z.line_crossing.enabled ? 'פעיל' : 'כבוי'} · ${z.line_crossing.lines.length} קווים` : ' · לא נקרא'}</sw-chip>
          <sw-button size="sm" variant="ghost" icon="refresh" ?disabled=${this.zonesBusy} @click=${() => this.loadZones(true)}>רענון מה־NVR</sw-button>
          ${z.can_edit_motion && m && m.rows && m.cols && !this.motionEdit ? html`<sw-button size="sm" icon="edit" data-motion-edit @click=${() => this.startMotionEdit()}>עריכת אזורי תנועה</sw-button>` : nothing}
        </div>
        ${this.motionEdit && m ? this.renderMotionEditor(m) : nothing}
        ${this.motionMsg ? html`<div class="note" data-motion-msg>${this.motionMsg}</div>` : nothing}
        ${Object.keys(z.unsupported).length ? html`<div class="note">לא נקרא מהמכשיר: ${Object.entries(z.unsupported).map(([k, v]) => `${k} (${v})`).join(', ')}</div>` : nothing}
        <div class="note" data-zones-note>קריאה בלבד מה־NVR (נקרא ${z.fetched_at.replace('T', ' ').replace('Z', ' UTC')}${z.cached ? ', מהמטמון' : ''}). אלו פוליגונים בתמונת המצלמה — לא חדרים במפה. שכבת־על בדפדפן אינה מסכת NVR ואינה מגינה על הקלטות; עריכה או מסכה אמיתית דורשות אישור מפורש, כתיבה מאומתת ובדיקת התוצאה בזרם.</div>
      </div>`;
  }

  private async load() {
    this.loading = true;
    this.error = '';
    try {
      if (isApi()) {
        const [list, settings] = await Promise.all([listCameras(), productSettings()]);
        this.cams = list.cameras;
        this.cam = list.cameras.find((c) => c.id === this.cameraId) ?? null;
        this.settings = settings;
        this.transport = effectiveTransport(settings);
      }
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.loading = false;
    }
  }

  private setTransport(t: Transport) {
    setTransportOverride(t === (this.settings?.['media.transport_default'] ?? 'mse') ? '' : t);
    this.transport = t;
  }

  private onPlayer(e: CustomEvent<{ status: string; transport?: string; error?: string }>) {
    this.playerStatus = e.detail.status;
    this.playerTransport = e.detail.transport ?? '';
  }

  private renderApi() {
    const cam = this.cam;
    if (this.loading) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    if (this.error) return html`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel>`;
    if (!cam) return html`<sw-state-panel state="forbidden" heading="המצלמה לא זמינה" hint="המצלמה לא נמצאה או שאין לך הרשאת צפייה בה."></sw-state-panel>`;
    const canView = cam.can_view_live !== false && cam.status !== 'offline';
    const poster = snapshotUrl(cam.id, this.posterBust);
    const stream = cam.stream;
    return html`
      <div class="video ${canView ? '' : 'off'}">
        ${canView
          ? html`<sw-live-player .cameraId=${cam.id} .profile=${this.profile} .mode=${this.transport} .poster=${poster} @player-status=${this.onPlayer}></sw-live-player>`
          : html`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span>${cam.status === 'offline' ? 'המצלמה מנותקת מה־NVR (לפי הסנכרון האחרון)' : 'אין הרשאת צפייה חיה במצלמה זו'}</span></div></div>`}
      </div>
      <div class="controls">
        <div class="round" role="group" aria-label="פקדי מצלמה">
          <button title="רענון תמונה" aria-label="רענון תמונה" @click=${() => (this.posterBust = Date.now())}><sw-icon name="aperture" size=${16}></sw-icon></button>
          <button title="מסך מלא" aria-label="מסך מלא" ?disabled=${this.playerStatus !== 'playing'} @click=${() => this.player?.fullscreen()}><sw-icon name="expand" size=${16}></sw-icon></button>
          <button title="התחבר מחדש" aria-label="התחבר מחדש" @click=${() => this.player?.reconnect()}><sw-icon name="refresh" size=${16}></sw-icon></button>
          <button class="q ${this.profile === 'main' ? 'on' : ''}" @click=${() => (this.profile = 'main')}>ראשי</button>
          <button class="q ${this.profile === 'sub' ? 'on' : ''}" @click=${() => (this.profile = 'sub')}>משני</button>
          <div class="transport" role="group" aria-label="תעבורה">
            ${(['auto', 'webrtc', 'mse'] as Transport[]).map((t) => html`<button class=${this.transport === t ? 'on' : ''} @click=${() => this.setTransport(t)}>${t === 'auto' ? 'אוטומטי' : t === 'webrtc' ? 'WebRTC' : 'MSE'}</button>`)}
          </div>
          ${transportOverride() ? html`<span class="note">ברירת המחדל של המערכת: ${this.settings?.['media.transport_default'] ?? 'mse'}</span>` : nothing}
        </div>
        <div class="note">${this.playerStatus === 'playing' ? `מנגן דרך ${this.playerTransport === 'webrtc' ? 'WebRTC' : 'MSE'}` : this.playerStatus === 'error' ? 'הזרם לא זמין' : 'מתחבר…'}</div>
      </div>
      ${this.renderCaps()}
      <div class="grid">
        <sw-card heading="פרטים">
          <dl>
            <dt>מצב</dt><dd><sw-badge kind=${cam.status === 'online' ? 'live' : cam.status === 'offline' ? 'offline' : 'unknown'}></sw-badge></dd>
            <dt>ערוץ</dt><dd>${cam.channel} · <span class="ltr">track ${cam.main_track ?? '?'}</span></dd>
            <dt>שם ב־NVR</dt><dd>${cam.name_source || '—'}</dd>
            <dt>זרם ראשי</dt><dd>${stream ? `${stream.resolution ?? ''} · ${stream.fps ?? '?'} fps · ${stream.bitrate_kbps ?? '?'} kbps` : 'לא נבדק'}</dd>
            <dt>זמן מקור</dt><dd>NVR · <span class="ltr">Asia/Jerusalem</span></dd>
            <dt>נראתה לאחרונה</dt><dd>${cam.last_seen_at ? cam.last_seen_at.replace('T', ' ').replace('Z', ' UTC') : '—'}</dd>
          </dl>
        </sw-card>
        <sw-card heading="אזורי זיהוי ומסכות — כפי שמוגדר ב־NVR" data-zones>${this.renderZones(cam)}</sw-card>
        <sw-card heading="מצלמות נוספות">
          <div class="tiles">
            ${this.cams.filter((c) => c.id !== cam.id).slice(0, 4).map((c) => html`<sw-camera-tile compact name=${c.name} state=${c.status === 'online' ? 'live' : c.status === 'offline' ? 'offline' : 'unknown'} poster=${c.status === 'offline' ? '' : snapshotUrl(c.id)} @click=${() => navigate(`/live/cameras/${c.id}`)}></sw-camera-tile>`)}
          </div>
        </sw-card>
      </div>
    `;
  }

  private renderDemo() {
    const cam = demoWall.find((c) => c.id === this.cameraId) ?? demoWall[0];
    const canView = cam.state === 'live' || cam.state === 'stale';
    const scene = demoScene[cam.id] ?? 'lobby';
    return html`
      <div class="video ${canView ? scene : 'off'}">
        ${canView
          ? html`<sw-scene kind=${scene}></sw-scene><div class="shade"></div><span class="demo">דמו · אין שרת מחובר</span>
              <span class="stamp">2026-09-14 10:24:36</span>
              <span class="quality">${this.profile === 'main' ? '1440p · H.265' : '360p · H.264'}</span>`
          : html`<div class="center"><div>
              <sw-icon name=${cam.state === 'offline' ? 'offline' : 'lock'} size=${32}></sw-icon>
              <span>${cam.state === 'offline' ? 'המצלמה אינה מחוברת ל־NVR' : 'אין הרשאת צפייה במצלמה זו'}</span>
            </div></div>`}
      </div>
      <div class="controls">
        <div class="round" role="group" aria-label="פקדי מצלמה">
          ${cam.audio ? html`<button title="מיקרופון" aria-label="מיקרופון" ?disabled=${!canView}><sw-icon name="mic" size=${16}></sw-icon></button><button title="שמע" aria-label="שמע" ?disabled=${!canView}><sw-icon name="volume" size=${16}></sw-icon></button>` : nothing}
          <button title="צילום מסך" aria-label="צילום מסך" ?disabled=${!canView}><sw-icon name="aperture" size=${16}></sw-icon></button>
          <button title="מסך מלא" aria-label="מסך מלא" ?disabled=${!canView}><sw-icon name="expand" size=${16}></sw-icon></button>
          <button class="q ${this.profile === 'main' ? 'on' : ''}" @click=${() => (this.profile = 'main')}>1440p</button>
          <button class="q ${this.profile === 'sub' ? 'on' : ''}" @click=${() => (this.profile = 'sub')}>360p</button>
        </div>
        ${cam.ptz
          ? html`<div class="ptz" role="group" aria-label="בקרת PTZ">
              <div class="joy">
                <button class="u" aria-label="למעלה"><sw-icon name="chevronDown" size=${14} style="transform:rotate(180deg)"></sw-icon></button>
                <button class="d" aria-label="למטה"><sw-icon name="chevronDown" size=${14}></sw-icon></button>
                <button class="l" aria-label="שמאלה"><sw-icon name="chevron" size=${14} flip></sw-icon></button>
                <button class="r" aria-label="ימינה"><sw-icon name="chevron" size=${14}></sw-icon></button>
                <span class="c" aria-hidden="true"></span>
              </div>
              <div class="zoom"><button aria-label="זום פנימה"><sw-icon name="plus" size=${14}></sw-icon></button><button aria-label="זום החוצה"><sw-icon name="minus" size=${14}></sw-icon></button></div>
            </div>`
          : nothing}
      </div>
      ${cam.ptz
        ? html`<div class="modes">
            <sw-chip icon="bookmark" ?selected=${this.ptzMode === 'presets'} @click=${() => (this.ptzMode = 'presets')}>Presets</sw-chip>
            <sw-chip icon="target" ?selected=${this.ptzMode === 'track'} @click=${() => (this.ptzMode = 'track')}>מעקב אוטומטי</sw-chip>
            <sw-chip icon="route" ?selected=${this.ptzMode === 'patrol'} @click=${() => (this.ptzMode = 'patrol')}>סיור</sw-chip>
          </div>`
        : html`<div class="note" style="margin-block-start:8px">PTZ ושמע אינם מוצגים במצלמה זו: היכולת לא אומתה. פקד שלא נתמך מוסתר או מוסבר, לא מדומה.</div>`}
      <div class="grid">
        <sw-card heading="פרטים">
          <dl>
            <dt>מצב</dt><dd><sw-badge kind=${cam.state}></sw-badge></dd>
            <dt>הקלטה</dt><dd>${{ continuous: 'רציפה', motion: 'לפי תנועה', off: 'כבויה', unknown: 'לא ידוע' }[cam.recording]}</dd>
            <dt>זרם</dt><dd>${cam.fps ? `${cam.fps} fps · ${cam.bitrateKbps} kbps` : '—'}</dd>
            <dt>קושחה</dt><dd><span class="ltr">${cam.firmware}</span></dd>
            <dt>אירוע אחרון</dt><dd>${cam.lastEvent}</dd>
          </dl>
        </sw-card>
        <sw-card heading="מצלמות באותה קומה">
          <div class="tiles">
            ${demoWall.filter((c) => c.floor === cam.floor && c.id !== cam.id).slice(0, 4).map((c) => html`<sw-camera-tile compact name=${c.name} state=${c.state} scene=${demoScene[c.id] ?? 'lobby'} @click=${() => navigate(`/live/cameras/${c.id}`)}></sw-camera-tile>`)}
          </div>
        </sw-card>
      </div>
    `;
  }

  render() {
    const api = isApi();
    const title = api ? this.cam?.name ?? 'מצלמה' : (demoWall.find((c) => c.id === this.cameraId) ?? demoWall[0]).name;
    const sub = api ? (this.cam ? `ערוץ ${this.cam.channel} · ${this.cam.name_source || ''}` : '') : `${(demoWall.find((c) => c.id === this.cameraId) ?? demoWall[0]).floor} · נתוני הדגמה`;
    return html`
      <sw-page heading=${title} subheading=${sub} crumbs="מצלמות | שידור חי">
        ${this.cam ? html`<sw-badge slot="actions" kind=${this.cam.status === 'online' ? 'live' : this.cam.status === 'offline' ? 'offline' : 'unknown'}></sw-badge>` : nothing}
        <a slot="actions" href=${api && this.cam ? `#/investigate/playback?camera=${this.cam.id}` : '#/investigate/playback'}><sw-button icon="history">הקלטות</sw-button></a>
        <a slot="actions" href="#/explore/floors/f0"><sw-button variant="ghost" iconOnly icon="map" label="במפה"></sw-button></a>
        ${api ? this.renderApi() : this.renderDemo()}
      </sw-page>
    `;
  }
}
