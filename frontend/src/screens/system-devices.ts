import { LitElement, html, css, svg } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-table';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-drawer';
import '../components/sw-field';
import '../components/sw-scene';
import type { TableColumn } from '../components/sw-table';
import { demoScene, demoWall } from '../fixtures/catalog';

/** SC27 — camera health (board 2 screen 12): filter pills, thumbnail rows, status dot, fps / bitrate / firmware / last event / network bars. */
@customElement('system-devices')
export class SystemDevices extends LitElement {
  @state() private selected: string | null = null;
  @state() private filter: 'all' | 'online' | 'offline' | 'issues' = 'all';

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

  private net(level: number) {
    return svg`<svg class="net" viewBox="0 0 22 14" aria-label="רשת">${[0, 1, 2, 3].map((i) => svg`<rect x=${i * 5.5} y=${11 - i * 3} width="4" height=${3 + i * 3} rx="1" fill=${i < level ? (level >= 3 ? '#22c55e' : '#f59e0b') : 'var(--sw-border-strong)'} />`)}</svg>`;
  }

  private columns: TableColumn[] = [
    { key: 'name', label: 'מצלמה', render: (r) => html`<div class="cam">${r.state === 'offline' || r.state === 'forbidden' ? html`<div class="none"></div>` : html`<sw-scene kind=${(demoScene[String(r.id)] ?? 'lobby') as 'lobby'}></sw-scene>`}<div><b>${String(r.name)}</b><small>${String(r.floor)} · ערוץ ${String(r.id).replace('cam-', '')}</small></div></div>` },
    { key: 'state', label: 'מצב', render: (r) => html`<span class="status"><i style="--c:${r.state === 'live' ? 'var(--sw-live)' : r.state === 'offline' ? 'var(--sw-danger)' : 'var(--sw-stale)'}"></i>${r.state === 'live' ? 'מחוברת' : r.state === 'offline' ? 'מנותקת' : r.state === 'stale' ? 'לא מעודכן' : 'ללא הרשאה'}</span>` },
    { key: 'fps', label: 'FPS', ltr: true, render: (r) => html`${r.fps ?? '—'}` },
    { key: 'bitrateKbps', label: 'קצב', ltr: true, render: (r) => html`${r.bitrateKbps ? `${(Number(r.bitrateKbps) / 1024).toFixed(1)} Mbps` : '—'}` },
    { key: 'firmware', label: 'קושחה', ltr: true },
    { key: 'lastEvent', label: 'אירוע אחרון' },
    { key: 'net', label: 'רשת', render: (r) => this.net(r.state === 'live' ? 4 : r.state === 'stale' ? 2 : 0) },
    { key: 'more', label: '', width: '40px', render: () => html`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>` },
  ];

  render() {
    const rows = demoWall.filter((c) => (this.filter === 'all' ? true : this.filter === 'online' ? c.state === 'live' : this.filter === 'offline' ? c.state === 'offline' : c.state === 'stale' || c.state === 'forbidden'));
    const cam = demoWall.find((c) => c.id === this.selected);
    return html`
      <sw-page heading="בריאות מצלמות" subheading="NVR ראשי · 10 ערוצים · Capability matrix לפי ראיות · נתוני הדגמה">
        <sw-button slot="actions" icon="refresh">בדיקת יכולות (קריאה)</sw-button>
        <sw-button slot="actions" variant="primary" icon="plus">הוספת NVR</sw-button>
        <div class="filters">
          <sw-chip ?selected=${this.filter === 'all'} @click=${() => (this.filter = 'all')} count=${demoWall.length}>הכל</sw-chip>
          <sw-chip dot="#22c55e" ?selected=${this.filter === 'online'} @click=${() => (this.filter = 'online')} count=${demoWall.filter((c) => c.state === 'live').length}>מחוברות</sw-chip>
          <sw-chip dot="#ef4444" ?selected=${this.filter === 'offline'} @click=${() => (this.filter = 'offline')} count=${demoWall.filter((c) => c.state === 'offline').length}>מנותקות</sw-chip>
          <sw-chip dot="#f59e0b" ?selected=${this.filter === 'issues'} @click=${() => (this.filter = 'issues')} count=${demoWall.filter((c) => c.state === 'stale' || c.state === 'forbidden').length}>בעיות</sw-chip>
          <span class="grow"></span>
          <sw-field style="inline-size:200px"><input type="search" placeholder="חיפוש מצלמה…" aria-label="חיפוש" /></sw-field>
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
                  <sw-button variant="primary" size="sm" icon="check">שמור כינוי</sw-button>
                  <sw-button size="sm" icon="refresh">בדיקת ערוץ</sw-button>
                  <sw-button variant="danger" size="sm" disabled>אתחול מצלמה</sw-button>
                </div>
              </sw-drawer>`
            : ''}
        </div>
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
      </sw-page>
    `;
  }
}
