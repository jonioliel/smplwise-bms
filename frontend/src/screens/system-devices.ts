import { parseRoute } from '../router';
import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-table';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-drawer';
import '../components/sw-field';
import '../components/sw-dialog';
import '../components/sw-scene';
import { snapshotUrl } from '../api/media';
import '../components/sw-state-panel';
import '../components/camera-image-health-card';
import { cameraImageHealth, setCameraReference, type ImageCamera, type ImageHealth, type ImageKind } from '../api/camera-image-health';
import { cit } from '../i18n/camera-image-health';
import type { TableColumn } from '../components/sw-table';
import type { SceneKind } from '../components/sw-scene';
import { demoScene, demoWall } from '../fixtures/catalog';
import { isApi } from '../api/session';
import { listCameras, registerCamera, syncCameras, updateCamera } from '../api/maps';
import { describeError, get } from '../api/client';
import type { Camera } from '../api/types';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';

interface Row {
  id: string;
  name: string;
  sub: string;
  state: 'live' | 'offline' | 'stale' | 'forbidden' | 'unknown';
  fps: string;
  bitrate: string;
  firmware: string;
  lastEvent: string;
  scene: SceneKind | null;
  channel: number;
  api?: Camera;
  [k: string]: unknown;
}

const SCENES: SceneKind[] = ['entrance', 'lobby', 'corridor', 'hall', 'parking', 'warehouse', 'backyard', 'driveway', 'night'];

/** SC27 — camera health (board 2 screen 12): registry from the backend (read-only NVR sync) or demo rows. */
/** R5-LIVE-297: inline cell styles (sw-table renders the cells in its own shadow root - see `columns`). */
const CELL_CAM = 'display:flex;align-items:center;gap:12px;min-inline-size:0';
const CELL_PIC = 'inline-size:72px;block-size:44px;flex:none;border-radius:var(--sw-r-sm);overflow:hidden;';
/** A state as a filled pill: the tone's tint behind a dot and a bold word (the HOMEFABLE "status is a field" rule). */
function statePill(state: string, tone: string, text: string, attr: 'cam' | 'cih' = 'cam') {
  const style = `display:inline-flex;align-items:center;gap:7px;min-block-size:26px;padding:0 11px;border-radius:var(--sw-r-pill);background:color-mix(in srgb, ${tone} 20%, var(--sw-surface));color:var(--sw-heading);font-size:var(--sw-fs-sm);font-weight:var(--sw-fw-bold);white-space:nowrap`;
  const dot = html`<i style=${`--c:${tone};inline-size:8px;block-size:8px;border-radius:50%;background:${tone};flex:none`}></i>`;
  return attr === 'cam'
    ? html`<span class="status" data-cam-state=${state} style=${style}>${dot}${text}</span>`
    : html`<span class="status" data-cih-cell=${state} style=${style}>${dot}${text}</span>`;
}

@customElement('system-devices')
export class SystemDevices extends LitElement {
  /** 0.1.157: the bubble skin's chrome keys on the host's data-skin (styles/bubble-chrome.ts). */
  readonly bubbleSkin = new SkinController(this);
  @state() private selected: string | null = null;
  @state() private filter: 'all' | 'online' | 'offline' | 'issues' = 'all';
  /** Owner 2026-09-29: from the Live overview's cameras tile - every camera, the offline ones first. */
  @state() private offlineFirst = false;
  @state() private cameras: Camera[] | null = null;
  @state() private recorder: { name: string; model: string | null; firmware: string | null; last_seen_at: string | null } | null = null;
  @state() private canSync = false;
  @state() private discovery: { cameras_last_ok: string | null; cameras_last_error: string | null; streams_last_error: string | null; interval_s: number } | null = null;
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';
  @state() private dialog = false;
  @state() private formChannel = 1;
  @state() private formAlias = '';
  @state() private alias = '';
  /** CAMHEALTH091: the camera picture check (dark / blurred / frozen / shifted) - the compact card, the picture column and its filter. */
  @state() private image: ImageHealth | null = null;
  @state() private imageFilter: ImageKind | null = null;

  static styles = [css`
    .filters {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filters .grow {
      flex: 1;
    }
    .stage {
      position: relative;
      min-block-size: 420px;
    }
    .cam {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .cam img.snap {
      inline-size: 48px;
      block-size: 32px;
      object-fit: cover;
      border-radius: var(--sw-r-2xs);
      flex-shrink: 0;
      background: var(--sw-surface-3);
    }
    .cam sw-scene,
    .cam .none {
      inline-size: 48px;
      block-size: 32px;
      border-radius: var(--sw-r-2xs);
      flex-shrink: 0;
      overflow: hidden;
    }
    .cam .none {
      background: var(--sw-surface-3);
    }
    .cam b {
      display: block;
      font-weight: var(--sw-fw-semibold);
    }
    .cam small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
    }
    .status i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--c);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--c) 22%, transparent);
      flex: none;
    }
    .cam .none {
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      box-shadow: inset 0 0 0 1px var(--sw-border-strong);
    }
    svg.net {
      inline-size: 22px;
      block-size: 14px;
      direction: ltr;
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
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .refs {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block: 8px;
    }
    camera-image-health-card {
      margin-block-end: 8px;
    }
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .ok {
      font-size: var(--sw-fs-xs);
      color: var(--sw-success-text);
    }
    .nvr {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
    }
    .nvr div {
      font-size: var(--sw-fs-sm);
    }
    .nvr span {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
  `, bubbleChrome];

  connectedCallback() {
    super.connectedCallback();
    // owner 2026-09-29: the Live overview's cameras tile opens the FULL list with the offline cameras first (`?sort=offline`);
    // `?filter= ` still preselects a chip
    const params = parseRoute().params;
    const f = params.get('filter');
    if (f === 'all' || f === 'online' || f === 'offline' || f === 'issues') this.filter = f;
    this.offlineFirst = params.get('sort') === 'offline';
    void this.reload();
  }

  private async reload() {
    if (!isApi()) {
      this.cameras = null;
      return;
    }
    try {
      const r = await listCameras();
      this.cameras = r.cameras;
      this.recorder = r.recorder;
      this.canSync = r.can_sync;
      cameraImageHealth().then((h) => (this.image = h)).catch(() => (this.image = null));
      get<{ discovery: { cameras_last_ok: string | null; cameras_last_error: string | null; streams_last_error: string | null; interval_s: number } }>('health').then((h) => (this.discovery = h.discovery)).catch(() => undefined);
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private async sync() {
    this.busy = true;
    this.error = '';
    this.message = '';
    try {
      const r = await syncCameras();
      this.message = `סנכרון הושלם: ${r.channels} ערוצים (${r.created} חדשים, ${r.updated} עודכנו)${r.recorder.model ? ` · ${r.recorder.model}` : ''}`;
      await this.reload();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async register() {
    this.busy = true;
    this.error = '';
    try {
      await registerCamera({ channel: this.formChannel, alias: this.formAlias.trim() });
      this.dialog = false;
      await this.reload();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async saveAlias(id: string) {
    this.busy = true;
    this.error = '';
    try {
      await updateCamera(id, { alias: this.alias.trim() || undefined });
      await this.reload();
      this.message = 'הכינוי נשמר (שם ה־NVR לא השתנה)';
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private get rows(): Row[] {
    if (this.cameras) {
      return this.cameras.map((c) => ({
        id: c.id,
        name: c.name,
        sub: `ערוץ ${c.channel}${c.name_source && c.alias ? ` · NVR: ${c.name_source}` : ''}`,
        state: c.status === 'online' ? 'live' : c.status === 'offline' ? 'offline' : 'unknown',
        fps: c.stream?.fps ? String(c.stream.fps) : '—',
        bitrate: c.stream?.bitrate_kbps ? `${(c.stream.bitrate_kbps / 1024).toFixed(1)} Mbps` : '—',
        firmware: c.stream?.resolution ? `${c.stream.resolution} ${c.stream.codec ?? ''}`.trim() : '—',
        lastEvent: c.last_seen_at ? c.last_seen_at.replace('T', ' ').replace('Z', '') : 'לא נבדק',
        scene: c.status === 'online' ? SCENES[(c.channel - 1) % SCENES.length] : null,
        channel: c.channel,
        api: c,
      }));
    }
    return demoWall.map((c) => ({
      id: c.id,
      name: c.name,
      sub: `${c.floor} · ערוץ ${c.id.replace('cam-', '')}`,
      state: c.state as Row['state'],
      fps: c.fps ? String(c.fps) : '—',
      bitrate: c.bitrateKbps ? `${(c.bitrateKbps / 1024).toFixed(1)} Mbps` : '—',
      firmware: c.firmware,
      lastEvent: c.lastEvent,
      scene: c.state === 'offline' || c.state === 'forbidden' ? null : (demoScene[c.id] ?? 'lobby'),
      channel: Number(c.id.replace('cam-', '')),
    }));
  }

  private imageOf(id: string): ImageCamera | undefined {
    return this.image?.enabled ? this.image.cameras.find((c) => c.id === id) : undefined;
  }

  /** CAMHEALTH091: the picture column - the problems in words, or a short state; nothing while the check is off. */
  private imageCell(c: ImageCamera | undefined) {
    if (!c || c.state === 'off') return html`<span class="hint">—</span>`;
    const tone = c.state === 'warn' ? (c.issues.some((k) => k === 'frozen' || k === 'shifted') ? 'var(--sw-danger)' : 'var(--sw-stale)') : c.state === 'ok' ? 'var(--sw-live)' : 'var(--sw-unknown)';
    const text = c.state === 'warn' ? c.issues.map((k) => cit(k)).join(', ') : c.state === 'ok' ? cit('stateOk') : c.state === 'excluded' ? cit('stateExcluded') : (c.error_text ?? cit('stateUnknown'));
    return statePill(c.state, tone, text, 'cih');
  }

  /** The drawer: the picture state, brightness / sharpness and the reference view. */
  private imageRows(c: ImageCamera) {
    const m = c.metrics;
    return html`<dt>${cit('column')}</dt><dd>${this.imageCell(c)}</dd>
      ${m.brightness != null ? html`<dt>${cit('brightness')} · ${cit('sharpness')}</dt><dd><span class="ltr">${Math.round(m.brightness)} · ${Math.round(m.sharpness ?? 0)}</span></dd>` : nothing}
      <dt>${cit('reference')}</dt><dd data-cih-ref>${c.reference ? (c.reference.auto ? cit('refAuto') : cit('refManual')) : cit('refNone')}</dd>`;
  }

  private async reference(id: string, action: 'set' | 'clear') {
    this.busy = true;
    this.error = '';
    try {
      this.image = { ...(await setCameraReference(id, action)) };
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private net(level: number) {
    return svg`<svg class="net" viewBox="0 0 22 14" aria-label="רשת">${[0, 1, 2, 3].map((i) => svg`<rect x=${i * 5.5} y=${11 - i * 3} width="4" height=${3 + i * 3} rx="1" fill=${i < level ? (level >= 3 ? 'var(--sw-live)' : 'var(--sw-stale)') : 'var(--sw-border-strong)'} />`)}</svg>`;
  }

  // R5-LIVE-297: the cells render inside sw-table's own shadow root, so this screen's `.cam` / `.status` rules never reached them (the
  // picture filled the whole column - a 440 x 250 scene per row - and the state dot was missing). The cell carries its own inline style:
  // a 72 x 44 picture in the media radius, the name 14 px bold over its line, the state a FILLED pill in the tone's tint.
  private columns: TableColumn[] = [
    { key: 'name', label: 'מצלמה', render: (r) => html`<div class="cam" style=${CELL_CAM}>${r.api && (r.api as { status?: string }).status === 'online' ? html`<img class="snap" src=${snapshotUrl(String(r.id))} alt="" loading="lazy" style=${CELL_PIC + 'object-fit:cover;background:var(--sw-surface-3);display:block'} @error=${(e: Event) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />` : r.scene ? html`<sw-scene kind=${r.scene as SceneKind} style=${CELL_PIC}></sw-scene>` : html`<div class="none" style=${CELL_PIC + 'display:grid;place-items:center;color:var(--sw-offline-text);background:color-mix(in srgb, var(--sw-offline) 22%, var(--sw-surface-3))'}><sw-icon name=${r.state === 'forbidden' ? 'lock' : 'offline'} size=${16}></sw-icon></div>`}<div style="min-inline-size:0"><b style="display:block;font-size:var(--sw-fs-md);font-weight:var(--sw-fw-bold);color:var(--sw-heading)">${String(r.name)}</b><small style="display:block;color:var(--sw-text-2);font-size:var(--sw-fs-xs)">${String(r.sub)}</small></div></div>` },
    { key: 'state', label: 'מצב', render: (r) => statePill(String(r.state), r.state === 'live' ? 'var(--sw-live)' : r.state === 'offline' ? 'var(--sw-danger)' : r.state === 'unknown' ? 'var(--sw-unknown)' : 'var(--sw-stale)', r.state === 'live' ? 'מחוברת' : r.state === 'offline' ? 'מנותקת' : r.state === 'stale' ? 'לא מעודכן' : r.state === 'forbidden' ? 'ללא הרשאה' : 'לא נבדק') },
    { key: 'fps', label: 'FPS', ltr: true },
    { key: 'bitrate', label: 'קצב', ltr: true },
    { key: 'firmware', label: 'זרם ראשי', ltr: true },
    { key: 'image', label: cit('column'), render: (r) => this.imageCell(this.imageOf(String(r.id))) },
    { key: 'lastEvent', label: 'נראתה לאחרונה' },
    { key: 'net', label: 'רשת', render: (r) => this.net(r.state === 'live' ? 4 : r.state === 'stale' ? 2 : 0) },
    { key: 'more', label: '', width: '40px', render: () => html`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>` },
  ];

  render() {
    const all = this.rows;
    const kind = this.imageFilter;
    const picked = all.filter((c) => (this.filter === 'all' ? true : this.filter === 'online' ? c.state === 'live' : this.filter === 'offline' ? c.state === 'offline' : c.state === 'stale' || c.state === 'forbidden' || c.state === 'unknown'))
      .filter((c) => !kind || (this.imageOf(c.id)?.issues ?? []).includes(kind));
    const rows = this.offlineFirst ? [...picked].sort((a, b) => Number(b.state === 'offline') - Number(a.state === 'offline')) : picked;
    const cam = all.find((c) => c.id === this.selected);
    const api = !!this.cameras;
    return html`
      <sw-page heading="בריאות מצלמות" subheading=${api ? `${this.recorder?.name ?? 'NVR'}${this.recorder?.model ? ` · ${this.recorder.model}` : ''} · ${all.length} מצלמות רשומות · גילוי לקריאה בלבד` : 'NVR ראשי · 10 ערוצים · Capability matrix לפי ראיות · נתוני הדגמה'}>
        ${api && this.canSync ? html`<sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${() => this.sync()}>${this.busy ? 'מסנכרן…' : 'סנכרון מה־NVR (קריאה)'}</sw-button>` : html`<sw-button slot="actions" icon="refresh" ?disabled=${api}>בדיקת יכולות (קריאה)</sw-button>`}
        ${api && this.discovery ? html`<div style="font-size:var(--sw-fs-xs);color:${this.discovery.cameras_last_error ? 'var(--sw-danger)' : 'var(--sw-text-3)'};margin-block-end:8px">גילוי אוטומטי מה־NVR כל ${Math.round(this.discovery.interval_s / 60)} דק׳ · ${this.discovery.cameras_last_error ? `נכשל: ${this.discovery.cameras_last_error}` : this.discovery.cameras_last_ok ? `הצליח ${this.discovery.cameras_last_ok.replace('T', ' ').replace('Z', ' UTC')}` : 'טרם רץ'}${this.discovery.streams_last_error ? ` · זרמי go2rtc: ${this.discovery.streams_last_error}` : ''}</div>` : nothing}
        ${api && this.canSync ? html`<sw-button slot="actions" variant="primary" icon="plus" @click=${() => { this.dialog = true; this.formAlias = ''; this.formChannel = (all.length ? Math.max(...all.map((c) => c.channel)) : 0) + 1; }}>רישום ידני</sw-button>` : nothing}
        ${this.message ? html`<div class="ok">${this.message}</div>` : nothing}
        ${this.error ? html`<div class="err">${this.error}</div>` : nothing}
        ${api && this.image ? html`<camera-image-health-card .data=${this.image} .selected=${this.imageFilter}
          @cih-updated=${(e: CustomEvent<ImageHealth>) => (this.image = e.detail)} @cih-filter=${(e: CustomEvent<ImageKind | null>) => (this.imageFilter = e.detail)}></camera-image-health-card>` : nothing}
        <div class="filters">
          <sw-chip ?selected=${this.filter === 'all'} @click=${() => (this.filter = 'all')} count=${all.length}>הכל</sw-chip>
          <sw-chip dot="var(--sw-live)" ?selected=${this.filter === 'online'} @click=${() => (this.filter = 'online')} count=${all.filter((c) => c.state === 'live').length}>מחוברות</sw-chip>
          <sw-chip dot="var(--sw-danger)" ?selected=${this.filter === 'offline'} @click=${() => (this.filter = 'offline')} count=${all.filter((c) => c.state === 'offline').length}>מנותקות</sw-chip>
          <sw-chip dot="var(--sw-stale)" ?selected=${this.filter === 'issues'} @click=${() => (this.filter = 'issues')} count=${all.filter((c) => c.state !== 'live' && c.state !== 'offline').length}>בעיות / לא נבדק</sw-chip>
          <span class="grow"></span>
          <sw-field style="inline-size:200px"><input type="search" placeholder="חיפוש מצלמה…" aria-label="חיפוש" /></sw-field>
        </div>
        <div class="stage">
          ${api && !all.length
            ? html`<sw-state-panel icon="camera" state="empty" heading="אין מצלמות רשומות" hint="הגדירו את פרטי ה־NVR בהגדרות ‹ חיבורים ולחצו 'סנכרון מה־NVR', או רשמו ערוץ ידנית."></sw-state-panel>`
            : html`<sw-table .columns=${this.columns} .rows=${rows} .selected=${this.selected} @row-select=${(e: CustomEvent<{ id: string }>) => { this.selected = e.detail.id; this.alias = all.find((c) => c.id === e.detail.id)?.api?.alias ?? ''; }}></sw-table>`}
          ${cam
            ? html`<sw-drawer open heading=${cam.name} subheading=${cam.sub} @close=${() => (this.selected = null)}>
                <sw-field label="כינוי מקומי" hint="שינוי כינוי אינו משנה OSD; שם ה־NVR נשמר בנפרד"><input .value=${api ? this.alias : cam.name} ?disabled=${!api || !this.canSync} @input=${(e: Event) => (this.alias = (e.target as HTMLInputElement).value)} /></sw-field>
                <dl>
                  <dt>שם ב־NVR</dt><dd>${api ? cam.api?.name_source || '—' : `Camera ${cam.channel}`}</dd>
                  <dt>Tracks</dt><dd><span class="ltr">${api ? `${cam.api?.main_track ?? '?'} / ${cam.api?.sub_track ?? '?'}` : `${cam.channel}01 / ${cam.channel}02`}</span></dd>
                  <dt>מצב</dt><dd><sw-badge kind=${cam.state}></sw-badge></dd>
                  <dt>נראתה לאחרונה</dt><dd>${cam.lastEvent}</dd>
                  ${this.imageOf(cam.id) ? this.imageRows(this.imageOf(cam.id)!) : nothing}
                </dl>
                ${this.image?.can_manage && this.imageOf(cam.id) && this.imageOf(cam.id)!.state !== 'excluded' ? html`<div class="refs" data-cih-ref-actions>
                  <sw-button size="sm" variant="ghost" icon="camera" ?disabled=${this.busy || !this.imageOf(cam.id)!.sampled_at || !!this.imageOf(cam.id)!.error} @click=${() => this.reference(cam.id, 'set')}>${cit('refSet')}</sw-button>
                  ${this.imageOf(cam.id)!.reference ? html`<sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${() => this.reference(cam.id, 'clear')}>${cit('refClear')}</sw-button>` : nothing}
                </div>` : nothing}
                <div class="hint">ניתוק מקור מוצג כניתוק, לא כאשמת הממשק. פעולות רגישות (אתחול, OSD) דורשות הרשאה ואישור ואינן בפיילוט.</div>
                <div slot="footer">
                  ${api && this.canSync ? html`<sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${() => this.saveAlias(cam.id)}>שמור כינוי</sw-button>` : nothing}
                  <sw-button variant="danger" size="sm" disabled>אתחול מצלמה</sw-button>
                </div>
              </sw-drawer>`
            : nothing}
        </div>
        ${!api
          ? html`<sw-card heading="NVR ראשי">
              <div class="nvr">
                <div><span>דגם</span>DS-76xx (הדגמה)</div>
                <div><span>קושחה</span><span class="ltr">V4.84.x</span></div>
                <div><span>ערוצים</span>10/16</div>
                <div><span>דיסק</span>1 · תקין · 30% פנוי</div>
                <div><span>שעון</span>NTP · סטייה 2 שנ׳</div>
                <div><span>חיפוש במקביל</span>1 (מגבלת מכשיר)</div>
              </div>
            </sw-card>`
          : this.recorder
            ? html`<sw-card heading=${this.recorder.name}>
                <div class="nvr">
                  <div><span>דגם</span>${this.recorder.model ?? 'לא נבדק'}</div>
                  <div><span>קושחה</span><span class="ltr">${this.recorder.firmware ?? '—'}</span></div>
                  <div><span>סנכרון אחרון</span>${this.recorder.last_seen_at ? this.recorder.last_seen_at.replace('T', ' ').replace('Z', ' UTC') : '—'}</div>
                  <div><span>גישה</span>קריאה בלבד (ISAPI)</div>
                </div>
              </sw-card>`
            : nothing}
        ${this.dialog
          ? html`<sw-dialog open heading="רישום מצלמה ידני" subheading="כשה־NVR לא מוגדר עדיין; הסנכרון יעדכן שם ומצב" @close=${() => (this.dialog = false)}>
              <sw-field label="מספר ערוץ ב־NVR"><input type="number" min="1" max="256" data-ltr .value=${String(this.formChannel)} @input=${(e: Event) => (this.formChannel = Number((e.target as HTMLInputElement).value))} /></sw-field>
              <sw-field label="כינוי"><input .value=${this.formAlias} @input=${(e: Event) => (this.formAlias = (e.target as HTMLInputElement).value)} placeholder="למשל: כניסה ראשית" /></sw-field>
              ${this.error ? html`<div class="err">${this.error}</div>` : nothing}
              <sw-button slot="footer" variant="ghost" @click=${() => (this.dialog = false)}>ביטול</sw-button>
              <sw-button slot="footer" variant="primary" ?disabled=${!this.formAlias.trim() || this.busy} @click=${() => this.register()}>רישום</sw-button>
            </sw-dialog>`
          : nothing}
      </sw-page>
    `;
  }
}
