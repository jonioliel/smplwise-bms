import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-field';
import '../components/sw-steps';
import '../components/sw-tabs';
import '../components/sw-icon';
import type { IconName } from '../components/sw-icon';
import { demoRules } from '../fixtures/catalog';
import { navigate } from '../router';

const RULE_ICON: Record<string, { icon: IconName; bg: string; fg: string }> = {
  'r-1': { icon: 'user', bg: '#eaf0ff', fg: '#2f6bff' },
  'r-2': { icon: 'move', bg: '#e8f8ee', fg: '#16a34a' },
  'r-3': { icon: 'door', bg: '#fff4e0', fg: '#d97706' },
  'r-4': { icon: 'offline', bg: '#fdecec', fg: '#ef4444' },
};

/** SC21 — alerts & automation rules (board 3 screen 19): tabs, rule cards with icon square, toggle, Edit, ⋯. */
@customElement('investigate-rules')
export class InvestigateRules extends LitElement {
  @state() private tab = 'rules';

  static styles = css`
    .list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-inline-size: 860px;
    }
    .rule {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
    }
    .ic {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 9px;
      background: var(--bg);
      color: var(--fg);
      flex-shrink: 0;
    }
    .txt {
      flex: 1;
      min-inline-size: 0;
    }
    .txt b {
      display: block;
      font-weight: var(--sw-fw-semibold);
    }
    .txt small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .last {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      white-space: nowrap;
    }
    .empty {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
      padding: 24px;
      text-align: center;
    }
    @media (max-width: 767px) {
      .last {
        display: none;
      }
    }
  `;

  render() {
    return html`
      <sw-page heading="התראות וחוקי אוטומציה" subheading="Trigger → היקף → תנאים → פעולה · בדיקה יבשה לפני הפעלה · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus" @click=${() => navigate('/investigate/rules/new')}>חוק חדש</sw-button>
        <sw-tabs .items=${[{ id: 'rules', label: 'חוקים', count: demoRules.length }, { id: 'notif', label: 'התראות' }, { id: 'sched', label: 'לוחות זמנים' }, { id: 'trig', label: 'Triggers' }]} .active=${this.tab} @change=${(e: CustomEvent<{ id: string }>) => (this.tab = e.detail.id)}></sw-tabs>
        ${this.tab === 'rules'
          ? html`<div class="list">
              ${demoRules.map((r) => {
                const ic = RULE_ICON[r.id] ?? RULE_ICON['r-1'];
                return html`<sw-card flush class="rule" style="--bg:${ic.bg};--fg:${ic.fg}">
                  <div class="ic"><sw-icon .name=${ic.icon} size=${16}></sw-icon></div>
                  <div class="txt"><b>${r.name}</b><small>${r.trigger} · ${r.scope} · ${r.action}</small></div>
                  <span class="last">הופעל: ${r.last}</span>
                  <sw-toggle ?checked=${r.enabled} label=""></sw-toggle>
                  <sw-button size="sm" @click=${() => navigate(`/investigate/rules/${r.id}`)}>עריכה</sw-button>
                  <sw-button variant="ghost" size="sm" iconOnly icon="more" label="עוד"></sw-button>
                </sw-card>`;
              })}
            </div>`
          : html`<sw-card><div class="empty">${this.tab === 'notif' ? 'ערוצי התראה: Push דרך HA, מייל (Beta). ההגדרה מגיעה עם T063.' : this.tab === 'sched' ? 'לוחות זמנים בזמן האתר (Asia/Jerusalem), שעון קיץ לפי התאריך.' : 'Triggers זמינים: אירועי NVR (אדם, רכב, תנועה, חציית קו, ניתוק) ושינויי מצב HA (allowlist).'}</div></sw-card>`}
      </sw-page>
    `;
  }
}

/** SC22 — rule editor with dry run and loop prevention. */
@customElement('investigate-rule-editor')
export class InvestigateRuleEditor extends LitElement {
  @property() ruleId = 'r-1';

  static styles = css`
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr);
      gap: 12px;
      align-items: start;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .dry {
      font-size: var(--sw-fs-sm);
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `;

  render() {
    const r = demoRules.find((x) => x.id === this.ruleId) ?? { name: 'חוק חדש', trigger: 'זיהוי אדם', scope: 'חוץ', action: 'התראה' };
    return html`
      <sw-page heading=${r.name} subheading="עורך חוק · גרסה 2 · נתוני הדגמה" crumbs="אירועים | חוקים והתראות">
        <sw-button slot="actions" icon="play">בדיקה יבשה</sw-button>
        <sw-button slot="actions" variant="primary" icon="check">שמירה</sw-button>
        <sw-steps .steps=${['Trigger', 'היקף', 'תנאים', 'פעולה']} .current=${1}></sw-steps>
        <div class="layout">
          <div class="stack">
            <sw-card heading="Trigger">
              <div class="two">
                <sw-field label="מקור"><select><option>אירוע NVR</option><option>שינוי HA</option></select></sw-field>
                <sw-field label="סוג"><select><option>${r.trigger}</option><option>זיהוי רכב</option><option>תנועה</option></select></sw-field>
              </div>
            </sw-card>
            <sw-card heading="היקף">
              <div class="two">
                <sw-field label="היקף"><select><option>${r.scope}</option><option>כל האתר</option></select></sw-field>
                <sw-field label="לוח זמנים (זמן האתר)"><input value="22:00–06:00" data-ltr /></sw-field>
              </div>
            </sw-card>
            <sw-card heading="תנאים">
              <sw-field label="חלון סמיכות"><input value="90 שניות" /></sw-field>
              <div class="hint">״אירועים סמוכים בזמן ובאזור״, לא הוכחה סיבתית. החלון מתחשב באיחור שעון ובזמן קליטה.</div>
            </sw-card>
            <sw-card heading="פעולה">
              <div class="two">
                <sw-field label="פעולה"><select><option>${r.action}</option><option>Push דרך HA</option><option>פתיחת תצוגת מצלמות</option></select></sw-field>
                <sw-field label="Cooldown"><input value="5 דקות" /></sw-field>
              </div>
              <div class="hint">unlock / disarm אינם מופעלים על סמך תוצאת AI. שליטה אוטומטית היא opt-in לפי allowlist.</div>
            </sw-card>
          </div>
          <div class="stack">
            <sw-card heading="בדיקה יבשה על 24 שעות">
              <div class="dry">10:14 · כניסה ראשית · <sw-badge kind="live" label="היה מפעיל"></sw-badge></div>
              <div class="dry">09:42 · חצר · <sw-badge kind="neutral" label="מחוץ ללוח הזמנים"></sw-badge></div>
              <div class="dry">אתמול 23:10 · לובי · <sw-badge kind="live" label="היה מפעיל"></sw-badge></div>
              <div class="hint" style="margin-block-start:8px">2 הפעלות · 0 כפילויות · correlation id לכל אירוע · מניעת לולאה: פעולה שיצרה אירוע לא מפעילה את אותו חוק.</div>
            </sw-card>
          </div>
        </div>
      </sw-page>
    `;
  }
}
