import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-badge';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-field';
import '../components/sw-steps';
import '../components/sw-icon';
import { demoRules } from '../fixtures/catalog';
import { navigate } from '../router';

/** SC21 — rules and alerts (board 3 screen 19, Beta). */
@customElement('investigate-rules')
export class InvestigateRules extends LitElement {
  static styles = css`
    .rule {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) auto auto;
      gap: var(--sw-s-3);
      align-items: center;
      padding: var(--sw-s-3) 0;
      border-block-end: 1px solid var(--sw-border);
      cursor: pointer;
    }
    .rule:last-child {
      border-block-end: 0;
    }
    .ic {
      display: grid;
      place-items: center;
      inline-size: 40px;
      block-size: 40px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .meta {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    @media (max-width: 767px) {
      .rule {
        grid-template-columns: 40px minmax(0, 1fr);
      }
    }
  `;

  render() {
    return html`
      <sw-page heading="חוקים והתראות" subheading="Trigger → Scope → תנאים → פעולה · בדיקה יבשה לפני הפעלה · נתוני הדגמה">
        <sw-button slot="actions" variant="primary" icon="plus" @click=${() => navigate('/investigate/rules/new')}>חוק חדש</sw-button>
        <sw-card>
          ${demoRules.map(
            (r) => html`<div class="rule" @click=${() => navigate(`/investigate/rules/${r.id}`)}>
              <div class="ic"><sw-icon name="rule" size=${20}></sw-icon></div>
              <div><strong>${r.name}</strong><div class="meta">${r.trigger} · ${r.scope} · ${r.action}</div></div>
              <span class="meta">הופעל לאחרונה: ${r.last}</span>
              <sw-toggle ?checked=${r.enabled} label=${r.enabled ? 'פעיל' : 'כבוי'} @click=${(e: Event) => e.stopPropagation()}></sw-toggle>
            </div>`,
          )}
        </sw-card>
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
      gap: var(--sw-s-4);
      align-items: start;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--sw-s-3);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .dry {
      font-size: var(--sw-fs-sm);
      padding: var(--sw-s-2) 0;
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
      <sw-page heading=${r.name} subheading="עורך חוק · גרסה 2 · נתוני הדגמה">
        <sw-button slot="actions" icon="play">בדיקה יבשה</sw-button>
        <sw-button slot="actions" variant="primary" icon="check">שמירה</sw-button>
        <sw-steps .steps=${['Trigger', 'Scope', 'תנאים', 'פעולה']} .current=${1}></sw-steps>
        <div class="layout">
          <div class="stack">
            <sw-card heading="Trigger">
              <div class="two">
                <sw-field label="מקור"><select><option>אירוע NVR</option><option>שינוי HA</option></select></sw-field>
                <sw-field label="סוג"><select><option>${r.trigger}</option><option>זיהוי רכב</option><option>תנועה</option></select></sw-field>
              </div>
            </sw-card>
            <sw-card heading="Scope">
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
