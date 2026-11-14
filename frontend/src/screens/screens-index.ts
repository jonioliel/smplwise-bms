import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { settingsLadderStyles } from '../styles/settings';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-icon';
import type { StateKind } from '../components/sw-badge';
import { tr } from '../i18n/msg/screens';

interface Entry {
  sc: string;
  name: string;
  route: string;
  phase: 'PILOT' | 'BETA' | 'V1';
  board: string;
}

const SCREENS: { mode: string; items: Entry[] }[] = [
  {
    mode: tr('סקירה ומצלמות'),
    items: [
      { sc: 'SC01', name: tr('סקירה (Dashboard)'), route: '#/live', phase: 'PILOT', board: '1:01 · 2:15' },
      { sc: 'SC07', name: tr('כל המצלמות (Grid)'), route: '#/live/wall', phase: 'PILOT', board: '1:06' },
      { sc: 'SC08', name: tr('מצלמה בודדת'), route: '#/live/cameras/cam-4', phase: 'PILOT', board: '1:05' },
      { sc: 'SC09', name: tr('תצוגות שמורות'), route: '#/live/views', phase: 'PILOT', board: 'legacy' },
      { sc: 'SC27', name: tr('בריאות מצלמות'), route: '#/system/devices', phase: 'PILOT', board: '2:12' },
      { sc: 'SC31', name: tr('קיוסק / תצוגת קיר'), route: '#/kiosk/all', phase: 'BETA', board: '3:24' },
    ],
  },
  {
    mode: tr('אתרים ומפות'),
    items: [
      { sc: 'SC02', name: tr('אתרים ומבנים'), route: '#/explore/sites', phase: 'PILOT', board: '1:02 · 3:17' },
      { sc: 'SC03', name: tr('דפדפן קומות'), route: '#/explore/buildings/bld-a/floors', phase: 'PILOT', board: '1:03' },
      { sc: 'SC04', name: tr('מפת קומה חיה'), route: '#/explore/floors/f0', phase: 'PILOT', board: '1:04' },
      { sc: 'SC05', name: tr('ייבוא ותיקון תוכנית'), route: '#/explore/floors/f-2/import', phase: 'PILOT', board: '2:13' },
      { sc: 'SC06', name: tr('עורך תוכנית ועוגנים'), route: '#/explore/floors/f0/edit', phase: 'PILOT', board: '2:13' },
      { sc: 'SC10', name: tr('קטלוג ההתקנים'), route: '#/system/entities', phase: 'PILOT', board: 'new' },
    ],
  },
  {
    // CR-010 (2026-09-29): לייב and חקירה became sections of the security area, with the alarm as the third.
    mode: tr('אבטחה · אזעקה'),
    items: [{ sc: 'SC34', name: tr('אזעקה: לוח, חיישנים ועקיפה'), route: '#/security/alarm', phase: 'BETA', board: 'CR-010' }],
  },
  {
    // Own top-level area since 0.1.103 (owner override 2026-09-27); was a sub-tab of "אתרים ומפות" in phase 1a.
    mode: 'WisKey',
    items: [{ sc: 'SC23', name: tr('WisKey · מרכז הכניסה'), route: '#/wiskey/overview', phase: 'V1', board: '3:18' }],
  },
  {
    // CR-007 (2026-09-28): electricity / device control, a top-level area approved from the mockup (6 boards).
    mode: tr('חשמל והתקנים'),
    items: [
      { sc: 'SC32', name: tr('חשמל והתקנים · המבנה'), route: '#/devices/building', phase: 'BETA', board: 'CR-007:1' },
      { sc: 'SC33', name: tr('חשמל והתקנים · אזור'), route: '#/devices/areas/unassigned', phase: 'BETA', board: 'CR-007:2' },
    ],
  },
  {
    mode: tr('אירועים והקלטות'),
    items: [
      { sc: 'SC14', name: tr('מרכז אירועים'), route: '#/investigate/events', phase: 'PILOT', board: '1:08' },
      { sc: 'SC12', name: tr('הקלטות / ציר זמן'), route: '#/investigate/playback', phase: 'PILOT', board: '1:07 · 2:16' },
      { sc: 'SC13', name: tr('מרכז שליטה / ניגון מסונכרן'), route: '#/investigate/playback/sync', phase: 'BETA', board: '2:14' },
      { sc: 'SC11', name: tr('מפה היסטורית'), route: '#/investigate/floors/f0/history', phase: 'PILOT', board: 'new' },
      { sc: 'SC15', name: tr('סקירה'), route: '#/investigate/reviews', phase: 'BETA', board: 'legacy' },
      { sc: 'SC16', name: tr('תיקים'), route: '#/investigate/cases', phase: 'BETA', board: '2:10' },
      { sc: 'SC17', name: tr('סקירת אירוע / תיק'), route: '#/investigate/cases/case-1', phase: 'BETA', board: '2:10' },
      { sc: 'SC18', name: tr('ייצוא והורדות'), route: '#/investigate/exports', phase: 'BETA', board: '2:10' },
      { sc: 'SC19', name: tr('חיפוש AI'), route: '#/investigate/search', phase: 'BETA', board: '2:09' },
      { sc: 'SC21', name: tr('התראות וחוקים'), route: '#/investigate/rules', phase: 'BETA', board: '3:19' },
      { sc: 'SC22', name: tr('עורך חוק'), route: '#/investigate/rules/r-1', phase: 'BETA', board: '3:19' },
    ],
  },
  {
    mode: tr('הגדרות'),
    items: [
      { sc: 'SC28', name: tr('הגדרות המערכת'), route: '#/system/diagnostics', phase: 'PILOT', board: '3:23' },
      { sc: 'SC24', name: tr('משתמשים והרשאות'), route: '#/system/access', phase: 'PILOT', board: '3:20' },
      { sc: 'SC25', name: tr('יומן אודיט'), route: '#/system/audit', phase: 'PILOT', board: '3:21' },
      { sc: 'SC20', name: tr('אנליטיקת אחסון'), route: '#/system/storage', phase: 'BETA', board: '2:11' },
      { sc: 'SC26', name: tr('אשף התקנה'), route: '#/system/wizard', phase: 'PILOT', board: '3:22' },
      { sc: 'SC26b', name: tr('מוכנות ההתקנה'), route: '#/system/readiness', phase: 'PILOT', board: 'CR-READY96' },
    ],
  },
];

const PHASE_KIND: Record<Entry['phase'], StateKind> = { PILOT: 'live', BETA: 'recorded', V1: 'neutral' };

/** Design-review index of every skeleton screen (SC29/SC30 mobile variants are the same routes at phone width). */
@customElement('screens-index')
export class ScreensIndex extends LitElement {
  static styles = [settingsLadderStyles, css`
    .groups {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 12px;
      align-items: start;
    }
    a {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 0;
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
      inline-size: 40px;
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
  `];

  render() {
    return html`
      <sw-page heading=${tr('כל המסכים (סקירת עיצוב)')} subheading=${tr('29 מסכים על נתוני הדגמה · SC29/SC30 הם אותם מסכים ברוחב טלפון · SC32 (Lovelace) הוא עטיפה של אותם רכיבים')}>
        <div class="note">${tr('כל מסך מסומן ״נתוני הדגמה״. שום זרם וידאו, תמונה או מצב מכשיר אינם אמיתיים כאן (הסצנות מאוירות); המטרה היא לאשר את השפה החזותית, הניווט והזרימות לפני החיבור לנתונים.')}</div>
        <div class="groups">
          ${SCREENS.map(
            (g) => html`<sw-card heading=${g.mode}>
              ${g.items.map((it) => html`<a href=${it.route}><span class="sc">${it.sc}</span><span class="name">${it.name}</span><span class="board">${it.board}</span><sw-badge kind=${PHASE_KIND[it.phase]} label=${it.phase}></sw-badge><sw-icon name="chevron" size=${12}></sw-icon></a>`)}
            </sw-card>`,
          )}
        </div>
      </sw-page>
    `;
  }
}
