import { LitElement, html, css } from 'lit';
import '../components/sw-state-panel';
import { isApi } from '../api/session';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-camera-tile';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-tabs';
import '../components/sw-icon';

const DOORS = [
  { id: 'd1', name: 'כניסה ראשית', kind: 'דלת זכוכית', lock: 'נעול', contact: 'סגור', relay: 'לא פעיל', ringing: false, scene: 'entrance' },
  { id: 'd2', name: 'לובי', kind: 'דלת פנימית', lock: 'פתוח', contact: 'פתוח', relay: 'לא פעיל', ringing: false, scene: 'lobby' },
  { id: 'd3', name: 'אינטרקום M2', kind: 'עמדת דלת', lock: 'נעול', contact: 'סגור', relay: 'לא פעיל', ringing: true, scene: 'entrance' },
  { id: 'd4', name: 'מחסן', kind: 'דלת שירות', lock: 'נעול', contact: 'סגור', relay: 'לא פעיל', ringing: false, scene: 'warehouse' },
] as const;

/** SC23 — access & intercom (board 3 screen 18; V1): door list, live picture, Unlock / Hold Open, linked cameras. Camera, ring, contact and relay are separate facts. */
@customElement('explore-access')
export class ExploreAccess extends LitElement {
  @state() private selected = 'd1';

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .door {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border: 1.5px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      cursor: pointer;
      box-shadow: var(--sw-shadow-1);
      text-align: start;
      font: inherit;
      color: inherit;
    }
    .door.on {
      border-color: var(--sw-accent);
      box-shadow: 0 0 0 3px var(--sw-accent-soft);
    }
    .door .ic {
      display: grid;
      place-items: center;
      inline-size: 30px;
      block-size: 30px;
      border-radius: 8px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .door b {
      display: block;
      font-weight: var(--sw-fw-semibold);
    }
    .door small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .st {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .st i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .st.open i {
      background: var(--sw-danger);
    }
    .st.ring i {
      background: var(--sw-stale);
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-block: 10px;
    }
    .fact {
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      padding: 8px 10px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
    }
    .fact span {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-regular);
    }
    .linked {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    h4 {
      margin: 12px 0 8px;
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 1fr;
      }
      .facts {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `;

  render() {
    if (isApi()) {
      return html`<sw-page heading="דלתות ואינטרקום" subheading="V1 · מצלמה, צלצול, מגע דלת וממסר הם ארבעה נתונים שונים">
        <sw-state-panel data-access-pending state="empty" heading="אינטרקום ובקרת כניסה טרם חוברו" hint="המסך יופעל כשמערכת האינטרקום / בקרת הכניסה תחובר (T054): נדרשות ישויות Home Assistant של הדלת, הצלצול והממסר או תחנת דלת ב־go2rtc. עד אז מעברי דלתות ומנעולים מחיישני HA מופיעים במרכז האירועים ועל המפה."></sw-state-panel>
      </sw-page>`;
    }
    const d = DOORS.find((x) => x.id === this.selected) ?? DOORS[0];
    return html`
      <sw-page heading="דלתות ואינטרקום" subheading="V1 · מצלמה, צלצול, מגע דלת וממסר הם ארבעה נתונים שונים · נתוני הדגמה">
        <sw-tabs .items=${[{ id: 'doors', label: 'דלתות', count: 4 }, { id: 'intercom', label: 'אינטרקום', count: 1 }, { id: 'linked', label: 'מצלמות מקושרות', count: 4 }]} active="doors"></sw-tabs>
        <div class="layout">
          <div class="list">
            ${DOORS.map(
              (x) => html`<button class="door ${x.id === this.selected ? 'on' : ''}" @click=${() => (this.selected = x.id)} aria-pressed=${x.id === this.selected}>
                <div class="ic"><sw-icon name=${x.lock === 'נעול' ? 'lock' : 'unlock'} size=${15}></sw-icon></div>
                <div style="flex:1"><b>${x.name}</b><small>${x.kind}</small></div>
                <span class="st ${x.ringing ? 'ring' : x.lock === 'נעול' ? '' : 'open'}"><i></i>${x.ringing ? 'מצלצל' : x.lock}</span>
              </button>`,
            )}
          </div>
          <sw-card heading=${d.name} subheading=${d.kind}>
            <sw-camera-tile name="מצלמת הדלת" state="live" scene=${d.scene}></sw-camera-tile>
            <div class="facts">
              <div class="fact"><span>מנעול</span>${d.lock}</div>
              <div class="fact"><span>מגע דלת</span>${d.contact}</div>
              <div class="fact"><span>ממסר</span>${d.relay}</div>
              <div class="fact"><span>צלצול</span>${d.ringing ? 'כן' : 'לא'}</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <sw-button variant="primary" icon="unlock" disabled>פתח דלת</sw-button>
              <sw-button icon="clock" disabled>השאר פתוח</sw-button>
              <sw-button variant="ghost" icon="history">אירועי הדלת</sw-button>
            </div>
            <div class="note" style="margin-block-start:8px">פתיחה דורשת grant מפורש (<span class="ltr">door.unlock</span>), הרשאת HA של המשתמש, אישור מפורש ורישום באודיט. אין שליחה חוזרת אחרי timeout או reconnect.</div>
            <h4>מצלמות מקושרות (2)</h4>
            <div class="linked">
              <sw-camera-tile compact name="כניסה ראשית" state="live" scene="entrance"></sw-camera-tile>
              <sw-camera-tile compact name="לובי" state="live" scene="lobby"></sw-camera-tile>
            </div>
          </sw-card>
        </div>
      </sw-page>
    `;
  }
}
