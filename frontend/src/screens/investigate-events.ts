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
import type { TableColumn } from '../components/sw-table';
import { demoEvents, eventTypeLabel, type DemoEvent } from '../fixtures/catalog';

/** SC14 — event center (board 1 screen 8): thumbnails, type, camera, time, source, coverage, documented Ack. */
@customElement('investigate-events')
export class InvestigateEvents extends LitElement {
  @state() private selected: string | null = null;
  @state() private filter: 'all' | 'unacked' = 'all';

  static styles = css`
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      align-items: center;
    }
    .filters sw-field {
      min-inline-size: 160px;
    }
    .stage {
      position: relative;
      min-block-size: 420px;
    }
    .thumb {
      inline-size: 64px;
      block-size: 40px;
      border-radius: 4px;
      background: linear-gradient(135deg, #172033, #0b1220);
      display: grid;
      place-items: center;
      color: rgba(255, 255, 255, 0.6);
    }
    .thumb.none {
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
    }
    .preview {
      aspect-ratio: 16 / 9;
      background: var(--sw-video-bg);
      border-radius: var(--sw-r-md);
      display: grid;
      place-items: center;
      color: rgba(255, 255, 255, 0.7);
      font-size: var(--sw-fs-sm);
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
  `;

  private columns: TableColumn[] = [
    { key: 'thumb', label: '', width: '72px', render: (r) => html`<div class="thumb ${r.type === 'offline' || r.type === 'door' ? 'none' : ''}"><sw-icon name=${r.type === 'offline' ? 'offline' : r.type === 'door' ? 'door' : 'camera'} size=${16}></sw-icon></div>` },
    { key: 'title', label: 'אירוע', render: (r) => html`<strong>${eventTypeLabel[r.type as DemoEvent['type']]}</strong><div style="color:var(--sw-text-3);font-size:var(--sw-fs-xs)">${String(r.title)}</div>` },
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
    return html`
      <sw-page heading="מרכז אירועים" subheading="${demoEvents.length} אירועים ב־24 שעות · מקור וזמן קליטה נשמרים · נתוני הדגמה">
        <sw-button slot="actions" icon="download">ייצוא רשימה</sw-button>
        <div class="filters">
          <sw-chip ?selected=${this.filter === 'all'} @click=${() => (this.filter = 'all')} count=${demoEvents.length}>הכל</sw-chip>
          <sw-chip ?selected=${this.filter === 'unacked'} @click=${() => (this.filter = 'unacked')} count=${demoEvents.filter((e) => !e.acked).length}>ללא טיפול</sw-chip>
          <sw-field><select><option>כל האתרים</option><option>אתר הדגמה</option></select></sw-field>
          <sw-field><select><option>כל המצלמות</option></select></sw-field>
          <sw-field><select><option>כל הסוגים</option><option>אדם</option><option>רכב</option><option>תנועה</option><option>ניתוק</option></select></sw-field>
          <sw-field><input type="date" value="2026-09-14" data-ltr /></sw-field>
          <sw-chip icon="filter">שמור פילטר</sw-chip>
        </div>
        <div class="stage">
          <sw-table .columns=${this.columns} .rows=${rows} .selected=${this.selected} @row-select=${(e: CustomEvent<{ id: string }>) => (this.selected = e.detail.id)}></sw-table>
          ${ev
            ? html`<sw-drawer open heading=${eventTypeLabel[ev.type]} subheading=${`${ev.camera} · ${ev.time}`} @close=${() => (this.selected = null)}>
                <div class="preview">${ev.type === 'offline' || ev.type === 'door' ? 'אין תמונה לאירוע זה' : 'תמונת אירוע מה־NVR תוצג כאן (T044)'}</div>
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
