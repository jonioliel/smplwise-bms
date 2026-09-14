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
  { key: 'gb', label: 'נפח (נמדד)', render: (r) => html`<div class="bar"><i style="--p:${(Number(r.gb) / 410) * 100}%"></i></div><span class="ltr">${r.gb} GB</span>` },
  { key: 'policy', label: 'מדיניות הקלטה', render: (r) => html`<sw-badge kind=${r.policy === 'רציפה' ? 'recorded' : 'neutral'} label=${String(r.policy)}></sw-badge>` },
  { key: 'days', label: 'ימים שנשמרו (בפועל)', ltr: true },
];

/** SC20 — storage and recording plan (board 2 screen 11, Beta): donut, observed vs estimated, guarded writes. */
@customElement('system-storage')
export class SystemStorage extends LitElement {
  static styles = css`
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--sw-s-4);
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(280px, 1fr) minmax(0, 1.6fr);
      gap: var(--sw-s-4);
      align-items: start;
    }
    .donut {
      display: flex;
      align-items: center;
      gap: var(--sw-s-5);
    }
    .donut svg {
      inline-size: 150px;
      block-size: 150px;
      flex-shrink: 0;
    }
    .lg {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    .lg span::before {
      content: '';
      display: inline-block;
      inline-size: 10px;
      block-size: 10px;
      border-radius: 3px;
      margin-inline-end: 8px;
      background: var(--c);
      vertical-align: middle;
    }
    .trend {
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
      padding: 9px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    sw-table .bar {
      display: inline-block;
      inline-size: 90px;
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      margin-inline-end: 8px;
      vertical-align: middle;
      overflow: hidden;
    }
    sw-table .bar i {
      display: block;
      block-size: 100%;
      inline-size: var(--p);
      background: var(--sw-accent);
    }
    @media (max-width: 1023px) {
      .grid {
        grid-template-columns: 1fr;
      }
      .kpis {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;

  render() {
    const points = [0.3, 0.36, 0.45, 0.5, 0.58, 0.63, 0.7];
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i / (points.length - 1)) * 600} ${160 - p * 150}`).join(' ');
    const r = 56;
    const c = 2 * Math.PI * r;
    const cont = 0.52;
    const motion = 0.16;
    return html`
      <sw-page heading="אחסון ותוכנית הקלטה" subheading="Beta · נתון נמדד לעומת אומדן מסומן · אין format או RAID · נתוני הדגמה">
        <div class="kpis">
          <sw-kpi icon="storage" value="1.3 TB" label="בשימוש" detail="מתוך 1.9 TB (נמדד)" tone="neutral"></sw-kpi>
          <sw-kpi icon="clock" tone="partial" value="≈ 11 ימים" label="הקלטה ישנה ביותר" detail="נמדד; במצב overwrite"></sw-kpi>
          <sw-kpi icon="warning" tone="stale" value="אומדן" label="ימים שנותרו" detail="אינו תחזית פשוטה של דיסק מתמלא"></sw-kpi>
          <sw-kpi icon="check" tone="live" value="תקין" label="דיסק" detail="SMART: אין אזהרות"></sw-kpi>
        </div>
        <div class="grid">
          <sw-card heading="חלוקת אחסון" subheading="נמדד מה־NVR">
            <div class="donut">
              <svg viewBox="0 0 140 140" role="img" aria-label="אחסון: 68% בשימוש">
                ${svg`<circle cx="70" cy="70" r=${r} fill="none" stroke="var(--sw-surface-3)" stroke-width="16" />
                <circle cx="70" cy="70" r=${r} fill="none" stroke="var(--sw-accent)" stroke-width="16" stroke-dasharray=${`${c * cont} ${c}`} transform="rotate(-90 70 70)" />
                <circle cx="70" cy="70" r=${r} fill="none" stroke="#8fb0ff" stroke-width="16" stroke-dasharray=${`${c * motion} ${c}`} stroke-dashoffset=${-c * cont} transform="rotate(-90 70 70)" />
                <text x="70" y="66" text-anchor="middle" font-size="24" font-weight="700" fill="var(--sw-text)" font-family="var(--sw-font)">68%</text>
                <text x="70" y="84" text-anchor="middle" font-size="11" fill="var(--sw-text-3)" font-family="var(--sw-font)">בשימוש</text>`}
              </svg>
              <div class="lg">
                <span style="--c: var(--sw-accent)">הקלטה רציפה · 1.0 TB</span>
                <span style="--c: #8fb0ff">הקלטת תנועה · 0.3 TB</span>
                <span style="--c: var(--sw-surface-3)">פנוי · 0.6 TB</span>
              </div>
            </div>
          </sw-card>
          <sw-card heading="מגמת שימוש" subheading="משמאל נתון נמדד, מימין לקו אומדן">
            <svg class="trend" viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label="מגמת אחסון">
              ${svg`<path d="${path} L600 180 L0 180 Z" fill="var(--sw-accent-soft)" /><path d="${path}" fill="none" stroke="var(--sw-accent)" stroke-width="2.5" /><line x1="430" x2="430" y1="0" y2="180" stroke="var(--sw-stale)" stroke-dasharray="4 4" /><text x="436" y="16" font-size="12" fill="var(--sw-stale)" font-family="var(--sw-font)">מכאן: אומדן</text>`}
            </svg>
            <div class="hint">מחיקת הקלטות לפי retention מבטלת cache בהתאם.</div>
          </sw-card>
        </div>
        <div class="grid" style="grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr)">
          <sw-table .columns=${columns} .rows=${PER_CAMERA}></sw-table>
          <sw-card heading="מדיניות הקלטה (קריאה)">
            <div class="row"><span>רציפה</span><span>5 מצלמות</span></div>
            <div class="row"><span>לפי תנועה</span><span>4 מצלמות</span></div>
            <div class="row"><span>ידנית בלבד</span><span>0</span></div>
            <div class="row"><span>pre/post event</span><span class="ltr">5s / 10s</span></div>
            <div class="hint" style="margin-block-start:8px">עריכת מדיניות היא פעולה מנהלית עם preview, גיבוי ובדיקת חזרה — לא בפיילוט.</div>
            <div style="margin-block-start:8px"><sw-button disabled icon="edit">עריכת מדיניות</sw-button></div>
          </sw-card>
        </div>
      </sw-page>
    `;
  }
}
