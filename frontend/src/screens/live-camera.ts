import { LitElement, html, nothing, svg } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { toggled } from '../components/sw-toggle';
import '../components/sw-page';
import '../components/sw-camera-tile';
import '../components/sw-badge';
import '../components/frigate-camera-control';
import '../components/sw-button';
import '../components/sw-card';
import '../components/sw-icon';
import '../components/sw-chip';
import '../components/sw-field';
import '../components/sw-scene';
import '../components/sw-live-player';
import '../components/sw-state-panel';
import type { SwLivePlayer } from '../components/sw-live-player';
import { demoScene, demoWall } from '../fixtures/catalog';
import { navigate } from '../router';
import { crt } from '../i18n/camera-reboot';
import { rebootErrorText, rebootView } from './camera-reboot-logic';
import '../components/camera-source-dialog';
import { getCameraSource, type CameraSource } from '../api/camera-sources';
import { cst } from '../i18n/camera-sources';
import { healthLine, recorderActions, sourceSummary } from './camera-source-logic';
import { cameraRebootState, cameraSchedules, cameraSmart, osdStatus, rebootCamera, recordStart, recordStatus, recordStop, setArming, setMotion, setOsd, setRecordSchedule, setSmart, writeChannelName, type ArmingKind, type CameraRebootState, type CameraSchedules, type CameraSmart, type OsdStatus, type RecordStatus, type WeekRange } from '../api/nvr';
import '../components/sw-week-grid';
import '../components/sw-dialog';
import { can, canAnywhere, canReadNvrConfig, isApi, onRemote, webrtcServer } from '../api/session';
import { WEBRTC_REQUIRED_TEXT, WEBRTC_SETTINGS_HREF, WEBRTC_SETTINGS_LABEL, cameraPane } from '../api/camera-visibility';
import { cameraCapabilities, cameraZones, snapshotUrl, type CameraCapabilities, type CameraZones, type ProductSettings, type Transport } from '../api/media';
import { cachedVideoPolicy, setPersonalTransport } from '../api/video-transport';
import { listCameras, updateCamera } from '../api/maps';
import { effectiveTransport, productSettings, TRANSPORT_DEFAULT, transportLabel } from '../api/prefs';
import { playerPlan, remoteVideo, remoteVideoFor } from '../api/video-policy';
import { describeError } from '../api/client';
import type { Camera } from '../api/types';
import { SkinController } from '../design/skin';
import '../components/sw-cast-picker';
import '../components/sw-cast-stop';
// TKMAP1: "open a service request" for this camera (the camera's place on the map is attached to the new request)
import '../tickets/map-create';
import { mapCreateLabel, mapTicketsOn } from '../tickets/map-create';
import { castTargets, type CastSession } from '../api/cast';
import { CastWatch, castStore } from '../components/cast-store';
import { castButtonVisible, isLow, leftText } from './cast-logic';
import { isPhoneWidth } from '../shell/tabs-mode';
import { t as heT } from '../i18n/he';
import { tr } from '../i18n/msg/live';
import { changeText } from '../i18n/bidi';
import { fx } from '../i18n/frigate-text';
import { timeText } from '../api/day-format';
import { liveCameraStyles } from './live-camera-css';

/**
 * SC08 — live camera view (board 1 screen 5). With a backend: real stream through the relay
 * (WebRTC → MSE), snapshot poster, transport override, fullscreen, audio only when the camera has it.
 * Without a backend: illustrated demo. Unsupported controls are hidden or explained, never simulated.
 */
@customElement('live-camera')
export class LiveCamera extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @property() cameraId = 'cam-1';
  /** TKMAP1: the create form for a service request about this camera is open */
  @state() private mapTicket = false;
  @state() private cam: Camera | null = null;
  /** T075: the NVR's detection configuration for this camera (read-only), drawn over the snapshot. */
  @state() private zones: CameraZones | null = null;
  @state() private zonesBusy = false;
  @state() private zonesError = '';
  /** B2 (0.1.65): editing the motion grid - a working copy of the cells, the sensitivity and the enabled flag. */
  /** LIVECAM-DRAFT-RESET-2435: every draft carries the camera it was opened for (`camId`); a save refuses when that is not the camera on screen. */
  @state() private motionEdit: { camId: string; cells: boolean[][]; sensitivity: number; enabled: boolean } | null = null;
  @state() private motionConfirm = false;
  @state() private motionBusy = false;
  @state() private motionMsg = '';
  private paintValue: boolean | null = null;
  /** A1 (0.1.66): manual recording state for this camera, polled while one is running. */
  @state() private rec: RecordStatus | null = null;
  /** D1 (0.1.71): the channel's name and OSD overlays on the NVR. */
  @state() private osd: OsdStatus | null = null;
  /** 0.1.72: arming + recording schedules (week grids) and the smart-rule editor. */
  @state() private sched: CameraSchedules | null = null;
  @state() private schedError = '';
  @state() private schedTab: ArmingKind | 'record' = 'motion';
  @state() private schedEdit: { camId: string; kind: ArmingKind | 'record'; days: WeekRange[][]; schedule_enabled?: boolean | null; enabled?: boolean } | null = null;
  @state() private schedBusy = false;
  @state() private schedMsg = '';
  @state() private schedConfirm = false;
  @state() private smart: CameraSmart | null = null;
  @state() private smartEdit: { camId: string; line: { enabled: boolean; lines: { id: number; enabled: boolean; sensitivity: number; direction: string; points: number[][]; human: boolean; vehicle: boolean }[] } | null; field: { enabled: boolean; regions: { id: number; sensitivity: number; points: number[][]; human: boolean; vehicle: boolean }[] } | null; tool: { type: 'line' | 'field'; id: number } } | null = null;
  @state() private smartBusy = false;
  @state() private smartMsg = '';
  @state() private osdMsg = '';
  /** Owner request (2026-09-18): rename the camera from its own screen (the VMS alias; the NVR name stays unless OSD writes it). */
  @state() private renameTo: string | null = null;
  @state() private renameBusy = false;
  @state() private renameMsg = '';
  @state() private osdBusy = false;
  @state() private recMinutes = 10;
  @state() private recBusy = false;
  @state() private recMsg = '';
  private recTimer = 0;
  /** CAMERA-REBOOT-2407: may this user restart the camera now (and why not); read only for NVR-config readers. */
  @state() private reboot: CameraRebootState | null = null;
  @state() private rebootOpen = false;
  @state() private rebootBusy = false;
  @state() private rebootMsg = '';
  /** CAMERA-STREAM-SOURCES-2410: the camera's video source (system.configure only) and its dialog. */
  @state() private source: CameraSource | null = null;
  @state() private sourceOpen = false;
  @state() private sourceMsg = '';
  /** LIVECAM-DRAFT-RESET-2435: bumped on every camera change; a read or a write that started under an older value drops its answer. */
  private camGen = 0;

  /** LIVECAM-DRAFT-RESET-2435: the shell re-uses this element when only the camera id in the route changes (shell/sw-app.ts), so
   * everything that belongs to the previous camera - its NVR reads, the open drafts and their dialogs, busy flags, messages and the
   * record poll - is dropped here, before the new camera's first frame. View choices (profile, layers, schedule tab, minutes) stay. */
  private resetCameraState() {
    this.camGen++;
    window.clearTimeout(this.recTimer);
    window.clearTimeout(this.castNoteTimer);
    this.mapTicket = false;
    this.zones = null;
    this.zonesBusy = false;
    this.zonesError = '';
    this.motionEdit = null;
    this.motionConfirm = false;
    this.motionBusy = false;
    this.motionMsg = '';
    this.paintValue = null;
    this.rec = null;
    this.recBusy = false;
    this.recMsg = '';
    this.osd = null;
    this.osdBusy = false;
    this.osdMsg = '';
    this.sched = null;
    this.schedError = '';
    this.schedEdit = null;
    this.schedBusy = false;
    this.schedMsg = '';
    this.schedConfirm = false;
    this.smart = null;
    this.smartEdit = null;
    this.smartBusy = false;
    this.smartMsg = '';
    this.renameTo = null;
    this.renameBusy = false;
    this.renameMsg = '';
    this.reboot = null;
    this.rebootOpen = false;
    this.rebootBusy = false;
    this.rebootMsg = '';
    this.source = null;
    this.sourceOpen = false;
    this.sourceMsg = '';
    this.caps = null;
    this.capsError = '';
    this.castShown = false;
    this.castOpen = false;
    this.castNote = '';
    this.playerStatus = '';
    this.playerTransport = '';
    if (isApi()) this.loading = true; // load() follows in updated(); no frame of the old camera's settings in between
  }

  /** The camera a draft may be written to: the one it was opened for, only while it is still the camera on screen. */
  private draftTarget(camId: string): Camera | null {
    const cam = this.cam;
    return cam && cam.id === camId && camId === this.cameraId ? cam : null;
  }

  private async loadSource() {
    if (!this.cam || !isApi() || !can('system.configure')) {
      this.source = null;
      return;
    }
    const gen = this.camGen;
    try {
      const s = await getCameraSource(this.cam.id);
      if (gen === this.camGen) this.source = s;
    } catch {
      if (gen === this.camGen) this.source = null;
    }
  }

  /** CAMERA-STREAM-SOURCES-2410: the "video source" row of the camera's settings - the current source, its health, and the dialog. */
  private renderSource(cam: Camera) {
    if (!this.source) return nothing;
    const h = healthLine(this.source);
    return html`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-camera-source=${this.source.mode}>
      <span>${sourceSummary(this.source, cam)}</span>
      ${h ? html`<span data-camera-source-health=${h.tone} style=${h.tone === 'bad' ? 'color:var(--sw-danger-text, var(--sw-danger))' : h.tone === 'ok' ? 'color:var(--sw-success-text, var(--sw-success))' : ''}>${h.text}</span>` : nothing}
      <sw-button size="sm" variant="ghost" icon="edit" data-camera-source-open @click=${() => { this.sourceMsg = ''; this.sourceOpen = true; }}>${cst('change')}</sw-button>
      ${this.sourceMsg ? html`<span role="status" data-camera-source-msg>${this.sourceMsg}</span>` : nothing}
    </div>
    <camera-source-dialog mode="edit" .open=${this.sourceOpen} camera-id=${cam.id} camera-name=${cam.name} @close=${() => (this.sourceOpen = false)}
      @saved=${() => { this.sourceMsg = cst('saved'); void this.loadSource(); this.posterBust = Date.now(); this.player?.reconnect(); }}></camera-source-dialog>`;
  }

  private async loadSchedules() {
    if (!this.cam || !isApi()) return;
    if (!canReadNvrConfig()) {
      // the NVR's schedules and smart rules are readable by administrators and NVR writers only (nvr_write._require_read):
      // asking anyway cost every other user two refused requests per camera (0.1.81)
      this.sched = null;
      this.smart = null;
      this.schedError = tr('לוחות הזמנים וחוקי ה־smart של המקליט נקראים עם הרשאת ניהול מקליט.');
      return;
    }
    const gen = this.camGen;
    const id = this.cam.id;
    try {
      const sched = await cameraSchedules(id);
      if (gen !== this.camGen) return;
      this.sched = sched;
      this.schedError = '';
      if (!this.sched.arming[this.schedTab as ArmingKind] && this.schedTab !== 'record') this.schedTab = (Object.keys(this.sched.arming)[0] as ArmingKind) ?? 'record';
    } catch (err) {
      if (gen !== this.camGen) return;
      this.schedError = describeError(err);
    }
    try {
      const smart = await cameraSmart(id);
      if (gen === this.camGen) this.smart = smart;
    } catch {
      if (gen === this.camGen) this.smart = null;
    }
  }

  private startSchedEdit() {
    const s = this.sched;
    if (!s) return;
    const kind = this.schedTab;
    const days = (kind === 'record' ? s.record?.days : s.arming[kind]) ?? Array.from({ length: 7 }, () => []);
    this.schedMsg = '';
    if (!this.cam) return;
    this.schedEdit = { camId: this.cam.id, kind, days: days.map((d) => d.map((r) => ({ ...r }))), schedule_enabled: s.record?.schedule_enabled ?? null, enabled: s.record?.enabled };
  }

  private schedDiff(): number {
    const e = this.schedEdit;
    const s = this.sched;
    if (!e || !s) return 0;
    const before = (e.kind === 'record' ? s.record?.days : s.arming[e.kind]) ?? [];
    const key = (d: WeekRange[][]) => d.map((day) => day.map((r) => `${r.begin}-${r.end}-${r.mode ?? ''}`).join(',')).join('|');
    return key(before) === key(e.days) ? 0 : 1;
  }

  private async saveSched() {
    const e = this.schedEdit;
    if (!e || !this.cam || this.schedBusy) return;
    const cam = this.draftTarget(e.camId);
    if (!cam) {
      this.refuseStaleDraft('sched');
      return;
    }
    const gen = this.camGen;
    this.schedBusy = true;
    this.schedConfirm = false;
    try {
      const rec = e.kind === 'record'
        ? await setRecordSchedule(cam.id, { days: e.days, ...(e.schedule_enabled !== null && e.schedule_enabled !== this.sched?.record?.schedule_enabled ? { schedule_enabled: e.schedule_enabled ?? undefined } : {}) })
        : await setArming(cam.id, e.kind, e.days);
      if (gen !== this.camGen) return;
      this.schedMsg = rec.status === 'unchanged' ? tr('המקליט כבר היה במצב הזה — לא נכתב דבר.') : tr('הלוח נכתב למקליט ונרשם (ניתן להחזרה מרשימת השינויים בהגדרות ‹ חיבורים).');
      this.schedEdit = null;
      await this.loadSchedules();
    } catch (err) {
      if (gen === this.camGen) this.schedMsg = describeError(err);
    } finally {
      if (gen === this.camGen) this.schedBusy = false;
    }
  }

  /** LIVECAM-DRAFT-RESET-2435: a draft that does not belong to the camera on screen is dropped, never written (defensive: a camera
   * change already closes every draft). */
  private refuseStaleDraft(kind: 'motion' | 'sched' | 'smart') {
    const msg = tr('העריכה נפתחה למצלמה אחרת ולכן לא נכתבה למקליט. פתח את העריכה מחדש במצלמה הזו.');
    if (kind === 'motion') {
      this.motionEdit = null;
      this.motionConfirm = false;
      this.motionMsg = msg;
    } else if (kind === 'sched') {
      this.schedEdit = null;
      this.schedConfirm = false;
      this.schedMsg = msg;
    } else {
      this.smartEdit = null;
      this.smartMsg = msg;
    }
  }

  private renderSchedules() {
    const s = this.sched;
    if (this.schedError && !s) return html`<div class="note">${this.schedError}</div>`;
    if (!s) return html`<div class="note">${tr('קורא לוחות מהמקליט…')}</div>`;
    const kinds: { id: ArmingKind | 'record'; label: string; ok: boolean }[] = [
      { id: 'motion', label: tr('זיהוי תנועה'), ok: !!s.arming.motion },
      { id: 'line', label: tr('חציית קו'), ok: !!s.arming.line },
      { id: 'field', label: tr('פריצה לאזור'), ok: !!s.arming.field },
      { id: 'record', label: tr('לוח הקלטה'), ok: !!s.record },
    ];
    const tab = this.schedTab;
    const e = this.schedEdit?.kind === tab ? this.schedEdit : null;
    const days = e ? e.days : tab === 'record' ? s.record?.days : s.arming[tab];
    // POLISH4-WP2 (D8): the record-mode legend takes skin tokens (dark-aware, skinned). A record mode is a category, never a status, so
    // "תנועה" is no longer green (green is for status only); it takes the purple tier, distinct from the alarm red and the event amber.
    const recordModes = [
      { id: 'CMR', label: tr('רציף'), color: 'var(--sw-recorded)' },
      { id: 'MOTION', label: tr('תנועה'), color: 'var(--sw-purple)' },
      { id: 'EDR', label: tr('אירוע'), color: 'var(--sw-warning)' },
      { id: 'ALARM', label: tr('אזעקה'), color: 'var(--sw-danger)' },
    ];
    const canEdit = tab === 'record' ? s.can.schedule : s.can.events;
    const label = kinds.find((k) => k.id === tab)?.label ?? '';
    return html`<div class="note">${tr('{n} לוחות בכרטיס הזה, כולל', { n: kinds.length })} <strong>${tr('לוח הקלטה')}</strong> ${tr('(מתי הערוץ מקליט בפועל) — לא רק לוחות הזיהוי.')}</div>
      <div class="legend" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-block-end:8px" data-schedules-tabs>
        ${kinds.map((k) => html`<sw-chip ?selected=${tab === k.id} ?disabled=${!k.ok} data-sched-tab=${k.id} title=${k.ok ? '' : (s.unsupported[k.id] ?? tr('לא נתמך בערוץ זה'))} @click=${() => { if (k.ok) { this.schedTab = k.id; this.schedEdit = null; } }}>${k.label}${k.ok ? '' : ` · ${tr('לא זמין')}`}</sw-chip>`)}
        <span class="grow"></span>
        ${canEdit && !e ? html`<sw-button size="sm" icon="edit" data-sched-edit @click=${() => this.startSchedEdit()}>${tr('עריכה')}</sw-button>` : nothing}
      </div>
      ${days
        ? html`<sw-week-grid data-week-grid .days=${days} .modes=${tab === 'record' ? recordModes : [{ id: 'on', label: tr('פעיל'), color: 'var(--sw-accent)' }]} ?editable=${!!e}
            @change=${(ev: CustomEvent<{ days: WeekRange[][] }>) => { if (this.schedEdit) this.schedEdit = { ...this.schedEdit, days: ev.detail.days }; }}></sw-week-grid>`
        : html`<div class="note">${tr('הלוח הזה לא נקרא מהמקליט')}${s.unsupported[tab] ? ` (${s.unsupported[tab]})` : ''}.</div>`}
      ${tab === 'record' && s.record
        ? html`<div class="note" style="margin-block-start:6px">${tr('ברירת מחדל: {mode}', { mode: s.record.default_mode ?? '—' })} · ${tr('לפני אירוע {n} שנ׳', { n: s.record.pre_record_s ?? '—' })} · ${tr('אחרי {n} שנ׳', { n: s.record.post_record_s ?? '—' })} · ${tr('הקלטה {state}', { state: s.record.enabled ? tr('פעילה') : tr('כבויה') })} · ${tr('לוח {state}', { state: s.record.schedule_enabled === false ? tr('כבוי (מקליט לפי ברירת המחדל)') : tr('פעיל') })}
            ${e ? html`<label style="display:inline-flex;gap:4px;align-items:center;margin-inline-start:8px"><sw-toggle size="sm" labelHidden in-label label=${tr('לוח פעיל')} data-sched-enabled .checked=${e.schedule_enabled !== false} @change=${(ev: Event) => (this.schedEdit = { ...e, schedule_enabled: toggled(ev) })}></sw-toggle> ${tr('לוח פעיל')}</label>` : nothing}</div>`
        : nothing}
      ${e
        ? html`<div class="legend" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-block-start:8px" data-sched-editor>
            <span class="note">${tab === 'record' ? tr('צבע = מצב הקלטה לשעה זו; תא ריק = אין הקלטה בשעה זו. טעות כאן = שעות בלי הקלטה, לכן יש אישור והחזר.') : tr('תא צבוע = הזיהוי פעיל בשעה זו; כיבוי כל היום = בלי התראות מהערוץ בזמן הזה.')}</span>
            <span class="grow"></span>
            <sw-button variant="primary" size="sm" icon="check" ?disabled=${this.schedBusy || (!this.schedDiff() && (tab !== 'record' || e.schedule_enabled === (s.record?.schedule_enabled ?? null)))} data-sched-save @click=${() => (this.schedConfirm = true)}>${tr('שמור למקליט')}</sw-button>
            <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.schedBusy} data-sched-cancel @click=${() => (this.schedEdit = null)}>${tr('ביטול')}</sw-button>
          </div>`
        : nothing}
      ${this.schedConfirm && e
        ? html`<sw-dialog open heading=${tr('כתיבה למקליט: {label}', { label })} subheading=${`${this.cam?.name ?? ''} · ${tr('ערוץ {n}', { n: s.channel })}`} data-sched-confirm @close=${() => (this.schedConfirm = false)}>
            <div style="font-size:var(--sw-fs-sm);line-height:1.6">
              <div>${tr('{n} טווחים בשבוע', { n: e.days.map((d) => d.length).reduce((a, b) => a + b, 0) })}${tab === 'record' ? ` · ${tr('{cmr} רציף, {motion} תנועה, {edr} אירוע', { cmr: e.days.flat().filter((r) => r.mode === 'CMR').length, motion: e.days.flat().filter((r) => r.mode === 'MOTION').length, edr: e.days.flat().filter((r) => r.mode === 'EDR').length })}` : ''}.</div>
              <div style="margin-block-start:6px;color:var(--sw-text-3)">${tr('המסמך לפני ואחרי נשמר, השינוי נרשם באודיט וניתן להחזרה בלחיצה.')}</div>
            </div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.schedBusy} data-sched-confirm-run @click=${() => this.saveSched()}>${this.schedBusy ? tr('כותב…') : tr('כתוב למקליט')}</sw-button><sw-button variant="ghost" @click=${() => (this.schedConfirm = false)}>${tr('ביטול')}</sw-button></div>
          </sw-dialog>`
        : nothing}
      ${this.schedMsg ? html`<div class="note" data-sched-msg>${this.schedMsg}</div>` : nothing}`;
  }

  // ---- B4: smart rules editor (line crossing, intrusion) drawn on the snapshot ----

  private startSmartEdit() {
    const sm = this.smart;
    if (!sm || !this.cam) return;
    const camId = this.cam.id;
    this.smartMsg = '';
    const line = sm.line ? { enabled: sm.line.enabled, lines: sm.line.lines.map((l) => ({ ...l, points: l.points.map((p) => [...p]) })) } : null;
    const field = sm.field ? { enabled: sm.field.enabled, regions: sm.field.regions.map((r) => ({ ...r, points: r.points.map((p) => [...p]) })) } : null;
    this.smartEdit = { camId, line, field, tool: line ? { type: 'line', id: line.lines[0]?.id ?? 1 } : { type: 'field', id: field?.regions[0]?.id ?? 1 } };
  }

  private smartClick(e: MouseEvent) {
    const ed = this.smartEdit;
    if (!ed) return;
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const x = Math.round(Math.max(0, Math.min(1000, ((e.clientX - r.left) / r.width) * 1000)));
    const y = Math.round(Math.max(0, Math.min(1000, ((e.clientY - r.top) / r.height) * 1000)));
    if (ed.tool.type === 'line' && ed.line) {
      const lines = ed.line.lines.map((l) => {
        if (l.id !== ed.tool.id) return l;
        const pts = l.points.length >= 2 && !(l.points[0][0] === 0 && l.points[0][1] === 1000 && l.points[1][0] === 0 && l.points[1][1] === 1000) && l.points.length !== 1 ? [] : l.points.filter((p) => !(p[0] === 0 && p[1] === 1000));
        const next = [...pts, [x, y]].slice(-2);
        return { ...l, points: next, enabled: next.length === 2 ? true : l.enabled };
      });
      this.smartEdit = { ...ed, line: { ...ed.line, lines } };
    } else if (ed.tool.type === 'field' && ed.field) {
      const regions = ed.field.regions.map((rg) => (rg.id === ed.tool.id && rg.points.length < 10 ? { ...rg, points: [...rg.points, [x, y]] } : rg));
      this.smartEdit = { ...ed, field: { ...ed.field, regions } };
    }
  }

  private async saveSmart() {
    const ed = this.smartEdit;
    if (!ed || !this.cam || this.smartBusy) return;
    const cam = this.draftTarget(ed.camId);
    if (!cam) {
      this.refuseStaleDraft('smart');
      return;
    }
    const gen = this.camGen;
    this.smartBusy = true;
    try {
      const body: Parameters<typeof setSmart>[1] = {};
      if (ed.line) body.line = { enabled: ed.line.enabled, lines: ed.line.lines.filter((l) => l.points.length === 2) };
      if (ed.field) body.field = { enabled: ed.field.enabled, regions: ed.field.regions.filter((r) => r.points.length === 0 || r.points.length >= 4) };
      const res = await setSmart(cam.id, body);
      if (gen !== this.camGen) return;
      const st = Object.values(res).map((r) => r.status);
      const refused = Object.values(res).some((r) => r.enable_refused);
      this.smartMsg = st.every((s) => s === 'unchanged')
        ? tr('המקליט כבר היה במצב הזה — לא נכתב דבר.')
        : refused
          ? tr('הצורות והפרמטרים נכתבו למקליט ונרשמו, אבל המקליט סירב להפעיל את הכלל דרך ה־ISAPI (invalidOperation). בקושחה הזו ההפעלה נעשית בממשק המקליט / המצלמה (משאב VCA של המצלמה); אחרי ההפעלה שם התצוגה כאן תתעדכן.')
          : tr('הכללים נכתבו למקליט ונרשמו (ניתנים להחזרה). התראות "אדם" / "רכב" מגיעות רק כשהערוץ מודיע ל־Arx (הגדרות ‹ חיבורים ‹ התראות מהמקליט).');
      this.smartEdit = null;
      await Promise.all([this.loadSchedules(), this.loadZones(true)]);
    } catch (err) {
      if (gen === this.camGen) this.smartMsg = describeError(err);
    } finally {
      if (gen === this.camGen) this.smartBusy = false;
    }
  }

  private renderSmartOverlay() {
    const ed = this.smartEdit;
    if (!ed) return nothing;
    const active = (type: 'line' | 'field', id: number) => ed.tool.type === type && ed.tool.id === id;
    return svg`
      ${ed.field ? ed.field.regions.filter((r) => r.points.length >= 1).map((r) => svg`<polygon points=${r.points.map((p) => p.join(',')).join(' ')} class="field" style=${active('field', r.id) ? 'stroke:var(--sw-on-video);stroke-width:6' : ''}></polygon>${r.points.map((p) => svg`<circle class="handle field" cx=${p[0]} cy=${p[1]} r="9"></circle>`)}`) : nothing}
      ${ed.line ? ed.line.lines.filter((l) => l.points.length >= 1 && !(l.points[0][0] === 0 && l.points[0][1] === 1000)).map((l) => svg`<polyline points=${l.points.map((p) => p.join(',')).join(' ')} class="line ${l.enabled ? '' : 'off'}" style=${active('line', l.id) ? 'stroke:var(--sw-on-video)' : ''}></polyline>${l.points.map((p) => svg`<circle class="handle line" cx=${p[0]} cy=${p[1]} r="9"></circle>`)}`) : nothing}
    `;
  }

  private renderSmartEditor() {
    const ed = this.smartEdit!;
    // MEDIUM-REST-2540 (SCR-27): a direction in words - a fixed arrow between two Hebrew words pointed against the reading
    const dir = (d: string) => ({ any: tr('שני הכיוונים'), 'left-right': tr('משמאל לימין'), 'right-left': tr('מימין לשמאל') })[d] ?? d;
    return html`<div class="legend" data-smart-editor style="display:grid;gap:8px;margin-block-start:8px">
      <div class="note">${tr('בחר כלל ולחץ על התמונה כדי לצייר: קו =')} <strong>${tr('שתי')}</strong> ${tr('לחיצות (התחלה וסוף — לחיצה נוספת מזיזה את הסוף); אזור פריצה =')} <strong>${tr('4 עד 10')}</strong> ${tr('לחיצות (נקודה לכל פינה), ואז ישר "שמור למקליט" למטה — אין צורך לסגור את הצורה. "אדם" / "רכב" = סינון אזעקות שווא (רק מטרה מסוג זה מפעילה).')}</div>
      ${ed.line ? html`<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-smart-lines>
          <label class="note" style="display:inline-flex;align-items:center;gap:4px"><sw-toggle size="sm" labelHidden in-label label=${tr('חציית קו פעילה')} data-smart-line-enabled .checked=${ed.line.enabled} @change=${(e: Event) => (this.smartEdit = { ...ed, line: { ...ed.line!, enabled: toggled(e) } })}></sw-toggle> ${tr('חציית קו פעילה')}</label>
          ${ed.line.lines.map((l) => html`<span style="display:inline-flex;gap:6px;align-items:center;border:1px solid var(--sw-border);border-radius:var(--sw-r-sm);padding:4px 8px" data-smart-line=${l.id}>
            <sw-chip ?selected=${ed.tool.type === 'line' && ed.tool.id === l.id} data-smart-pick-line=${l.id} @click=${() => (this.smartEdit = { ...ed, tool: { type: 'line', id: l.id } })}>${tr('קו {id}', { id: l.id })}${l.points.length === 2 && !(l.points[0][0] === 0 && l.points[0][1] === 1000) ? '' : ` · ${tr('לא מצויר')}`}</sw-chip>
            <label class="note"><sw-toggle size="sm" labelHidden in-label label=${tr('פעיל')} .checked=${l.enabled} @change=${(e: Event) => (this.smartEdit = { ...ed, line: { ...ed.line!, lines: ed.line!.lines.map((x) => (x.id === l.id ? { ...x, enabled: toggled(e) } : x)) } })}></sw-toggle> ${tr('פעיל')}</label>
            <select class="note" aria-label=${tr('כיוון')} .value=${l.direction} @change=${(e: Event) => (this.smartEdit = { ...ed, line: { ...ed.line!, lines: ed.line!.lines.map((x) => (x.id === l.id ? { ...x, direction: (e.target as HTMLSelectElement).value } : x)) } })}>${['any', 'left-right', 'right-left'].map((d) => html`<option value=${d} ?selected=${d === l.direction}>${dir(d)}</option>`)}</select>
            <label class="note">${tr('רגישות')} <input type="range" min="1" max="100" .value=${String(l.sensitivity)} @input=${(e: Event) => (this.smartEdit = { ...ed, line: { ...ed.line!, lines: ed.line!.lines.map((x) => (x.id === l.id ? { ...x, sensitivity: Number((e.target as HTMLInputElement).value) } : x)) } })} /> ${l.sensitivity}</label>
            <label class="note"><input type="checkbox" .checked=${l.human} @change=${(e: Event) => (this.smartEdit = { ...ed, line: { ...ed.line!, lines: ed.line!.lines.map((x) => (x.id === l.id ? { ...x, human: (e.target as HTMLInputElement).checked } : x)) } })} /> ${tr('אדם')}</label>
            <label class="note"><input type="checkbox" .checked=${l.vehicle} @change=${(e: Event) => (this.smartEdit = { ...ed, line: { ...ed.line!, lines: ed.line!.lines.map((x) => (x.id === l.id ? { ...x, vehicle: (e.target as HTMLInputElement).checked } : x)) } })} /> ${tr('רכב')}</label>
          </span>`)}
        </div>` : nothing}
      ${ed.field ? html`<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-smart-regions>
          <label class="note" style="display:inline-flex;align-items:center;gap:4px"><sw-toggle size="sm" labelHidden in-label label=${tr('פריצה לאזור פעילה')} data-smart-field-enabled .checked=${ed.field.enabled} @change=${(e: Event) => (this.smartEdit = { ...ed, field: { ...ed.field!, enabled: toggled(e) } })}></sw-toggle> ${tr('פריצה לאזור פעילה')}</label>
          ${ed.field.regions.map((r) => html`<span style="display:inline-flex;gap:6px;align-items:center;border:1px solid var(--sw-border);border-radius:var(--sw-r-sm);padding:4px 8px" data-smart-region=${r.id}>
            <sw-chip ?selected=${ed.tool.type === 'field' && ed.tool.id === r.id} data-smart-pick-region=${r.id} @click=${() => (this.smartEdit = { ...ed, tool: { type: 'field', id: r.id } })}>${tr('אזור {id}', { id: r.id })} · ${tr('{n} נק׳', { n: r.points.length })}</sw-chip>
            <sw-button size="sm" variant="ghost" data-smart-region-clear=${r.id} @click=${() => (this.smartEdit = { ...ed, field: { ...ed.field!, regions: ed.field!.regions.map((x) => (x.id === r.id ? { ...x, points: [] } : x)) } })}>${tr('נקה')}</sw-button>
            <label class="note">${tr('רגישות')} <input type="range" min="1" max="100" .value=${String(r.sensitivity)} @input=${(e: Event) => (this.smartEdit = { ...ed, field: { ...ed.field!, regions: ed.field!.regions.map((x) => (x.id === r.id ? { ...x, sensitivity: Number((e.target as HTMLInputElement).value) } : x)) } })} /> ${r.sensitivity}</label>
            <label class="note"><input type="checkbox" .checked=${r.human} @change=${(e: Event) => (this.smartEdit = { ...ed, field: { ...ed.field!, regions: ed.field!.regions.map((x) => (x.id === r.id ? { ...x, human: (e.target as HTMLInputElement).checked } : x)) } })} /> ${tr('אדם')}</label>
            <label class="note"><input type="checkbox" .checked=${r.vehicle} @change=${(e: Event) => (this.smartEdit = { ...ed, field: { ...ed.field!, regions: ed.field!.regions.map((x) => (x.id === r.id ? { ...x, vehicle: (e.target as HTMLInputElement).checked } : x)) } })} /> ${tr('רכב')}</label>
          </span>`)}
        </div>` : nothing}
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <span class="grow"></span>
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${this.smartBusy} data-smart-save @click=${() => this.saveSmart()}>${this.smartBusy ? tr('כותב…') : tr('שמור למקליט')}</sw-button>
        <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.smartBusy} data-smart-cancel @click=${() => (this.smartEdit = null)}>${tr('ביטול')}</sw-button>
      </div>
    </div>`;
  }

  private async saveRename() {
    if (this.renameTo === null || !this.cam || this.renameBusy || this.cam.id !== this.cameraId) return;
    const gen = this.camGen;
    this.renameBusy = true;
    this.renameMsg = '';
    try {
      const saved = await updateCamera(this.cam.id, { alias: this.renameTo.trim() });
      if (gen !== this.camGen || !this.cam) return;
      this.cam = { ...this.cam, ...saved };
      this.cams = this.cams.map((c) => (c.id === saved.id ? { ...c, ...saved } : c));
      this.renameTo = null;
      void this.loadOsd();
    } catch (err) {
      if (gen === this.camGen) this.renameMsg = describeError(err);
    } finally {
      if (gen === this.camGen) this.renameBusy = false;
    }
  }

  private renderRename() {
    if (this.renameTo === null) return nothing;
    return html`<sw-dialog open heading=${tr('שינוי שם המצלמה')} subheading=${tr('השם במערכת (בקיר, במפה, באירועים). השם במקליט לא משתנה, אלא אם כותבים אותו מסעיף ה־OSD למטה.')} data-rename-dialog @close=${() => (this.renameTo = null)}>
      <sw-field label=${tr('שם')}><input data-rename-input maxlength="80" .value=${this.renameTo} placeholder=${this.cam?.name_source ?? ''} @input=${(e: Event) => (this.renameTo = (e.target as HTMLInputElement).value)} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') void this.saveRename(); }} /></sw-field>
      <div class="note">${tr('ריק = השם מהמקליט')}${this.cam?.name_source ? ` („${this.cam.name_source}“)` : ''}.</div>
      ${this.renameMsg ? html`<div class="note" style="color:var(--sw-danger)">${this.renameMsg}</div>` : nothing}
      <div slot="footer"><sw-button variant="primary" icon="check" ?disabled=${this.renameBusy} data-rename-save @click=${() => this.saveRename()}>${tr('שמור')}</sw-button><sw-button variant="ghost" @click=${() => (this.renameTo = null)}>${tr('ביטול')}</sw-button></div>
    </sw-dialog>`;
  }

  private async loadOsd() {
    if (!this.cam || !isApi()) return;
    if (!canReadNvrConfig()) {
      this.osd = null; // the OSD card is for NVR writers; nothing to read for anyone else
      return;
    }
    const gen = this.camGen;
    try {
      const osd = await osdStatus(this.cam.id);
      if (gen === this.camGen) this.osd = osd;
    } catch {
      if (gen === this.camGen) this.osd = null;
    }
  }

  private async osdAction(label: string, run: () => Promise<unknown>) {
    // the OSD row shows the camera on screen; a write only while that is still the routed camera
    if (this.osdBusy || !this.cam || this.cam.id !== this.cameraId || this.osd?.camera_id !== this.cam.id) return;
    const gen = this.camGen;
    this.osdBusy = true;
    this.osdMsg = '';
    try {
      await run();
      if (gen !== this.camGen) return;
      this.osdMsg = `${label}: ${tr('נכתב למקליט ונרשם.')}`;
      await this.loadOsd();
    } catch (err) {
      if (gen === this.camGen) this.osdMsg = `${label}: ${describeError(err)}`;
    } finally {
      if (gen === this.camGen) this.osdBusy = false;
    }
  }

  // HONEST-STATES-2540 (SCR-29 / FC-01): the two OSD switches are controlled - they show what the NVR answers (`loadOsd` after the write),
  // never a value a refused write left behind
  private renderOsd() {
    const o = this.osd;
    if (!o || !o.can_write) return nothing;
    const same = (o.nvr_name ?? '') === o.vms_name;
    return html`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-osd>
      <span>${tr('שם במקליט:')} <b data-osd-nvr-name>${o.nvr_name ?? '—'}</b>${same ? ` ${tr('(זהה לשם ב־Arx)')}` : ` · ${tr('ב־Arx: {name}', { name: o.vms_name })}`}</span>
      <sw-button size="sm" icon="edit" ?disabled=${this.osdBusy || same} data-osd-write-name @click=${() => this.osdAction(tr('שם הערוץ'), () => writeChannelName(this.cam!.id))}>${tr('כתוב את השם מ־Arx למקליט')}</sw-button>
      ${o.channel_name ? html`<label style="display:inline-flex;gap:4px;align-items:center"><sw-toggle size="sm" controlled labelHidden in-label label=${tr('שם על התמונה')} data-osd-name-enabled .checked=${o.channel_name.enabled} ?disabled=${this.osdBusy} @change=${(e: Event) => this.osdAction(tr('שם על התמונה'), () => setOsd(this.cam!.id, { name_enabled: toggled(e) }))}></sw-toggle> ${tr('שם על התמונה')}</label>` : nothing}
      ${o.datetime ? html`<label style="display:inline-flex;gap:4px;align-items:center"><sw-toggle size="sm" controlled labelHidden in-label label=${tr('חותמת זמן')} data-osd-datetime-enabled .checked=${o.datetime.enabled} ?disabled=${this.osdBusy} @change=${(e: Event) => this.osdAction(tr('חותמת זמן'), () => setOsd(this.cam!.id, { datetime_enabled: toggled(e) }))}></sw-toggle> ${tr('חותמת זמן')}</label>
        <sw-field><select aria-label=${tr('פורמט תאריך')} data-osd-date-style ?disabled=${this.osdBusy} @change=${(e: Event) => this.osdAction(tr('פורמט תאריך'), () => setOsd(this.cam!.id, { date_style: (e.target as HTMLSelectElement).value }))}>${o.date_styles.map((d) => html`<option value=${d} ?selected=${d === o.datetime!.date_style}>${d}</option>`)}</select></sw-field>` : nothing}
      ${this.osdMsg ? html`<span data-osd-msg>${this.osdMsg}</span>` : nothing}
    </div>`;
  }

  // ---------------------------------------------------------------- CAMERA-REBOOT-2407: restart this camera through the NVR

  private async loadReboot() {
    if (!this.cam || !isApi() || !canReadNvrConfig()) {
      this.reboot = null; // the action is for NVR administrators; nothing to read for anyone else
      return;
    }
    const gen = this.camGen;
    try {
      const st = await cameraRebootState(this.cam.id);
      if (gen === this.camGen) this.reboot = st;
    } catch {
      if (gen === this.camGen) this.reboot = null;
    }
  }

  private async runReboot() {
    if (!this.cam || this.rebootBusy || this.cam.id !== this.cameraId) return;
    const gen = this.camGen;
    this.rebootBusy = true;
    this.rebootMsg = '';
    try {
      await rebootCamera(this.cam.id);
      if (gen === this.camGen) this.rebootMsg = crt('done');
    } catch (err) {
      if (gen === this.camGen) this.rebootMsg = rebootErrorText(err); // never retried: the press is the one confirmation
    } finally {
      if (gen === this.camGen) {
        this.rebootBusy = false;
        this.rebootOpen = false;
        await this.loadReboot();
      }
    }
  }

  private renderReboot() {
    const v = rebootView(this.reboot, this.rebootBusy);
    if (!v.shown || !this.cam) return nothing;
    const cam = this.cam;
    return html`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-camera-reboot data-enabled=${v.enabled ? 'yes' : 'no'}>
      <span>${crt('lead')}</span>
      <sw-button size="sm" variant="danger" icon="refresh" ?disabled=${!v.enabled} title=${v.reason || nothing} aria-describedby=${v.reason ? 'camera-reboot-reason' : nothing}
        data-camera-reboot-open @click=${() => { this.rebootMsg = ''; this.rebootOpen = true; }}>${this.rebootBusy ? crt('sending') : crt('button')}</sw-button>
      ${v.reason ? html`<span class="muted" id="camera-reboot-reason" data-camera-reboot-reason>${v.reason}</span>` : nothing}
      ${this.rebootMsg ? html`<span role="status" data-camera-reboot-msg>${this.rebootMsg}</span>` : nothing}
    </div>
    ${this.rebootOpen
      ? html`<sw-dialog open heading=${crt('dialogTitle')} subheading=${crt('dialogSub', { name: cam.name, channel: cam.channel ?? '—' })} data-camera-reboot-dialog @close=${() => (this.rebootOpen = false)}>
          <p>${crt('dialogText')}</p>
          <div slot="footer"><sw-button variant="danger" ?disabled=${this.rebootBusy} data-camera-reboot-run @click=${() => void this.runReboot()}>${crt('confirm')}</sw-button><sw-button variant="ghost" @click=${() => (this.rebootOpen = false)}>${crt('cancel')}</sw-button></div>
        </sw-dialog>`
      : nothing}`;
  }

  private async loadRecord() {
    if (!this.cam || !isApi()) return;
    const gen = this.camGen;
    let rec: RecordStatus | null;
    try {
      rec = await recordStatus(this.cam.id);
    } catch {
      rec = null;
    }
    if (gen !== this.camGen) return; // a newer camera owns the row (and its own poll)
    this.rec = rec;
    window.clearTimeout(this.recTimer);
    // LIVECAM-DRAFT-RESET-2435: the poll lives only while the screen is shown (disconnectedCallback clears it)
    if (this.rec?.active && this.isConnected) this.recTimer = window.setTimeout(() => void this.loadRecord(), 15000);
  }

  private async toggleRecord() {
    if (!this.cam || this.recBusy || this.cam.id !== this.cameraId) return;
    const gen = this.camGen;
    this.recBusy = true;
    this.recMsg = '';
    try {
      if (this.rec?.active) {
        await recordStop(this.cam.id);
        if (gen === this.camGen) this.recMsg = tr('ההקלטה הידנית נעצרה.');
      } else {
        const r = await recordStart(this.cam.id, this.recMinutes);
        if (gen === this.camGen) this.recMsg = tr('הקלטה ידנית החלה · תיעצר אוטומטית ב־{time}.', { time: timeText(new Date(r.stop_at)) });
      }
      if (gen === this.camGen) await this.loadRecord();
    } catch (err) {
      if (gen === this.camGen) this.recMsg = describeError(err);
    } finally {
      if (gen === this.camGen) this.recBusy = false;
    }
  }

  private renderRecord() {
    const r = this.rec;
    if (!r || !r.can_write) return nothing;
    const a = r.active;
    const mm = a ? `${Math.floor(a.remaining_s / 60)}:${String(a.remaining_s % 60).padStart(2, '0')}` : '';
    return html`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center" data-manual-record data-active=${a ? 'yes' : 'no'}>
      ${a
        ? html`<sw-badge kind="live" label=${tr('הקלטה ידנית פעילה · נותרו {time}', { time: mm })}></sw-badge>
          <sw-button size="sm" variant="danger" icon="close" ?disabled=${this.recBusy} data-record-stop @click=${() => this.toggleRecord()}>${tr('עצור הקלטה')}</sw-button>`
        : html`<sw-field><select aria-label=${tr('משך הקלטה ידנית')} data-record-minutes @change=${(e: Event) => (this.recMinutes = Number((e.target as HTMLSelectElement).value))}>${[5, 10, 30, 60, 120].map((m) => html`<option value=${m} ?selected=${m === this.recMinutes}>${tr('{n} דק׳', { n: m })}</option>`)}</select></sw-field>
          <sw-button size="sm" variant="primary" icon="live" ?disabled=${this.recBusy || !r.track_id} data-record-start @click=${() => this.toggleRecord()}>${tr('הקלט עכשיו')}</sw-button>
          ${!r.track_id ? html`<span class="warn" data-record-unavailable>${tr('אין זרם ראשי זמין למצלמה זו כרגע, אי אפשר להקליט ידנית.')}</span>` : html`<span>${tr('הקלטה ידנית במקליט על הזרם הראשי; נעצרת אוטומטית בתום הזמן גם אם המסך נסגר. ההקלטה עצמה מצטרפת להקלטות הרגילות של הערוץ — היא נמצאת לפי הזמן במסך "הקלטות", לא בתגית נפרדת.')}</span>`}`}
      ${this.recMsg ? html`<span data-record-msg>${this.recMsg}</span>` : nothing}
    </div>`;
  }
  @state() private zoneLayers = { motion: true, privacy: true, intrusion: true, lines: true };
  /** T045 / T012: capability facts from the NVR (PTZ, presets, two-way audio), read-only. */
  @state() private caps: CameraCapabilities | null = null;
  @state() private capsError = '';
  @state() private cams: Camera[] = [];
  @state() private canConfigure = false;
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
  /** CR-028: casting this camera to a screen. `castShown` = the server says there is at least one screen to list (the button exists only then). */
  @state() private castShown = false;
  @state() private castOpen = false;
  @state() private castNote = '';
  private castWatch = new CastWatch(this);
  private castNoteTimer = 0;
  @query('[data-cast-button]') private castBtn?: HTMLElement;

  static styles = liveCameraStyles;

  connectedCallback() {
    super.connectedCallback();
    void this.load();
    if (this.hasUpdated && this.rec?.active) void this.loadRecord(); // re-attached: the poll stopped in disconnectedCallback
  }

  /** LIVECAM-DRAFT-RESET-2435: leaving the screen stops the 15 s manual-recording poll and the cast note timer. */
  disconnectedCallback() {
    window.clearTimeout(this.recTimer);
    window.clearTimeout(this.castNoteTimer);
    this.recTimer = 0;
    this.castNoteTimer = 0;
    super.disconnectedCallback();
  }

  protected willUpdate(changed: Map<string, unknown>) {
    // the same element, another camera: nothing of the previous camera may survive into this render (LC-1)
    if (changed.has('cameraId') && changed.get('cameraId') !== undefined) this.resetCameraState();
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('cameraId') && changed.get('cameraId') !== undefined) void this.load();
    if (changed.has('cam') && this.cam && isApi()) void this.loadSource();
    // CAMERA-STREAM-SOURCES-2410: a camera without a recorder has nothing of a recorder to read (recording, OSD, reboot, schedules, zones)
    if (changed.has('cam') && this.cam && isApi() && !this.cam.standalone && !this.zonesBusy && (!this.zones || this.zones.camera_id !== this.cam.id)) {
      void this.loadRecord();
      void this.loadOsd();
      void this.loadReboot();
      void this.loadSchedules();
      this.zonesError = '';
      void this.loadZones();
    }
    if (changed.has('cam') && this.cam && isApi() && !this.cam.standalone && (!this.caps || this.caps.camera_id !== this.cam.id)) void this.loadCaps();
    if (changed.has('cam') && this.cam) void this.loadCastTargets();
  }

  private async loadZones(refresh = false) {
    if (!this.cam) return;
    const gen = this.camGen;
    this.zonesBusy = true;
    this.zonesError = '';
    try {
      const z = await cameraZones(this.cam.id, refresh);
      if (gen === this.camGen) this.zones = z;
    } catch (err) {
      if (gen === this.camGen) this.zonesError = describeError(err);
    } finally {
      if (gen === this.camGen) this.zonesBusy = false;
    }
  }

  private async loadCaps(refresh = false) {
    if (!this.cam) return;
    const gen = this.camGen;
    this.capsError = '';
    try {
      const c = await cameraCapabilities(this.cam.id, refresh);
      if (gen === this.camGen) this.caps = c;
    } catch (err) {
      if (gen === this.camGen) this.capsError = describeError(err);
    }
  }

  private renderCaps() {
    const c = this.caps;
    if (this.capsError && !c) return html`<div class="note" data-caps>${tr('יכולות המצלמה לא נקראו מהמקליט: {error}', { error: this.capsError })}</div>`;
    if (!c) return html`<div class="note" data-caps>${tr('קורא יכולות מהמקליט…')}</div>`;
    const ptzKind = c.ptz.state === 'supported' ? 'live' : c.ptz.state === 'unsupported' ? 'neutral' : 'unknown';
    const ptzLabel = c.ptz.state === 'supported' ? `${tr('PTZ: נתמך')}${c.ptz.preset_count !== null ? ` · ${c.ptz.preset_count} presets` : ''}` : c.ptz.state === 'unsupported' ? tr('PTZ: לא נתמך במצלמה זו') : tr('PTZ: לא ידוע');
    const audioKind = c.audio.state === 'available' ? 'live' : c.audio.state === 'disabled' ? 'stale' : c.audio.state === 'unsupported' ? 'neutral' : 'unknown';
    const audioLabel = c.audio.state === 'available' ? `${tr('שמע דו־כיווני: ערוץ פעיל')}${c.audio.codec ? ` (${c.audio.codec})` : ''}` : c.audio.state === 'disabled' ? tr('שמע דו־כיווני: ערוץ קיים אך כבוי במכשיר') : c.audio.state === 'unsupported' ? tr('שמע דו־כיווני: אין ערוץ למצלמה זו') : tr('שמע דו־כיווני: לא ידוע');
    return html`<div class="note" style="margin-block-start:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center" data-caps data-ptz=${c.ptz.state} data-audio=${c.audio.state}>
      <sw-badge kind=${ptzKind} label=${ptzLabel} title=${c.ptz.reason ?? ''}></sw-badge>
      <sw-badge kind=${audioKind} label=${audioLabel} title=${c.audio.reason ?? ''}></sw-badge>
      <sw-badge kind="neutral" label=${tr('זום דיגיטלי: הגדלה בדפדפן בלבד, לא הנעת מצלמה')}></sw-badge>
      ${c.video?.main ? html`<sw-badge data-caps-webrtc kind=${c.video.main.webrtc === 'ok' ? 'live' : c.video.main.webrtc === 'no' ? 'stale' : 'unknown'} label=${`${tr('זרם ראשי {codec}', { codec: c.video.main.codec ?? '?' })}: ${c.video.main.webrtc === 'ok' ? tr('מתנגן ב־WebRTC') : c.video.main.webrtc === 'no' ? tr('לא יתנגן ב־WebRTC') : tr('WebRTC לא ידוע')}`}></sw-badge>` : nothing}
      ${c.video?.hint ? html`<span data-caps-webrtc-hint>${c.video.hint}.</span>` : nothing}
      <span>${c.ptz.reason ? `${tr('PTZ לפי המכשיר: {reason}.', { reason: c.ptz.reason })} ` : ''}${tr('הנעת PTZ, קריאת preset ודיבור הם כתיבה למכשיר ואינם מוצעים בפיילוט ללא אישור מפורש — אין פקד מדומה.')} ${tr('נקרא מהמקליט {time}', { time: c.fetched_at.replace('T', ' ').replace('Z', ' UTC') })}${c.cached ? ` ${tr('(מהמטמון)')}` : ''}.</span>
    </div>`;
  }

  private startMotionEdit() {
    const m = this.zones?.motion;
    if (!m || !m.rows || !m.cols || !this.zones) return;
    this.motionMsg = '';
    this.motionEdit = { camId: this.zones.camera_id, cells: m.cells.map((r) => [...r]), sensitivity: m.sensitivity ?? 50, enabled: m.enabled };
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
    if (!e || !this.cam || this.motionBusy) return;
    // the grid is written to the camera it was drawn on, and only while that camera is still on screen with its own zones (LC-1)
    const cam = this.draftTarget(e.camId);
    if (!cam || this.zones?.camera_id !== e.camId) {
      this.refuseStaleDraft('motion');
      return;
    }
    const gen = this.camGen;
    const d = this.motionDiff();
    this.motionBusy = true;
    try {
      const rec = await setMotion(e.camId, { ...(d.added || d.removed ? { cells: e.cells } : {}), ...(d.sensitivity ? { sensitivity: e.sensitivity } : {}), ...(d.enabled ? { enabled: e.enabled } : {}) });
      if (gen !== this.camGen) return;
      this.motionMsg = rec.status === 'unchanged' ? tr('המקליט כבר היה במצב הזה, לא נכתב דבר.') : tr('נכתב למקליט (שינוי {id}). ניתן להחזיר מהגדרות ‹ חיבורים ‹ שינויים אחרונים.', { id: rec.id.slice(0, 8) });
      this.motionEdit = null;
      this.motionConfirm = false;
      await this.loadZones(true);
    } catch (err) {
      if (gen !== this.camGen) return;
      this.motionMsg = describeError(err);
      this.motionConfirm = false;
    } finally {
      if (gen === this.camGen) this.motionBusy = false;
    }
  }

  private renderMotionEditor(m: NonNullable<CameraZones['motion']>) {
    const e = this.motionEdit!;
    const d = this.motionDiff();
    const changed = d.added || d.removed || d.sensitivity || d.enabled;
    const active = e.cells.flat().filter(Boolean).length;
    return html`<div class="legend" data-motion-editor>
      <span class="note">${tr('לחץ או גרור על התמונה כדי לסמן תאים שמזהים תנועה')} · ${tr('{n} מתוך {total} תאים', { n: active, total: m.rows * m.cols })}</span>
      <sw-button size="sm" variant="ghost" @click=${() => this.fillMotion(true)}>${tr('בחר הכל')}</sw-button>
      <sw-button size="sm" variant="ghost" @click=${() => this.fillMotion(false)}>${tr('נקה')}</sw-button>
      <label class="note" style="display:inline-flex;align-items:center;gap:6px">${tr('רגישות')} <input type="range" min=${this.zones?.sensitivity_caps?.min ?? 0} max=${this.zones?.sensitivity_caps?.max ?? 100} step=${this.zones?.sensitivity_caps?.step ?? 20} .value=${String(e.sensitivity)} data-motion-sensitivity @input=${(ev: Event) => (this.motionEdit = { ...e, sensitivity: Number((ev.target as HTMLInputElement).value) })} /> <b class="ltr">${e.sensitivity}</b></label>
      <label class="note" style="display:inline-flex;align-items:center;gap:6px"><sw-toggle size="sm" labelHidden in-label label=${tr('זיהוי תנועה פעיל')} .checked=${e.enabled} data-motion-enabled @change=${(ev: Event) => (this.motionEdit = { ...e, enabled: toggled(ev) })}></sw-toggle> ${tr('זיהוי תנועה פעיל')}</label>
      <span class="grow"></span>
      <sw-button variant="primary" size="sm" icon="check" ?disabled=${!changed || this.motionBusy} data-motion-save @click=${() => (this.motionConfirm = true)}>${tr('שמור למקליט')}</sw-button>
      <sw-button size="sm" variant="ghost" icon="close" ?disabled=${this.motionBusy} data-motion-cancel @click=${() => (this.motionEdit = null)}>${tr('ביטול')}</sw-button>
      ${this.motionConfirm
        ? html`<sw-dialog open heading=${tr('כתיבה למקליט: זיהוי תנועה')} subheading=${`${this.cam?.name ?? ''} · ${tr('ערוץ {n}', { n: this.zones?.channel ?? '' })}`} data-motion-confirm @close=${() => (this.motionConfirm = false)}>
            <div style="font-size:var(--sw-fs-sm);line-height:1.6">
              <div>${d.added ? tr('+{n} תאים נוספים לזיהוי', { n: d.added }) : ''}${d.added && d.removed ? ' · ' : ''}${d.removed ? tr('−{n} תאים מוסרים', { n: d.removed }) : ''}${!d.added && !d.removed ? tr('הרשת ללא שינוי') : ''}</div>
              <!-- MEDIUM-REST-2540 (SCR-27): before -> after with each value isolated and the arrow of the reading direction (was "60 → 40"
                   for 40 -> 60 in Hebrew) -->
              <div>${tr('רגישות:')} <span data-motion-change="sensitivity">${d.sensitivity ? changeText(m.sensitivity ?? '—', e.sensitivity) : tr('ללא שינוי')}</span> · ${tr('זיהוי:')} <span data-motion-change="enabled">${d.enabled ? (e.enabled ? changeText(tr('כבוי'), tr('פעיל')) : changeText(tr('פעיל'), tr('כבוי'))) : tr('ללא שינוי')}</span></div>
              <div style="margin-block-start:6px;color:var(--sw-text-3)">${tr('המסמך לפני ואחרי נשמר, השינוי נרשם באודיט וניתן להחזרה. ההקלטות אינן מושפעות; אזור שלא מסומן לא יפעיל הקלטת תנועה.')}</div>
            </div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.motionBusy} data-motion-confirm-run @click=${() => this.saveMotion()}>${this.motionBusy ? tr('כותב…') : tr('כתוב למקליט')}</sw-button><sw-button variant="ghost" @click=${() => (this.motionConfirm = false)}>${tr('ביטול')}</sw-button></div>
          </sw-dialog>`
        : nothing}
    </div>`;
  }

  private renderZones(cam: Camera) {
    const z = this.zones;
    if (this.zonesBusy && !z) return html`<div class="note">${tr('קורא את הגדרות הזיהוי מהמקליט…')}</div>`;
    if (this.zonesError && !z) return html`<div class="note">${this.zonesError} <sw-button size="sm" @click=${() => this.loadZones(true)}>${tr('נסה שוב')}</sw-button></div>`;
    if (!z) return html`<div class="note">—</div>`;
    const L = this.zoneLayers;
    const m = z.motion;
    const scale = (pts: number[][], n: { width: number; height: number }) => pts.map(([x, y]) => `${(x / n.width) * 1000},${(y / n.height) * 1000}`).join(' ');
    const target = (t: string) => (t === 'human' ? tr('אדם') : t === 'vehicle' ? tr('רכב') : t);
    return html`
      <div class="zones" data-zones-loaded>
        <div class="frame">
          <img src=${snapshotUrl(cam.id)} alt="" />
          <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label=${tr('אזורי זיהוי מעל תמונת המצלמה')} style=${this.smartEdit ? 'cursor:crosshair' : ''} data-zones-svg @click=${(e: MouseEvent) => this.smartClick(e)}>
            ${this.motionEdit && m && m.rows && m.cols
              ? this.motionEdit.cells.flatMap((row, r) => row.map((on, c) => svg`<rect class=${on ? 'cell' : 'cell off'} data-motion-cell=${`${r}-${c}`} x=${(c * 1000) / m.cols} y=${(r * 1000) / m.rows} width=${1000 / m.cols} height=${1000 / m.rows} style="cursor:crosshair;${on ? '' : 'fill:color-mix(in srgb, var(--sw-on-video) 3%, transparent);stroke:var(--sw-video-line)'}" @pointerdown=${(ev: PointerEvent) => { ev.preventDefault(); this.paintCell(r, c, true); }} @pointerenter=${(ev: PointerEvent) => { if (ev.buttons & 1) this.paintCell(r, c); }} @pointerup=${() => (this.paintValue = null)}></rect>`))
              : nothing}
            ${!this.motionEdit && L.motion && m && m.rows && m.cols ? m.cells.flatMap((row, r) => row.map((on, c) => (on ? svg`<rect x=${(c * 1000) / m.cols} y=${(r * 1000) / m.rows} width=${1000 / m.cols} height=${1000 / m.rows} class="cell"></rect>` : nothing))) : nothing}
            ${L.privacy && z.privacy_mask ? z.privacy_mask.regions.map((reg) => svg`<polygon points=${scale(reg.points, z.privacy_mask!.normalized)} class="mask"></polygon>`) : nothing}
            ${L.intrusion && z.intrusion && !this.smartEdit ? z.intrusion.regions.map((reg) => svg`<polygon points=${scale(reg.points, z.intrusion!.normalized)} class="field"></polygon>`) : nothing}
            ${L.lines && z.line_crossing && !this.smartEdit ? z.line_crossing.lines.map((ln) => svg`<polyline points=${scale(ln.points, z.line_crossing!.normalized)} class="line ${ln.enabled ? '' : 'off'}"></polyline>`) : nothing}
            ${this.renderSmartOverlay()}
          </svg>
        </div>
        <div class="legend">
          <sw-chip data-zone-layer="motion" ?selected=${L.motion} @click=${() => (this.zoneLayers = { ...L, motion: !L.motion })}>${tr('תנועה')}${m ? ` · ${m.enabled ? tr('פעיל') : tr('כבוי')} · ${tr('{pct}% מהתמונה', { pct: m.coverage_pct })} · ${tr('רגישות {n}', { n: m.sensitivity ?? '?' })}${m.target_types.length ? ` · ${m.target_types.map(target).join('/')}` : ''}` : ` · ${tr('לא נקרא')}`}</sw-chip>
          <sw-chip data-zone-layer="privacy" ?selected=${L.privacy} @click=${() => (this.zoneLayers = { ...L, privacy: !L.privacy })}>${tr('מסכת פרטיות')}${z.privacy_mask ? ` · ${z.privacy_mask.enabled ? tr('פעילה') : tr('כבויה')} · ${tr('{n} אזורים', { n: z.privacy_mask.regions.length })}` : ` · ${tr('לא נקרא')}`}</sw-chip>
          <sw-chip data-zone-layer="intrusion" ?selected=${L.intrusion} @click=${() => (this.zoneLayers = { ...L, intrusion: !L.intrusion })}>${tr('חדירה לאזור')}${z.intrusion ? ` · ${z.intrusion.enabled ? tr('פעיל') : tr('כבוי')} · ${tr('{n} אזורים', { n: z.intrusion.regions.length })}` : ` · ${tr('לא נקרא')}`}</sw-chip>
          <sw-chip data-zone-layer="lines" ?selected=${L.lines} @click=${() => (this.zoneLayers = { ...L, lines: !L.lines })}>${tr('חציית קו')}${z.line_crossing ? ` · ${z.line_crossing.enabled ? tr('פעיל') : tr('כבוי')} · ${tr('{n} קווים', { n: z.line_crossing.lines.length })}` : ` · ${tr('לא נקרא')}`}</sw-chip>
          <sw-button size="sm" variant="ghost" icon="refresh" ?disabled=${this.zonesBusy} @click=${() => this.loadZones(true)}>${tr('רענון מהמקליט')}</sw-button>
          ${z.can_edit_motion && m && m.rows && m.cols && !this.motionEdit ? html`<sw-button size="sm" icon="edit" data-motion-edit @click=${() => this.startMotionEdit()}>${tr('עריכת אזורי תנועה')}</sw-button>` : nothing}
          ${this.smart?.can_write && (this.smart.line || this.smart.field) && !this.smartEdit && !this.motionEdit ? html`<sw-button size="sm" icon="edit" data-smart-edit @click=${() => this.startSmartEdit()}>${tr('עריכת כללים חכמים')}</sw-button>` : nothing}
        </div>
        ${this.motionEdit && m ? this.renderMotionEditor(m) : nothing}
        ${this.smartEdit ? this.renderSmartEditor() : nothing}
        ${this.smartMsg ? html`<div class="note" data-smart-msg>${this.smartMsg}</div>` : nothing}
        ${this.motionMsg ? html`<div class="note" data-motion-msg>${this.motionMsg}</div>` : nothing}
        ${Object.keys(z.unsupported).length ? html`<div class="note">${tr('לא נקרא מהמכשיר:')} ${Object.entries(z.unsupported).map(([k, v]) => `${k} (${v})`).join(', ')}</div>` : nothing}
        <div class="note" data-zones-note>${tr('קריאה בלבד מהמקליט (נקרא {time}{cached}).', { time: z.fetched_at.replace('T', ' ').replace('Z', ' UTC'), cached: z.cached ? tr(', מהמטמון') : '' })} ${tr('אלו פוליגונים בתמונת המצלמה — לא חדרים במפה. שכבת־על בדפדפן אינה מסכת מקליט ואינה מגינה על הקלטות; עריכה או מסכה אמיתית דורשות אישור מפורש, כתיבה מאומתת ובדיקת התוצאה בזרם.')}</div>
      </div>`;
  }

  private async load() {
    const gen = this.camGen;
    this.loading = true;
    this.error = '';
    try {
      if (isApi()) {
        const [list, settings] = await Promise.all([listCameras(), productSettings()]);
        if (gen !== this.camGen) return; // the route moved on to another camera; its own load() fills the screen
        this.cams = list.cameras;
        this.cam = list.cameras.find((c) => c.id === this.cameraId) ?? null;
        this.canConfigure = list.can_sync;
        this.settings = settings;
        this.transport = effectiveTransport(settings);
        // CR-008 D7: a remote viewer starts on remote.default_profile (over WebRTC - the player's plan)
        const remote = remoteVideo();
        if (remote) this.profile = remote.defaultProfile;
      }
    } catch (err) {
      if (gen === this.camGen) this.error = describeError(err);
    } finally {
      if (gen === this.camGen) this.loading = false;
    }
  }

  /** VIDEO-TRANSPORT-2400: the viewer's own choice, saved on the server (/me/prefs `video.transport`, also in "החשבון שלי › וידאו") so it
   * follows the viewer to every screen and device; picking the installation's own choice hands it back to the installation. It
   * replaces the per-browser override of earlier versions. A refused save springs back to what the server holds. */
  private setTransport(t: Transport) {
    const installation = cachedVideoPolicy()?.installation ?? this.settings?.['media.transport_default'] ?? TRANSPORT_DEFAULT;
    this.transport = t;
    void setPersonalTransport(t === installation ? null : t)
      .then((p) => {
        if (p) this.transport = p.choice;
      })
      .catch(() => (this.transport = effectiveTransport(this.settings)));
  }

  private onPlayer(e: CustomEvent<{ status: string; transport?: string; error?: string }>) {
    this.playerStatus = e.detail.status;
    this.playerTransport = e.detail.transport ?? '';
  }

  private renderApi() {
    const cam = this.cam;
    if (this.loading) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    if (this.error) return html`<sw-state-panel state="error" hint=${this.error} actionLabel=${tr('נסה שוב')} @action=${() => this.load()}></sw-state-panel>`;
    if (!cam) return html`<sw-state-panel state="forbidden" heading=${tr('המצלמה לא זמינה')} hint=${tr('המצלמה לא נמצאה או שאין לך הרשאת צפייה בה.')}></sw-state-panel>`;
    const canView = cam.can_view_live !== false && cam.status !== 'offline';
    const pane = cameraPane(cam, webrtcServer()); // EVIDENCE-CAMERAS-2412: no video server - the notice also over a stale offline status
    const poster = snapshotUrl(cam.id, this.posterBust);
    const stream = cam.stream;
    const remote = remoteVideoFor(this.transport);
    const plan = playerPlan(this.profile, cam.encoding, this.transport);
    return html`<div class="stage"><div class="stage-main"><div class="vbox">
      <div class="video ${pane === 'off' ? 'off' : ''}">
        ${pane === 'still'
          ? html`<sw-camera-tile data-live-still name=${cam.name} state="live" cameraId=${cam.id} poster=${snapshotUrl(cam.id)} .stillRefresh=${cam.still_refresh_s ?? 10} noDemo></sw-camera-tile>`
          : pane === 'webrtc_required' // NVRLESS-CAMERAS-2411 (owner, 08.11): no video server - say so instead of an empty player
          ? html`<div class="center" data-webrtc-required><div><sw-icon name="camera" size=${32}></sw-icon><span>${WEBRTC_REQUIRED_TEXT}</span> <a href=${WEBRTC_SETTINGS_HREF}>${WEBRTC_SETTINGS_LABEL}</a></div></div>`
          : pane === 'player'
          ? html`<sw-live-player .cameraId=${cam.id} .profile=${this.profile} .mode=${this.transport} .plan=${plan.plan} .preferred=${plan.preferred} .gop=${plan.gop} .encoding=${cam.encoding ?? null} .poster=${poster} @player-status=${this.onPlayer}></sw-live-player>`
          : html`<div class="center"><div><sw-icon name="offline" size=${32}></sw-icon><span data-camera-off-reason>${cam.recorder_enabled === false ? tr('המקליט של המצלמה מושבת') : cam.status === 'offline' && cam.video_source === 'manual' ? cst('offline') : cam.status === 'offline' ? tr('המצלמה מנותקת מהמקליט (לפי הסנכרון האחרון)') : tr('אין הרשאת צפייה חיה במצלמה זו')}</span></div></div>`}
      </div></div>
      ${canView && cam.live_kind === 'still' ? html`<div class="note" data-live-still-note>${fx().live.stillExplain.replace('{n}', String(cam.still_refresh_s ?? 10))}</div>` : nothing}
      <div class="controls" data-player=${this.playerStatus === 'playing' ? 'playing' : this.playerStatus === 'error' ? 'error' : 'connecting'}>
        <div class="round" role="group" aria-label=${tr('פקדי מצלמה')}>
          <button title=${tr('רענון תמונה')} aria-label=${tr('רענון תמונה')} @click=${() => (this.posterBust = Date.now())}><sw-icon name="aperture" size=${16}></sw-icon></button>
          <button title=${tr('מסך מלא')} aria-label=${tr('מסך מלא')} ?disabled=${this.playerStatus !== 'playing'} @click=${() => this.player?.fullscreen()}><sw-icon name="expand" size=${16}></sw-icon></button>
          ${this.castShown ? html`<button type="button" data-cast-button title=${heT('cast.button')} aria-label=${heT('cast.button')} aria-haspopup="dialog" aria-expanded=${this.castOpen ? 'true' : 'false'} @click=${() => (this.castOpen = !this.castOpen)}><sw-icon name="cast" size=${16}></sw-icon></button>` : nothing}
          <button title=${tr('התחבר מחדש')} aria-label=${tr('התחבר מחדש')} @click=${() => this.player?.reconnect()}><sw-icon name="refresh" size=${16}></sw-icon></button>
          <button class="q ${this.profile === 'main' ? 'on' : ''}" @click=${() => (this.profile = 'main')}>${tr('ראשי')}</button>
          <button class="q ${this.profile === 'sub' ? 'on' : ''}" @click=${() => (this.profile = 'sub')}>${tr('משני')}</button>
          <div class="transport" role="group" aria-label=${tr('תעבורה')} data-transport-choice=${this.transport}>
            ${(['auto', 'webrtc', 'mse'] as Transport[]).map((t) => html`<button class=${this.transport === t ? 'on' : ''} aria-pressed=${String(this.transport === t)} @click=${() => this.setTransport(t)}>${t === 'auto' ? tr('אוטומטי') : t === 'webrtc' ? 'WebRTC' : 'MSE'}</button>`)}
          </div>
          ${cachedVideoPolicy()?.source === 'personal' ? html`<span class="note" data-transport-own>${tr('ברירת המחדל של המערכת:')} ${transportLabel(cachedVideoPolicy()?.installation ?? this.settings?.['media.transport_default'] ?? TRANSPORT_DEFAULT)}</span>` : nothing}
          ${remote && this.settings?.['media.video_notices'] === 'true'
            ? html`<span class="note" data-remote-video-policy>${tr('גישה מרחוק:')} ${this.transport === 'mse' ? tr('MSE בלבד') : this.transport === 'webrtc' ? tr('WebRTC בלבד · בלי MSE') : `${tr('WebRTC תחילה')} · ${remote.mseFallback ? tr('MSE רק כמוצא אחרון') : tr('בלי MSE')}`}</span>`
            : nothing}
        </div>
        ${this.playerStatus === 'playing' && this.settings?.['media.video_notices'] !== 'true' ? nothing : html`<div class="note">${this.playerStatus === 'playing' ? tr('מנגן דרך {transport}', { transport: this.playerTransport === 'webrtc' ? 'WebRTC' : 'MSE' }) : this.playerStatus === 'error' ? tr('הזרם לא זמין') : this.playerStatus === 'ended' ? tr('הסתיים') : tr('מתחבר…')}</div>`}
      </div>
      ${this.renderCast(cam)}
      </div><div class="stage-side">
      <frigate-camera-control camera-id=${cam.id} recorder-id=${cam.recorder_id} data-live-frigate-control></frigate-camera-control>
      ${this.renderSettingsAccordion(cam, stream)}
    </div></div>`;
  }

  /** CR-028: the status line of MY cast of this camera (screen, countdown, stop) and the picker. Nothing is drawn when the person cannot cast. */
  private renderCast(cam: Camera) {
    void this.castWatch;
    if (!this.castShown && !castStore.open().some((x) => x.mine && x.camera_id === cam.id)) return nothing;
    const now = castStore.now;
    const mine = castStore.open().filter((x) => x.mine && x.camera_id === cam.id);
    return html`
      ${mine.map((x: CastSession) => html`<div class="cast-status" data-cast-status data-cast-status-state=${x.state} role="status">
        <sw-icon name="cast" size=${15}></sw-icon>
        <span class="who">${x.state === 'not_confirmed' ? heT('cast.notConfirmed') : x.state === 'starting' ? `${heT('cast.starting2')} · ${x.screen_name}` : `${heT('cast.playing')}: ${x.screen_name}`}</span>
        ${x.state === 'playing' ? html`<span class=${isLow(x, now) ? 'low' : ''} data-cast-status-left>${leftText(x, now)}</span>` : nothing}
        <sw-cast-stop .session=${x} @cast-stopped=${() => this.flashCast(heT('cast.stopped'))}></sw-cast-stop>
      </div>`)}
      ${this.castNote ? html`<div class="note" data-cast-note role="status">${this.castNote}</div>` : nothing}
      <sw-cast-picker .open=${this.castOpen} .cameraId=${cam.id} .cameraName=${cam.alias || cam.name} .anchor=${this.castBtn ?? null} .profile=${this.profile}
        .phone=${isPhoneWidth()} .ddPhone=${document.documentElement.getAttribute('data-dd-phone') ?? ''} ?remote=${onRemote()}
        @close=${() => (this.castOpen = false)} @cast-started=${() => this.flashCast(heT('cast.started'))}></sw-cast-picker>`;
  }

  private flashCast(msg: string) {
    this.castNote = msg;
    window.clearTimeout(this.castNoteTimer);
    this.castNoteTimer = window.setTimeout(() => (this.castNote = ''), 4000);
  }

  /** The button's existence: a person with `media.cast`, a backend, and at least one screen in the server's list for this camera. */
  private async loadCastTargets() {
    if (!this.cam || !isApi() || !canAnywhere('media.cast')) {
      this.castShown = false;
      return;
    }
    const gen = this.camGen;
    try {
      const r = await castTargets(this.cam.id);
      if (gen === this.camGen) this.castShown = castButtonVisible({ api: true, hasCast: true, targets: r.targets.length, ready: r.ready });
    } catch {
      if (gen === this.camGen) this.castShown = false;
    }
  }

  /** Owner round 4 (2.6): the video used to share the screen with everything expanded below it - four cards plus
   * loose capability/record/OSD rows. All of it now lives under one "camera settings" toggle, collapsed by
   * default, and each setting inside is its own collapsed row so the video stays the first thing you see. */
  private renderSettingsAccordion(cam: Camera, stream: Camera['stream']) {
    const caps = this.renderCaps();
    const record = this.renderRecord();
    const osd = this.renderOsd();
    const reboot = this.renderReboot();
    const source = this.renderSource(cam);
    const rec = recorderActions(cam);
    return html`<details class="acc-root" data-camera-settings>
      <summary><sw-icon class="chev" name="chevron" size=${16}></sw-icon>${tr('הגדרות מצלמה')}</summary>
      <div class="acc-body">
        ${source !== nothing
          ? html`<details class="acc" data-acc-source ?open=${this.sourceOpen || !!this.sourceMsg || this.source?.health?.state === 'failing'}>
              <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${cst('section')}</span>${this.source?.mode === 'manual' ? html`<sw-badge kind=${this.source.health?.state === 'failing' ? 'offline' : 'neutral'} label=${cst('manual')}></sw-badge>` : nothing}</summary>
              <div class="acc-content">${source}</div>
            </details>`
          : nothing}
        ${!rec.recording ? html`<div class="note" data-camera-standalone-note>${cst('standaloneNote')} ${rec.reason}</div>` : nothing}
        ${record !== nothing
          ? html`<details class="acc" data-acc-record ?open=${!!this.rec?.active}>
              <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${tr('הקלטה ידנית')}</span>${this.rec?.active ? html`<sw-badge kind="live" label=${tr('פעילה')}></sw-badge>` : nothing}</summary>
              <div class="acc-content">${record}</div>
            </details>`
          : nothing}
        <details class="acc" data-acc-details>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${tr('פרטים')}</span></summary>
          <div class="acc-content">
            <dl>
              <dt>${tr('מצב')}</dt><dd><sw-badge kind=${cam.status === 'online' ? 'live' : cam.status === 'offline' ? 'offline' : 'unknown'}></sw-badge></dd>
              ${cam.standalone
                ? html`<dt>${cst('section')}</dt><dd>${cst('manual')} · ${cst('noRecorder')}</dd>`
                : html`<dt>${tr('ערוץ')}</dt><dd>${cam.channel} · <span class="ltr">track ${cam.main_track ?? '?'}</span></dd>
              <dt>${tr('שם במקליט')}</dt><dd>${cam.name_source || '—'}</dd>`}
              <dt>${tr('זרם ראשי')}</dt><dd>${stream ? `${stream.resolution ?? ''} · ${stream.fps ?? '?'} fps · ${stream.bitrate_kbps ?? '?'} kbps` : tr('לא נבדק')}</dd>
              ${cam.standalone ? nothing : html`<dt>${tr('זמן מקור')}</dt><dd>${heT('videoCopy.sourceTime')}</dd>`}
              <dt>${tr('נראתה לאחרונה')}</dt><dd>${cam.last_seen_at ? cam.last_seen_at.replace('T', ' ').replace('Z', ' UTC') : '—'}</dd>
            </dl>
            ${caps}
          </div>
        </details>
        ${osd !== nothing
          ? html`<details class="acc" data-acc-osd>
              <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${tr('OSD — כיתוב על התמונה')}</span></summary>
              <div class="acc-content">${osd}</div>
            </details>`
          : nothing}
        ${!rec.recording ? nothing : html`<details class="acc" data-acc-schedules>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${tr('לוחות זימון והקלטה — כפי שמוגדר במקליט')}</span></summary>
          <div class="acc-content">
            <div class="note">${tr('מתי כל זיהוי פעיל ומתי הערוץ מקליט (רציף / תנועה / אירוע) · עריכה דורשת הרשאה רגישה ונרשמת עם החזר')}</div>
            ${this.renderSchedules()}
          </div>
        </details>
        <details class="acc" data-acc-zones>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${tr('אזורי זיהוי ומסכות — כפי שמוגדר במקליט')}</span></summary>
          <div class="acc-content">${this.renderZones(cam)}</div>
        </details>`}
        ${reboot !== nothing
          ? html`<details class="acc" data-acc-reboot ?open=${this.rebootOpen || !!this.rebootMsg}>
              <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${crt('section')}</span></summary>
              <div class="acc-content">${reboot}</div>
            </details>`
          : nothing}
        <details class="acc" data-acc-more>
          <summary><span class="lbl"><sw-icon class="chev" name="chevron" size=${14}></sw-icon>${tr('מצלמות נוספות')}</span></summary>
          <div class="acc-content tiles">
            ${this.cams.filter((c) => c.id !== cam.id).slice(0, 4).map((c) => html`<sw-camera-tile compact name=${c.name} state=${c.status === 'online' ? 'live' : c.status === 'offline' ? 'offline' : 'unknown'} poster=${c.status === 'offline' ? '' : snapshotUrl(c.id)} @click=${() => navigate(`/live/cameras/${c.id}`)}></sw-camera-tile>`)}
          </div>
        </details>
      </div>
    </details>`;
  }

  private renderDemo() {
    const cam = demoWall.find((c) => c.id === this.cameraId) ?? demoWall[0];
    const canView = cam.state === 'live' || cam.state === 'stale';
    const scene = demoScene[cam.id] ?? 'lobby';
    return html`<div class="stage"><div class="stage-main"><div class="vbox">
      <div class="video ${canView ? scene : 'off'}">
        ${canView
          ? html`<sw-scene kind=${scene}></sw-scene><div class="shade"></div><span class="demo">${tr('דמו · אין שרת מחובר')}</span>
              <span class="stamp">2026-09-14 10:24:36</span>
              <span class="quality">${this.profile === 'main' ? '1440p · H.265' : '360p · H.264'}</span>`
          : html`<div class="center"><div>
              <sw-icon name=${cam.state === 'offline' ? 'offline' : 'lock'} size=${32}></sw-icon>
              <span>${cam.state === 'offline' ? tr('המצלמה אינה מחוברת למקליט') : tr('אין הרשאת צפייה במצלמה זו')}</span>
            </div></div>`}
      </div></div>
      <div class="controls" data-player=${canView ? 'playing' : 'error'}>
        <div class="round" role="group" aria-label=${tr('פקדי מצלמה')}>
          ${cam.audio ? html`<button title=${tr('מיקרופון')} aria-label=${tr('מיקרופון')} ?disabled=${!canView}><sw-icon name="mic" size=${16}></sw-icon></button><button title=${tr('שמע')} aria-label=${tr('שמע')} ?disabled=${!canView}><sw-icon name="volume" size=${16}></sw-icon></button>` : nothing}
          <button title=${tr('צילום מסך')} aria-label=${tr('צילום מסך')} ?disabled=${!canView}><sw-icon name="aperture" size=${16}></sw-icon></button>
          <button title=${tr('מסך מלא')} aria-label=${tr('מסך מלא')} ?disabled=${!canView}><sw-icon name="expand" size=${16}></sw-icon></button>
          <button class="q ${this.profile === 'main' ? 'on' : ''}" @click=${() => (this.profile = 'main')}>1440p</button>
          <button class="q ${this.profile === 'sub' ? 'on' : ''}" @click=${() => (this.profile = 'sub')}>360p</button>
        </div>
        ${cam.ptz
          ? html`<div class="ptz" role="group" aria-label=${tr('בקרת PTZ')}>
              <div class="joy">
                <button class="u" aria-label=${tr('למעלה')}><sw-icon name="chevronDown" size=${14} style="transform:rotate(180deg)"></sw-icon></button>
                <button class="d" aria-label=${tr('למטה')}><sw-icon name="chevronDown" size=${14}></sw-icon></button>
                <button class="l" aria-label=${tr('שמאלה')}><sw-icon name="chevron" size=${14} flip></sw-icon></button>
                <button class="r" aria-label=${tr('ימינה')}><sw-icon name="chevron" size=${14}></sw-icon></button>
                <span class="c" aria-hidden="true"></span>
              </div>
              <div class="zoom"><button aria-label=${tr('זום פנימה')}><sw-icon name="plus" size=${14}></sw-icon></button><button aria-label=${tr('זום החוצה')}><sw-icon name="minus" size=${14}></sw-icon></button></div>
            </div>`
          : nothing}
      </div>
      ${cam.ptz
        ? html`<div class="modes">
            <sw-chip icon="bookmark" ?selected=${this.ptzMode === 'presets'} @click=${() => (this.ptzMode = 'presets')}>${heT('videoCopy.presets')}</sw-chip>
            <sw-chip icon="target" ?selected=${this.ptzMode === 'track'} @click=${() => (this.ptzMode = 'track')}>${tr('מעקב אוטומטי')}</sw-chip>
            <sw-chip icon="route" ?selected=${this.ptzMode === 'patrol'} @click=${() => (this.ptzMode = 'patrol')}>${tr('סיור')}</sw-chip>
          </div>`
        : html`<div class="note" style="margin-block-start:8px">${tr('PTZ ושמע אינם מוצגים במצלמה זו: היכולת לא אומתה. פקד שלא נתמך מוסתר או מוסבר, לא מדומה.')}</div>`}
      </div><div class="stage-side">
      <div class="grid">
        <sw-card heading=${tr('פרטים')}>
          <dl>
            <dt>${tr('מצב')}</dt><dd><sw-badge kind=${cam.state}></sw-badge></dd>
            <dt>${tr('הקלטה')}</dt><dd>${{ continuous: tr('רציפה'), motion: tr('לפי תנועה'), off: tr('כבויה'), unknown: tr('לא ידוע') }[cam.recording]}</dd>
            <dt>${tr('זרם')}</dt><dd>${cam.fps ? `${cam.fps} fps · ${cam.bitrateKbps} kbps` : '—'}</dd>
            <dt>${tr('קושחה')}</dt><dd><span class="ltr">${cam.firmware}</span></dd>
            <dt>${tr('אירוע אחרון')}</dt><dd>${cam.lastEvent}</dd>
          </dl>
        </sw-card>
        <sw-card heading=${tr('מצלמות באותה קומה')}>
          <div class="tiles">
            ${demoWall.filter((c) => c.floor === cam.floor && c.id !== cam.id).slice(0, 4).map((c) => html`<sw-camera-tile compact name=${c.name} state=${c.state} scene=${demoScene[c.id] ?? 'lobby'} @click=${() => navigate(`/live/cameras/${c.id}`)}></sw-camera-tile>`)}
          </div>
        </sw-card>
      </div>
    </div></div>`;
  }

  render() {
    const api = isApi();
    const title = api ? this.cam?.name ?? tr('מצלמה') : (demoWall.find((c) => c.id === this.cameraId) ?? demoWall[0]).name;
    const sub = api ? (this.cam ? (this.cam.standalone ? cst('noRecorder') : `${tr('ערוץ {n}', { n: this.cam.channel })} · ${this.cam.name_source || ''}`) : '') : `${(demoWall.find((c) => c.id === this.cameraId) ?? demoWall[0]).floor} · ${tr('נתוני הדגמה')}`;
    return html`
      <sw-page heading=${title} subheading=${sub} crumbs=${`${tr('מצלמות')} | ${tr('שידור חי')}`} backHref="/live/wall">
        ${this.cam ? html`<sw-badge slot="actions" kind=${this.cam.status === 'online' ? 'live' : this.cam.status === 'offline' ? 'offline' : 'unknown'}></sw-badge>` : nothing}
        ${api && this.cam && this.canConfigure ? html`<sw-button slot="actions" variant="ghost" icon="edit" data-camera-rename @click=${() => { this.renameMsg = ''; this.renameTo = this.cam?.alias ?? this.cam?.name ?? ''; }}>${tr('שנה שם')}</sw-button>` : nothing}
        ${this.renderRename()}
        ${api && this.cam?.standalone ? nothing : html`<a slot="actions" href=${api && this.cam ? `#/investigate/playback?camera=${this.cam.id}` : '#/investigate/playback'}><sw-button icon="history">${tr('הקלטות')}</sw-button></a>`}
        <a slot="actions" href="#/explore/floors/f0"><sw-button variant="ghost" iconOnly icon="map" label=${tr('במפה')}></sw-button></a>
        ${api && this.cam && mapTicketsOn() ? html`<sw-button slot="actions" variant="ghost" icon="plus" data-camera-ticket @click=${() => (this.mapTicket = true)}>${mapCreateLabel()}</sw-button>` : nothing}
        ${this.mapTicket && this.cam ? html`<ticket-map-create open .element=${{ pick: { resource: { type: 'camera', id: this.cam.id } }, name: this.cam.alias || this.cam.name, floorName: '' }} @close=${() => (this.mapTicket = false)}></ticket-map-create>` : nothing}
        ${api ? this.renderApi() : this.renderDemo()}
      </sw-page>
    `;
  }
}
