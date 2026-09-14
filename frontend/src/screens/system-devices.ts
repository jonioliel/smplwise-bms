import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-table';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-drawer';
import '../components/sw-field';
import type { TableColumn } from '../components/sw-table';
import { demoWall } from '../fixtures/catalog';

/** SC27 — NVRs, cameras and health (board 2 screen 12): mapping/aliases/order, capability, firmware, probes. */
@customElement('system-devices')
export class SystemDevices extends LitElement {
  @state() private selected: string | null = null;
  @state() private filter: 'all' | 'online' | 'offline' | 'issues' = 'all';

  static styles = css`
    .filters {
      display: flex;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .stage {
      position: relative;
      min-block-size: 420px;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 14px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-2);
    }
    dd {
      margin: 0;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .nvr {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: var(--sw-s-3);
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

  private columns: TableColumn[] = [
    { key: 'name', label: 'מצלמה', render: (r) => html`<strong>${String(r.name)}</strong><div class="hint">כינוי מקומי ≠ שם ב־NVR</div>` },
    { key: 'id', label: 'ערוץ / track', ltr: true, render: (r) => html`${String(r.id).replace('cam-', '')} / ${String(r.id).replace('cam-', '')}01` },
    { key: 'state', label: 'מצב', render: (r) => html`<sw-badge kind=${r.state as 'live'}></sw-badge>` },
    { key: 'recording', label: 'הקלטה', render: (r) => ({ continuous: 'רציפה', motion: 'תנועה', off: 'כבויה', unknown: 'לא ידוע' })[r.recording as string] ?? '' },
    { key: 'fps', label: 'FPS', ltr: true, render: (r) => html`${r.fps ?? '—'}` },
    { key: 'bitrateKbps', label: 'קצב', ltr: true, render: (r) => html`${r.bitrateKbps ? `${(Number(r.bitrateKbps) / 1024).toFixed(1)} Mbps` : '—'}` },
    { key: 'firmware', label: 'קושחה', ltr: true },
    { key: 'caps', label: 'יכולות', render: (r) => html`${r.ptz ? html`<sw-badge kind="neutral" label="PTZ"></sw-badge>` : ''} ${r.audio ? html`<sw-badge kind="neutral" label="שמע"></sw-badge>` : ''}` },
    { key: 'lastEvent', label: 'אירוע אחרון' },
  ];

  render() {
    const rows = demoWall.filter((c) => (this.filter === 'all' ? true : this.filter === 'online' ? c.state === 'live' : this.filter === 'offline' ? c.state === 'offline' : c.state === 'stale' || c.state === 'forbidden'));
    const cam = demoWall.find((c) => c.id === this.selected);
    return html`
      <sw-page heading="מכשירים ובריאות" subheading="NVR ראשי · 10 ערוצים · Capability matrix לפי ראיות · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">בדיקת יכולות (קריאה)</sw-button>
        <sw-button slot="actions" variant="primary" icon="plus">הוספת NVR</sw-button>
        <sw-card heading="NVR ראשי">
          <div class="nvr">
            <div><span>דגם</span>DS-76xx (הדגמה)</div>
            <div><span>קושחה</span><span class="ltr">V4.84.x</span></div>
            <div><span>ערוצים</span>10/16</div>
            <div><span>דיסק</span>1 · תקין · 30% פנוי</div>
            <div><span>שעון</span>NTP · סטייה 2 שנ׳</div>
            <div><span>חיפוש במקביל</span>1 (מגבלת מכשיר)</div>
          </div>
        </sw-card>
        <div class="filters">
          <sw-chip ?selected=${this.filter === 'all'} @click=${() => (this.filter = 'all')} count=${demoWall.length}>הכל</sw-chip>
          <sw-chip ?selected=${this.filter === 'online'} @click=${() => (this.filter = 'online')} count=${demoWall.filter((c) => c.state === 'live').length}>מחוברות</sw-chip>
          <sw-chip ?selected=${this.filter === 'offline'} @click=${() => (this.filter = 'offline')} count=${demoWall.filter((c) => c.state === 'offline').length}>מנותקות</sw-chip>
          <sw-chip ?selected=${this.filter === 'issues'} @click=${() => (this.filter = 'issues')} count=${demoWall.filter((c) => c.state === 'stale' || c.state === 'forbidden').length}>בעיות</sw-chip>
        </div>
        <div class="stage">
          <sw-table .columns=${this.columns} .rows=${rows} .selected=${this.selected} @row-select=${(e: CustomEvent<{ id: string }>) => (this.selected = e.detail.id)}></sw-table>
          ${cam
            ? html`<sw-drawer open heading=${cam.name} subheading=${`ערוץ ${cam.id.replace('cam-', '')} · ${cam.floor}`} @close=${() => (this.selected = null)}>
                <sw-field label="כינוי מקומי" hint="שינוי כינוי אינו משנה OSD; סנכרון ל־NVR הוא פעולה מפורשת"><input value=${cam.name} /></sw-field>
                <sw-field label="סדר תצוגה"><input data-ltr value=${cam.id.replace('cam-', '')} /></sw-field>
                <dl>
                  <dt>שם ב־NVR</dt><dd>Camera ${cam.id.replace('cam-', '')}</dd>
                  <dt>זרמים</dt><dd>ראשי <span class="ltr">${cam.id.replace('cam-', '')}01</span> · משני <span class="ltr">${cam.id.replace('cam-', '')}02</span></dd>
                  <dt>Codec</dt><dd><span class="ltr">H.264 2560×1440</span></dd>
                  <dt>PTZ / שמע</dt><dd>${cam.ptz ? 'נתמך' : 'לא נתמך'} / ${cam.audio ? 'נתמך' : 'לא נתמך'}</dd>
                  <dt>בדיקה אחרונה</dt><dd>היום 10:00 · ראיות מצונזרות</dd>
                </dl>
                <div class="hint">ניתוק מקור מוצג כניתוק, לא כאשמת הממשק. הפעולות הרגישות (אתחול, OSD) דורשות הרשאה ואישור.</div>
                <div slot="footer">
                  <sw-button variant="primary" icon="check">שמור כינוי</sw-button>
                  <sw-button icon="refresh">בדיקת ערוץ</sw-button>
                  <sw-button variant="danger" disabled>אתחול מצלמה</sw-button>
                </div>
              </sw-drawer>`
            : ''}
        </div>
      </sw-page>
    `;
  }
}
