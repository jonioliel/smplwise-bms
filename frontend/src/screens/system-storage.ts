import { LitElement, html, css, svg } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-kpi';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';

const PER_CAMERA = [
  { id: 'c1', name: 'כניסה ראשית', gb: 320, policy: 'רציפה', days: 12 },
  { id: 'c2', name: 'לובי', gb: 180, policy: 'תנועה', days: 30 },
  { id: 'c4', name: 'אולם', gb: 410, policy: 'רציפה', days: 12 },
  { id: 'c7', name: 'מחסן', gb: 96, policy: 'תנועה', days: 41 },
  { id: 'c10', name: 'חצר אחורית', gb: 380, policy: 'רציפה', days: 11 },
];

const columns: TableColumn[] = [
  { key: 'name', label: 'מצלמה' },
  { key: 'gb', label: 'נפח (נמדד)', ltr: true, render: (r) => html`${r.gb} GB` },
  { key: 'policy', label: 'מדיניות הקלטה' },
  { key: 'days', label: 'ימים שנשמרו (בפועל)', ltr: true },
];

/** SC20 — storage and recording plan (board 2 screen 11, Beta): observed vs estimated, guarded writes. */
@customElement('system-storage')
export class SystemStorage extends LitElement {
  static styles = css`
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--sw-s-3);
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr);
      gap: var(--sw-s-4);
      align-items: start;
    }
    svg {
      inline-size: 100%;
      block-size: 180px;
      direction: ltr;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 1023px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    const points = [0.3, 0.36, 0.45, 0.5, 0.58, 0.63, 0.7];
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i / (points.length - 1)) * 600} ${160 - p * 150}`).join(' ');
    return html`
      <sw-page heading="אחסון ותוכנית הקלטה" subheading="Beta · נתון נמדד לעומת אומדן מסומן · אין format או RAID · נתוני הדגמה">
        <div class="kpis">
          <sw-kpi icon="storage" value="1.3 TB" label="בשימוש" detail="מתוך 1.9 TB (נמדד)"></sw-kpi>
          <sw-kpi icon="clock" tone="partial" value="≈ 11 ימים" label="הקלטה ישנה ביותר" detail="נמדד; במצב overwrite"></sw-kpi>
          <sw-kpi icon="warning" tone="stale" value="אומדן" label="ימים שנותרו" detail="אינו תחזית פשוטה של דיסק מתמלא"></sw-kpi>
          <sw-kpi icon="check" tone="live" value="תקין" label="דיסק" detail="SMART: אין אזהרות"></sw-kpi>
        </div>
        <div class="grid">
          <sw-card heading="מגמת שימוש (אומדן מסומן)">
            <svg viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label="מגמת אחסון">
              ${svg`<path d="${path} L600 180 L0 180 Z" fill="var(--sw-accent-soft)" /><path d="${path}" fill="none" stroke="var(--sw-accent)" stroke-width="2.5" /><line x1="430" x2="430" y1="0" y2="180" stroke="var(--sw-stale)" stroke-dasharray="4 4" /><text x="436" y="16" font-size="12" fill="var(--sw-stale)">מכאן: אומדן</text>`}
            </svg>
            <div class="hint">משמאל נתון נמדד, מימין לקו אומדן. מחיקת הקלטות לפי retention מבטלת cache בהתאם.</div>
          </sw-card>
          <sw-card heading="מדיניות הקלטה (קריאה)">
            <div class="row"><span>רציפה</span><span>5 מצלמות</span></div>
            <div class="row"><span>לפי תנועה</span><span>4 מצלמות</span></div>
            <div class="row"><span>ידנית בלבד</span><span>0</span></div>
            <div class="row"><span>pre/post event</span><span>5s / 10s</span></div>
            <div class="hint" style="margin-block-start:8px">עריכת מדיניות היא פעולה מנהלית עם preview, גיבוי ובדיקת חזרה — לא בפיילוט.</div>
            <div style="margin-block-start:8px"><sw-button disabled icon="edit">עריכת מדיניות</sw-button></div>
          </sw-card>
        </div>
        <sw-table .columns=${columns} .rows=${PER_CAMERA}></sw-table>
      </sw-page>
    `;
  }
}
