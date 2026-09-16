import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-kpi';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { isApi } from '../api/session';
import { describeError } from '../api/client';
import { productSettings } from '../api/prefs';
import { fmtMb, getStorage, type StorageReport } from '../api/storage';

const PER_CAMERA = [
  { name: 'כניסה ראשית', gb: 320 },
  { name: 'אולם', gb: 410 },
  { name: 'חצר אחורית', gb: 380 },
  { name: 'לובי', gb: 180 },
  { name: 'מחסן', gb: 96 },
];

/** SC20 — storage analytics (board 2 screen 11, Beta): range pills, three stat cards, usage forecast with a "projected full" marker, per-camera bars, recording policy. */
@customElement('system-storage')
export class SystemStorage extends LitElement {
  @state() private range = '30D';
  @state() private data: StorageReport | null = null;
  @state() private error = '';
  @state() private loading = false;
  @state() private tz = 'Asia/Jerusalem';

  static styles = css`
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .kpi {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
    }
    .kpi .v {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      line-height: 1.1;
    }
    .kpi .l {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .kpi .ic {
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      border-radius: 8px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
      margin-inline-start: auto;
    }
    .kpi svg {
      inline-size: 40px;
      block-size: 40px;
      margin-inline-start: auto;
    }
    .trend {
      inline-size: 100%;
      block-size: 200px;
      direction: ltr;
      display: block;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr);
      gap: 12px;
      align-items: start;
    }
    .cam {
      display: grid;
      grid-template-columns: 100px minmax(0, 1fr) 60px;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
      font-size: var(--sw-fs-sm);
    }
    .cam .bar {
      block-size: 8px;
      border-radius: 4px;
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .cam .bar i {
      display: block;
      block-size: 100%;
      inline-size: var(--p);
      background: var(--sw-accent);
      border-radius: 4px;
    }
    .cam .gb {
      text-align: end;
      font-variant-numeric: tabular-nums;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .policy {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .policy:last-child {
      border-block-end: 0;
    }
    .policy .ic {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 8px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent);
    }
    .policy small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .tbl {
      display: flex;
      flex-direction: column;
    }
    .tbl .r {
      display: grid;
      gap: 8px;
      align-items: center;
      padding: 7px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .tbl .r:last-child {
      border-block-end: 0;
    }
    .tbl .h {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      border-block-end: 1px solid var(--sw-border-strong);
    }
    .tbl.disks .r {
      grid-template-columns: minmax(0, 1.2fr) 70px 90px 90px 90px 50px;
    }
    .tbl.cams .r {
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.6fr) 90px 130px 150px 80px;
    }
    .tbl small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .num {
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: isolate;
      text-align: end;
    }
    .ret {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .ret .v {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      line-height: 1.1;
    }
    .ret .l {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 4px;
    }
    .limits li {
      font-size: var(--sw-fs-sm);
      margin-block-end: 4px;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) {
      .tbl.disks .r,
      .tbl.cams .r {
        grid-template-columns: 1fr 1fr;
      }
      .tbl .h {
        display: none;
      }
      .ret {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 1023px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 767px) {
      .kpis {
        grid-template-columns: 1fr;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    if (isApi()) void this.load();
  }

  private async load(fresh = false) {
    this.loading = true;
    this.error = '';
    try {
      const [s, d] = await Promise.all([productSettings(), getStorage(fresh)]);
      this.tz = s['time.zone'] ?? this.tz;
      this.data = d;
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.loading = false;
    }
  }

  private fmt(iso: string | null) {
    return iso ? new Intl.DateTimeFormat('he-IL', { timeZone: this.tz, dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '—';
  }

  private renderApi() {
    if (this.error && !this.data) return html`<sw-page heading="אחסון ותוכנית הקלטה"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel></sw-page>`;
    const d = this.data;
    if (!d) return html`<sw-page heading="אחסון ותוכנית הקלטה"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    const t = d.totals;
    const r = d.retention;
    const ring = 16;
    const circ = 2 * Math.PI * ring;
    const pct = t?.used_pct ?? 0;
    const measured = r.measured_days_min == null ? '—' : r.measured_days_min === r.measured_days_max ? `${r.measured_days_min}` : `${r.measured_days_min}–${r.measured_days_max}`;
    return html`
      <sw-page heading="אחסון ותוכנית הקלטה" subheading="קריאה בלבד מה־NVR · נמדד לעומת אומדן, עם הסיבה לכל מספר · אין format, RAID או מחיקה מכאן">
        <sw-button slot="actions" icon="refresh" data-storage-refresh ?disabled=${this.loading} @click=${() => this.load(true)}>${this.loading ? 'שואל את ה־NVR…' : 'רענון מול ה־NVR'}</sw-button>
        ${this.error ? html`<div class="err">${this.error}</div>` : nothing}
        ${!d.nvr.configured
          ? html`<sw-state-panel state="empty" heading="ה־NVR לא מוגדר" hint="הגדר את פרטי ה־NVR בהגדרות התוסף; המסך קורא ממנו בלבד."></sw-state-panel>`
          : !d.nvr.reachable
            ? html`<sw-state-panel state="error" heading="אין תשובה מה־NVR" hint=${d.nvr.error ?? ''} actionLabel="נסה שוב" @action=${() => this.load(true)}></sw-state-panel>`
            : html`
                <div class="kpis" data-storage-kpis>
                  <sw-card flush class="kpi"><div><div class="v">${fmtMb(t?.used_mb)}</div><div class="l">בשימוש (נמדד מה־NVR)</div></div><div class="ic"><sw-icon name="storage" size=${16}></sw-icon></div></sw-card>
                  <sw-card flush class="kpi"><div><div class="v">${fmtMb(t?.capacity_mb)}</div><div class="l">קיבולת · ${t?.disks ?? 0} דיסקים${t?.nas ? ` · ${t.nas} NAS` : ''} · מצב ${d.work_mode ?? '?'}</div></div><div class="ic"><sw-icon name="cpu" size=${16}></sw-icon></div></sw-card>
                  <sw-card flush class="kpi"><div><div class="v">${t?.used_pct == null ? '—' : `${t.used_pct}%`}</div><div class="l">ניצולת · פנוי ${fmtMb(t?.free_mb)}</div></div><svg viewBox="0 0 40 40" aria-hidden="true">${svg`<circle cx="20" cy="20" r=${ring} fill="none" stroke="var(--sw-surface-3)" stroke-width="6" /><circle cx="20" cy="20" r=${ring} fill="none" stroke="var(--sw-accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray=${`${(circ * pct) / 100} ${circ}`} transform="rotate(-90 20 20)" />`}</svg></sw-card>
                </div>
                <sw-card heading="שמירת הקלטות (retention)" subheading="שני מספרים שונים בכוונה: מה שנמדד מול מה שמוערך" data-storage-retention>
                  <div class="ret">
                    <div><div class="v">${measured}<span style="font-size:var(--sw-fs-sm);font-weight:400"> ימים</span></div><div class="l"><strong>נמדד</strong> · ${r.measured_reason}</div></div>
                    <div><div class="v">${r.estimated_days == null ? '—' : `≈ ${r.estimated_days}`}<span style="font-size:var(--sw-fs-sm);font-weight:400"> ימים</span></div><div class="l"><strong>אומדן</strong> · ${r.estimated_reason}</div></div>
                  </div>
                </sw-card>
                <div class="grid">
                  <sw-card heading="תוכנית הקלטה לפי מצלמה" subheading=${d.schedule_error ?? 'נקרא מ־ISAPI record/tracks · pre/post בשניות · ההקלטה המוקדמת ביותר שנמצאה'}>
                    <div class="tbl cams" data-storage-cameras>
                      <div class="r h"><span>מצלמה</span><span>מצב הקלטה</span><span>pre / post</span><span>זרם</span><span>הקלטה מוקדמת ביותר</span><span class="num">ימים</span></div>
                      ${d.cameras.map((c) => html`<div class="r" data-storage-camera><span>${c.name}<small>ערוץ ${c.channel}${c.track_id ? ` · track ${c.track_id}` : ''}</small></span><span>${c.summary}${c.expiry && c.expiry !== 'P0DT0H' ? html`<small>תפוגה ${c.expiry}</small>` : nothing}</span><span class="num">${c.pre_s ?? '—'} / ${c.post_s ?? '—'}</span><span class="num">${c.bitrate_kbps ? `${c.bitrate_kbps} kbps` : '—'}${c.resolution ? html`<small class="num">${c.resolution}${c.fps ? ` · ${c.fps} fps` : ''}</small>` : nothing}</span><span>${this.fmt(c.oldest_recording_at)}<small>${c.retention_reason}</small></span><span class="num">${c.retention_days ?? '—'}</span></div>`)}
                    </div>
                  </sw-card>
                  <div>
                    <sw-card heading="דיסקים" subheading=${`${t?.disks_ok ?? 0} מתוך ${(t?.disks ?? 0) + (t?.nas ?? 0)} תקינים`}>
                      <div class="tbl disks" data-storage-disks>
                        <div class="r h"><span>שם</span><span>סוג</span><span>מצב</span><span class="num">קיבולת</span><span class="num">פנוי</span><span>גישה</span></div>
                        ${[...d.disks, ...d.nas].map((x) => html`<div class="r" data-storage-disk><span>${x.name}${x.path ? html`<small>${x.path}</small>` : nothing}</span><span>${x.kind}</span><span><sw-badge kind=${x.status === 'ok' ? 'recorded' : 'error'} label=${x.status}></sw-badge></span><span class="num">${fmtMb(x.capacity_mb)}</span><span class="num">${fmtMb(x.free_mb)}</span><span>${x.property}</span></div>`)}
                      </div>
                    </sw-card>
                    <sw-card heading="מה המערכת לא עושה ב־NVR" subheading="גבולות הפיילוט" data-storage-limits>
                      <ul class="limits">${d.limits.notes.map((n) => html`<li>${n}</li>`)}</ul>
                      <div style="margin-block-start:6px"><sw-button size="sm" disabled icon="edit">עריכת מדיניות הקלטה (לא בפיילוט)</sw-button></div>
                    </sw-card>
                  </div>
                </div>
                <div class="hint">נקרא ${this.fmt(d.generated_at)}${d.cached ? ' · מהמטמון (עד 10 דקות)' : ' · עכשיו'} · חיפוש ההקלטה המוקדמת: ${r.lookback_days} ימים אחורה, שאילתה אחת לכל מצלמה.</div>
              `}
      </sw-page>
    `;
  }

  render() {
    if (isApi()) return this.renderApi();
    const points = [0.3, 0.36, 0.45, 0.5, 0.58, 0.63, 0.7];
    const W = 600;
    const H = 200;
    const px = (i: number) => (i / (points.length - 1)) * 420;
    const py = (p: number) => 170 - p * 150;
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i)} ${py(p)}`).join(' ');
    const forecast = `M${px(points.length - 1)} ${py(0.7)} L520 ${py(0.86)} L${W} ${py(1)}`;
    const r = 16;
    const c = 2 * Math.PI * r;
    const max = 410;
    return html`
      <sw-page heading="אנליטיקת אחסון" subheading="Beta · ניטור שימוש, תכנון קדימה ושליטה · נתון נמדד לעומת אומדן מסומן · אין format או RAID · נתוני הדגמה">
        <div slot="actions" style="display:flex;gap:4px">${['7D', '30D', '90D', '1Y'].map((x) => html`<sw-chip ?selected=${this.range === x} @click=${() => (this.range = x)}>${x}</sw-chip>`)}</div>
        <div class="kpis">
          <sw-card flush class="kpi"><div><div class="v">1.3 TB</div><div class="l">אחסון בשימוש (נמדד)</div></div><div class="ic"><sw-icon name="storage" size=${16}></sw-icon></div></sw-card>
          <sw-card flush class="kpi"><div><div class="v">1.9 TB</div><div class="l">קיבולת כוללת</div></div><div class="ic"><sw-icon name="cpu" size=${16}></sw-icon></div></sw-card>
          <sw-card flush class="kpi"><div><div class="v">68%</div><div class="l">ניצולת · ≈ 11 ימים נשמרים</div></div><svg viewBox="0 0 40 40" aria-hidden="true">${svg`<circle cx="20" cy="20" r=${r} fill="none" stroke="var(--sw-surface-3)" stroke-width="6" /><circle cx="20" cy="20" r=${r} fill="none" stroke="var(--sw-accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray=${`${c * 0.68} ${c}`} transform="rotate(-90 20 20)" />`}</svg></sw-card>
        </div>
        <sw-card heading="תחזית שימוש באחסון" subheading="עד הקו: נתון נמדד · אחרי הקו: אומדן (אינו תחזית פשוטה של דיסק מתמלא)">
          <svg class="trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="תחזית אחסון">
            ${svg`
              ${[0.25, 0.5, 0.75, 1].map((g) => svg`<line x1="0" x2=${W} y1=${py(g)} y2=${py(g)} stroke="var(--sw-border)" />`)}
              <path d="${path} L${px(points.length - 1)} 170 L0 170 Z" fill="var(--sw-accent-soft)" />
              <path d="${path}" fill="none" stroke="var(--sw-accent)" stroke-width="2.5" />
              <path d="${forecast}" fill="none" stroke="var(--sw-accent)" stroke-width="2" stroke-dasharray="5 5" opacity="0.7" />
              <line x1=${px(points.length - 1)} x2=${px(points.length - 1)} y1="10" y2="170" stroke="var(--sw-stale)" stroke-dasharray="4 4" />
              <rect x="470" y="18" width="110" height="34" rx="6" fill="#fff" stroke="var(--sw-border)" />
              <text x="525" y="32" font-size="10.5" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">אומדן מילוי</text>
              <text x="525" y="46" font-size="11" font-weight="600" text-anchor="middle" fill="var(--sw-text)" font-family="var(--sw-font)">≈ 25.09.2026</text>
              ${['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול'].map((m, i) => svg`<text x=${px(i)} y="190" font-size="10" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">${m}</text>`)}
              ${['0.5 TB', '1 TB', '1.5 TB', '1.9 TB'].map((t, i) => svg`<text x="4" y=${py(0.25 * (i + 1)) - 3} font-size="9.5" fill="var(--sw-text-3)" font-family="var(--sw-font)">${t}</text>`)}
            `}
          </svg>
        </sw-card>
        <div class="grid">
          <sw-card heading="שימוש באחסון לפי מצלמה" subheading="נמדד · לפני retention">
            ${PER_CAMERA.map((cam) => html`<div class="cam"><span>${cam.name}</span><span class="bar"><i style="--p:${(cam.gb / max) * 100}%"></i></span><span class="gb ltr">${cam.gb} GB</span></div>`)}
            <div class="hint" style="margin-block-start:6px">מחיקת הקלטות לפי retention מבטלת cache בהתאם.</div>
          </sw-card>
          <sw-card heading="מדיניות הקלטה" subheading="קריאה מה־NVR">
            <div class="policy"><span class="ic"><sw-icon name="history" size=${14}></sw-icon></span><span>רציפה<small>5 מצלמות</small></span></div>
            <div class="policy"><span class="ic"><sw-icon name="activity" size=${14}></sw-icon></span><span>לפי תנועה<small>4 מצלמות</small></span></div>
            <div class="policy"><span class="ic"><sw-icon name="calendar" size=${14}></sw-icon></span><span>מתוזמנת<small>0 מצלמות</small></span></div>
            <div class="policy"><span class="ic"><sw-icon name="bell" size=${14}></sw-icon></span><span>לפי אירוע<small>1 מצלמה · pre/post 5s / 10s</small></span></div>
            <div style="margin-block-start:10px"><sw-button size="sm" disabled icon="edit">עריכת מדיניות (לא בפיילוט)</sw-button></div>
          </sw-card>
        </div>
      </sw-page>
    `;
  }
}
