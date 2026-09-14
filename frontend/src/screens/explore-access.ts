import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-camera-tile';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-icon';

const DOORS = [
  { id: 'd1', name: 'כניסה ראשית', kind: 'דלת זכוכית', lock: 'נעול', contact: 'סגור', relay: 'לא פעיל', ringing: false },
  { id: 'd2', name: 'לובי', kind: 'דלת פנימית', lock: 'פתוח', contact: 'פתוח', relay: 'לא פעיל', ringing: false },
  { id: 'd3', name: 'אינטרקום M2', kind: 'עמדת דלת', lock: 'נעול', contact: 'סגור', relay: 'לא פעיל', ringing: true },
  { id: 'd4', name: 'מחסן', kind: 'דלת שירות', lock: 'נעול', contact: 'סגור', relay: 'לא פעיל', ringing: false },
];

/** SC23 — door and intercom (board 3 screen 18; V1): camera, ring, contact and relay are separate facts. */
@customElement('explore-access')
export class ExploreAccess extends LitElement {
  @state() private selected = 'd1';

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: 300px minmax(0, 1fr);
      gap: var(--sw-s-4);
      align-items: start;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
    }
    .door {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      padding: var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      cursor: pointer;
    }
    .door.on {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .door .ic {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: var(--sw-s-2);
      margin-block: var(--sw-s-3);
    }
    .fact {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      padding: var(--sw-s-2) var(--sw-s-3);
      font-size: var(--sw-fs-sm);
    }
    .fact span {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .linked {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sw-s-3);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    const d = DOORS.find((x) => x.id === this.selected) ?? DOORS[0];
    return html`
      <sw-page heading="דלתות ואינטרקום" subheading="V1 · מצלמה, צלצול, מגע דלת וממסר הם ארבעה נתונים שונים · נתוני הדגמה">
        <div class="layout">
          <div class="list">
            ${DOORS.map(
              (x) => html`<div class="door ${x.id === this.selected ? 'on' : ''}" @click=${() => (this.selected = x.id)}>
                <div class="ic"><sw-icon name=${x.lock === 'נעול' ? 'lock' : 'unlock'} size=${18}></sw-icon></div>
                <div style="flex:1"><div style="font-weight:600">${x.name}</div><div class="note">${x.kind}</div></div>
                ${x.ringing ? html`<sw-badge kind="stale" label="מצלצל"></sw-badge>` : html`<sw-badge kind=${x.lock === 'נעול' ? 'neutral' : 'live'} label=${x.lock}></sw-badge>`}
              </div>`,
            )}
          </div>
          <div>
            <sw-card heading=${d.name}>
              <sw-camera-tile name="מצלמת הדלת" meta="Live" state="live"></sw-camera-tile>
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
            </sw-card>
            <div style="margin-block-start:var(--sw-s-4)">
              <div style="font-weight:600;margin-block-end:8px">מצלמות מקושרות (2)</div>
              <div class="linked">
                <sw-camera-tile compact name="כניסה ראשית" meta="Live" state="live"></sw-camera-tile>
                <sw-camera-tile compact name="לובי" meta="Live" state="live"></sw-camera-tile>
              </div>
            </div>
          </div>
        </div>
      </sw-page>
    `;
  }
}
