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
import type { TableColumn } from '../components/sw-table';
import type { SceneKind } from '../components/sw-scene';
import { demoScene, demoWall } from '../fixtures/catalog';
import { isApi } from '../api/session';
import { listCameras, registerCamera, syncCameras, updateCamera } from '../api/maps';
import { describeError, get } from '../api/client';
import type { Camera } from '../api/types';

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
@customElement('system-devices')
export class SystemDevices extends LitElement {
  @state() private selected: string | null = null;
  @state() private filter: 'all' | 'online' | 'offline' | 'issues' = 'all';
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

  static styles = css`
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
      border-radius: 5px;
      flex-shrink: 0;
      background: var(--sw-surface-3);
    }
    .cam sw-scene,
    .cam .none {
      inline-size: 48px;
      block-size: 32px;
      border-radius: 5px;
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
    .err {
      font-size: var(--sw-fs-xs);
      color: var(--sw-danger);
    }
    .ok {
      font-size: var(--sw-fs-xs);
      color: #15803d;
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
  `;

  connectedCallback() {
    super.connectedCallback();
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

  private net(level: number) {
    return svg`<svg class="net" viewBox="0 0 22 14" aria-label="רשת">${[0, 1, 2, 3].map((i) => svg`<rect x=${i * 5.5} y=${11 - i * 3} width="4" height=${3 + i * 3} rx="1" fill=${i < level ? (level >= 3 ? '#22c55e' : '#f59e0b') : 'var(--sw-border-strong)'} />`)}</svg>`;
  }

  private columns: TableColumn[] = [
    { key: 'name', label: 'מצלמה', render: (r) => html`<div class="cam">${r.api && (r.api as { status?: string }).status === 'online' ? html`<img class="snap" src=${snapshotUrl(String(r.id))} alt="" loading="lazy" style="inline-size:64px;block-size:40px;object-fit:cover;border-radius:5px;flex-shrink:0;background:var(--sw-surface-3);display:block" @error=${(e: Event) => ((e.target as HTMLImageElement).style.visibility = 'hidden')} />` : r.scene ? html`<sw-scene kind=${r.scene as SceneKind}></sw-scene>` : html`<div class="none"></div>`}<div><b>${String(r.name)}</b><small>${String(r.sub)}</small></div></div>` },
    { key: 'state', label: 'מצב', render: (r) => html`<span class="status"><i style="--c:${r.state === 'live' ? 'var(--sw-live)' : r.state === 'offline' ? 'var(--sw-danger)' : r.state === 'unknown' ? 'var(--sw-unknown)' : 'var(--sw-stale)'}"></i>${r.state === 'live' ? 'מחוברת' : r.state === 'offline' ? 'מנותקת' : r.state === 'stale' ? 'לא מעודכן' : r.state === 'forbidden' ? 'ללא הרשאה' : 'לא נבדק'}</span>` },
    { key: 'fps', label: 'FPS', ltr: true },
    { key: 'bitrate', label: 'קצב', ltr: true },
    { key: 'firmware', label: 'זרם ראשי', ltr: true },
    { key: 'lastEvent', label: 'נראתה לאחרונה' },
    { key: 'net', label: 'רשת', render: (r) => this.net(r.state === 'live' ? 4 : r.state === 'stale' ? 2 : 0) },
    { key: 'more', label: '', width: '40px', render: () => html`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>` },
  ];

  render() {
    const all = this.rows;
    const rows = all.filter((c) => (this.filter === 'all' ? true : this.filter === 'online' ? c.state === 'live' : this.filter === 'offline' ? c.state === 'offline' : c.state === 'stale' || c.state === 'forbidden' || c.state === 'unknown'));
    const cam = all.find((c) => c.id === this.selected);
    const api = !!this.cameras;
    return html`
      <sw-page heading="בריאות מצלמות" subheading=${api ? `${this.recorder?.name ?? 'NVR'}${this.recorder?.model ? ` · ${this.recorder.model}` : ''} · ${all.length} מצלמות רשומות · גילוי לקריאה בלבד` : 'NVR ראשי · 10 ערוצים · Capability matrix לפי ראיות · נתוני הדגמה'}>
        ${api && this.canSync ? html`<sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${() => this.sync()}>${this.busy ? 'מסנכרן…' : 'סנכרון מה־NVR (קריאה)'}</sw-button>` : html`<sw-button slot="actions" icon="refresh" ?disabled=${api}>בדיקת יכולות (קריאה)</sw-button>`}
        ${api && this.discovery ? html`<div style="font-size:var(--sw-fs-xs);color:${this.discovery.cameras_last_error ? 'var(--sw-danger)' : 'var(--sw-text-3)'};margin-block-end:8px">גילוי אוטומטי מה־NVR כל ${Math.round(this.discovery.interval_s / 60)} דק׳ · ${this.discovery.cameras_last_error ? `נכשל: ${this.discovery.cameras_last_error}` : this.discovery.cameras_last_ok ? `הצליח ${this.discovery.cameras_last_ok.replace('T', ' ').replace('Z', ' UTC')}` : 'טרם רץ'}${this.discovery.streams_last_error ? ` · זרמי go2rtc: ${this.discovery.streams_last_error}` : ''}</div>` : nothing}
        ${api && this.canSync ? html`<sw-button slot="actions" variant="primary" icon="plus" @click=${() => { this.dialog = true; this.formAlias = ''; this.formChannel = (all.length ? Math.max(...all.map((c) => c.channel)) : 0) + 1; }}>רישום ידני</sw-button>` : nothing}
        ${this.message ? html`<div class="ok">${this.message}</div>` : nothing}
        ${this.error ? html`<div class="err">${this.error}</div>` : nothing}
        <div class="filters">
          <sw-chip ?selected=${this.filter === 'all'} @click=${() => (this.filter = 'all')} count=${all.length}>הכל</sw-chip>
          <sw-chip dot="#22c55e" ?selected=${this.filter === 'online'} @click=${() => (this.filter = 'online')} count=${all.filter((c) => c.state === 'live').length}>מחוברות</sw-chip>
          <sw-chip dot="#ef4444" ?selected=${this.filter === 'offline'} @click=${() => (this.filter = 'offline')} count=${all.filter((c) => c.state === 'offline').length}>מנותקות</sw-chip>
          <sw-chip dot="#f59e0b" ?selected=${this.filter === 'issues'} @click=${() => (this.filter = 'issues')} count=${all.filter((c) => c.state !== 'live' && c.state !== 'offline').length}>בעיות / לא נבדק</sw-chip>
          <span class="grow"></span>
          <sw-field style="inline-size:200px"><input type="search" placeholder="חיפוש מצלמה…" aria-label="חיפוש" /></sw-field>
        </div>
        <div class="stage">
          ${api && !all.length
            ? html`<sw-state-panel state="empty" heading="אין מצלמות רשומות" hint="הגדר את פרטי ה־NVR בהגדרות ה־Add-on ולחץ 'סנכרון מה־NVR', או רשום ערוץ ידנית."></sw-state-panel>`
            : html`<sw-table .columns=${this.columns} .rows=${rows} .selected=${this.selected} @row-select=${(e: CustomEvent<{ id: string }>) => { this.selected = e.detail.id; this.alias = all.find((c) => c.id === e.detail.id)?.api?.alias ?? ''; }}></sw-table>`}
          ${cam
            ? html`<sw-drawer open heading=${cam.name} subheading=${cam.sub} @close=${() => (this.selected = null)}>
                <sw-field label="כינוי מקומי" hint="שינוי כינוי אינו משנה OSD; שם ה־NVR נשמר בנפרד"><input .value=${api ? this.alias : cam.name} ?disabled=${!api || !this.canSync} @input=${(e: Event) => (this.alias = (e.target as HTMLInputElement).value)} /></sw-field>
                <dl>
                  <dt>שם ב־NVR</dt><dd>${api ? cam.api?.name_source || '—' : `Camera ${cam.channel}`}</dd>
                  <dt>Tracks</dt><dd><span class="ltr">${api ? `${cam.api?.main_track ?? '?'} / ${cam.api?.sub_track ?? '?'}` : `${cam.channel}01 / ${cam.channel}02`}</span></dd>
                  <dt>מצב</dt><dd><sw-badge kind=${cam.state}></sw-badge></dd>
                  <dt>נראתה לאחרונה</dt><dd>${cam.lastEvent}</dd>
                </dl>
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
