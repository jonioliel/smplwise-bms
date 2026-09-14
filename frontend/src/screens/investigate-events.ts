import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-table';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-chip';
import '../components/sw-drawer';
import '../components/sw-field';
import '../components/sw-icon';
import '../components/sw-kpi';
import type { TableColumn } from '../components/sw-table';
import { demoEvents, eventTypeLabel, type DemoEvent } from '../fixtures/catalog';

const TONE: Record<DemoEvent['type'], string> = { person: '#2f6bff', vehicle: '#22c55e', motion: '#ef4444', line: '#f59e0b', offline: '#6b7280', door: '#8b5cf6' };

/** SC14 — event center (board 1 screen 8): thumbnails, type dot, camera, time, source, coverage, documented Ack. */
@customElement('investigate-events')
export class InvestigateEvents extends LitElement {
  @state() private selected: string | null = null;
  @state() private filter: 'all' | 'unacked' = 'all';

  static styles = css`
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--sw-s-3);
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
    }
    .filters sw-field {
      min-inline-size: 150px;
    }
    .filters .grow {
      flex: 1;
    }
    .stage {
      position: relative;
      min-block-size: 420px;
    }
    .thumb {
      inline-size: 72px;
      block-size: 44px;
      border-radius: 6px;
      position: relative;
      overflow: hidden;
      background: linear-gradient(180deg, #e7e2d8 0%, #c9bda9 55%, #6e5f4c 100%);
    }
    .thumb.out {
      background: linear-gradient(180deg, #a9c4e6 0%, #cfdff0 34%, #8fa58b 50%, #5f7358 70%, #3f4d3c 100%);
    }
    .thumb::after {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(120% 100% at 50% 40%, transparent 55%, rgba(0, 0, 0, 0.35) 100%);
    }
    .thumb.none {
      background: var(--sw-surface-3);
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
    }
    .thumb.none::after {
      display: none;
    }
    .ty {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-weight: var(--sw-fw-semibold);
    }
    .ty i {
      inline-size: 9px;
      block-size: 9px;
      border-radius: 50%;
      background: var(--tone);
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .preview {
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      color: #fff;
      font-size: var(--sw-fs-sm);
      background: linear-gradient(180deg, #a9c4e6 0%, #cfdff0 34%, #8fa58b 50%, #5f7358 70%, #3f4d3c 100%);
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      position: relative;
    }
    .preview.none {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      text-shadow: none;
    }
    .preview .demo {
      position: absolute;
      inset-inline-start: 8px;
      inset-block-start: 8px;
      font-size: 10px;
      background: rgba(17, 24, 39, 0.55);
      border-radius: 4px;
      padding: 1px 6px;
      text-shadow: none;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 14px;
      margin: 0;
      font-size: var(--sw-fs-sm);
    }
    dt {
      color: var(--sw-text-3);
    }
    dd {
      margin: 0;
    }
    @media (max-width: 1023px) {
      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;

  private columns: TableColumn[] = [
    { key: 'thumb', label: '', width: '84px', render: (r) => (r.type === 'offline' || r.type === 'door' ? html`<div class="thumb none"><sw-icon name=${r.type === 'offline' ? 'offline' : 'door'} size=${16}></sw-icon></div>` : html`<div class="thumb ${r.floor === 'חוץ' ? 'out' : ''}"></div>`) },
    { key: 'title', label: 'אירוע', render: (r) => html`<span class="ty" style="--tone:${TONE[r.type as DemoEvent['type']]}"><i></i>${eventTypeLabel[r.type as DemoEvent['type']]}</span><div class="sub">${String(r.title)}</div>` },
    { key: 'camera', label: 'מצלמה / ישות' },
    { key: 'floor', label: 'קומה' },
    { key: 'time', label: 'זמן (אתר)' },
    { key: 'source', label: 'מקור', ltr: true },
    { key: 'severity', label: 'חומרה', render: (r) => html`<sw-badge kind=${r.severity === 'critical' ? 'error' : r.severity === 'alert' ? 'stale' : 'neutral'} label=${{ info: 'מידע', alert: 'התראה', critical: 'קריטי' }[r.severity as DemoEvent['severity']]}></sw-badge>` },
    { key: 'acked', label: 'טיפול', render: (r) => (r.acked ? html`<sw-badge kind="neutral" label="טופל"></sw-badge>` : html`<sw-badge kind="stale" label="ממתין"></sw-badge>`) },
  ];

  render() {
    const rows = demoEvents.filter((e) => this.filter === 'all' || !e.acked);
    const ev = demoEvents.find((e) => e.id === this.selected);
    const count = (t: DemoEvent['type']) => demoEvents.filter((e) => e.type === t).length;
    return html`
      <sw-page heading="מרכז אירועים" subheading="${demoEvents.length} אירועים ב־24 שעות · מקור וזמן קליטה נשמרים · נתוני הדגמה">
        <sw-button slot="actions" icon="download">ייצוא רשימה</sw-button>
        <div class="kpis">
          <sw-kpi icon="user" value=${String(count('person'))} label="זיהוי אדם" detail="ב־24 השעות" tone="neutral"></sw-kpi>
          <sw-kpi icon="move" value=${String(count('vehicle'))} label="זיהוי רכב" detail="ב־24 השעות" tone="neutral"></sw-kpi>
          <sw-kpi icon="activity" value=${String(count('motion') + count('line'))} label="תנועה וחציית קו" detail="ב־24 השעות" tone="neutral"></sw-kpi>
          <sw-kpi icon="warning" tone="stale" value=${String(demoEvents.filter((e) => !e.acked).length)} label="ממתינים לטיפול" detail="דורש סימון"></sw-kpi>
        </div>
        <div class="filters">
          <sw-chip ?selected=${this.filter === 'all'} @click=${() => (this.filter = 'all')} count=${demoEvents.length}>הכל</sw-chip>
          <sw-chip ?selected=${this.filter === 'unacked'} @click=${() => (this.filter = 'unacked')} count=${demoEvents.filter((e) => !e.acked).length}>ללא טיפול</sw-chip>
          <span class="grow"></span>
          <sw-field><select><option>כל האתרים</option><option>אתר הדגמה</option></select></sw-field>
          <sw-field><select><option>כל המצלמות</option></select></sw-field>
          <sw-field><select><option>כל הסוגים</option><option>אדם</option><option>רכב</option><option>תנועה</option><option>ניתוק</option></select></sw-field>
          <sw-field><input type="date" value="2026-09-14" data-ltr /></sw-field>
          <sw-button icon="filter" variant="ghost">שמור פילטר</sw-button>
        </div>
        <div class="stage">
          <sw-table .columns=${this.columns} .rows=${rows} .selected=${this.selected} @row-select=${(e: CustomEvent<{ id: string }>) => (this.selected = e.detail.id)}></sw-table>
          ${ev
            ? html`<sw-drawer open heading=${eventTypeLabel[ev.type]} subheading=${`${ev.camera} · ${ev.time}`} @close=${() => (this.selected = null)}>
                <div class="preview ${ev.type === 'offline' || ev.type === 'door' ? 'none' : ''}">${ev.type === 'offline' || ev.type === 'door' ? 'אין תמונה לאירוע זה' : html`<span class="demo">דמו</span>תמונת אירוע מה־NVR תוצג כאן (T044)`}</div>
                <dl>
                  <dt>מקור</dt><dd><span class="ltr">${ev.source}</span> · raw: <span class="ltr">${ev.type}</span></dd>
                  <dt>זמן אירוע</dt><dd>${ev.time} · נקלט +1.2s</dd>
                  <dt>קומה</dt><dd>${ev.floor}</dd>
                  <dt>כיסוי הקלטה</dt><dd>${ev.type === 'offline' ? 'אין' : 'קיים · 10 שנ׳ לפני/אחרי'}</dd>
                  <dt>טיפול</dt><dd>${ev.acked ? 'טופל בידי יוני, 09:50' : 'ממתין'}</dd>
                </dl>
                <div slot="footer">
                  <a href="#/investigate/playback"><sw-button variant="primary" icon="history">להקלטה</sw-button></a>
                  <a href="#/investigate/floors/f0/history"><sw-button icon="map">במפה</sw-button></a>
                  <sw-button variant="ghost" icon="check" ?disabled=${ev.acked}>סמן טופל</sw-button>
                </div>
              </sw-drawer>`
            : ''}
        </div>
      </sw-page>
    `;
  }
}
