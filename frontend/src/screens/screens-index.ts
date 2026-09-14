import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-icon';
import type { StateKind } from '../components/sw-badge';

interface Entry {
  sc: string;
  name: string;
  route: string;
  phase: 'PILOT' | 'BETA' | 'V1';
  board: string;
}

const SCREENS: { mode: string; items: Entry[] }[] = [
  {
    mode: 'שידור חי',
    items: [
      { sc: 'SC01', name: 'סקירה / Spotlights', route: '#/live', phase: 'PILOT', board: '1:01' },
      { sc: 'SC07', name: 'קיר מצלמות', route: '#/live/wall', phase: 'PILOT', board: '1:06' },
      { sc: 'SC08', name: 'מצלמה בודדת', route: '#/live/cameras/cam-1', phase: 'PILOT', board: '1:05' },
      { sc: 'SC09', name: 'תצוגות שמורות', route: '#/live/views', phase: 'PILOT', board: 'legacy' },
      { sc: 'SC31', name: 'קיוסק / תצוגת קיר', route: '#/kiosk/all', phase: 'BETA', board: '3:24' },
    ],
  },
  {
    mode: 'מפות',
    items: [
      { sc: 'SC02', name: 'אתרים ומבנים', route: '#/explore/sites', phase: 'PILOT', board: '1:02 · 3:17' },
      { sc: 'SC03', name: 'דפדפן קומות', route: '#/explore/buildings/bld-a/floors', phase: 'PILOT', board: '1:03' },
      { sc: 'SC04', name: 'מפת קומה חיה', route: '#/explore/floors/f0', phase: 'PILOT', board: '1:04' },
      { sc: 'SC05', name: 'ייבוא ותיקון תוכנית', route: '#/explore/floors/f-2/import', phase: 'PILOT', board: '2:13' },
      { sc: 'SC06', name: 'עורך תוכנית ועוגנים', route: '#/explore/floors/f0/edit', phase: 'PILOT', board: '2:13' },
      { sc: 'SC10', name: 'קטלוג ישויות HA', route: '#/explore/entities', phase: 'PILOT', board: 'new' },
      { sc: 'SC23', name: 'דלת ואינטרקום', route: '#/explore/access/d1', phase: 'V1', board: '3:18' },
    ],
  },
  {
    mode: 'חקירה',
    items: [
      { sc: 'SC12', name: 'הקלטות / ציר זמן', route: '#/investigate/playback', phase: 'PILOT', board: '1:07' },
      { sc: 'SC13', name: 'ניגון מסונכרן', route: '#/investigate/playback/sync', phase: 'BETA', board: '2:14' },
      { sc: 'SC11', name: 'מפה היסטורית', route: '#/investigate/floors/f0/history', phase: 'PILOT', board: 'new' },
      { sc: 'SC14', name: 'מרכז אירועים', route: '#/investigate/events', phase: 'PILOT', board: '1:08' },
      { sc: 'SC15', name: 'תור Review', route: '#/investigate/reviews', phase: 'BETA', board: 'legacy' },
      { sc: 'SC16', name: 'תיקים', route: '#/investigate/cases', phase: 'BETA', board: '2:10' },
      { sc: 'SC17', name: 'תיק חקירה', route: '#/investigate/cases/case-1', phase: 'BETA', board: '2:10' },
      { sc: 'SC18', name: 'ייצוא והורדות', route: '#/investigate/exports', phase: 'BETA', board: '2:10' },
      { sc: 'SC19', name: 'חיפוש מרחבי ו־AI', route: '#/investigate/search', phase: 'BETA', board: '2:09' },
      { sc: 'SC21', name: 'חוקים והתראות', route: '#/investigate/rules', phase: 'BETA', board: '3:19' },
      { sc: 'SC22', name: 'עורך חוק', route: '#/investigate/rules/r-1', phase: 'BETA', board: '3:19' },
    ],
  },
  {
    mode: 'מערכת',
    items: [
      { sc: 'SC24', name: 'משתמשים, קבוצות ותפקידים', route: '#/system/access', phase: 'PILOT', board: '3:20' },
      { sc: 'SC25', name: 'Audit trail', route: '#/system/audit', phase: 'PILOT', board: '3:21' },
      { sc: 'SC26', name: 'אשף התקנה ומיפוי', route: '#/system/setup', phase: 'PILOT', board: '3:22' },
      { sc: 'SC27', name: 'מכשירים ובריאות', route: '#/system/devices', phase: 'PILOT', board: '2:12' },
      { sc: 'SC28', name: 'הגדרות ודיאגנוסטיקה', route: '#/system/diagnostics', phase: 'PILOT', board: '3:23' },
      { sc: 'SC20', name: 'אחסון ותוכנית הקלטה', route: '#/system/storage', phase: 'BETA', board: '2:11' },
    ],
  },
];

const PHASE_KIND: Record<Entry['phase'], StateKind> = { PILOT: 'live', BETA: 'recorded', V1: 'neutral' };

/** Design-review index of every skeleton screen (SC29/SC30 mobile variants are the same routes at phone width). */
@customElement('screens-index')
export class ScreensIndex extends LitElement {
  static styles = css`
    .groups {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: var(--sw-s-4);
      align-items: start;
    }
    a {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      color: var(--sw-text);
      text-decoration: none;
      font-size: var(--sw-fs-sm);
    }
    a:last-child {
      border-block-end: 0;
    }
    a:hover {
      color: var(--sw-accent-text);
    }
    .sc {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      inline-size: 44px;
    }
    .name {
      flex: 1;
    }
    .board {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      direction: ltr;
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
  `;

  render() {
    return html`
      <sw-page heading="כל המסכים (סקירת עיצוב)" subheading="29 מסכים על נתוני הדגמה · SC29/SC30 הם אותם מסכים ברוחב טלפון · SC32 (Lovelace) הוא עטיפה של אותם רכיבים">
        <div class="note">כל מסך מסומן ״נתוני הדגמה״. שום זרם וידאו, תמונה או מצב מכשיר אינם אמיתיים כאן; המטרה היא לאשר את השפה החזותית, הניווט והזרימות לפני החיבור לנתונים.</div>
        <div class="groups">
          ${SCREENS.map(
            (g) => html`<sw-card heading=${g.mode}>
              ${g.items.map((it) => html`<a href=${it.route}><span class="sc">${it.sc}</span><span class="name">${it.name}</span><span class="board">${it.board}</span><sw-badge kind=${PHASE_KIND[it.phase]} label=${it.phase}></sw-badge><sw-icon name="chevron" size=${14}></sw-icon></a>`)}
            </sw-card>`,
          )}
        </div>
      </sw-page>
    `;
  }
}
