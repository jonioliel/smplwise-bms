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
import '../components/sw-scene';
import type { TableColumn } from '../components/sw-table';
import { demoEvents, eventTypeLabel, type DemoEvent } from '../fixtures/catalog';

const TONE: Record<DemoEvent['type'], string> = { person: '#2f6bff', vehicle: '#22c55e', motion: '#ef4444', line: '#f59e0b', offline: '#6b7280', door: '#8b5cf6' };
const SCENE: Record<string, string> = { 'כניסה ראשית': 'entrance', 'חצר אחורית': 'backyard', מחסן: 'warehouse', לובי: 'lobby', 'חניה מקורה': 'parking', 'מסדרון מזרחי': 'corridor' };

/** SC14 — event center (board 1 screen 8): filters, thumbnail | event | camera | time | ⋯, drawer with source and coverage. */
@customElement('investigate-events')
export class InvestigateEvents extends LitElement {
  @state() private selected: string | null = null;
  @state() private filter: 'all' | 'unacked' = 'all';

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
  `;

  private columns: TableColumn[] = [
    { key: 'thumb', label: 'תמונה', width: '80px', render: (r) => (r.type === 'offline' || r.type === 'door' ? html`<div class="thumb none"><sw-icon name=${r.type === 'offline' ? 'offline' : 'door'} size=${14}></sw-icon></div>` : html`<sw-scene class="thumb" kind=${(SCENE[String(r.camera)] ?? 'lobby') as 'lobby'}></sw-scene>`) },
    { key: 'title', label: 'אירוע', render: (r) => html`<span class="ty" style="--tone:${TONE[r.type as DemoEvent['type']]}"><i></i>${eventTypeLabel[r.type as DemoEvent['type']]}</span><div class="sub">${String(r.title)} · ${r.acked ? 'טופל' : 'ממתין לטיפול'}</div>` },
    { key: 'camera', label: 'מצלמה', render: (r) => html`${String(r.camera)}<div class="sub">${String(r.floor)}</div>` },
    { key: 'time', label: 'זמן', render: (r) => html`${String(r.time)}<div class="sub ltr">${String(r.source)}</div>` },
    { key: 'severity', label: 'חומרה', render: (r) => html`<sw-badge kind=${r.severity === 'critical' ? 'error' : r.severity === 'alert' ? 'stale' : 'neutral'} label=${{ info: 'מידע', alert: 'התראה', critical: 'קריטי' }[r.severity as DemoEvent['severity']]}></sw-badge>` },
    { key: 'more', label: '', width: '40px', render: () => html`<sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>` },
  ];

  render() {
    const rows = demoEvents.filter((e) => this.filter === 'all' || !e.acked);
    const ev = demoEvents.find((e) => e.id === this.selected);
    return html`
      <sw-page heading="מרכז אירועים" subheading="חיפוש, סינון וסקירה של כל האירועים · מקור וזמן קליטה נשמרים · נתוני הדגמה">
        <sw-button slot="actions" icon="download">ייצוא</sw-button>
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
      </sw-page>
    `;
  }
}
